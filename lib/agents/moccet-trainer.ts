/**
 * Moccet Trainer Agent
 *
 * A conversational fitness trainer agent specialized in personalized workouts.
 * Uses user context (fitness level, goals, health data) to provide tailored
 * exercise recommendations and workout plans.
 */

import { StateGraph, END, START, Annotation } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { createClient } from '@supabase/supabase-js';

// =============================================================================
// STATE DEFINITION
// =============================================================================

const TrainerStateAnnotation = Annotation.Root({
  // Input
  userEmail: Annotation<string>(),
  message: Annotation<string>(),
  userContext: Annotation<Record<string, any>>(),

  // Conversation
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),

  // Step tracking
  currentStep: Annotation<number>({
    reducer: (_, y) => y,
    default: () => 0,
  }),
  maxSteps: Annotation<number>({
    reducer: (_, y) => y,
    default: () => 5,
  }),

  // Status
  status: Annotation<'running' | 'completed' | 'failed'>({
    reducer: (_, y) => y,
    default: () => 'running' as const,
  }),
  finalResult: Annotation<{
    success: boolean;
    response: string;
    workout?: {
      name: string;
      type: string;
      duration: string;
      difficulty: string;
      targetMuscles: string[];
      exercises: Array<{
        name: string;
        sets: number;
        reps: string;
        rest: string;
        notes?: string;
      }>;
      warmup?: string[];
      cooldown?: string[];
      tips?: string[];
    };
  } | null>({
    reducer: (_, y) => y,
    default: () => null,
  }),
  error: Annotation<string | null>({
    reducer: (_, y) => y,
    default: () => null,
  }),
});

type TrainerState = typeof TrainerStateAnnotation.State;

// =============================================================================
// LLM SETUP
// =============================================================================

const llm = new ChatOpenAI({
  modelName: 'gpt-4-turbo-preview',
  temperature: 0.7,
});

// =============================================================================
// SYSTEM PROMPT
// =============================================================================

const TRAINER_SYSTEM_PROMPT = `You are Moccet Trainer, a personalized fitness and workout AI assistant.

## CRITICAL: Voice-First Conversational Style

You are speaking through voice (text-to-speech). Your responses must be natural and conversational.

**For casual fitness questions** - Keep it SHORT (1-2 sentences):
- "What should I do today?" → "Based on your recovery, I'd suggest a light upper body session. Want the workout?"
- "Is this a good exercise?" → "Yeah, that's solid for building strength. Great choice."
- "How many sets?" → "For hypertrophy, aim for 3-4 sets of 8-12 reps."

**For workout requests** - You can be more detailed since they asked for it:
- When they say "give me a workout" or "what exercises should I do...", provide the full routine
- But still keep it conversational, like a personal trainer coaching a friend
- Read it in a way that sounds natural spoken aloud

## Your Expertise
- Creating personalized workout programs
- Exercise form and technique guidance
- Understanding how recovery data affects training
- Progressive overload and periodization
- Injury prevention and modifications
- Matching workouts to fitness goals

## User Context Available
- Recovery metrics (HRV, sleep, strain)
- Fitness goals (strength, endurance, weight loss, muscle gain)
- Activity level and workout history
- Any injuries or limitations
- Available equipment

## Workout Format (ONLY when they ask for a workout)

Keep it speakable - avoid complex formatting. Something like:

"Alright, here's a push day workout for you. This should take about 45 minutes.

Start with a 5 minute warmup - some arm circles, band pull-aparts, and light push-ups to get the blood flowing.

Main workout:
Bench press - 4 sets of 8 reps, rest 90 seconds between sets.
Incline dumbbell press - 3 sets of 10, rest 60 seconds.
Cable flyes - 3 sets of 12, really squeeze at the top.
Overhead press - 3 sets of 10.
Lateral raises - 3 sets of 15, light weight, controlled movement.
Tricep pushdowns - 3 sets of 12.

Cool down with some chest and shoulder stretches.

This hits your chest, shoulders, and triceps. Your recovery score looks good today, so you should be able to push the weights a bit. How does that sound?"

## Important Guidelines

1. **Conversational first** - Sound like a supportive personal trainer
2. **Short for questions** - 1-2 sentences unless they ask for a workout
3. **Safety first** - Always consider their recovery and any limitations
4. **Encouraging tone** - Motivate without being over the top
5. **Progressive approach** - Scale difficulty to their level
6. **Offer to elaborate** - "Want me to break down the full workout?" instead of giving it unprompted

## Recovery-Aware Training

If you have their recovery data:
- Low HRV or poor sleep → Suggest lighter intensity or active recovery
- High strain yesterday → Maybe a rest day or light mobility work
- Good recovery → Can push harder, progressive overload

## Exercise Form Cues

When explaining exercises, give 1-2 key form cues:
- "Keep your core tight and don't arch your back"
- "Squeeze at the top for a second"
- "Control the weight on the way down"`;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

