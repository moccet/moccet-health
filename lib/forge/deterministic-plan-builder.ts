/**
 * Deterministic Plan Builder
 * Builds workout plans without AI using templates and database exercises
 */

import type {
  ForgeProfile,
  ForgeExercise,
  TrainingModifications,
  CategorizedExercises,
  WorkoutPlanData,
  WeekPlan,
  DayPlan,
  ProgrammedExercise,
  WarmupSection,
  CooldownSection,
  ProgressionGuidelines,
  DayFocus,
  SplitType,
} from './types';
import {
  selectSplitType,
  adjustSplitForDays,
  getRepRangesForGoal,
  getProgressionStrategy,
  RepRangeConfig,
} from './split-templates';
import { getExercisesForDay } from './exercise-selector';

// ==================== MAIN BUILDER ====================

/**
 * Build a workout plan deterministically using templates and database exercises
 */
export async function buildDeterministicPlan(
  profile: ForgeProfile,
  healthMods: TrainingModifications,
  categorizedExercises: CategorizedExercises
): Promise<WorkoutPlanData> {
  console.log('[PlanBuilder] Building deterministic plan...');

  // 1. Calculate effective training days
  const effectiveTrainingDays = Math.max(
    2,
    Math.min(
      healthMods.maxTrainingDays ?? 7,
      profile.training_days_per_week - healthMods.extraRestDays
    )
  );

  console.log(`[PlanBuilder] Effective training days: ${effectiveTrainingDays} (original: ${profile.training_days_per_week})`);

  // 2. Select split type
  const splitType = selectSplitType(effectiveTrainingDays, profile.primary_goal);
  console.log(`[PlanBuilder] Selected split: ${splitType}`);

  // 3. Get day focuses for the split
  const dayFocuses = adjustSplitForDays(splitType, effectiveTrainingDays);

  // 4. Get rep ranges for the goal (adjusted for health)
  const baseRepRanges = getRepRangesForGoal(profile.primary_goal);
  const adjustedRepRanges = adjustRepRangesForHealth(baseRepRanges, healthMods);

  // 5. Build each day
  const days: DayPlan[] = [];
  for (const focus of dayFocuses) {
    if (focus.isRest) {
      days.push(buildRestDay(focus, healthMods.prioritizeRecovery));
    } else {
      days.push(
        buildTrainingDay(
          focus,
          categorizedExercises,
          adjustedRepRanges,
          profile.session_length_minutes,
          healthMods
        )
      );
    }
  }

  // 6. Build progression guidelines
  const progression = buildProgressionGuidelines(
    profile.primary_goal,
    profile.experience_level
  );

  // 7. Assemble final plan
  const plan: WorkoutPlanData = {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    splitType,
    userProfile: {
      goal: profile.primary_goal,
      experience: profile.experience_level,
      trainingDays: effectiveTrainingDays,
      sessionLength: profile.session_length_minutes,
    },
    weeks: [{ weekNumber: 1, days }],
    progression,
  };

  console.log(`[PlanBuilder] Plan built with ${countExercisesInPlan(plan)} total exercises`);

  return plan;
}

// ==================== DAY BUILDERS ====================

