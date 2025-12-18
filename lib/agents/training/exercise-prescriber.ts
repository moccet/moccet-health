/**
 * Exercise Prescriber Agent
 *
 * Purpose: Fill each day with specific exercises, sets, reps, and weights
 * Model: GPT-4o-mini (structured output generation)
 * Cost: ~$0.008 per call
 *
 * Takes the Program Designer output and creates detailed workout programs
 * for each training day with specific exercises tailored to the athlete's
 * equipment, injuries, and experience level.
 */

import OpenAI from 'openai';
import { AthleteProfileCard } from '../../types/athlete-profile';
import { ProgramDesignerOutput, WeeklyProgram, DayWorkout, MainExercise } from '../../types/plan-output';

// ============================================================================
// TYPES
// ============================================================================

export interface ExercisePrescriberInput {
  athleteProfile: AthleteProfileCard;
  programDesign: ProgramDesignerOutput;
}

export interface ExercisePrescriberOutput {
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
// EXERCISE DATABASE
// ============================================================================

const EXERCISE_DB: Record<string, { equipment: string[]; alternatives: string[] }> = {
  // Lower Body
  'Barbell Back Squat': { equipment: ['barbell'], alternatives: ['Goblet Squat', 'Leg Press', 'Bodyweight Squat'] },
  'Romanian Deadlift': { equipment: ['barbell', 'dumbbells'], alternatives: ['Good Morning', 'Hip Hinge'] },
  'Leg Press': { equipment: ['cables-machines'], alternatives: ['Goblet Squat', 'Lunges'] },
  'Walking Lunges': { equipment: ['bodyweight', 'dumbbells'], alternatives: ['Reverse Lunges', 'Split Squats'] },
  'Leg Curl': { equipment: ['cables-machines'], alternatives: ['Nordic Curl', 'Stability Ball Curl'] },
  'Leg Extension': { equipment: ['cables-machines'], alternatives: ['Sissy Squat', 'Terminal Knee Extension'] },
  'Calf Raises': { equipment: ['bodyweight', 'dumbbells', 'cables-machines'], alternatives: ['Seated Calf Raises'] },

  // Upper Push
  'Barbell Bench Press': { equipment: ['barbell'], alternatives: ['Dumbbell Bench Press', 'Push-ups'] },
  'Incline Dumbbell Press': { equipment: ['dumbbells'], alternatives: ['Incline Push-ups', 'Landmine Press'] },
  'Overhead Press': { equipment: ['barbell', 'dumbbells'], alternatives: ['Pike Push-ups', 'Landmine Press'] },
  'Dips': { equipment: ['bodyweight'], alternatives: ['Close Grip Push-ups', 'Bench Dips'] },
  'Lateral Raises': { equipment: ['dumbbells', 'cables-machines'], alternatives: ['Band Lateral Raises'] },
  'Tricep Pushdowns': { equipment: ['cables-machines'], alternatives: ['Diamond Push-ups', 'Overhead Tricep Extension'] },

  // Upper Pull
  'Pull-ups': { equipment: ['bodyweight'], alternatives: ['Lat Pulldown', 'Inverted Rows'] },
  'Barbell Rows': { equipment: ['barbell'], alternatives: ['Dumbbell Rows', 'Cable Rows'] },
  'Lat Pulldown': { equipment: ['cables-machines'], alternatives: ['Pull-ups', 'Band Pulldowns'] },
  'Face Pulls': { equipment: ['cables-machines', 'resistance-bands'], alternatives: ['Band Pull-Aparts', 'Reverse Flyes'] },
  'Dumbbell Curls': { equipment: ['dumbbells'], alternatives: ['Hammer Curls', 'Band Curls'] },
  'Barbell Curls': { equipment: ['barbell'], alternatives: ['Dumbbell Curls', 'Cable Curls'] },

  // Core
  'Plank': { equipment: ['bodyweight'], alternatives: ['Dead Bug', 'Bird Dog'] },
  'Hanging Leg Raises': { equipment: ['bodyweight'], alternatives: ['Lying Leg Raises', 'Reverse Crunches'] },
  'Cable Woodchops': { equipment: ['cables-machines'], alternatives: ['Band Woodchops', 'Russian Twists'] },
  'Ab Wheel Rollouts': { equipment: ['bodyweight'], alternatives: ['Plank Walkouts', 'Stability Ball Rollouts'] },
};

// ============================================================================
// WEIGHT CALCULATION HELPERS
// ============================================================================

function calculateStartingWeight(
  exercise: string,
  athleteProfile: AthleteProfileCard,
  intensity: 'light' | 'moderate' | 'heavy'
): string {
  // Guard against undefined exercise name
  if (!exercise) {
    return 'Moderate weight';
  }

  const { profile, ecosystemMetrics } = athleteProfile;
  const bodyweight = profile.weightKg;

  // Multipliers based on experience and intensity
  const expMultiplier = profile.trainingAge === 'beginner' ? 0.6 : profile.trainingAge === 'intermediate' ? 0.8 : 1.0;
  const intensityMultiplier = intensity === 'light' ? 0.6 : intensity === 'moderate' ? 0.75 : 0.85;

  // Recovery-based adjustment (from ecosystem data)
  let recoveryMultiplier = 1.0;
  if (ecosystemMetrics?.recovery.combinedRecoveryScore) {
    const score = ecosystemMetrics.recovery.combinedRecoveryScore;
    if (score < 40) {
      recoveryMultiplier = 0.85; // 15% reduction for low recovery
    } else if (score < 60) {
      recoveryMultiplier = 0.92; // 8% reduction for moderate recovery
    } else if (score >= 80) {
      recoveryMultiplier = 1.05; // Can push slightly harder with high recovery
    }
  }

  // HRV-based adjustment (stacks with recovery)
  if (ecosystemMetrics?.recovery.hrvPercentOfBaseline && ecosystemMetrics.recovery.hrvPercentOfBaseline < 85) {
    recoveryMultiplier *= 0.95; // Additional 5% reduction if HRV below baseline
  }

  // Base percentages of bodyweight for common exercises
  const exerciseMultipliers: Record<string, number> = {
    'Barbell Back Squat': 0.8,
    'Romanian Deadlift': 0.6,
    'Barbell Bench Press': 0.6,
    'Overhead Press': 0.4,
    'Barbell Rows': 0.5,
    'Incline Dumbbell Press': 0.25, // Per hand
    'Dumbbell Curls': 0.12, // Per hand
    'Lateral Raises': 0.08, // Per hand
    'Goblet Squat': 0.25,
  };

  const baseMultiplier = exerciseMultipliers[exercise] || 0.3;
  const calculatedWeight = Math.round(bodyweight * baseMultiplier * expMultiplier * intensityMultiplier * recoveryMultiplier / 2.5) * 2.5;

  // Check if exercise is bodyweight
  const bodyweightExercises = ['Push-ups', 'Pull-ups', 'Dips', 'Plank', 'Lunges', 'Bodyweight Squat'];
  const exerciseLower = exercise.toLowerCase();
  if (bodyweightExercises.some(bw => exerciseLower.includes(bw.toLowerCase()))) {
    return 'Bodyweight';
  }

  // Check if exercise uses dumbbells (weight per hand)
  const dumbbellExercises = ['Dumbbell', 'Lateral Raises', 'Curls', 'Hammer'];
  if (dumbbellExercises.some(db => exercise.includes(db))) {
    const perHand = Math.max(5, Math.round(calculatedWeight / 2 / 2.5) * 2.5);
    return `${perHand} kg each hand`;
  }

  return `${Math.max(20, calculatedWeight)} kg`;
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

const SYSTEM_PROMPT = `You are an expert exercise programmer. Your job is to take a high-level program design and fill in specific exercises for each day.

CRITICAL RULES:
1. EVERY exercise MUST have a specific weight value - NEVER leave weight empty
2. Use lowercase day keys: monday, tuesday, wednesday, thursday, friday, saturday, sunday
3. Format sets as "X sets" (e.g., "4 sets")
4. Format reps as "X-Y reps" or "X reps" (e.g., "8-10 reps")
5. Format rest as "X seconds" or "X minutes" (e.g., "90 seconds")
6. Tempo must be plain language (e.g., "Lower 2 sec, lift 1 sec") NOT notation like "3-1-1"
7. Intensity must be plain language (e.g., "Challenging but doable") NOT "RPE 8"
8. Notes field is for form cues only - MAX 15 words

EXERCISE SELECTION RULES:
- Only prescribe exercises the athlete has equipment for
- Avoid exercises that aggravate their injuries
- Match complexity to experience level
- Each training day should have 5-8 main exercises

TRAINING DAY STRUCTURE:
For training days, use this structure:
{
  "dayName": "Monday",
  "focus": "Lower Body Strength",
  "duration": "45-60 minutes",
  "warmup": { "description": "Dynamic warmup", "exercises": [...] },
  "mainWorkout": [...],
  "cooldown": { "description": "Static stretching", "exercises": [...] }
}

REST DAY STRUCTURE:
For rest days, use this minimal structure:
{
  "dayName": "Tuesday",
  "focus": "Rest & Recovery",
  "duration": "N/A",
  "warmup": { "description": "Light movement if desired", "exercises": [] },
  "mainWorkout": [],
  "cooldown": { "description": "Optional stretching", "exercises": [] }
}

CRITICAL: Every day MUST have a "duration" field. Training days use the athlete's session length (e.g., "45-60 minutes"). Rest days use "N/A".

OUTPUT FORMAT:
Return valid JSON with this exact structure:
{
  "weeklyProgram": {
    "monday": { DayWorkout },
    "tuesday": { DayWorkout },
    ... all 7 days
  }
}`;

// ============================================================================
// BUILD USER PROMPT
// ============================================================================

function buildUserPrompt(input: ExercisePrescriberInput): string {
  const { athleteProfile, programDesign } = input;
  const { profile, constraints, ecosystemMetrics } = athleteProfile;

  let prompt = `# PROGRAM DESIGN TO FILL

## Day Assignments
${Object.entries(programDesign.dayFocusAssignments)
  .map(([day, focus]) => `- ${day}: ${focus}`)
  .join('\n')}

## Athlete Context
- Experience: ${profile.trainingAge}
- Session Length: ${profile.sessionLengthMinutes} minutes
- Available Equipment: ${constraints.equipment.join(', ')}
- Training Location: ${constraints.trainingLocation}
`;

  if (constraints.injuries.length > 0) {
    prompt += `\n## Injuries to Work Around\n`;
    for (const injury of constraints.injuries) {
      prompt += `- ${injury.area}: Avoid ${injury.exercisesToAvoid.join(', ')}\n`;
    }
  }

  prompt += `\n## Weight Guidelines
- Athlete weighs ${profile.weightKg} kg
- Experience level: ${profile.trainingAge}
- Always provide specific weights (e.g., "60 kg", "20 kg each hand", "Bodyweight")
`;

  // Add recovery-based intensity guidance
  if (ecosystemMetrics?.recovery) {
    const { recovery } = ecosystemMetrics;
    prompt += `\n## Recovery-Based Adjustments\n`;

    let intensityModifier = 'normal';

    if (recovery.combinedRecoveryScore) {
      if (recovery.combinedRecoveryScore < 40) {
        intensityModifier = 'light';
        prompt += `- Recovery Score: ${recovery.combinedRecoveryScore}/100 (LOW)\n`;
        prompt += `  * Reduce starting weights by 10-15%\n`;
        prompt += `  * Use "Easy to moderate effort" for intensity descriptions\n`;
        prompt += `  * Add extra rest between sets (+30 seconds)\n`;
      } else if (recovery.combinedRecoveryScore < 60) {
        intensityModifier = 'moderate';
        prompt += `- Recovery Score: ${recovery.combinedRecoveryScore}/100 (MODERATE)\n`;
        prompt += `  * Use conservative weight estimates\n`;
        prompt += `  * Include notes about scaling down if needed\n`;
      } else if (recovery.combinedRecoveryScore >= 80) {
        intensityModifier = 'high';
        prompt += `- Recovery Score: ${recovery.combinedRecoveryScore}/100 (HIGH)\n`;
        prompt += `  * Can prescribe challenging weights\n`;
        prompt += `  * "Challenging but doable" to "Very challenging" intensity is appropriate\n`;
      }
    }

    if (recovery.hrvPercentOfBaseline && recovery.hrvPercentOfBaseline < 85) {
      prompt += `- HRV: ${recovery.hrvPercentOfBaseline}% of baseline (BELOW NORMAL)\n`;
      prompt += `  * Avoid prescribing maximal efforts\n`;
      prompt += `  * Keep 2-3 reps in reserve on all working sets\n`;
    }

    if (recovery.sleepDebtHours && recovery.sleepDebtHours > 5) {
      prompt += `- Sleep Debt: ${recovery.sleepDebtHours} hours accumulated\n`;
      prompt += `  * Add "reduce weight if feeling fatigued" to exercise notes\n`;
    }

    prompt += `\n**Apply ${intensityModifier} intensity based on recovery data.**\n`;
  }

  prompt += `
## Your Task
Fill in the complete weeklyProgram with all 7 days. Each training day needs:
- dayName (capitalized day name)
- focus (e.g., "Lower Body Strength")
- duration (use "${profile.sessionLengthMinutes} minutes" for training days, "N/A" for rest days)
- 3-5 warmup exercises
- 5-8 main exercises with full details
- 2-4 cooldown stretches

IMPORTANT: Every day MUST include a "duration" field.

Return the JSON structure as specified.`;

  return prompt;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

export async function runExercisePrescriber(
  input: ExercisePrescriberInput
): Promise<ExercisePrescriberOutput> {
  console.log('[Exercise Prescriber] Starting exercise prescription...');

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
      temperature: 0.7,
      max_tokens: 12000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from GPT-4o-mini');
    }

    const result = JSON.parse(content) as ExercisePrescriberOutput;

    // Validate and fix the response
    if (!result.weeklyProgram) {
      throw new Error('Missing weeklyProgram in response');
    }

    // Ensure all days exist and have proper structure
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
    for (const day of days) {
      if (!result.weeklyProgram[day]) {
        result.weeklyProgram[day] = createRestDay(day);
      } else {
        // Fix any missing weights
        result.weeklyProgram[day] = fixMissingWeights(result.weeklyProgram[day], input.athleteProfile);
      }
    }

    console.log('[Exercise Prescriber] Exercise prescription complete');
    console.log(`[Exercise Prescriber] Tokens used: ${response.usage?.total_tokens || 'unknown'}`);

    return result;
  } catch (error) {
    console.error('[Exercise Prescriber] Error:', error);

    // Return fallback program
    console.log('[Exercise Prescriber] Using fallback program');
    return createFallbackProgram(input);
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function createRestDay(dayName: string): DayWorkout {
  const capitalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);
  return {
    dayName: capitalizedDay,
    focus: 'Rest & Recovery',
    duration: 'N/A',
    warmup: {
      description: 'Light movement if desired',
      exercises: [],
    },
    mainWorkout: [],
    cooldown: {
      description: 'Optional stretching',
      exercises: [],
    },
    isRestDay: true,
  };
}

function fixMissingWeights(day: DayWorkout, athleteProfile: AthleteProfileCard): DayWorkout {
  // Fix missing duration
  if (!day.duration) {
    const isRestDay = day.focus?.toLowerCase().includes('rest') || day.focus?.toLowerCase().includes('recovery') || !day.mainWorkout?.length;
    day.duration = isRestDay ? 'N/A' : `${athleteProfile.profile.sessionLengthMinutes || 45}-${(athleteProfile.profile.sessionLengthMinutes || 45) + 15} minutes`;
  }

  if (!day.mainWorkout || !Array.isArray(day.mainWorkout)) {
    return day;
  }

  day.mainWorkout = day.mainWorkout
    .filter((exercise) => exercise && exercise.exercise) // Filter out invalid exercises
    .map((exercise) => {
      if (!exercise.weight || exercise.weight === '' || exercise.weight === 'undefined') {
        exercise.weight = calculateStartingWeight(exercise.exercise, athleteProfile, 'moderate');
      }

      // Fix tempo if it's in notation format
      if (exercise.tempo && /^\d+-\d+-\d+/.test(exercise.tempo)) {
        const parts = exercise.tempo.split('-').map(Number);
        exercise.tempo = `Lower ${parts[0]} sec, pause ${parts[1]} sec, lift ${parts[2]} sec`;
      }

      // Fix intensity if it's RPE format
      if (exercise.intensity && /^RPE\s*\d+/i.test(exercise.intensity)) {
        const rpe = parseInt(exercise.intensity.replace(/\D/g, ''));
        if (rpe <= 6) exercise.intensity = 'Moderate effort — could do several more reps';
        else if (rpe <= 8) exercise.intensity = 'Challenging but doable — leave 2-3 reps in reserve';
        else exercise.intensity = 'Very challenging — pushing close to your limit';
      }

      return exercise;
    });

  return day;
}

function createFallbackProgram(input: ExercisePrescriberInput): ExercisePrescriberOutput {
  const { athleteProfile, programDesign } = input;
  const weeklyProgram: Partial<WeeklyProgram> = {};

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

  for (const day of days) {
    const focus = programDesign.dayFocusAssignments?.[day] || '';

    if (!focus || focus.toLowerCase().includes('rest') || focus.toLowerCase().includes('recovery')) {
      weeklyProgram[day] = createRestDay(day);
    } else {
      weeklyProgram[day] = createTrainingDay(day, focus, athleteProfile);
    }
  }

  return { weeklyProgram: weeklyProgram as WeeklyProgram };
}

function createTrainingDay(dayName: string, focus: string, athleteProfile: AthleteProfileCard): DayWorkout {
  const capitalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);
  const focusLower = (focus || '').toLowerCase();
  const isLowerBody = focusLower.includes('lower') || focusLower.includes('leg');
  const isUpperPush = focusLower.includes('push') || focusLower.includes('chest');
  const isUpperPull = focusLower.includes('pull') || focusLower.includes('back');

  let mainExercises: MainExercise[];

  if (isLowerBody) {
    mainExercises = [
      createExercise('Barbell Back Squat', '4 sets', '6-8 reps', athleteProfile, 'heavy'),
      createExercise('Romanian Deadlift', '3 sets', '8-10 reps', athleteProfile, 'moderate'),
      createExercise('Walking Lunges', '3 sets', '12 reps each leg', athleteProfile, 'moderate'),
      createExercise('Leg Curl', '3 sets', '10-12 reps', athleteProfile, 'moderate'),
      createExercise('Calf Raises', '4 sets', '12-15 reps', athleteProfile, 'moderate'),
    ];
  } else if (isUpperPush) {
    mainExercises = [
      createExercise('Barbell Bench Press', '4 sets', '6-8 reps', athleteProfile, 'heavy'),
      createExercise('Incline Dumbbell Press', '3 sets', '8-10 reps', athleteProfile, 'moderate'),
      createExercise('Overhead Press', '3 sets', '8-10 reps', athleteProfile, 'moderate'),
      createExercise('Lateral Raises', '3 sets', '12-15 reps', athleteProfile, 'light'),
      createExercise('Tricep Pushdowns', '3 sets', '10-12 reps', athleteProfile, 'moderate'),
    ];
  } else if (isUpperPull) {
    mainExercises = [
      createExercise('Pull-ups', '4 sets', '6-10 reps', athleteProfile, 'heavy'),
      createExercise('Barbell Rows', '4 sets', '8-10 reps', athleteProfile, 'moderate'),
      createExercise('Lat Pulldown', '3 sets', '10-12 reps', athleteProfile, 'moderate'),
      createExercise('Face Pulls', '3 sets', '12-15 reps', athleteProfile, 'light'),
      createExercise('Dumbbell Curls', '3 sets', '10-12 reps', athleteProfile, 'moderate'),
    ];
  } else {
    // Full body or mixed
    mainExercises = [
      createExercise('Barbell Back Squat', '3 sets', '8-10 reps', athleteProfile, 'moderate'),
      createExercise('Barbell Bench Press', '3 sets', '8-10 reps', athleteProfile, 'moderate'),
      createExercise('Barbell Rows', '3 sets', '8-10 reps', athleteProfile, 'moderate'),
      createExercise('Overhead Press', '3 sets', '8-10 reps', athleteProfile, 'moderate'),
      createExercise('Romanian Deadlift', '3 sets', '8-10 reps', athleteProfile, 'moderate'),
    ];
  }

  return {
    dayName: capitalizedDay,
    focus,
    duration: `${athleteProfile.profile.sessionLengthMinutes} minutes`,
    warmup: {
      description: '8-10 minute progressive warmup',
      exercises: [
        { name: 'Light Cardio', sets: '1 set', reps: '5 minutes', notes: 'Bike, row, or brisk walk' },
        { name: 'Dynamic Stretches', sets: '1 set', reps: '10 reps each', notes: 'Leg swings, arm circles' },
        { name: 'Movement Prep', sets: '2 sets', reps: '8 reps', notes: 'Light version of main lifts' },
      ],
    },
    mainWorkout: mainExercises,
    cooldown: {
      description: '5-8 minute cooldown',
      exercises: [
        { name: 'Static Stretching', duration: '30 seconds each', notes: 'Hold each stretch gently' },
        { name: 'Deep Breathing', duration: '2 minutes', notes: 'Slow, controlled breaths' },
      ],
    },
  };
}

function createExercise(
  name: string,
  sets: string,
  reps: string,
  athleteProfile: AthleteProfileCard,
  intensity: 'light' | 'moderate' | 'heavy'
): MainExercise {
  const weight = calculateStartingWeight(name, athleteProfile, intensity);

  const intensityDescriptions = {
    light: 'Easy to moderate — plenty left in the tank',
    moderate: 'Challenging but doable — leave 2-3 reps in reserve',
    heavy: 'Very challenging — could do 1-2 more reps at most',
  };

  const restTimes = {
    light: '60 seconds',
    moderate: '90 seconds',
    heavy: '2-3 minutes',
  };

  return {
    exercise: name,
    sets,
    reps,
    weight,
    rest: restTimes[intensity],
    tempo: 'Lower 2 sec, lift 1 sec',
    intensity: intensityDescriptions[intensity],
    notes: 'Focus on controlled movement and full range of motion',
  };
}
