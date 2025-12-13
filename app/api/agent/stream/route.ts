/**
 * Agent Streaming Endpoint
 *
 * Streams agent reasoning and actions to the client in real-time
 * using Server-Sent Events (SSE).
 */

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHealthAgent, AgentState } from '@/lib/agents/health-agent';
import { createCheckpointer } from '@/lib/agents/checkpointer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, userEmail, task, userContext, threadId } = body;

    if (!taskId || !userEmail || !task) {
      return new Response(
        JSON.stringify({ error: 'taskId, userEmail, and task are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: string, data: any) => {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        };

        try {
          // Create agent with checkpointer for persistence
          const checkpointer = createCheckpointer();
          const agent = createHealthAgent();

          // Compile with checkpointer
          const compiledAgent = agent; // Note: Add checkpointer in production

          // Initial state
          const initialState: Partial<AgentState> = {
            taskId,
            userEmail,
            task,
            userContext: userContext || {},
            currentStep: 0,
            maxSteps: 15,
          };

          // Send start event
          sendEvent('start', {
            taskId,
            threadId: threadId || `thread_${taskId}`,
            status: 'running',
          });

          // Record execution start
          const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

          await supabase.from('agent_executions').insert({
            id: executionId,
            task_id: taskId,
            user_email: userEmail,
            thread_id: threadId || `thread_${taskId}`,
            status: 'running',
            started_at: new Date().toISOString(),
          });

          // Stream agent execution
          for await (const event of compiledAgent.stream(initialState)) {
            // Extract the node name and state from the event
            const nodeNames = Object.keys(event);

            for (const nodeName of nodeNames) {
              const nodeState = event[nodeName];

              // Send reasoning steps
              if (nodeState.reasoning && nodeState.reasoning.length > 0) {
                const latestReasoning = nodeState.reasoning[nodeState.reasoning.length - 1];
                sendEvent('reasoning', {
                  step: latestReasoning.step,
                  thought: latestReasoning.thought,
                  action: latestReasoning.action,
                  observation: latestReasoning.observation,
                  timestamp: latestReasoning.timestamp,
                });
              }

              // Send tool results
              if (nodeState.toolResults && nodeState.toolResults.length > 0) {
                const latestResult = nodeState.toolResults[nodeState.toolResults.length - 1];
                sendEvent('tool_result', {
                  tool: latestResult.tool,
                  success: latestResult.success,
                  data: latestResult.data,
                  error: latestResult.error,
                });
              }

              // Check if awaiting approval
              if (nodeState.awaitingApproval && nodeState.pendingToolCall) {
                sendEvent('approval_needed', {
                  toolCallId: nodeState.pendingToolCall.id,
                  toolName: nodeState.pendingToolCall.name,
                  toolArgs: nodeState.pendingToolCall.args,
                  reasoning: nodeState.pendingToolCall.reasoning,
                  executionId,
                });

                // Update execution status
                await supabase
                  .from('agent_executions')
                  .update({
                    status: 'awaiting_approval',
                    pending_approval: nodeState.pendingToolCall,
                  })
                  .eq('id', executionId);

                // Create approval request
                await supabase.from('agent_approval_requests').insert({
                  execution_id: executionId,
                  tool_name: nodeState.pendingToolCall.name,
                  tool_args: nodeState.pendingToolCall.args,
                  risk_level: getToolRiskLevel(nodeState.pendingToolCall.name),
                  status: 'pending',
                });
              }

              // Check if completed
              if (nodeState.status === 'completed') {
                sendEvent('complete', {
                  success: true,
                  result: nodeState.finalResult,
                  reasoning: nodeState.reasoning,
                });

                // Update execution status
                await supabase
                  .from('agent_executions')
                  .update({
                    status: 'completed',
                    final_result: nodeState.finalResult,
                    reasoning_steps: nodeState.reasoning,
                    tool_calls: nodeState.toolResults,
                    completed_at: new Date().toISOString(),
                  })
                  .eq('id', executionId);
              }

              // Check if failed
              if (nodeState.status === 'failed') {
                sendEvent('error', {
                  error: nodeState.error,
                });

                // Update execution status
                await supabase
                  .from('agent_executions')
                  .update({
                    status: 'failed',
                    final_result: { error: nodeState.error },
                    completed_at: new Date().toISOString(),
                  })
                  .eq('id', executionId);
              }
            }
          }

          // Send end event
          sendEvent('end', { taskId });
        } catch (error) {
          console.error('Agent streaming error:', error);
          sendEvent('error', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error in agent stream:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
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
    search_tracks: 'low',
    get_spotify_recommendations: 'low',
    get_cart: 'low',
    create_calendar_event: 'medium',
    update_calendar_event: 'medium',
    delete_calendar_event: 'medium',
    add_to_cart: 'medium',
    send_notification: 'medium',
    complete_purchase: 'high',
    book_appointment: 'high',
    cancel_appointment: 'high',
  };
  return riskLevels[toolName] || 'medium';
}
