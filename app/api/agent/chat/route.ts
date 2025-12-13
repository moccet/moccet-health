/**
 * Agent Chat Endpoint
 *
 * Main endpoint for conversational AI with memory-aware personalization.
 * Used by Flutter app and web clients for health assistant interactions.
 */

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createHealthAgent, AgentState } from '@/lib/agents/health-agent';
import { UserMemoryService } from '@/lib/services/memory/user-memory';
import { buildMemoryAwarePrompt } from '@/lib/agents/prompts';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

  // Dev mode: allow email in body
  if (process.env.NODE_ENV === 'development') {
    const body = await request.clone().json().catch(() => ({}));
    return body.userEmail || null;
  }

  return null;
}

/**
 * POST /api/agent/chat
 *
 * Send a message to the health agent and receive a streaming response.
 *
 * Request body:
 * {
 *   "message": "How can I improve my sleep?",
 *   "threadId": "optional-thread-id",
 *   "userEmail": "dev-mode-only"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const userEmail = await getUserEmail(request);
    if (!userEmail) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized. Please sign in.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json();
    const { message, threadId: providedThreadId } = body;

    if (!message) {
      return new Response(
        JSON.stringify({ error: 'message is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Generate or use provided thread ID
    const threadId = providedThreadId || `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Initialize memory service
    const memoryService = new UserMemoryService();

    // Get user's memory context for personalization
    const memoryContext = await memoryService.getMemoryContext(userEmail);

    // Get existing conversation if continuing a thread
    const existingConversation = providedThreadId
      ? await memoryService.getConversation(providedThreadId)
      : null;

    // Build memory-aware system prompt
    const memoryPrompt = buildMemoryAwarePrompt(memoryContext);

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: string, data: any) => {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        };

        try {
          // Create agent
          const agent = createHealthAgent();

          // Build conversation history
          const conversationMessages = existingConversation?.messages || [];
          conversationMessages.push({
            role: 'user',
            content: message,
            timestamp: new Date().toISOString(),
          });

          // Initial state with memory context
          const initialState: Partial<AgentState> = {
            taskId: threadId,
            userEmail,
            task: message,
            userContext: {
              memory: memoryContext,
              memoryPrompt,
              conversationHistory: conversationMessages,
            },
            currentStep: 0,
            maxSteps: 15,
          };

          // Send start event
          sendEvent('start', {
            threadId,
            hasMemory: memoryContext.facts.length > 0,
            communicationStyle: memoryContext.style,
          });

          let finalResponse = '';
          let agentReasoning: any[] = [];

          // Stream agent execution
          for await (const event of agent.stream(initialState)) {
            const nodeNames = Object.keys(event);

            for (const nodeName of nodeNames) {
              const nodeState = event[nodeName];

              // Send reasoning steps
              if (nodeState.reasoning && nodeState.reasoning.length > 0) {
                const latestReasoning = nodeState.reasoning[nodeState.reasoning.length - 1];
                agentReasoning.push(latestReasoning);
                sendEvent('reasoning', latestReasoning);
              }

              // Send tool results
              if (nodeState.toolResults && nodeState.toolResults.length > 0) {
                const latestResult = nodeState.toolResults[nodeState.toolResults.length - 1];
                sendEvent('tool_result', {
                  tool: latestResult.tool,
                  success: latestResult.success,
                });
              }

              // Check if awaiting approval
              if (nodeState.awaitingApproval && nodeState.pendingToolCall) {
                sendEvent('approval_needed', {
                  toolName: nodeState.pendingToolCall.name,
                  toolArgs: nodeState.pendingToolCall.args,
                  reasoning: nodeState.pendingToolCall.reasoning,
                });
              }

              // Capture final response
              if (nodeState.status === 'completed' && nodeState.finalResult) {
                finalResponse = nodeState.finalResult.response || nodeState.finalResult;
              }

              // Send completion
              if (nodeState.status === 'completed') {
                sendEvent('complete', {
                  response: finalResponse,
                  threadId,
                });
              }

              // Send error
              if (nodeState.status === 'failed') {
                sendEvent('error', {
                  error: nodeState.error,
                });
              }
            }
          }

          // Save conversation to memory
          conversationMessages.push({
            role: 'assistant',
            content: finalResponse,
            timestamp: new Date().toISOString(),
          });

          await memoryService.saveConversation(
            userEmail,
            threadId,
            conversationMessages,
            extractTopic(message)
          );

          // Learn from the interaction
          await learnFromInteraction(memoryService, userEmail, message, finalResponse, agentReasoning);

          // Send end event
          sendEvent('end', { threadId });
        } catch (error) {
          console.error('Chat error:', error);
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
    console.error('Error in agent chat:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Extract a topic from the user's message
 */
