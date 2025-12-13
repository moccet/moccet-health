/**
 * Agent Resume Endpoint
 *
 * Resumes agent execution after user approval/rejection
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHealthAgent, AgentState } from '@/lib/agents/health-agent';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/agent/resume
 *
 * Resume a paused agent execution
 *
 * Body: {
 *   executionId: string,
 *   userEmail: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { executionId, userEmail } = body;

    if (!executionId || !userEmail) {
      return NextResponse.json(
        { error: 'executionId and userEmail are required' },
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

    // Check if there's an approval decision
    const { data: decision } = await supabase
      .from('agent_approval_decisions')
      .select('*')
      .eq('execution_id', executionId)
      .order('decided_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!decision) {
      return NextResponse.json(
        { error: 'No approval decision found for this execution' },
        { status: 400 }
      );
    }

    // Update execution status
    await supabase
      .from('agent_executions')
      .update({
        status: 'running',
        pending_approval: null,
      })
      .eq('id', executionId);

    // Get the checkpoint/state
    const { data: checkpoint } = await supabase
      .from('agent_checkpoints')
      .select('*')
      .eq('thread_id', execution.thread_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Reconstruct state
    const state: Partial<AgentState> = checkpoint?.checkpoint || {
      taskId: execution.task_id,
      userEmail: execution.user_email,
      task: execution.task || '',
      reasoning: execution.reasoning_steps || [],
      toolResults: execution.tool_calls || [],
      pendingToolCall: execution.pending_approval,
      currentStep: (execution.reasoning_steps?.length || 0),
      maxSteps: 15,
    };

    // Update state with approval decision
    if (decision.approved) {
      (state as AgentState).approvedToolCallIds = [
        ...((state as AgentState).approvedToolCallIds || []),
        decision.tool_call_id,
      ];
    } else {
      (state as AgentState).rejectedToolCallIds = [
        ...((state as AgentState).rejectedToolCallIds || []),
        decision.tool_call_id,
      ];
    }

    (state as AgentState).awaitingApproval = false;
    (state as AgentState).status = 'running';

    // Continue execution
    const agent = createHealthAgent();
    const finalState = await agent.invoke(state);

    // Update execution with final state
    await supabase
      .from('agent_executions')
      .update({
        status: finalState.status,
        reasoning_steps: finalState.reasoning,
        tool_calls: finalState.toolResults,
        final_result: finalState.finalResult,
        completed_at:
          finalState.status === 'completed' || finalState.status === 'failed'
            ? new Date().toISOString()
            : null,
        pending_approval:
          finalState.status === 'awaiting_approval'
            ? finalState.pendingToolCall
            : null,
      })
      .eq('id', executionId);

    // If still awaiting approval, create new approval request
    if (finalState.status === 'awaiting_approval' && finalState.pendingToolCall) {
      await supabase.from('agent_approval_requests').insert({
        execution_id: executionId,
        tool_name: finalState.pendingToolCall.name,
        tool_args: finalState.pendingToolCall.args,
        risk_level: getToolRiskLevel(finalState.pendingToolCall.name),
        status: 'pending',
      });
    }

    return NextResponse.json({
      success: true,
      status: finalState.status,
      reasoning: finalState.reasoning,
      result: finalState.finalResult,
      pendingApproval:
        finalState.status === 'awaiting_approval'
          ? finalState.pendingToolCall
          : null,
    });
  } catch (error) {
    console.error('Error in resume endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper to get risk level
function getToolRiskLevel(toolName: string): string {
  const riskLevels: Record<string, string> = {
    get_health_data: 'low',
    analyze_biomarkers: 'low',
    search_supplements: 'low',
    find_calendar_slots: 'low',
    search_products: 'low',
    find_health_providers: 'low',
    check_insurance: 'low',
    create_playlist: 'low',
    add_tracks_to_playlist: 'low',
    get_user_context: 'low',
    create_calendar_event: 'medium',
    update_calendar_event: 'medium',
    delete_calendar_event: 'medium',
    add_to_cart: 'medium',
    complete_purchase: 'high',
    book_appointment: 'high',
    cancel_appointment: 'high',
  };
  return riskLevels[toolName] || 'medium';
}
