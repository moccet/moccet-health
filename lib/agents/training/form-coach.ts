/**
 * Form Coach Agent
 *
 * Purpose: Add personalized coaching cues and polish exercise details
 * Model: GPT-4o-mini (structured output generation)
 * Cost: ~$0.003 per call
 *
 * Takes the Exercise Prescriber output and adds:
 * - Personalized form cues (notes field)
 * - Progression notes for each exercise
 * - Ensures beginner-friendly language
 * - Validates all weights are specific
 */

import OpenAI from 'openai';
import { AthleteProfileCard } from '../../types/athlete-profile';
import { WeeklyProgram, DayWorkout, MainExercise, FormCoachOutput } from '../../types/plan-output';

// ============================================================================
// TYPES
// ============================================================================

export interface FormCoachInput {
  athleteProfile: AthleteProfileCard;
  weeklyProgram: WeeklyProgram;
}

// ============================================================================
// OPENAI CLIENT
// ============================================================================

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  return new OpenAI({ apiKey });
}

// ============================================================================
// FORM CUE DATABASE
// ============================================================================

const FORM_CUES: Record<string, { notes: string; progression: string }> = {
  // Lower Body
  'Barbell Back Squat': {
    notes: 'Keep chest up, drive through heels, knees track over toes',
    progression: 'Add 2.5 kg when all sets feel controlled',
  },
  'Romanian Deadlift': {
    notes: 'Hinge at hips, slight knee bend, feel hamstring stretch',
    progression: 'Add 2.5-5 kg when form is solid through all reps',
  },
  'Leg Press': {
    notes: 'Push through full foot, control the descent, full range',
    progression: 'Add 5-10 kg when last set feels manageable',
  },
  'Walking Lunges': {
    notes: 'Long stride, torso upright, front knee over ankle',
    progression: 'Add weight when balance is consistent',
  },
  'Leg Curl': {
    notes: 'Control the negative, squeeze hamstrings at top',
    progression: 'Increase weight when 12 reps feel easy',
  },
  'Calf Raises': {
    notes: 'Full stretch at bottom, pause at top, control descent',
    progression: 'Add 5 kg when you can pause 2 sec at top',
  },
  'Goblet Squat': {
    notes: 'Elbows inside knees, chest tall, sit back into heels',
    progression: 'Progress to heavier dumbbell or barbell squat',
  },

  // Upper Push
  'Barbell Bench Press': {
    notes: 'Feet flat, squeeze shoulder blades, bar to mid-chest',
    progression: 'Add 2.5 kg when you hit top of rep range',
  },
  'Incline Dumbbell Press': {
    notes: 'Elbows at 45 degrees, control descent, press up and in',
    progression: 'Add 2.5 kg each hand when all reps are smooth',
  },
  'Overhead Press': {
    notes: 'Brace core, bar path straight up, head through at top',
    progression: 'Add 1-2.5 kg when form is perfect on all sets',
  },
  'Dips': {
    notes: 'Lean slightly forward for chest, control descent',
    progression: 'Add weight vest or belt when 12+ reps are easy',
  },
  'Lateral Raises': {
    notes: 'Slight bend in elbows, lead with pinkies, control down',
    progression: 'Add 1 kg when movement is fully controlled',
  },
  'Tricep Pushdowns': {
    notes: 'Elbows locked at sides, squeeze triceps at bottom',
    progression: 'Increase weight when 12 reps feel smooth',
  },

  // Upper Pull
  'Pull-ups': {
    notes: 'Full hang at bottom, chin over bar, control descent',
    progression: 'Add weight when you can do 10+ clean reps',
  },
  'Barbell Rows': {
    notes: 'Flat back, pull to lower chest, squeeze shoulder blades',
    progression: 'Add 2.5-5 kg when form is solid through all reps',
  },
  'Lat Pulldown': {
    notes: 'Slight lean back, pull to upper chest, squeeze lats',
    progression: 'Add 5 kg when you feel lats working fully',
  },
  'Face Pulls': {
    notes: 'Pull to face level, externally rotate at end, squeeze',
    progression: 'Focus on mind-muscle connection before adding weight',
  },
  'Dumbbell Curls': {
    notes: 'Keep elbows still, full extension, squeeze at top',
    progression: 'Add 1-2 kg when all reps are controlled',
  },

  // Core
  'Plank': {
    notes: 'Flat back, squeeze glutes, breathe steadily',
    progression: 'Add 10 seconds when current hold feels easy',
  },
  'Hanging Leg Raises': {
    notes: 'Control the swing, exhale as you lift, slow descent',
    progression: 'Progress to straight legs when bent feels easy',
  },
};

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