async function getUserFitnessContext(userEmail: string): Promise<Record<string, any>> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get user profile for fitness goals and activity level
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('health_goals, activity_level, fitness_level')
    .eq('email', userEmail)
    .single();

  // Get latest recovery/wellness data (from Whoop, Oura, etc.)
  const { data: recoveryData } = await supabase
    .from('whoop_data')
    .select('recovery_score, hrv, strain, sleep_performance')
    .eq('user_email', userEmail)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // Get recent workout history
  const { data: recentWorkouts } = await supabase
    .from('workout_logs')
    .select('workout_type, muscle_groups, completed_at')
    .eq('user_email', userEmail)
    .order('completed_at', { ascending: false })
    .limit(5);

  // Get any injuries or limitations
  const { data: limitations } = await supabase
    .from('user_health_limitations')
    .select('limitation_type, body_part, notes')
    .eq('user_email', userEmail)
    .eq('is_active', true);

  return {
    fitnessGoals: profile?.health_goals || [],
    activityLevel: profile?.activity_level || 'moderate',
    fitnessLevel: profile?.fitness_level || 'intermediate',
    recovery: recoveryData || null,
    recentWorkouts: recentWorkouts || [],
    limitations: limitations || [],
  };
}

function buildContextPrompt(context: Record<string, any>): string {
  const parts: string[] = [];

  // Fitness level and goals
  if (context.fitnessLevel) {
    parts.push(`**Fitness Level:** ${context.fitnessLevel}`);
  }

  if (context.fitnessGoals?.length > 0) {
    parts.push(`**Fitness Goals:** ${context.fitnessGoals.join(', ')}`);
  }

  if (context.activityLevel) {
    parts.push(`**Activity Level:** ${context.activityLevel}`);
  }

  // Recovery data (important for workout intensity)
  if (context.recovery) {
    const recovery = context.recovery;
    const recoveryParts: string[] = [];

    if (recovery.recovery_score !== undefined) {
      recoveryParts.push(`Recovery: ${recovery.recovery_score}%`);
    }
    if (recovery.hrv !== undefined) {
      recoveryParts.push(`HRV: ${recovery.hrv}ms`);
    }
    if (recovery.strain !== undefined) {
      recoveryParts.push(`Yesterday's Strain: ${recovery.strain}`);
    }
    if (recovery.sleep_performance !== undefined) {
      recoveryParts.push(`Sleep: ${recovery.sleep_performance}%`);
    }

    if (recoveryParts.length > 0) {
      parts.push(`**Today's Recovery Status:**\n${recoveryParts.join(' | ')}`);
    }
  }

  // Recent workouts (to avoid overtraining same muscles)
  if (context.recentWorkouts?.length > 0) {
    const recentMuscles = new Set<string>();
    context.recentWorkouts.slice(0, 3).forEach((w: any) => {
      if (w.muscle_groups) {
        w.muscle_groups.forEach((m: string) => recentMuscles.add(m));
      }
    });

    if (recentMuscles.size > 0) {
      parts.push(`**Recently Trained (last 3 workouts):** ${Array.from(recentMuscles).join(', ')}`);
    }
  }

  // Injuries/limitations
  if (context.limitations?.length > 0) {
    const limitationsList = context.limitations
      .map((l: any) => `${l.body_part}: ${l.limitation_type}${l.notes ? ` (${l.notes})` : ''}`)
      .join(', ');
    parts.push(`**Injuries/Limitations:** ${limitationsList}`);
  }

  return parts.length > 0
    ? `\n\n## User's Fitness Profile\n${parts.join('\n\n')}`
    : '';
}

// =============================================================================
// GRAPH NODES
// =============================================================================

