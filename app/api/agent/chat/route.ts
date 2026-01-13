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
import { runChefAgent } from '@/lib/agents/moccet-chef';
import { runTrainerAgent } from '@/lib/agents/moccet-trainer';
import { UserMemoryService } from '@/lib/services/memory/user-memory';
import { buildMemoryAwarePrompt } from '@/lib/agents/prompts';
import { generateSpeech, isElevenLabsConfigured, VoiceId } from '@/lib/services/tts-service';
import { getUserContext, formatContextForPrompt, getUserSubscriptionTier } from '@/lib/services/user-context-service';
import { saveMessage } from '@/lib/services/conversation-compactor';

// Agent types
type AgentType = 'moccet-chef' | 'moccet-trainer' | 'moccet-health' | 'moccet-orchestrator';

interface AgentInfo {
  type: AgentType;
  displayName: string;
  icon: string;
}

const AGENT_INFO: Record<AgentType, AgentInfo> = {
  'moccet-chef': {
    type: 'moccet-chef',
    displayName: 'Chef',
    icon: 'chef_hat',
  },
  'moccet-trainer': {
    type: 'moccet-trainer',
    displayName: 'Trainer',
    icon: 'fitness_center',
  },
  'moccet-health': {
    type: 'moccet-health',
    displayName: 'Health',
    icon: 'heart',
  },
  'moccet-orchestrator': {
    type: 'moccet-orchestrator',
    displayName: 'Orchestrator',
    icon: 'brain',
  },
};

/**
 * Classify which agent should handle the request
 */
