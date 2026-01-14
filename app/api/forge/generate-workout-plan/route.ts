/**
 * Workout Plan Generator API
 * Generates personalized workout plans using exercises from forge_exercises database
 *
 * POST /api/forge/generate-workout-plan
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getServiceClient } from '@/lib/supabase/server';
import {
  queryEligibleExercises,
  categorizeExercises,
  loadUserProfile,
  normalizeEquipment,
} from '@/lib/forge/exercise-selector';
import {
  selectSplitType,
  adjustSplitForDays,
  getProgressionStrategy,
  SPLIT_TEMPLATES,
} from '@/lib/forge/split-templates';
import {
  buildWorkoutPlanPrompt,
  createExerciseLookup,
  resolveExerciseReferences,
  parseAIResponse,
} from '@/lib/forge/workout-plan-prompt';
import type {
  GenerateWorkoutPlanRequest,
  GenerateWorkoutPlanResponse,
  WorkoutPlanData,
  SplitType,
  ExerciseType,
} from '@/lib/forge/types';

// Allow up to 2 minutes for generation
export const maxDuration = 120;

// ==================== OPENAI CLIENT ====================

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key is not configured');
  }
  return new OpenAI({
    apiKey,
    timeout: 90000, // 90 second timeout
    maxRetries: 2,
  });
}

// ==================== SYSTEM PROMPT ====================

const SYSTEM_PROMPT = `You are an expert strength and conditioning coach creating a personalized workout plan.

CRITICAL RULES:
1. You MUST ONLY select exercises from the provided exercise lists - DO NOT invent exercises
2. Use SIMPLE LANGUAGE for intensity (never "RPE 8", use "Challenging but doable with 2 reps left")
3. Prescribe SPECIFIC rest periods in seconds
4. Start each training day with compound movements, end with isolation
5. Include warmup and cooldown for each training day
6. Provide progression notes for key exercises

OUTPUT FORMAT:
Return a valid JSON object matching the specified schema exactly. No markdown, no explanations.`;

// ==================== MAIN HANDLER ====================

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('[WorkoutPlanGenerator] Starting plan generation...');

    // Parse request body
    const body = await request.json() as GenerateWorkoutPlanRequest;
    const { userEmail, overrides } = body;

    // Validate required fields
    if (!userEmail) {
      return NextResponse.json<GenerateWorkoutPlanResponse>(
        { success: false, error: 'userEmail is required' },
        { status: 400 }
      );
    }

    // Load user profile
    console.log(`[WorkoutPlanGenerator] Loading profile for ${userEmail}`);
    const profile = await loadUserProfile(userEmail);

    if (!profile) {
      return NextResponse.json<GenerateWorkoutPlanResponse>(
        { success: false, error: 'No profile found for this user. Complete onboarding first.' },
        { status: 404 }
      );
    }

    // Apply overrides
    const trainingDays = overrides?.trainingDays ?? profile.training_days_per_week;
    const sessionLength = overrides?.sessionLength ?? profile.session_length_minutes;

    // Determine split type
    let splitType: Exclude<SplitType, 'auto'>;
    if (overrides?.splitType && overrides.splitType !== 'auto') {
      splitType = overrides.splitType;
    } else {
      splitType = selectSplitType(trainingDays, profile.primary_goal);
    }

    console.log(`[WorkoutPlanGenerator] Using ${splitType} split for ${trainingDays} days/week`);

    // Normalize equipment
    const normalizedEquipment = normalizeEquipment(profile.equipment || []);
    console.log(`[WorkoutPlanGenerator] Equipment available:`, normalizedEquipment);

    // Determine which exercise types to include based on split and preferences
    const exerciseTypes: ExerciseType[] = profile.preferred_exercises?.length > 0
      ? profile.preferred_exercises
      : ['weightTraining', 'calisthenics'];

    // Query eligible exercises
    console.log('[WorkoutPlanGenerator] Querying exercises...');
    const eligibleExercises = await queryEligibleExercises({
      equipmentAvailable: normalizedEquipment,
      injuriesToAvoid: profile.injuries || [],
      experienceLevel: profile.experience_level,
      exerciseTypes,
    });

    if (eligibleExercises.length === 0) {
      return NextResponse.json<GenerateWorkoutPlanResponse>(
        {
          success: false,
          error: 'No exercises available for your equipment and injury requirements. Try adjusting your profile.',
        },
        { status: 400 }
      );
    }

    console.log(`[WorkoutPlanGenerator] Found ${eligibleExercises.length} eligible exercises`);

    // Categorize exercises
    const categorized = categorizeExercises(eligibleExercises);

    // Get day focuses for the split
    const dayFocuses = adjustSplitForDays(splitType, trainingDays);

    // Build prompt
    const prompt = buildWorkoutPlanPrompt({
      profile,
      categorizedExercises: categorized,
      splitType,
      dayFocuses,
    });

    // Create exercise lookup for resolving references
    const exerciseLookup = createExerciseLookup(eligibleExercises);

    // Call OpenAI
    console.log('[WorkoutPlanGenerator] Calling OpenAI...');
    const openai = getOpenAIClient();

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 8000,
    });

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      throw new Error('Empty response from OpenAI');
    }

    // Parse and validate response
    console.log('[WorkoutPlanGenerator] Parsing AI response...');
    const aiOutput = parseAIResponse(responseText);

    // Resolve exercise references
    const { resolved, unmatchedExercises } = resolveExerciseReferences(aiOutput, exerciseLookup);

    if (unmatchedExercises.length > 0) {
      console.warn('[WorkoutPlanGenerator] Unmatched exercises:', unmatchedExercises);
    }

    // Build final plan data
    const progression = getProgressionStrategy(profile.primary_goal, profile.experience_level);

    const planData: WorkoutPlanData = {
      version: '1.0',
      generatedAt: new Date().toISOString(),
      splitType,
      userProfile: {
        goal: profile.primary_goal,
        experience: profile.experience_level,
        trainingDays,
        sessionLength,
      },
      weeks: [{
        weekNumber: 1,
        days: Object.entries(resolved.weeklyProgram as Record<string, unknown>).map(([day, data]) => ({
          dayOfWeek: day as WorkoutPlanData['weeks'][0]['days'][0]['dayOfWeek'],
          ...(data as object),
        })),
      }],
      progression: {
        strategy: progression.strategy,
        weeklyIncrements: progression.weeklyIncrements,
        repProgression: (resolved.progression as Record<string, unknown>)?.repProgression as string || 'Add 1-2 reps before increasing weight',
        deloadFrequency: progression.deloadFrequency,
        plateauStrategy: (resolved.progression as Record<string, unknown>)?.plateauStrategy as string || 'Reduce weight by 10% and rebuild',
      },
    };

    // Store plan in database
    console.log('[WorkoutPlanGenerator] Storing plan...');
    const supabase = getServiceClient();

    const { data: storedPlan, error: storeError } = await supabase
      .from('forge_workout_plans')
      .insert({
        user_email: userEmail,
        name: `${formatSplitName(splitType)} - Week 1`,
        description: `${trainingDays}-day ${splitType.replace(/_/g, ' ')} program for ${formatGoal(profile.primary_goal)}`,
        duration_weeks: 4,
        days_per_week: trainingDays,
        plan_data: planData,
        based_on_goal: profile.primary_goal,
        based_on_level: profile.experience_level,
        is_active: true,
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (storeError) {
      console.error('[WorkoutPlanGenerator] Failed to store plan:', storeError);
      // Don't fail the request, just log the error
    }

    const generationTime = Date.now() - startTime;
    const estimatedCost = (completion.usage?.total_tokens || 0) * 0.00000015; // GPT-4o-mini pricing

    console.log(`[WorkoutPlanGenerator] ✅ Plan generated in ${generationTime}ms (cost: $${estimatedCost.toFixed(4)})`);

    return NextResponse.json<GenerateWorkoutPlanResponse>({
      success: true,
      planId: storedPlan?.id,
      plan: planData,
      metadata: {
        exercisesUsed: countExercisesInPlan(planData),
        exercisesAvailable: eligibleExercises.length,
        generationTimeMs: generationTime,
        estimatedCost,
        splitTypeUsed: splitType,
      },
    });

  } catch (error) {
    console.error('[WorkoutPlanGenerator] Error:', error);

    return NextResponse.json<GenerateWorkoutPlanResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate workout plan',
      },
      { status: 500 }
    );
  }
}

// ==================== HELPERS ====================

function formatSplitName(split: SplitType): string {
  const names: Record<SplitType, string> = {
    push_pull_legs: 'Push/Pull/Legs',
    upper_lower: 'Upper/Lower',
    full_body: 'Full Body',
    bro_split: 'Bro Split',
    auto: 'Custom',
  };
  return names[split] || split;
}

function formatGoal(goal: string): string {
  const goals: Record<string, string> = {
    buildMuscle: 'muscle building',
    loseFat: 'fat loss',
    getStronger: 'strength',
    improveEndurance: 'endurance',
    flexibility: 'flexibility',
    generalFitness: 'general fitness',
  };
  return goals[goal] || goal;
}

function countExercisesInPlan(plan: WorkoutPlanData): number {
  let count = 0;
  for (const week of plan.weeks) {
    for (const day of week.days) {
      if ('mainWorkout' in day && day.mainWorkout?.exercises) {
        count += (day.mainWorkout.exercises as unknown[]).length;
      }
    }
  }
  return count;
}

// ==================== GET HANDLER ====================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userEmail = searchParams.get('email');

  if (!userEmail) {
    return NextResponse.json(
      { success: false, error: 'email parameter is required' },
      { status: 400 }
    );
  }

  try {
    const supabase = getServiceClient();

    const { data: plans, error } = await supabase
      .from('forge_workout_plans')
      .select('*')
      .eq('user_email', userEmail)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      throw error;
    }

    if (!plans || plans.length === 0) {
      return NextResponse.json({
        success: true,
        plan: null,
        message: 'No active workout plan found',
      });
    }

    return NextResponse.json({
      success: true,
      planId: plans[0].id,
      plan: plans[0].plan_data,
    });

  } catch (error) {
    console.error('[WorkoutPlanGenerator] GET Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch workout plan' },
      { status: 500 }
    );
  }
}
