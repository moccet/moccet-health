/**
 * Agent Approval Endpoint
 *
 * Handles user approval/rejection of agent tool calls
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/agent/approve
 *
 * Approve or reject a pending tool call
 *
 * Body: {
 *   executionId: string,
 *   toolCallId: string,
 *   approved: boolean,
 *   userEmail: string,
 *   feedback?: string  // Optional user feedback
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { executionId, toolCallId, approved, userEmail, feedback } = body;

    if (!executionId || !toolCallId || approved === undefined || !userEmail) {
      return NextResponse.json(
        { error: 'executionId, toolCallId, approved, and userEmail are required' },
        { status: 400 }
      );
    }

    // Get the execution
    const { data: execution, error: execError } = await supabase
      .from('agent_executions')
      .select('*')
      .eq('id', executionId)
      .eq('user_email', userEmail)
      .single();

    if (execError || !execution) {
      return NextResponse.json(
        { error: 'Execution not found' },
        { status: 404 }
      );
    }

    if (execution.status !== 'awaiting_approval') {
      return NextResponse.json(
        { error: 'Execution is not awaiting approval' },
        { status: 400 }
      );
    }

    // Update the approval request
    await supabase
      .from('agent_approval_requests')
      .update({
        status: approved ? 'approved' : 'rejected',
        user_response_at: new Date().toISOString(),
        user_feedback: feedback,
      })
      .eq('execution_id', executionId)
      .eq('status', 'pending');

    // Store the approval decision for the agent to pick up
    const pendingApproval = execution.pending_approval;
    if (pendingApproval) {
      // Update the checkpoint state with approval
      await supabase
        .from('agent_approval_decisions')
        .upsert({
          execution_id: executionId,
          tool_call_id: toolCallId,
          approved,
          feedback,
          decided_at: new Date().toISOString(),
        });
    }

    // Log the action
    await supabase.from('agent_action_log').insert({
      user_email: userEmail,
      action_type: approved ? 'tool_approved' : 'tool_rejected',
      details: {
        executionId,
        toolCallId,
        toolName: pendingApproval?.name,
        feedback,
      },
    });

    return NextResponse.json({
      success: true,
      approved,
      executionId,
      message: approved
        ? 'Tool call approved. Agent will continue execution.'
        : 'Tool call rejected. Agent will look for alternatives.',
    });
  } catch (error) {
    console.error('Error in approve endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/agent/approve
 *
 * Get pending approval requests for a user
 *
 * Query: ?email=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Get pending approvals
    const { data: pendingApprovals, error } = await supabase
      .from('agent_approval_requests')
      .select(`
        *,
        agent_executions (
          id,
          task_id,
          user_email,
          reasoning_steps
        )
      `)
      .eq('status', 'pending')
      .eq('agent_executions.user_email', email)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching pending approvals:', error);
      return NextResponse.json(
        { error: 'Failed to fetch pending approvals' },
        { status: 500 }
      );
    }

    // Format the response
    const formatted = (pendingApprovals || []).map((approval) => ({
      id: approval.id,
      executionId: approval.execution_id,
      toolName: approval.tool_name,
      toolArgs: approval.tool_args,
      riskLevel: approval.risk_level,
      createdAt: approval.created_at,
      reasoning: approval.agent_executions?.reasoning_steps?.slice(-1)[0]?.thought,
    }));

    return NextResponse.json({
      pendingApprovals: formatted,
      count: formatted.length,
    });
  } catch (error) {
    console.error('Error in GET approve endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
