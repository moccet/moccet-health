/**
 * AI Prompt Builder for Workout Plan Generation
 * Creates a structured prompt for GPT-4o-mini to program exercises
 */

import type {
  ForgeProfile,
  ForgeExercise,
  CategorizedExercises,
  SplitType,
  DayFocus,
  FitnessGoal,
} from './types';
import { getRepRangesForGoal, getProgressionStrategy } from './split-templates';

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
Return a valid JSON object matching the specified schema exactly.`;

// ==================== PROMPT BUILDER ====================

interface PromptInput {
  profile: ForgeProfile;
  categorizedExercises: CategorizedExercises;
  splitType: Exclude<SplitType, 'auto'>;
  dayFocuses: DayFocus[];
}

export function buildWorkoutPlanPrompt(input: PromptInput): string {
  const { profile, categorizedExercises, splitType, dayFocuses } = input;
  const repRanges = getRepRangesForGoal(profile.primary_goal);
  const progression = getProgressionStrategy(profile.primary_goal, profile.experience_level);

  // Format exercise lists for the prompt
  const pushExercises = formatExerciseList(categorizedExercises.push, 'Push');
  const pullExercises = formatExerciseList(categorizedExercises.pull, 'Pull');
  const legExercises = formatExerciseList(categorizedExercises.legs, 'Legs');
  const coreExercises = formatExerciseList(categorizedExercises.core, 'Core');
  const cardioExercises = formatExerciseList(categorizedExercises.cardio, 'Cardio');

  // Format day focuses
  const weekStructure = dayFocuses.map((d, i) =>
    `${d.day.charAt(0).toUpperCase() + d.day.slice(1)}: ${d.focus}${d.isRest ? ' (REST)' : ''}`
  ).join('\n');

  const prompt = `
## ATHLETE PROFILE
- **Goal**: ${formatGoal(profile.primary_goal)}
- **Experience**: ${profile.experience_level}
- **Training Days**: ${profile.training_days_per_week} days per week
- **Session Length**: ${profile.session_length_minutes} minutes
- **Injuries/Limitations**: ${profile.injuries.length > 0 ? profile.injuries.join(', ') : 'None reported'}
${profile.additional_notes ? `- **Notes**: ${profile.additional_notes}` : ''}

## TRAINING SPLIT: ${splitType.toUpperCase().replace(/_/g, ' ')}

### Weekly Structure
${weekStructure}

## AVAILABLE EXERCISES
You MUST ONLY select from these exercises. Each line shows: Name [difficulty] (compound indicator)

${pushExercises}

${pullExercises}

${legExercises}

${coreExercises}

${cardioExercises}

## PROGRAMMING GUIDELINES

### Rep Ranges for ${formatGoal(profile.primary_goal)}
- **Compound exercises**: ${repRanges.compound.sets} sets × ${repRanges.compound.reps} reps, ${repRanges.compound.rest} rest
- **Isolation exercises**: ${repRanges.isolation.sets} sets × ${repRanges.isolation.reps} reps, ${repRanges.isolation.rest} rest
- **Target intensity**: ${repRanges.intensity}

### Progression Strategy: ${progression.strategy.toUpperCase()}
${progression.description}
- Upper body: ${progression.weeklyIncrements.upperBody}
- Lower body: ${progression.weeklyIncrements.lowerBody}
- Deload: ${progression.deloadFrequency}

### Exercise Selection Rules
1. Select 5-8 exercises per training day (based on ${profile.session_length_minutes} minute sessions)
2. Start with 2-3 compound movements
3. Follow with 2-4 isolation exercises
4. End with core work when time permits
5. Include variety - don't repeat the same exercise twice in the week

### Warmup Guidelines
- 5-10 minutes of light cardio or dynamic stretching
- Movement-specific warm-up sets for first compound exercise

### Cooldown Guidelines
- 5 minutes of static stretching
- Focus on muscles trained that day

## OUTPUT SCHEMA
Return a JSON object with this EXACT structure:

{
  "weeklyProgram": {
    "monday": {
      "focus": "string describing the day's focus",
      "isRestDay": boolean,
      "estimatedDuration": number (minutes),
      "warmup": {
        "description": "Brief warmup description",
        "durationMinutes": number,
        "exercises": [
          { "name": "Exercise name", "duration": "30 seconds or 10 reps", "notes": "optional" }
        ]
      },
      "mainWorkout": {
        "exercises": [
          {
            "exerciseName": "EXACT name from the exercise list",
            "sets": number,
            "reps": "8-10 or 12 or 30 seconds",
            "restSeconds": number,
            "intensity": "Simple description like 'Moderate - 3 reps in reserve'",
            "weight": "Starting weight suggestion or 'Bodyweight'",
            "progressionNotes": "How to progress this exercise"
          }
        ]
      },
      "cooldown": {
        "description": "Brief cooldown description",
        "durationMinutes": number,
        "exercises": [
          { "name": "Stretch name", "duration": "30 seconds", "notes": "optional" }
        ]
      },
      "restDayActivities": null
    },
    "tuesday": { ... same structure ... },
    "wednesday": { ... same structure, or for rest days: ... },
    "thursday": { ... },
    "friday": { ... },
    "saturday": { ... },
    "sunday": {
      "focus": "Rest",
      "isRestDay": true,
      "estimatedDuration": 0,
      "warmup": null,
      "mainWorkout": null,
      "cooldown": null,
      "restDayActivities": ["Light walk", "Stretching", "Foam rolling"]
    }
  },
  "progression": {
    "strategy": "${progression.strategy}",
    "weeklyIncrements": {
      "upperBody": "${progression.weeklyIncrements.upperBody}",
      "lowerBody": "${progression.weeklyIncrements.lowerBody}"
    },
    "repProgression": "Add 1-2 reps per set before increasing weight",
    "deloadFrequency": "${progression.deloadFrequency}",
    "plateauStrategy": "If stuck for 2 weeks, reduce weight by 10% and rebuild"
  }
}