function buildTrainingDay(
  focus: DayFocus,
  exercises: CategorizedExercises,
  repRanges: RepRangeConfig,
  sessionLength: number,
  healthMods: TrainingModifications
): DayPlan {
  // Map focus to category
  const focusCategory = mapFocusToCategory(focus.focus);
  const availableExercises = getExercisesForDay(exercises, focusCategory);

  if (availableExercises.length === 0) {
    console.warn(`[PlanBuilder] No exercises found for focus: ${focus.focus}`);
    return buildRestDay(focus, true);
  }

  // Calculate exercise count based on session length
  const baseExerciseCount = Math.floor(sessionLength / 10); // ~10 min per exercise
  const volumeMultiplier = 1 + healthMods.volumeAdjustment / 100;
  const adjustedCount = Math.max(4, Math.min(8, Math.round(baseExerciseCount * volumeMultiplier)));

  // Select exercises: compounds first, then isolation
  const compounds = availableExercises
    .filter(e => e.is_compound)
    .slice(0, 3);

  const isolations = availableExercises
    .filter(e => !e.is_compound)
    .slice(0, Math.max(0, adjustedCount - compounds.length));

  const selectedExercises = [...compounds, ...isolations].slice(0, adjustedCount);

  // Build programmed exercises
  const programmedExercises: ProgrammedExercise[] = selectedExercises.map((ex, index) => {
    const isCompound = ex.is_compound;
    const config = isCompound ? repRanges.compound : repRanges.isolation;

    // Parse sets from range (e.g., "3-4" -> 4 for compounds, 3 for isolations)
    const setsParts = config.sets.split('-').map(Number);
    let baseSets = isCompound
      ? setsParts[setsParts.length - 1] // Take upper bound for compounds
      : setsParts[0]; // Take lower bound for isolations

    // Apply volume adjustment
    baseSets = Math.max(2, Math.round(baseSets * volumeMultiplier));

    // Parse rest seconds from string
    const restSeconds = parseRestSeconds(config.rest);

    // Adjust intensity description
    const intensity = adjustIntensityDescription(
      config.intensity || repRanges.intensity,
      healthMods.intensityAdjustment
    );

    return {
      exerciseId: ex.id,
      exerciseName: ex.name,
      sets: baseSets,
      reps: config.reps,
      restSeconds,
      intensity,
      tips: ex.tips || [],
      commonMistakes: ex.common_mistakes || [],
      isCompound,
      muscleGroups: ex.muscle_groups || [],
      progressionNotes: isCompound
        ? 'Add 1-2.5kg when completing all reps with good form'
        : 'Increase reps before adding weight',
    };
  });

  // Build warmup
  const warmup = buildWarmup(focus.muscleGroups);

  // Build cooldown
  const cooldown = buildCooldown(focus.muscleGroups, healthMods.prioritizeRecovery);

  // Calculate estimated duration
  const warmupDuration = warmup.durationMinutes;
  const mainDuration = programmedExercises.reduce(
    (sum, ex) => sum + (ex.sets * 1.5) + (ex.sets * ex.restSeconds / 60), // 1.5 min per set + rest
    0
  );
  const cooldownDuration = cooldown.durationMinutes;
  const estimatedDuration = Math.round(warmupDuration + mainDuration + cooldownDuration);

  return {
    dayOfWeek: focus.day,
    focus: focus.focus,
    isRestDay: false,
    estimatedDuration,
    warmup,
    mainWorkout: { exercises: programmedExercises },
    cooldown,
  };
}

function buildRestDay(focus: DayFocus, prioritizeRecovery: boolean): DayPlan {
  const activities: string[] = [];

  if (prioritizeRecovery) {
    activities.push('10-15 minutes of light stretching or yoga');
    activities.push('20-30 minute walk at easy pace');
    activities.push('Foam rolling for 10 minutes');
    activities.push('Focus on hydration and sleep');
  } else {
    activities.push('Light activity - walking, cycling, or swimming');
    activities.push('Optional: 10 minutes of mobility work');
    activities.push('Stay hydrated and prioritize sleep');
  }

  return {
    dayOfWeek: focus.day,
    focus: focus.focus || 'Rest & Recovery',
    isRestDay: true,
    estimatedDuration: 0,
    restDayActivities: activities,
  };
}

// ==================== WARMUP & COOLDOWN ====================

