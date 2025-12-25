/**
 * MCP Tool Approval Endpoint
 *
 * Handles approving or rejecting high-risk tool actions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Get user email from auth
async function getUserEmail(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (!error && user?.email) {
      return user.email;
    }
  }

  const cookieStore = await cookies();
  const accessToken = cookieStore.get('sb-access-token')?.value;
  if (accessToken) {
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (!error && user?.email) {
      return user.email;
    }
  }

  return null;
}

// Import tool handlers
const getMcpToolHandlers = async () => {
  try {
    const { toolHandlers } = await import('../../../../../mcp-server/src/tools/index');
    return toolHandlers;
  } catch (error) {
    console.error('Failed to import MCP tool handlers:', error);
    return null;
  }
};

/**
 * POST /api/mcp/approve
 *
 * Approve or reject a pending tool action.
 *
 * Request body:
 * {
 *   "approvalId": "uuid",
 *   "approved": true,
 *   "feedback": "optional feedback"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const userEmail = await getUserEmail(request);
    if (!userEmail) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { approvalId, approved, feedback } = await request.json();

    if (!approvalId) {
      return NextResponse.json(
        { error: 'approvalId is required' },
        { status: 400 }
      );
    }

    // Get the approval request
    const { data: approvalRequest, error: fetchError } = await supabase
      .from('agent_approval_requests')
      .select('*')
      .eq('id', approvalId)
      .eq('user_email', userEmail)
      .single();

    if (fetchError || !approvalRequest) {
      return NextResponse.json(
        { error: 'Approval request not found' },
        { status: 404 }
      );
    }

    if (approvalRequest.status !== 'pending') {
      return NextResponse.json(
        { error: 'Approval request already processed' },
        { status: 400 }
      );
    }

    // Update the approval request
    const newStatus = approved ? 'approved' : 'rejected';
    await supabase
      .from('agent_approval_requests')
      .update({
        status: newStatus,
        user_response_at: new Date().toISOString(),
      })
      .eq('id', approvalId);

    // Record the decision in action preferences for learning
    await supabase.from('user_action_preferences').insert({
      user_email: userEmail,
      action_type: approvalRequest.tool_name,
      action_pattern: approvalRequest.tool_args,
      approved,
      user_feedback: feedback,
    });

    // If approved, execute the tool
    if (approved) {
      const handlers = await getMcpToolHandlers();
      if (!handlers) {
        return NextResponse.json(
          { error: 'Tool handlers not available' },
          { status: 500 }
        );
      }

      const handler = handlers[approvalRequest.tool_name];
      if (!handler) {
        return NextResponse.json(
          { error: 'Tool not found' },
          { status: 404 }
        );
      }

      // Build config
      const config = {
        supabaseUrl,
        supabaseKey: supabaseServiceKey,
        userEmail,
        baseUrl: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
      };

      // Execute the tool
      const result = await handler(approvalRequest.tool_args, config);

      // Log execution
      await supabase.from('agent_action_log').insert({
        user_email: userEmail,
        action_type: 'tool_call',
        action_name: approvalRequest.tool_name,
        action_args: approvalRequest.tool_args,
        action_result: result,
        risk_level: approvalRequest.risk_level,
        source: 'mcp_http_api_approved',
      });

      return NextResponse.json({
        success: true,
        approved: true,
        toolName: approvalRequest.tool_name,
        result,
      });
    }

    // Rejected
    return NextResponse.json({
      success: true,
      approved: false,
      message: 'Action was rejected',
    });
  } catch (error) {
    console.error('Approval error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process approval',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/mcp/approve
 *
 * Get pending approval requests for the current user.
 */
export async function GET(request: NextRequest) {
  try {
    const userEmail = await getUserEmail(request);
    if (!userEmail) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { data: pendingApprovals } = await supabase
      .from('agent_approval_requests')
      .select('*')
      .eq('user_email', userEmail)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    return NextResponse.json({
      pending: pendingApprovals || [],
      count: (pendingApprovals || []).length,
    });
  } catch (error) {
    console.error('Error fetching approvals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch approvals' },
      { status: 500 }
    );
  }
}