function extractTopic(message: string): string {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes('sleep')) return 'Sleep';
  if (lowerMessage.includes('glucose') || lowerMessage.includes('sugar') || lowerMessage.includes('cgm')) return 'Glucose';
  if (lowerMessage.includes('supplement') || lowerMessage.includes('vitamin')) return 'Supplements';
  if (lowerMessage.includes('exercise') || lowerMessage.includes('workout') || lowerMessage.includes('fitness')) return 'Fitness';
  if (lowerMessage.includes('nutrition') || lowerMessage.includes('diet') || lowerMessage.includes('food') || lowerMessage.includes('eat')) return 'Nutrition';
  if (lowerMessage.includes('stress') || lowerMessage.includes('anxiety')) return 'Stress';
  if (lowerMessage.includes('hrv') || lowerMessage.includes('recovery')) return 'Recovery';
  if (lowerMessage.includes('blood') || lowerMessage.includes('biomarker')) return 'Blood Work';

  return 'General';
}

/**
 * Learn from the interaction to improve future responses
 */
async function learnFromInteraction(
  memoryService: UserMemoryService,
  userEmail: string,
  userMessage: string,
  agentResponse: string,
  reasoning: any[]
) {
  try {
    // Analyze the conversation for learnable facts
    const lowerMessage = userMessage.toLowerCase();

    // Learn preferences mentioned in the message
    if (lowerMessage.includes("i don't like") || lowerMessage.includes("i hate")) {
      const match = userMessage.match(/(?:i don't like|i hate)\s+(.+?)(?:\.|,|$)/i);
      if (match) {
        await memoryService.learnFact(
          userEmail,
          'preference',
          `dislikes_${match[1].trim().replace(/\s+/g, '_')}`,
          `Does not like ${match[1].trim()}`,
          'conversation',
          0.7
        );
      }
    }

    if (lowerMessage.includes('i prefer') || lowerMessage.includes('i like')) {
      const match = userMessage.match(/(?:i prefer|i like)\s+(.+?)(?:\.|,|$)/i);
      if (match) {
        await memoryService.learnFact(
          userEmail,
          'preference',
          `prefers_${match[1].trim().replace(/\s+/g, '_')}`,
          `Prefers ${match[1].trim()}`,
          'conversation',
          0.7
        );
      }
    }

    // Learn goals mentioned
    if (lowerMessage.includes('i want to') || lowerMessage.includes('my goal is')) {
      const match = userMessage.match(/(?:i want to|my goal is)\s+(.+?)(?:\.|,|$)/i);
      if (match) {
        await memoryService.learnFact(
          userEmail,
          'goal',
          `goal_${Date.now()}`,
          match[1].trim(),
          'conversation',
          0.8
        );
      }
    }

    // Learn allergies or constraints
    if (lowerMessage.includes('allergic to') || lowerMessage.includes("can't eat") || lowerMessage.includes("can't have")) {
      const match = userMessage.match(/(?:allergic to|can't eat|can't have)\s+(.+?)(?:\.|,|$)/i);
      if (match) {
        await memoryService.learnFact(
          userEmail,
          'allergy',
          match[1].trim().replace(/\s+/g, '_'),
          `Cannot have ${match[1].trim()}`,
          'conversation',
          0.9
        );
      }
    }

    // Track if health advice was given (for outcome tracking later)
    const advicePatterns = [
      { pattern: /recommend.*(\d+)\s*(mg|iu|mcg)/i, type: 'supplement' },
      { pattern: /try.*sleeping.*(\d+)/i, type: 'sleep' },
      { pattern: /eat.*before|after.*workout/i, type: 'nutrition' },
      { pattern: /exercise.*(\d+).*times.*week/i, type: 'exercise' },
    ];

    for (const { pattern, type } of advicePatterns) {
      if (pattern.test(agentResponse)) {
        // Extract the metric that should be tracked
        const metricMap: Record<string, string> = {
          supplement: 'blood_biomarkers',
          sleep: 'sleep_score',
          nutrition: 'glucose_avg',
          exercise: 'hrv',
        };

        await memoryService.trackAdvice(userEmail, {
          advice_type: type,
          advice_given: agentResponse.substring(0, 500),
          advice_summary: `${type} advice given`,
          metric_name: metricMap[type] || 'general',
          check_after_days: 14,
        });
        break;
      }
    }
  } catch (error) {
    console.warn('Failed to learn from interaction:', error);
    // Don't throw - learning failures shouldn't break the chat
  }
}