function buildWarmup(muscleGroups: string[]): WarmupSection {
  const exercises: WarmupSection['exercises'] = [
    { name: '5 minutes light cardio (bike, rowing, or brisk walk)', duration: '5 minutes' },
  ];

  // Add muscle-specific warmup movements
  const hasUpper = muscleGroups.some(m =>
    ['chest', 'back', 'shoulders', 'biceps', 'triceps'].includes(m.toLowerCase())
  );
  const hasLower = muscleGroups.some(m =>
    ['quadriceps', 'quads', 'hamstrings', 'glutes', 'calves', 'legs'].includes(m.toLowerCase())
  );

  if (hasUpper) {
    exercises.push(
      { name: 'Arm circles', duration: '30 seconds each direction' },
      { name: 'Band pull-aparts or wall slides', duration: '15 reps' },
      { name: 'Push-up plus', duration: '10 reps' }
    );
  }

  if (hasLower) {
    exercises.push(
      { name: 'Leg swings (front-back and side-to-side)', duration: '10 each leg' },
      { name: 'Bodyweight squats', duration: '15 reps' },
      { name: 'Walking lunges', duration: '10 steps each leg' }
    );
  }

  // General activation
  exercises.push({ name: 'Light sets of first exercise (50% working weight)', duration: '2 sets of 10' });

  return {
    description: 'Dynamic warmup to prepare muscles and joints',
    durationMinutes: 8,
    exercises,
  };
}

function buildCooldown(muscleGroups: string[], prioritizeRecovery: boolean): CooldownSection {
  const exercises: CooldownSection['exercises'] = [];

  const hasUpper = muscleGroups.some(m =>
    ['chest', 'back', 'shoulders', 'biceps', 'triceps'].includes(m.toLowerCase())
  );
  const hasLower = muscleGroups.some(m =>
    ['quadriceps', 'quads', 'hamstrings', 'glutes', 'calves', 'legs'].includes(m.toLowerCase())
  );

  // Light cardio to start
  exercises.push({ name: '3-5 minutes easy walking', duration: '3-5 minutes' });

  // Upper body stretches
  if (hasUpper) {
    exercises.push(
      { name: 'Chest doorway stretch', duration: '30 seconds each side' },
      { name: 'Cross-body shoulder stretch', duration: '30 seconds each arm' },
      { name: 'Tricep overhead stretch', duration: '30 seconds each arm' }
    );
  }

  // Lower body stretches
  if (hasLower) {
    exercises.push(
      { name: 'Standing quad stretch', duration: '30 seconds each leg' },
      { name: 'Standing hamstring stretch', duration: '30 seconds each leg' },
      { name: 'Hip flexor stretch (lunge position)', duration: '30 seconds each side' }
    );
  }

  // Extra recovery if prioritized
  if (prioritizeRecovery) {
    exercises.push(
      { name: 'Foam rolling on worked muscles', duration: '5 minutes' },
      { name: 'Deep breathing exercises', duration: '2 minutes' }
    );
  }

  return {
    description: 'Static stretching and recovery',
    durationMinutes: prioritizeRecovery ? 10 : 5,
    exercises,
  };
}

// ==================== PROGRESSION ====================

function buildProgressionGuidelines(
  goal: ForgeProfile['primary_goal'],
  experience: string
): ProgressionGuidelines {
  const strategy = getProgressionStrategy(goal, experience);

  return {
    strategy: strategy.strategy,
    weeklyIncrements: strategy.weeklyIncrements,
    repProgression: 'Complete all sets at the top of the rep range before increasing weight',
    deloadFrequency: strategy.deloadFrequency,
    plateauStrategy: 'If stuck for 2+ weeks: reduce weight by 10%, increase reps, rebuild',
  };
}

// ==================== HELPERS ====================

function mapFocusToCategory(
  focus: string
): 'push' | 'pull' | 'legs' | 'upper' | 'lower' | 'full_body' | 'cardio' | 'rest' {
  const lower = focus.toLowerCase();

  if (lower.includes('push') || lower.includes('chest')) return 'push';
  if (lower.includes('pull') || lower.includes('back')) return 'pull';
  if (lower.includes('leg') || lower.includes('lower body')) return 'legs';
  if (lower.includes('upper')) return 'upper';
  if (lower.includes('full body')) return 'full_body';
  if (lower.includes('cardio') || lower.includes('conditioning')) return 'cardio';
  if (lower.includes('rest')) return 'rest';

  // Default to full body if unclear
  return 'full_body';
}