function classifyAgentType(message: string): AgentType {
  const lowerMessage = message.toLowerCase();

  // Fitness/workout related - route to moccet-trainer
  const trainerKeywords = [
    'workout', 'workouts', 'exercise', 'exercises', 'gym', 'training', 'train',
    'lift', 'lifting', 'weights', 'strength', 'cardio', 'hiit', 'run', 'running',
    'push up', 'pushup', 'pull up', 'pullup', 'squat', 'deadlift', 'bench press',
    'muscle', 'muscles', 'fitness', 'fit', 'reps', 'sets', 'personal trainer',
    'leg day', 'arm day', 'chest day', 'back day', 'shoulder', 'bicep', 'tricep',
    'abs', 'core', 'glutes', 'quads', 'hamstring', 'stretch', 'stretching',
    'warm up', 'cool down', 'rest day', 'split', 'routine', 'program',
    'how many sets', 'how many reps', 'what exercises', 'build muscle',
    'lose fat', 'get stronger', 'bulk', 'cut', 'tone', 'toning',
  ];

  if (trainerKeywords.some(kw => lowerMessage.includes(kw))) {
    return 'moccet-trainer';
  }

  // Food/nutrition related - route to moccet-chef
  const chefKeywords = [
    'recipe', 'recipes', 'cook', 'cooking', 'meal', 'meals', 'food', 'foods',
    'eat', 'eating', 'breakfast', 'lunch', 'dinner', 'snack', 'nutrition',
    'nutritious', 'ingredient', 'ingredients', 'dish', 'dishes', 'cuisine',
    'healthy food', 'what should i eat', 'what can i make', 'what to cook',
    'hungry', 'dietary', 'diet', 'menu', 'protein', 'carbs', 'vegetables',
    'fruit', 'calories', 'vitamins', 'iron-rich', 'vitamin d', 'b12',
  ];

  if (chefKeywords.some(kw => lowerMessage.includes(kw))) {
    return 'moccet-chef';
  }

  // Default to orchestrator (which uses health agent for now)
  return 'moccet-orchestrator';
}

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
  console.log('[CHAT] ========== NEW CHAT REQUEST ==========');

  try {
    // Step 1: Quick validation - only do essential checks before streaming
    console.log('[CHAT] Step 1: Getting user email...');
    const userEmail = await getUserEmail(request);
    if (!userEmail) {
      console.log('[CHAT] ERROR: No user email found - unauthorized');
      return new Response(
        JSON.stringify({ error: 'Unauthorized. Please sign in.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
    console.log('[CHAT] User email:', userEmail);

    console.log('[CHAT] Step 2: Parsing request body...');
    const body = await request.json();
    const { message, threadId: providedThreadId, requestTTS, voiceId, requestedAgent, skipAcknowledgment = true } = body;
    console.log('[CHAT] Message:', message?.substring(0, 100));
    console.log('[CHAT] ThreadId:', providedThreadId);
    console.log('[CHAT] RequestTTS:', requestTTS);
    console.log('[CHAT] VoiceId:', voiceId);
    console.log('[CHAT] RequestedAgent:', requestedAgent);

    // Determine which agent should handle this request
    const agentType: AgentType = requestedAgent || classifyAgentType(message);
    const agentInfo = AGENT_INFO[agentType];
    console.log('[CHAT] Selected agent:', agentType);

    // Check if TTS is available
    const elevenLabsConfigured = isElevenLabsConfigured();
    const ttsEnabled = requestTTS && elevenLabsConfigured;
    console.log('[CHAT] TTS check - requestTTS:', requestTTS, 'elevenLabsConfigured:', elevenLabsConfigured, 'ttsEnabled:', ttsEnabled);
    if (requestTTS && !elevenLabsConfigured) {
      console.log('[CHAT] TTS requested but ELEVENLABS_API_KEY not configured');
      console.log('[CHAT] ELEVENLABS_API_KEY present:', !!process.env.ELEVENLABS_API_KEY);
      console.log('[CHAT] ELEVENLABS_API_KEY length:', process.env.ELEVENLABS_API_KEY?.length || 0);
    }

    if (!message) {
      console.log('[CHAT] ERROR: No message provided');
      return new Response(
        JSON.stringify({ error: 'message is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Generate or use provided thread ID
    const threadId = providedThreadId || `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('[CHAT] Using threadId:', threadId);

    const encoder = new TextEncoder();

    // Quick intent classification for smart acknowledgments
    const intent = classifyIntent(message);
    console.log('[CHAT] Classified intent:', intent);

    // Context-aware acknowledgment phrases based on intent
    const acknowledgmentsByIntent: Record<string, Array<{ text: string; audioFile: string }>> = {
      calendar: [
        { text: "Let me check your calendar", audioFile: "ack_calendar_1.mp3" },
        { text: "Checking your schedule now", audioFile: "ack_calendar_2.mp3" },
        { text: "Looking at your appointments", audioFile: "ack_calendar_3.mp3" },
      ],
      health_question: [
        { text: "Good question, let me look that up for you", audioFile: "ack_health_1.mp3" },
        { text: "I'll find that information for you", audioFile: "ack_health_2.mp3" },
        { text: "Let me check what I know about that", audioFile: "ack_health_3.mp3" },
      ],
      health_data: [
        { text: "Let me pull up your health data", audioFile: "ack_data_1.mp3" },
        { text: "Checking your metrics now", audioFile: "ack_data_2.mp3" },
        { text: "Looking at your recent data", audioFile: "ack_data_3.mp3" },
      ],
      action_request: [
        { text: "I'll help you with that right away", audioFile: "ack_action_1.mp3" },
        { text: "On it, give me just a moment", audioFile: "ack_action_2.mp3" },
        { text: "I can do that for you", audioFile: "ack_action_3.mp3" },
      ],
      general: [
        { text: "I hear you, let me help with that", audioFile: "ack_general_1.mp3" },
        { text: "I understand, let me see", audioFile: "ack_general_2.mp3" },
        { text: "Of course, looking into that for you", audioFile: "ack_general_3.mp3" },
        { text: "Let me see what I can find", audioFile: "ack_general_4.mp3" },
      ],
    };

    // Select an acknowledgment based on intent
    const intentPhrases = acknowledgmentsByIntent[intent] || acknowledgmentsByIntent.general;
    const acknowledgment = intentPhrases[Math.floor(Math.random() * intentPhrases.length)];

    // START STREAMING IMMEDIATELY - acknowledgment goes out first
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: string, data: any) => {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        };

        // Send agent_active event to indicate which agent is handling the request
        console.log('[CHAT] Sending agent_active event:', agentInfo.displayName);
        sendEvent('agent_active', {
          agent: agentInfo.type,
          displayName: agentInfo.displayName,
          icon: agentInfo.icon,
        });

        // INSTANT ACKNOWLEDGMENT - sent before ANY processing (if not skipped)
        let ackAudioPromise: Promise<string | null> | null = null;
        if (!skipAcknowledgment) {
          console.log('[CHAT] Sending instant acknowledgment:', acknowledgment.text);
          sendEvent('acknowledgment', {
            text: acknowledgment.text,
            audioFile: acknowledgment.audioFile,
          });

          // Generate TTS for acknowledgment (in parallel with other processing)
          if (ttsEnabled) {
            console.log('[CHAT] Generating TTS for acknowledgment...');
            ackAudioPromise = generateSpeech(acknowledgment.text, { voiceId: (voiceId as VoiceId) || 'rachel' })
              .then(audio => {
                console.log('[CHAT] Acknowledgment TTS generated, length:', audio.length);
                // Send audio chunk immediately
                sendEvent('audio_chunk', {
                  audio,
                  index: -1, // Use -1 to indicate acknowledgment audio
                  isFinal: false,
                  isAcknowledgment: true,
                });
                return audio;
              })
              .catch(err => {
                console.error('[CHAT] Error generating acknowledgment TTS:', err);
                return null;
              });
          }
        }

        try {
          // NOW do the slow memory/context loading (user already has acknowledgment)
          console.log('[CHAT] Step 3: Initializing services...');
          const memoryService = new UserMemoryService();

          // Get user's subscription tier for context limits
          console.log('[CHAT] Step 4: Getting subscription tier...');
          const subscriptionTier = await getUserSubscriptionTier(userEmail);
          console.log('[CHAT] Subscription tier:', subscriptionTier);

          // Get user's memory context for personalization (parallel with user context)
          console.log('[CHAT] Step 5: Getting memory and user context...');
          const [memoryContext, userContext] = await Promise.all([
            memoryService.getMemoryContext(userEmail).catch((err) => {
              console.error('[CHAT] ERROR getting memory context:', err);
              return { facts: [], style: null, outcomes: [], preferences: [], recentSummary: null, recentConversations: [] };
            }),
            getUserContext(userEmail, message, {
              subscriptionTier,
              threadId: providedThreadId,
              includeConversation: true,
              useAISelection: subscriptionTier !== 'free', // Only use AI selection for paid tiers
            }).catch((err) => {
              console.error('[CHAT] ERROR getting user context:', err);
              return null;
            }),
          ]);
          console.log('[CHAT] Memory context loaded, facts count:', memoryContext?.facts?.length || 0);
          console.log('[CHAT] User context loaded, sources:', userContext?.selectionResult?.sources?.join(', ') || 'none');

          // Get existing conversation if continuing a thread
          console.log('[CHAT] Step 6: Getting existing conversation...');
          let existingConversation = null;
          if (providedThreadId) {
            try {
              existingConversation = await memoryService.getConversation(providedThreadId);
              console.log('[CHAT] Existing conversation found:', !!existingConversation);
            } catch (convError) {
              console.error('[CHAT] ERROR getting conversation:', convError);
              // Don't throw - just continue without existing conversation
            }
          }

          // Build memory-aware system prompt
          console.log('[CHAT] Step 7: Building context-aware prompt...');
          const memoryPrompt = buildMemoryAwarePrompt(memoryContext);

          // Format user context for prompt
          let userContextPrompt = '';
          if (userContext) {
            const formattedContext = formatContextForPrompt(userContext, subscriptionTier);
            userContextPrompt = formattedContext.systemPromptAddition;
            console.log('[CHAT] User context formatted, token estimate:', formattedContext.tokenEstimate);
          }

          // ================================================================
          // AGENT ROUTING - Route to appropriate agent based on classification
          // ================================================================

          if (agentType === 'moccet-chef') {
            // MOCCET CHEF AGENT - Handles food/nutrition/recipe queries
            console.log('[CHAT] Routing to Moccet Chef agent...');

            try {
              const chefResult = await runChefAgent(userEmail, message);
              console.log('[CHAT] Chef agent completed');

              const finalResponse = chefResult.response;

              // Stream the response in sentence chunks
              const sentences = splitIntoSentences(finalResponse);

              // Start audio generation in parallel (if TTS is enabled)
              const audioPromises: Promise<{ audio: string; index: number } | null>[] = [];
              if (ttsEnabled) {
                console.log('[CHAT] TTS enabled, generating audio for', sentences.length, 'sentences');
                for (let i = 0; i < sentences.length; i++) {
                  audioPromises.push(
                    generateSpeech(sentences[i], { voiceId: (voiceId as VoiceId) || 'rachel' })
                      .then(audio => ({ audio, index: i }))
                      .catch(err => {
                        console.error(`[CHAT] TTS error for sentence ${i}:`, err);
                        return null;
                      })
                  );
                }
              }

              // Send text chunks immediately
              for (let i = 0; i < sentences.length; i++) {
                const isLast = i === sentences.length - 1;
                sendEvent('text_chunk', {
                  text: sentences[i],
                  index: i,
                  isFinal: isLast,
                });
                if (!isLast) {
                  await new Promise(resolve => setTimeout(resolve, 10));
                }
              }
              console.log('[CHAT] Sent', sentences.length, 'text chunks from chef');

              // Send audio chunks
              if (ttsEnabled && audioPromises.length > 0) {
                const audioResults = await Promise.all(audioPromises);
                const validResults = audioResults.filter((r): r is { audio: string; index: number } => r !== null);
                validResults.sort((a, b) => a.index - b.index);

                for (const result of validResults) {
                  const isLast = result.index === sentences.length - 1;
                  sendEvent('audio_chunk', {
                    audio: result.audio,
                    index: result.index,
                    isFinal: isLast,
                  });
                }
                console.log('[CHAT] Sent', validResults.length, 'audio chunks from chef');
              }

              // Send complete event
              sendEvent('complete', {
                response: finalResponse,
                threadId,
                recipe: chefResult.recipe,
              });

              // Save conversation to both memory and history
              const conversationMessages = existingConversation?.messages || [];
              conversationMessages.push({
                role: 'user',
                content: message,
                timestamp: new Date().toISOString(),
              });
              conversationMessages.push({
                role: 'assistant',
                content: finalResponse,
                timestamp: new Date().toISOString(),
              });

              try {
                // Save to existing memory system
                await memoryService.saveConversation(
                  userEmail,
                  threadId,
                  conversationMessages,
                  extractTopic(message)
                );

                // Also save to new conversation_history table for compaction
                await Promise.all([
                  saveMessage(userEmail, 'user', message, {
                    threadId,
                    agent: 'moccet-chef',
                  }),
                  saveMessage(userEmail, 'assistant', finalResponse, {
                    threadId,
                    agent: 'moccet-chef',
                  }),
                ]);
              } catch (saveError) {
                console.error('[CHAT] Error saving conversation:', saveError);
              }

              sendEvent('end', {});
              controller.close();
              return;

            } catch (chefError) {
              console.error('[CHAT] Chef agent error:', chefError);
              sendEvent('error', {
                error: chefError instanceof Error ? chefError.message : 'Chef agent failed',
              });
              sendEvent('end', {});
              controller.close();
              return;
            }
          }

          // ================================================================
          // MOCCET TRAINER AGENT - Handles fitness/workout queries
          // ================================================================

          if (agentType === 'moccet-trainer') {
            console.log('[CHAT] Routing to Moccet Trainer agent...');

            try {
              const trainerResult = await runTrainerAgent(userEmail, message);
              console.log('[CHAT] Trainer agent completed');

              const finalResponse = trainerResult.response;

              // Stream the response in sentence chunks
              const sentences = splitIntoSentences(finalResponse);

              // Start audio generation in parallel (if TTS is enabled)
              const audioPromises: Promise<{ audio: string; index: number } | null>[] = [];
              if (ttsEnabled) {
                console.log('[CHAT] TTS enabled, generating audio for', sentences.length, 'sentences');
                for (let i = 0; i < sentences.length; i++) {
                  audioPromises.push(
                    generateSpeech(sentences[i], { voiceId: (voiceId as VoiceId) || 'rachel' })
                      .then(audio => ({ audio, index: i }))
                      .catch(err => {
                        console.error(`[CHAT] TTS error for sentence ${i}:`, err);
                        return null;
                      })
                  );
                }
              }

              // Send text chunks immediately
              for (let i = 0; i < sentences.length; i++) {
                const isLast = i === sentences.length - 1;
                sendEvent('text_chunk', {
                  text: sentences[i],
                  index: i,
                  isFinal: isLast,
                });
                if (!isLast) {
                  await new Promise(resolve => setTimeout(resolve, 10));
                }
              }
              console.log('[CHAT] Sent', sentences.length, 'text chunks from trainer');

              // Send audio chunks
              if (ttsEnabled && audioPromises.length > 0) {
                const audioResults = await Promise.all(audioPromises);
                const validResults = audioResults.filter((r): r is { audio: string; index: number } => r !== null);
                validResults.sort((a, b) => a.index - b.index);

                for (const result of validResults) {
                  const isLast = result.index === sentences.length - 1;
                  sendEvent('audio_chunk', {
                    audio: result.audio,
                    index: result.index,
                    isFinal: isLast,
                  });
                }
                console.log('[CHAT] Sent', validResults.length, 'audio chunks from trainer');
              }

              // Send complete event
              sendEvent('complete', {
                response: finalResponse,
                threadId,
                workout: trainerResult.workout,
              });

              // Save conversation to both memory and history
              const conversationMessages = existingConversation?.messages || [];
              conversationMessages.push({
                role: 'user',
                content: message,
                timestamp: new Date().toISOString(),
              });
              conversationMessages.push({
                role: 'assistant',
                content: finalResponse,
                timestamp: new Date().toISOString(),
              });

              try {
                // Save to existing memory system
                await memoryService.saveConversation(
                  userEmail,
                  threadId,
                  conversationMessages,
                  extractTopic(message)
                );

                // Also save to new conversation_history table for compaction
                await Promise.all([
                  saveMessage(userEmail, 'user', message, {
                    threadId,
                    agent: 'moccet-trainer',
                  }),
                  saveMessage(userEmail, 'assistant', finalResponse, {
                    threadId,
                    agent: 'moccet-trainer',
                  }),
                ]);
              } catch (saveError) {
                console.error('[CHAT] Error saving conversation:', saveError);
              }

              sendEvent('end', {});
              controller.close();
              return;

            } catch (trainerError) {
              console.error('[CHAT] Trainer agent error:', trainerError);
              sendEvent('error', {
                error: trainerError instanceof Error ? trainerError.message : 'Trainer agent failed',
              });
              sendEvent('end', {});
              controller.close();
              return;
            }
          }

          // ================================================================
          // HEALTH AGENT (default / orchestrator) - Handles general health queries
          // ================================================================

          // Create agent
          console.log('[CHAT] Step 8: Creating health agent...');
          let agent;
          try {
            agent = createHealthAgent();
            console.log('[CHAT] Health agent created successfully');
          } catch (agentError) {
            console.error('[CHAT] ERROR creating health agent:', agentError);
            throw agentError;
          }

          // Build conversation history
          const conversationMessages = existingConversation?.messages || [];
          conversationMessages.push({
            role: 'user',
            content: message,
            timestamp: new Date().toISOString(),
          });

          // Initial state with memory context and user context
          const initialState: Partial<AgentState> = {
            taskId: threadId,
            userEmail,
            task: message,
            userContext: {
              memory: memoryContext,
              memoryPrompt,
              userContextPrompt, // NEW: Full user health/data context
              conversationHistory: conversationMessages,
              subscriptionTier, // NEW: For tier-aware responses
            },
            currentStep: 0,
            maxSteps: 15,
          };
          console.log('[CHAT] Initial state prepared with user context');

          // Send start event
          sendEvent('start', {
            threadId,
            hasMemory: memoryContext.facts.length > 0,
            communicationStyle: memoryContext.style,
          });
          console.log('[CHAT] Start event sent');

          let finalResponse = '';
          let agentReasoning: any[] = [];

          // Stream agent execution
          console.log('[CHAT] Step 9: Starting agent stream...');
          let streamEventCount = 0;
          const agentStream = await agent.stream(initialState);
          console.log('[CHAT] Agent stream obtained, iterating...');
          for await (const event of agentStream) {
            streamEventCount++;
            const nodeNames = Object.keys(event);
            console.log(`[CHAT] Stream event #${streamEventCount}, nodes:`, nodeNames);

            for (const nodeName of nodeNames) {
              const nodeState = event[nodeName];
              console.log(`[CHAT] Node "${nodeName}" status:`, nodeState.status);

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
                // Generate a spoken response for approval request
                const toolName = nodeState.pendingToolCall.name;
                const approvalText = `I'd like to ${toolName.replace(/_/g, ' ')} for you. Do you want me to proceed?`;

                console.log('[CHAT] Approval needed, generating TTS for:', approvalText);

                // Send text chunk for display
                sendEvent('text_chunk', {
                  text: approvalText,
                  index: 0,
                  isFinal: true,
                });

                // Generate TTS for approval message
                if (ttsEnabled) {
                  try {
                    const audio = await generateSpeech(approvalText, { voiceId: (voiceId as VoiceId) || 'rachel' });
                    console.log('[CHAT] Approval TTS generated, length:', audio.length);
                    sendEvent('audio_chunk', {
                      audio,
                      index: 0,
                      isFinal: true,
                    });
                  } catch (ttsErr) {
                    console.error('[CHAT] Error generating approval TTS:', ttsErr);
                  }
                }

                sendEvent('approval_needed', {
                  toolName: nodeState.pendingToolCall.name,
                  toolArgs: nodeState.pendingToolCall.args,
                  reasoning: nodeState.pendingToolCall.reasoning,
                });

                // Set final response for saving
                finalResponse = approvalText;
              }

              // Capture final response and stream it in chunks
              if (nodeState.status === 'completed' && nodeState.finalResult) {
                // finalResult has: { success, summary, actionsCompleted, recommendations }
                // The 'summary' field contains the actual response text
                finalResponse = nodeState.finalResult.summary ||
                               nodeState.finalResult.response ||
                               (typeof nodeState.finalResult === 'string' ? nodeState.finalResult : JSON.stringify(nodeState.finalResult));
                console.log('[CHAT] Final response captured, length:', finalResponse?.length || 0);
                console.log('[CHAT] Final response preview:', finalResponse?.substring(0, 200));

                // Stream the response in sentence chunks for better perceived latency
                console.log('[CHAT] Streaming response in chunks...');
                const sentences = splitIntoSentences(finalResponse);

                // Start audio generation in parallel (if TTS is enabled)
                const audioPromises: Promise<{ audio: string; index: number } | null>[] = [];
                if (ttsEnabled) {
                  console.log('[CHAT] TTS enabled, generating audio for', sentences.length, 'sentences');
                  for (let i = 0; i < sentences.length; i++) {
                    audioPromises.push(
                      generateSpeech(sentences[i], { voiceId: (voiceId as VoiceId) || 'rachel' })
                        .then(audio => ({ audio, index: i }))
                        .catch(err => {
                          console.error(`[CHAT] TTS error for sentence ${i}:`, err);
                          return null;
                        })
                    );
                  }
                }

                // Send text chunks immediately (don't wait for audio)
                for (let i = 0; i < sentences.length; i++) {
                  const isLast = i === sentences.length - 1;
                  sendEvent('text_chunk', {
                    text: sentences[i],
                    index: i,
                    isFinal: isLast,
                  });
                  // Small delay between chunks for natural pacing (10ms per chunk)
                  if (!isLast) {
                    await new Promise(resolve => setTimeout(resolve, 10));
                  }
                }
                console.log('[CHAT] Sent', sentences.length, 'text chunks');

                // Send audio chunks as they complete
                if (ttsEnabled && audioPromises.length > 0) {
                  console.log('[CHAT] Waiting for audio generation...');
                  const audioResults = await Promise.all(audioPromises);
                  console.log('[CHAT] Audio generation complete. Results:', audioResults.length, 'total,', audioResults.filter(r => r !== null).length, 'successful');
                  const validResults = audioResults.filter((r): r is { audio: string; index: number } => r !== null);

                  if (validResults.length === 0) {
                    console.log('[CHAT] WARNING: No audio chunks generated successfully!');
                  }

                  // Sort by index to maintain order
                  validResults.sort((a, b) => a.index - b.index);

                  for (const result of validResults) {
                    const isLast = result.index === sentences.length - 1;
                    console.log(`[CHAT] Sending audio_chunk ${result.index}, audio length: ${result.audio.length}`);
                    sendEvent('audio_chunk', {
                      audio: result.audio,
                      index: result.index,
                      isFinal: isLast,
                    });
                  }
                  console.log('[CHAT] Sent', validResults.length, 'audio chunks');
                } else if (requestTTS) {
                  console.log('[CHAT] TTS was requested but not enabled - no audio will be sent');
                }
              }

              // Send completion
              if (nodeState.status === 'completed') {
                console.log('[CHAT] Sending complete event with response');
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

          // Save conversation to memory and conversation history
          console.log('[CHAT] Step 10: Saving conversation to memory and history...');
          conversationMessages.push({
            role: 'assistant',
            content: finalResponse,
            timestamp: new Date().toISOString(),
          });

          try {
            // Save to existing memory system
            await memoryService.saveConversation(
              userEmail,
              threadId,
              conversationMessages,
              extractTopic(message)
            );
            console.log('[CHAT] Conversation saved to memory');

            // Also save to new conversation_history table for compaction
            await Promise.all([
              saveMessage(userEmail, 'user', message, {
                threadId,
                agent: agentType,
              }),
              saveMessage(userEmail, 'assistant', finalResponse, {
                threadId,
                agent: agentType,
              }),
            ]);
            console.log('[CHAT] Conversation saved to history table');
          } catch (saveError) {
            console.error('[CHAT] ERROR saving conversation:', saveError);
            // Don't throw - continue anyway
          }

          // Learn from the interaction
          console.log('[CHAT] Step 11: Learning from interaction...');
          try {
            await learnFromInteraction(memoryService, userEmail, message, finalResponse, agentReasoning);
            console.log('[CHAT] Learning complete');
          } catch (learnError) {
            console.error('[CHAT] ERROR learning from interaction:', learnError);
            // Don't throw - continue anyway
          }

          // Send end event
          sendEvent('end', { threadId });
          console.log('[CHAT] ========== CHAT COMPLETED SUCCESSFULLY ==========');
        } catch (error) {
          console.error('[CHAT] ========== STREAM ERROR ==========');
          console.error('[CHAT] Error type:', error?.constructor?.name);
          console.error('[CHAT] Error message:', error instanceof Error ? error.message : String(error));
          console.error('[CHAT] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
          console.error('[CHAT] Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error || {}), 2));
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
    console.error('[CHAT] ========== OUTER ERROR ==========');
    console.error('[CHAT] Error type:', error?.constructor?.name);
    console.error('[CHAT] Error message:', error instanceof Error ? error.message : String(error));
    console.error('[CHAT] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Quick intent classification for smart acknowledgments
 * Classifies the user's message into categories for contextual responses
 */
function classifyIntent(message: string): string {
  const lowerMessage = message.toLowerCase();

  // Calendar-related queries
  const calendarKeywords = ['calendar', 'schedule', 'appointment', 'meeting', 'reschedule', 'book', 'when am i', 'what do i have', 'my day', 'tomorrow', 'next week'];
  if (calendarKeywords.some(kw => lowerMessage.includes(kw))) {
    return 'calendar';
  }

  // Health data queries (asking about their own metrics)
  const healthDataKeywords = ['my sleep', 'my glucose', 'my hrv', 'my heart rate', 'my steps', 'my data', 'my metrics', 'my score', 'how did i', 'how was my', 'show me my', 'what was my'];
  if (healthDataKeywords.some(kw => lowerMessage.includes(kw))) {
    return 'health_data';
  }

  // Health questions (asking for information/advice)
  const questionIndicators = ['what is', 'what are', 'how do', 'how can', 'why do', 'why does', 'should i', 'can i', 'is it', 'tell me about', 'explain', 'help me understand'];
  if (questionIndicators.some(kw => lowerMessage.includes(kw))) {
    return 'health_question';
  }

  // Action requests
  const actionKeywords = ['create', 'add', 'set', 'send', 'order', 'buy', 'play', 'start', 'stop', 'remind', 'cancel'];
  if (actionKeywords.some(kw => lowerMessage.includes(kw))) {
    return 'action_request';
  }

  return 'general';
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
 * Split text into sentences for streaming chunks
 * Handles common sentence endings while preserving formatting
 */
function splitIntoSentences(text: string): string[] {
  if (!text) return [];

  // Split on sentence-ending punctuation followed by space or end of string
  // But keep the punctuation with the sentence
  const sentences: string[] = [];
  let current = '';

  for (let i = 0; i < text.length; i++) {
    current += text[i];

    // Check for sentence endings: . ! ? followed by space or end
    if ((text[i] === '.' || text[i] === '!' || text[i] === '?')) {
      const nextChar = text[i + 1];
      // End sentence if followed by space, newline, or end of string
      if (!nextChar || nextChar === ' ' || nextChar === '\n') {
        // Don't split on common abbreviations like "Dr." "Mr." "etc."
        const lastWord = current.trim().split(/\s+/).pop() || '';
        const abbreviations = ['dr', 'mr', 'mrs', 'ms', 'jr', 'sr', 'vs', 'etc', 'i.e', 'e.g'];
        const isAbbreviation = abbreviations.some(abbr =>
          lastWord.toLowerCase().replace('.', '') === abbr
        );

        if (!isAbbreviation) {
          sentences.push(current.trim());
          current = '';
          // Skip the space after the sentence
          if (nextChar === ' ') i++;
        }
      }
    }
  }

  // Add any remaining text
  if (current.trim()) {
    sentences.push(current.trim());
  }

  // If we couldn't split into sentences, split by newlines or return as single chunk
  if (sentences.length === 0) {
    const lines = text.split('\n').filter(line => line.trim());
    return lines.length > 0 ? lines : [text];
  }

  return sentences;
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