const SYSTEM_PROMPT = `You are an expert movement coach specializing in form cues and exercise technique. Your job is to review an exercise program and enhance it with personalized coaching notes.

CRITICAL RULES:
1. Notes field is MAX 15 words - concise form cues only
2. ProgressionNotes field is MAX 15 words - how to advance
3. Use beginner-friendly language - no jargon
4. NEVER use colons (:) - use em dashes (—) instead
5. Every exercise MUST have both notes and progressionNotes
6. Weight must NEVER be empty - verify and fix if needed

PERSONALIZATION:
- Reference the athlete's experience level in progression advice
- For beginners: focus on form mastery before weight increases
- For intermediate: balance form with progressive overload
- For advanced: more nuanced technique cues

OUTPUT FORMAT:
Return the complete weeklyProgram with enhanced notes and progressionNotes for every exercise.`;

// ============================================================================
// BUILD USER PROMPT
// ============================================================================

function buildUserPrompt(input: FormCoachInput): string {
  const { athleteProfile, weeklyProgram } = input;

  return `# ATHLETE CONTEXT
- Experience: ${athleteProfile.profile.trainingAge}
- Primary Goal: ${athleteProfile.profile.primaryGoal}
- Injuries: ${athleteProfile.constraints.injuries.map(i => i.area).join(', ') || 'None'}

# PROGRAM TO ENHANCE
${JSON.stringify(weeklyProgram, null, 2)}

# YOUR TASK
Enhance every exercise with:
1. Personalized "notes" (form cues, max 15 words)
2. "progressionNotes" (how to progress, max 15 words)

Return the complete enhanced weeklyProgram JSON.`;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

export async function runFormCoach(input: FormCoachInput): Promise<FormCoachOutput> {
  console.log('[Form Coach] Starting form enhancement...');

  // For cost efficiency, we can often do this locally without API call
  // Only call API for complex personalization needs
  const { athleteProfile, weeklyProgram } = input;
  const needsApiCall = athleteProfile.constraints.injuries.length > 0 ||
                       athleteProfile.profile.trainingAge === 'beginner';

  if (!needsApiCall) {
    console.log('[Form Coach] Using local enhancement (no injuries, not beginner)');
    return { weeklyProgram: enhanceLocally(weeklyProgram, athleteProfile) };
  }

  const openai = getOpenAIClient();
  const userPrompt = buildUserPrompt(input);

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5,
      max_tokens: 10000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from GPT-4o-mini');
    }

    const result = JSON.parse(content);
    const enhancedProgram = result.weeklyProgram || result;

    console.log('[Form Coach] Form enhancement complete');
    console.log(`[Form Coach] Tokens used: ${response.usage?.total_tokens || 'unknown'}`);

    // Final validation pass
    return { weeklyProgram: validateAndFix(enhancedProgram, athleteProfile) };
  } catch (error) {
    console.error('[Form Coach] Error:', error);
    console.log('[Form Coach] Falling back to local enhancement');
    return { weeklyProgram: enhanceLocally(weeklyProgram, athleteProfile) };
  }
}

// ============================================================================
// LOCAL ENHANCEMENT (NO API CALL)
// ============================================================================

function enhanceLocally(weeklyProgram: WeeklyProgram, athleteProfile: AthleteProfileCard): WeeklyProgram {
  const enhanced = { ...weeklyProgram };
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

  for (const day of days) {
    if (enhanced[day] && enhanced[day].mainWorkout) {
      enhanced[day] = {
        ...enhanced[day],
        mainWorkout: enhanced[day].mainWorkout.map(exercise =>
          enhanceExercise(exercise, athleteProfile)
        ),
      };
    }
  }

  return enhanced;
}