function parseRestSeconds(restString: string): number {
  // Parse rest time strings like "2-3 minutes", "60-90 seconds", "90 seconds"
  const lower = restString.toLowerCase();

  if (lower.includes('minute')) {
    const match = lower.match(/(\d+)(?:-(\d+))?\s*minute/);
    if (match) {
      const max = match[2] ? parseInt(match[2]) : parseInt(match[1]);
      return max * 60;
    }
  }

  if (lower.includes('second')) {
    const match = lower.match(/(\d+)(?:-(\d+))?\s*second/);
    if (match) {
      const max = match[2] ? parseInt(match[2]) : parseInt(match[1]);
      return max;
    }
  }

  // Default to 90 seconds
  return 90;
}

function adjustRepRangesForHealth(
  baseRanges: RepRangeConfig,
  healthMods: TrainingModifications
): RepRangeConfig {
  // If significant intensity reduction, shift to higher reps
  if (healthMods.intensityAdjustment <= -20) {
    return {
      ...baseRanges,
      compound: {
        ...baseRanges.compound,
        reps: increaseRepRange(baseRanges.compound.reps, 2),
      },
      isolation: {
        ...baseRanges.isolation,
        reps: increaseRepRange(baseRanges.isolation.reps, 2),
      },
    };
  }

  return baseRanges;
}

function increaseRepRange(reps: string, increase: number): string {
  // Parse "8-10" -> "10-12"
  const match = reps.match(/(\d+)(?:-(\d+))?/);
  if (!match) return reps;

  const min = parseInt(match[1]) + increase;
  const max = match[2] ? parseInt(match[2]) + increase : min;

  return min === max ? `${min}` : `${min}-${max}`;
}

function adjustIntensityDescription(
  baseIntensity: string,
  adjustment: number
): string {
  if (adjustment === 0) return baseIntensity;

  if (adjustment <= -20) {
    return 'Light to moderate - focus on form and control, 4+ reps in reserve';
  }
  if (adjustment <= -10) {
    return 'Moderate - challenging but controlled, 3-4 reps in reserve';
  }
  if (adjustment >= 10) {
    return 'Heavy - pushing closer to failure, 1 rep in reserve';
  }

  return baseIntensity;
}

/**
 * Count total exercises in a plan
 */
export function countExercisesInPlan(plan: WorkoutPlanData): number {
  let count = 0;
  for (const week of plan.weeks) {
    for (const day of week.days) {
      if (day.mainWorkout?.exercises) {
        count += day.mainWorkout.exercises.length;
      }
    }
  }
  return count;
}

/**
 * Build a recovery-only plan when training should be skipped
 */
export function buildRecoveryOnlyPlan(profile: ForgeProfile): WorkoutPlanData {
  return {
    version: '1.0',
    generatedAt: new Date().toISOString(),
    splitType: 'full_body',
    userProfile: {
      goal: profile.primary_goal,
      experience: profile.experience_level,
      trainingDays: 0,
      sessionLength: 0,
    },
    weeks: [{
      weekNumber: 1,
      days: [
        {
          dayOfWeek: 'monday',
          focus: 'Recovery Day',
          isRestDay: true,
          estimatedDuration: 30,
          restDayActivities: [
            'Light walking for 20-30 minutes',
            'Gentle yoga or stretching for 15-20 minutes',
            'Foam rolling for muscle recovery',
            'Focus on hydration (aim for 2-3L water)',
            'Prioritize 7-8+ hours of sleep',
            'Consider a warm bath or sauna if available',
          ],
        },
      ],
    }],
    progression: {
      strategy: 'linear',
      weeklyIncrements: { upperBody: 'N/A', lowerBody: 'N/A' },
      repProgression: 'Focus on recovery first',
      deloadFrequency: 'Resume training when recovery improves',
      plateauStrategy: 'N/A',
    },
  };
}
