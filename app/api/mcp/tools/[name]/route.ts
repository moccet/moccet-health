/**
 * HTTP API Wrapper for MCP Tools
 *
 * Exposes MCP tools via HTTP for Flutter and other clients.
 * Tools require authentication and may require approval for higher-risk actions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// Supabase client
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Tool risk levels
const TOOL_RISK_LEVELS: Record<string, 'low' | 'medium' | 'high'> = {
  calendar_find_slots: 'low',
  calendar_create_event: 'medium',
  spotify_create_playlist: 'low',
  spotify_add_tracks: 'low',
  supplements_search: 'low',
  supplements_recommend: 'low',
  shopping_search: 'low',
  shopping_add_to_cart: 'medium',
  shopping_purchase: 'high',
  booking_find_providers: 'low',
  booking_check_insurance: 'low',
  booking_schedule: 'high',
};

// Import tool handlers from MCP server
const getMcpToolHandlers = async () => {
  try {
    const { toolHandlers } = await import('../../../../../../mcp-server/src/tools/index.js');
    return toolHandlers;
  } catch (error) {
    console.error('Failed to import MCP tool handlers:', error);
    return null;
  }
};

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

  // Dev mode fallback
  if (process.env.NODE_ENV === 'development') {
    const body = await request.clone().json().catch(() => ({}));
    return body.userEmail || null;
  }

  return null;
}

// Log tool execution
async function logToolExecution(
  userEmail: string,
  toolName: string,
  args: any,
  result: any,
  riskLevel: string
) {
  try {
    await supabase.from('agent_action_log').insert({
      user_email: userEmail,
      action_type: 'tool_call',
      action_name: toolName,
      action_args: args,
      action_result: result,
      risk_level: riskLevel,
      source: 'mcp_http_api',
    });
  } catch (error) {
    console.warn('Failed to log tool execution:', error);
  }
}

/**
 * POST /api/mcp/tools/[name]
 *
 * Call an MCP tool with arguments.
 *
 * Request body:
 * {
 *   "args": { ... tool-specific arguments ... },
 *   "skipApproval": false  // Optional: skip approval for testing
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    // Get user email
    const userEmail = await getUserEmail(request);
    if (!userEmail) {
      return NextResponse.json(
        { error: 'Unauthorized. Please provide a valid authentication token.' },
        { status: 401 }
      );
    }

    const { name: toolName } = await params;
    const body = await request.json();
    const { args = {}, skipApproval = false } = body;

    // Get tool handlers
    const handlers = await getMcpToolHandlers();
    if (!handlers) {
      return NextResponse.json(
        { error: 'MCP tool handlers not available. Server configuration error.' },
        { status: 500 }
      );
    }

    // Find handler
    const handler = handlers[toolName];
    if (!handler) {
      return NextResponse.json(
        {
          error: `Unknown tool: ${toolName}`,
          availableTools: Object.keys(handlers),
        },
        { status: 404 }
      );
    }

    // Check risk level
    const riskLevel = TOOL_RISK_LEVELS[toolName] || 'medium';

    // For high/medium risk tools, check if approval is needed
    if ((riskLevel === 'high' || riskLevel === 'medium') && !skipApproval) {
      // Check if there's a pending approval for this action
      const { data: pendingApproval } = await supabase
        .from('agent_approval_requests')
        .select('id, status')
        .eq('user_email', userEmail)
        .eq('tool_name', toolName)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // If no approval exists for high-risk tools, require one
      if (riskLevel === 'high' && !pendingApproval) {
        // Create approval request
        const { data: approvalRequest } = await supabase
          .from('agent_approval_requests')
          .insert({
            user_email: userEmail,
            tool_name: toolName,
            tool_args: args,
            risk_level: riskLevel,
            status: 'pending',
          })
          .select('id')
          .single();

        return NextResponse.json(
          {
            requiresApproval: true,
            approvalId: approvalRequest?.id,
            toolName,
            riskLevel,
            message: `This action requires approval. Please approve via /api/mcp/tools/approve`,
          },
          { status: 202 }
        );
      }
    }

    // Build config
    const config = {
      supabaseUrl,
      supabaseKey: supabaseServiceKey,
      userEmail,
      baseUrl: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
    };

    // Execute tool
    const result = await handler(args, config);

    // Log execution
    await logToolExecution(userEmail, toolName, args, result, riskLevel);

    return NextResponse.json({
      success: true,
      toolName,
      riskLevel,
      result,
    });
  } catch (error) {
    console.error('MCP tool error:', error);
    return NextResponse.json(
      {
        error: 'Tool execution failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/mcp/tools/[name]
 *
 * Get information about a specific tool.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name: toolName } = await params;
  const riskLevel = TOOL_RISK_LEVELS[toolName] || 'unknown';

  const handlers = await getMcpToolHandlers();
  const exists = handlers ? toolName in handlers : false;

  if (!exists) {
    return NextResponse.json(
      { error: `Unknown tool: ${toolName}` },
      { status: 404 }
    );
  }

  return NextResponse.json({
    name: toolName,
    riskLevel,
    requiresApproval: riskLevel === 'high' || riskLevel === 'medium',
    endpoint: `/api/mcp/tools/${toolName}`,
    method: 'POST',
  });
}