function enhanceExercise(exercise: MainExercise, athleteProfile: AthleteProfileCard): MainExercise {
  const enhanced = { ...exercise };
  const { trainingAge } = athleteProfile.profile;

  // Get cues from database or generate generic ones
  const cues = FORM_CUES[exercise.exercise] || {
    notes: 'Focus on controlled movement through full range',
    progression: 'Add weight when all reps feel controlled',
  };

  // Personalize notes based on experience
  if (!enhanced.notes || enhanced.notes.length < 5) {
    enhanced.notes = cues.notes;
  }

  // Personalize progression based on experience
  if (!enhanced.progressionNotes) {
    if (trainingAge === 'beginner') {
      enhanced.progressionNotes = 'Master form first, then add weight gradually';
    } else if (trainingAge === 'intermediate') {
      enhanced.progressionNotes = cues.progression;
    } else {
      enhanced.progressionNotes = 'Progress when movement quality is excellent';
    }
  }

  // Ensure notes aren't too long (max 15 words)
  if (enhanced.notes) {
    const words = enhanced.notes.split(/\s+/);
    if (words.length > 15) {
      enhanced.notes = words.slice(0, 15).join(' ');
    }
  }

  if (enhanced.progressionNotes) {
    const words = enhanced.progressionNotes.split(/\s+/);
    if (words.length > 15) {
      enhanced.progressionNotes = words.slice(0, 15).join(' ');
    }
  }

  return enhanced;
}

// ============================================================================
// VALIDATION AND FIXES
// ============================================================================

function validateAndFix(weeklyProgram: WeeklyProgram, athleteProfile: AthleteProfileCard): WeeklyProgram {
  const fixed = { ...weeklyProgram };
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

  for (const day of days) {
    if (!fixed[day]) {
      fixed[day] = createRestDay(day);
      continue;
    }

    // Ensure dayName is capitalized
    if (!fixed[day].dayName) {
      fixed[day].dayName = day.charAt(0).toUpperCase() + day.slice(1);
    }

    // Fix each exercise
    if (fixed[day].mainWorkout && Array.isArray(fixed[day].mainWorkout)) {
      fixed[day].mainWorkout = fixed[day].mainWorkout.map(exercise => {
        // Ensure weight is never empty
        if (!exercise.weight || exercise.weight === '' || exercise.weight === 'undefined') {
          exercise.weight = calculateFallbackWeight(exercise.exercise, athleteProfile);
        }

        // Ensure notes exist
        if (!exercise.notes) {
          const cues = FORM_CUES[exercise.exercise];
          exercise.notes = cues?.notes || 'Focus on controlled movement';
        }

        // Ensure progressionNotes exist
        if (!exercise.progressionNotes) {
          const cues = FORM_CUES[exercise.exercise];
          exercise.progressionNotes = cues?.progression || 'Add weight when form is solid';
        }

        // Remove colons from text
        exercise.notes = exercise.notes.replace(/:/g, ' —');
        if (exercise.progressionNotes) {
          exercise.progressionNotes = exercise.progressionNotes.replace(/:/g, ' —');
        }

        return exercise;
      });
    }
  }

  return fixed;
}

function createRestDay(dayName: string): DayWorkout {
  return {
    dayName: dayName.charAt(0).toUpperCase() + dayName.slice(1),
    focus: 'Rest & Recovery',
    duration: 'N/A',
    warmup: { description: 'Light movement if desired', exercises: [] },
    mainWorkout: [],
    cooldown: { description: 'Optional stretching', exercises: [] },
    isRestDay: true,
  };
}

function calculateFallbackWeight(exerciseName: string, athleteProfile: AthleteProfileCard): string {
  const bodyweight = athleteProfile.profile.weightKg;
  const isAdvanced = athleteProfile.profile.trainingAge === 'advanced';

  // Bodyweight exercises
  if (['Push-ups', 'Pull-ups', 'Dips', 'Plank', 'Lunges'].some(e => exerciseName.includes(e))) {
    return 'Bodyweight';
  }

  // Dumbbell exercises (per hand)
  if (exerciseName.includes('Dumbbell') || exerciseName.includes('Lateral') || exerciseName.includes('Curl')) {
    const baseWeight = isAdvanced ? bodyweight * 0.15 : bodyweight * 0.1;
    return `${Math.round(baseWeight / 2.5) * 2.5} kg each hand`;
  }

  // Barbell exercises
  const baseWeight = isAdvanced ? bodyweight * 0.6 : bodyweight * 0.4;
  return `${Math.round(baseWeight / 2.5) * 2.5} kg`;
}