async function trainerNode(state: TrainerState): Promise<Partial<TrainerState>> {
  console.log('[MOCCET-TRAINER] Processing message:', state.message.substring(0, 50));

  const contextPrompt = buildContextPrompt(state.userContext);

  const systemMessage = new SystemMessage(TRAINER_SYSTEM_PROMPT + contextPrompt);

  const userMessage = new HumanMessage(state.message);

  const messages = [systemMessage, ...state.messages, userMessage];

  try {
    const response = await llm.invoke(messages);
    const responseText = typeof response.content === 'string'
      ? response.content
      : JSON.stringify(response.content);

    console.log('[MOCCET-TRAINER] Generated response, length:', responseText.length);

    // Check if response contains a workout (simple heuristic)
    const hasWorkout = responseText.toLowerCase().includes('sets') &&
                       responseText.toLowerCase().includes('reps');

    return {
      messages: [userMessage, new AIMessage(responseText)],
      currentStep: state.currentStep + 1,
      status: 'completed',
      finalResult: {
        success: true,
        response: responseText,
        workout: hasWorkout ? extractWorkoutDetails(responseText) : undefined,
      },
    };
  } catch (error) {
    console.error('[MOCCET-TRAINER] Error:', error);
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Simple extraction helpers for workout details
function extractWorkoutDetails(text: string): any {
  const exercises: any[] = [];

  // Try to extract exercises with sets/reps pattern
  const exercisePattern = /([A-Za-z\s]+)\s*[-–—:]\s*(\d+)\s*sets?\s*(?:of\s*)?(\d+(?:-\d+)?)\s*(?:reps?)?/gi;
  let match;

  while ((match = exercisePattern.exec(text)) !== null) {
    exercises.push({
      name: match[1].trim(),
      sets: parseInt(match[2]),
      reps: match[3],
      rest: '60-90 seconds',
    });
  }

  // Determine workout type from content
  let workoutType = 'general';
  const lowerText = text.toLowerCase();
  if (lowerText.includes('push') || lowerText.includes('chest') || lowerText.includes('shoulder')) {
    workoutType = 'push';
  } else if (lowerText.includes('pull') || lowerText.includes('back') || lowerText.includes('bicep')) {
    workoutType = 'pull';
  } else if (lowerText.includes('leg') || lowerText.includes('squat') || lowerText.includes('lower body')) {
    workoutType = 'legs';
  } else if (lowerText.includes('full body')) {
    workoutType = 'full body';
  } else if (lowerText.includes('cardio') || lowerText.includes('hiit')) {
    workoutType = 'cardio';
  }

  // Extract duration if mentioned
  const durationMatch = text.match(/(\d+)\s*(?:minute|min)/i);
  const duration = durationMatch ? `${durationMatch[1]} minutes` : '45-60 minutes';

  return {
    name: `${workoutType.charAt(0).toUpperCase() + workoutType.slice(1)} Workout`,
    type: workoutType,
    duration,
    difficulty: 'moderate',
    targetMuscles: [],
    exercises: exercises.length > 0 ? exercises : undefined,
  };
}

// =============================================================================
// GRAPH CREATION
// =============================================================================

export async function createTrainerAgent() {
  console.log('[MOCCET-TRAINER] Creating trainer agent graph...');

  const workflow = new StateGraph(TrainerStateAnnotation)
    .addNode('trainer', trainerNode)
    .addEdge(START, 'trainer')
    .addEdge('trainer', END);

  const app = workflow.compile();
  console.log('[MOCCET-TRAINER] Graph compiled successfully');

  return app;
}

// =============================================================================
// MAIN ENTRY POINT
// =============================================================================

export async function runTrainerAgent(
  userEmail: string,
  message: string,
  existingMessages: BaseMessage[] = []
): Promise<{
  response: string;
  workout?: any;
  error?: string;
}> {
  console.log('[MOCCET-TRAINER] Running trainer agent for:', userEmail);

  try {
    // Get user's fitness context
    const userContext = await getUserFitnessContext(userEmail);
    console.log('[MOCCET-TRAINER] User context loaded');

    // Create and run agent
    const agent = await createTrainerAgent();

    const initialState = {
      userEmail,
      message,
      userContext,
      messages: existingMessages,
    };

    const result = await agent.invoke(initialState);

    if (result.status === 'completed' && result.finalResult) {
      return {
        response: result.finalResult.response,
        workout: result.finalResult.workout,
      };
    } else if (result.error) {
      return {
        response: "I'm sorry, I had trouble generating a response. Please try again.",
        error: result.error,
      };
    }

    return {
      response: "I couldn't process your request. Please try again.",
    };
  } catch (error) {
    console.error('[MOCCET-TRAINER] Error running agent:', error);
    return {
      response: "I encountered an error. Please try again.",
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