IMPORTANT:
- exerciseName MUST exactly match one of the exercises listed above
- Every training day needs warmup, mainWorkout, and cooldown
- Rest days have isRestDay: true and restDayActivities instead of workout
- All numeric values (sets, restSeconds, estimatedDuration) must be numbers, not strings
`;

  return prompt;
}

// ==================== HELPERS ====================

function formatExerciseList(exercises: ForgeExercise[], category: string): string {
  if (exercises.length === 0) {
    return `### ${category} Exercises\nNo exercises available in this category.`;
  }

  const formatted = exercises
    .slice(0, 30) // Limit to 30 exercises per category to control prompt size
    .map(ex => {
      const compound = ex.is_compound ? '(compound)' : '';
      return `- ${ex.name} [${ex.difficulty_level}] ${compound}`;
    })
    .join('\n');

  return `### ${category} Exercises (${exercises.length} available)\n${formatted}`;
}

function formatGoal(goal: FitnessGoal): string {
  const goalNames: Record<FitnessGoal, string> = {
    buildMuscle: 'Build Muscle (Hypertrophy)',
    loseFat: 'Lose Fat (Body Recomposition)',
    getStronger: 'Get Stronger (Strength)',
    improveEndurance: 'Improve Endurance',
    flexibility: 'Improve Flexibility',
    generalFitness: 'General Fitness',
  };
  return goalNames[goal] || goal;
}

// ==================== EXERCISE ID LOOKUP ====================

/**
 * Create a lookup map from exercise names to IDs
 */
export function createExerciseLookup(exercises: ForgeExercise[]): Map<string, ForgeExercise> {
  const lookup = new Map<string, ForgeExercise>();
  for (const ex of exercises) {
    // Store by exact name
    lookup.set(ex.name, ex);
    // Also store by lowercase for fuzzy matching
    lookup.set(ex.name.toLowerCase(), ex);
  }
  return lookup;
}

/**
 * Resolve exercise references in AI output to actual exercise data
 */
export function resolveExerciseReferences(
  aiOutput: Record<string, unknown>,
  lookup: Map<string, ForgeExercise>
): { resolved: Record<string, unknown>; unmatchedExercises: string[] } {
  const unmatched: string[] = [];

  function processExercises(obj: unknown): unknown {
    if (Array.isArray(obj)) {
      return obj.map(processExercises);
    }

    if (obj && typeof obj === 'object') {
      const processed: Record<string, unknown> = {};

      for (const [key, value] of Object.entries(obj)) {
        if (key === 'exerciseName' && typeof value === 'string') {
          // Try to find the exercise in lookup
          const exercise = lookup.get(value) || lookup.get(value.toLowerCase());

          if (exercise) {
            processed['exerciseId'] = exercise.id;
            processed['exerciseName'] = exercise.name;
            processed['tips'] = exercise.tips || [];
            processed['commonMistakes'] = exercise.common_mistakes || [];
            processed['isCompound'] = exercise.is_compound || false;
            processed['muscleGroups'] = exercise.muscle_groups || [];
          } else {
            unmatched.push(value);
            processed['exerciseId'] = null;
            processed['exerciseName'] = value;
            processed['tips'] = [];
            processed['commonMistakes'] = [];
            processed['isCompound'] = false;
            processed['muscleGroups'] = [];
          }
        } else {
          processed[key] = processExercises(value);
        }
      }

      return processed;
    }

    return obj;
  }

  const resolved = processExercises(aiOutput) as Record<string, unknown>;
  return { resolved, unmatchedExercises: unmatched };
}

// ==================== JSON PARSING HELPERS ====================

/**
 * Clean and parse AI response JSON
 */
export function parseAIResponse(responseText: string): Record<string, unknown> {
  let cleaned = responseText.trim();

  // Remove markdown code blocks
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\n?/, '').replace(/\n?```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\n?/, '').replace(/\n?```$/, '');
  }

  // Remove trailing commas before closing brackets
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

  // Remove JavaScript comments
  cleaned = cleaned.replace(/\/\/.*$/gm, '');

  try {
    return JSON.parse(cleaned);
  } catch (error) {
    console.error('[WorkoutPlanPrompt] Failed to parse AI response:', error);
    throw new Error('Failed to parse workout plan from AI response');
  }
}
