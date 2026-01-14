/**
 * Training Split Templates
 * Defines workout split patterns based on training frequency and goals
 */

import type {
  SplitType,
  SplitTemplate,
  DayFocus,
  FitnessGoal,
  DayOfWeek,
} from './types';

// ==================== SPLIT TEMPLATES ====================

export const SPLIT_TEMPLATES: Record<SplitType, SplitTemplate> = {
  push_pull_legs: {
    name: 'Push/Pull/Legs',
    description: 'Classic 6-day split targeting push muscles, pull muscles, and legs separately',
    minDays: 3,
    maxDays: 6,
    days: [
      {
        day: 'monday',
        focus: 'Push (Chest, Shoulders, Triceps)',
        isRest: false,
        muscleGroups: ['chest', 'shoulders', 'triceps'],
        exerciseTypes: ['weightTraining', 'calisthenics'],
      },
      {
        day: 'tuesday',
        focus: 'Pull (Back, Biceps, Rear Delts)',
        isRest: false,
        muscleGroups: ['back', 'biceps', 'rear_deltoid', 'lats'],
        exerciseTypes: ['weightTraining', 'calisthenics'],
      },
      {
        day: 'wednesday',
        focus: 'Legs (Quads, Hamstrings, Glutes, Calves)',
        isRest: false,
        muscleGroups: ['quadriceps', 'hamstrings', 'glutes', 'calves'],
        exerciseTypes: ['weightTraining'],
      },
      {
        day: 'thursday',
        focus: 'Rest & Active Recovery',
        isRest: true,
        muscleGroups: [],
        exerciseTypes: ['yoga', 'cardio'],
      },
      {
        day: 'friday',
        focus: 'Push (Chest, Shoulders, Triceps)',
        isRest: false,
        muscleGroups: ['chest', 'shoulders', 'triceps'],
        exerciseTypes: ['weightTraining', 'calisthenics'],
      },
      {
        day: 'saturday',
        focus: 'Pull (Back, Biceps, Rear Delts)',
        isRest: false,
        muscleGroups: ['back', 'biceps', 'rear_deltoid', 'lats'],
        exerciseTypes: ['weightTraining', 'calisthenics'],
      },
      {
        day: 'sunday',
        focus: 'Legs & Core',
        isRest: false,
        muscleGroups: ['quadriceps', 'hamstrings', 'glutes', 'core'],
        exerciseTypes: ['weightTraining'],
      },
    ],
  },

  upper_lower: {
    name: 'Upper/Lower',
    description: '4-day split alternating between upper and lower body',
    minDays: 3,
    maxDays: 5,
    days: [
      {
        day: 'monday',
        focus: 'Upper Body (Push Emphasis)',
        isRest: false,
        muscleGroups: ['chest', 'shoulders', 'triceps', 'back', 'biceps'],
        exerciseTypes: ['weightTraining', 'calisthenics'],
      },
      {
        day: 'tuesday',
        focus: 'Lower Body (Quad Emphasis)',
        isRest: false,
        muscleGroups: ['quadriceps', 'glutes', 'calves', 'core'],
        exerciseTypes: ['weightTraining'],
      },
      {
        day: 'wednesday',
        focus: 'Rest & Active Recovery',
        isRest: true,
        muscleGroups: [],
        exerciseTypes: ['yoga', 'cardio'],
      },
      {
        day: 'thursday',
        focus: 'Upper Body (Pull Emphasis)',
        isRest: false,
        muscleGroups: ['back', 'biceps', 'shoulders', 'chest', 'triceps'],
        exerciseTypes: ['weightTraining', 'calisthenics'],
      },
      {
        day: 'friday',
        focus: 'Lower Body (Hamstring Emphasis)',
        isRest: false,
        muscleGroups: ['hamstrings', 'glutes', 'calves', 'core'],
        exerciseTypes: ['weightTraining'],
      },
      {
        day: 'saturday',
        focus: 'Rest & Active Recovery',
        isRest: true,
        muscleGroups: [],
        exerciseTypes: ['yoga', 'cardio'],
      },
      {
        day: 'sunday',
        focus: 'Rest',
        isRest: true,
        muscleGroups: [],
        exerciseTypes: [],
      },
    ],
  },

  full_body: {
    name: 'Full Body',
    description: '3-day full body workouts with rest between sessions',
    minDays: 2,
    maxDays: 4,
    days: [
      {
        day: 'monday',
        focus: 'Full Body A (Compound Focus)',
        isRest: false,
        muscleGroups: ['chest', 'back', 'legs', 'shoulders', 'core'],
        exerciseTypes: ['weightTraining', 'calisthenics'],
      },
      {
        day: 'tuesday',
        focus: 'Rest & Active Recovery',
        isRest: true,
        muscleGroups: [],
        exerciseTypes: ['yoga', 'cardio'],
      },
      {
        day: 'wednesday',
        focus: 'Full Body B (Strength Focus)',
        isRest: false,
        muscleGroups: ['chest', 'back', 'legs', 'shoulders', 'core'],
        exerciseTypes: ['weightTraining', 'calisthenics'],
      },
      {
        day: 'thursday',
        focus: 'Rest & Active Recovery',
        isRest: true,
        muscleGroups: [],
        exerciseTypes: ['yoga', 'cardio'],
      },
      {
        day: 'friday',
        focus: 'Full Body C (Volume Focus)',
        isRest: false,
        muscleGroups: ['chest', 'back', 'legs', 'shoulders', 'core'],
        exerciseTypes: ['weightTraining', 'calisthenics'],
      },
      {
        day: 'saturday',
        focus: 'Cardio & Conditioning',
        isRest: false,
        muscleGroups: [],
        exerciseTypes: ['hiit', 'cardio', 'running'],
      },
      {
        day: 'sunday',
        focus: 'Rest',
        isRest: true,
        muscleGroups: [],
        exerciseTypes: [],
      },
    ],
  },

  bro_split: {
    name: 'Bro Split',
    description: '5-day split targeting one muscle group per day',
    minDays: 4,
    maxDays: 6,
    days: [
      {
        day: 'monday',
        focus: 'Chest',
        isRest: false,
        muscleGroups: ['chest'],
        exerciseTypes: ['weightTraining'],
      },
      {
        day: 'tuesday',
        focus: 'Back',
        isRest: false,
        muscleGroups: ['back', 'lats'],
        exerciseTypes: ['weightTraining'],
      },
      {
        day: 'wednesday',
        focus: 'Shoulders',
        isRest: false,
        muscleGroups: ['shoulders'],
        exerciseTypes: ['weightTraining'],
      },
      {
        day: 'thursday',
        focus: 'Legs',
        isRest: false,
        muscleGroups: ['quadriceps', 'hamstrings', 'glutes', 'calves'],
        exerciseTypes: ['weightTraining'],
      },
      {
        day: 'friday',
        focus: 'Arms (Biceps & Triceps)',
        isRest: false,
        muscleGroups: ['biceps', 'triceps'],
        exerciseTypes: ['weightTraining'],
      },
      {
        day: 'saturday',
        focus: 'Rest & Active Recovery',
        isRest: true,
        muscleGroups: [],
        exerciseTypes: ['yoga', 'cardio'],
      },
      {
        day: 'sunday',
        focus: 'Rest',
        isRest: true,
        muscleGroups: [],
        exerciseTypes: [],
      },
    ],
  },

  auto: {
    name: 'Auto-Select',
    description: 'Automatically selected based on training days and goals',
    minDays: 2,
    maxDays: 7,
    days: [], // Will be populated dynamically
  },
};

// ==================== SPLIT SELECTION LOGIC ====================

/**
 * Auto-select the best split based on training days and goal
 */
export function selectSplitType(
  trainingDays: number,
  goal: FitnessGoal
): Exclude<SplitType, 'auto'> {
  // For 2-3 days: Full Body is most effective
  if (trainingDays <= 3) {
    return 'full_body';
  }

  // For 4 days: Upper/Lower provides good frequency
  if (trainingDays === 4) {
    return 'upper_lower';
  }

  // For 5+ days: Depends on goal
  if (trainingDays >= 5) {
    // Strength and muscle building benefit from PPL
    if (goal === 'buildMuscle' || goal === 'getStronger') {
      return 'push_pull_legs';
    }
    // Other goals can use bro split or PPL
    return 'push_pull_legs';
  }

  // Default
  return 'upper_lower';
}

/**
 * Adjust split template for specific number of training days
 */
export function adjustSplitForDays(
  splitType: Exclude<SplitType, 'auto'>,
  trainingDays: number
): DayFocus[] {
  const template = SPLIT_TEMPLATES[splitType];
  const allDays: DayOfWeek[] = [
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
  ];

  // Get training days from template (non-rest days)
  const trainingDaysFromTemplate = template.days.filter(d => !d.isRest);

  // If we need fewer days, select the most important ones
  if (trainingDays < trainingDaysFromTemplate.length) {
    const selectedDays: DayFocus[] = [];
    let dayIndex = 0;

    for (let i = 0; i < 7; i++) {
      if (selectedDays.filter(d => !d.isRest).length >= trainingDays) {
        // Fill remaining days as rest
        selectedDays.push({
          day: allDays[i],
          focus: 'Rest',
          isRest: true,
          muscleGroups: [],
          exerciseTypes: [],
        });
      } else if (dayIndex < trainingDaysFromTemplate.length) {
        // Add training day with proper day of week
        selectedDays.push({
          ...trainingDaysFromTemplate[dayIndex],
          day: allDays[i],
        });
        dayIndex++;

        // Add rest day after each training day for recovery
        if (trainingDays <= 3 && i < 6) {
          i++;
          selectedDays.push({
            day: allDays[i],
            focus: 'Rest & Recovery',
            isRest: true,
            muscleGroups: [],
            exerciseTypes: ['yoga'],
          });
        }
      }
    }

    return selectedDays;
  }

  // Return the full template adjusted for 7 days
  return template.days;
}

// ==================== REP RANGES BY GOAL ====================

export interface RepRangeConfig {
  compound: { sets: string; reps: string; rest: string };
  isolation: { sets: string; reps: string; rest: string };
  intensity: string;
}

export function getRepRangesForGoal(goal: FitnessGoal): RepRangeConfig {
  switch (goal) {
    case 'getStronger':
      return {
        compound: { sets: '4-5', reps: '3-6', rest: '3-4 minutes' },
        isolation: { sets: '3', reps: '6-8', rest: '2 minutes' },
        intensity: 'Heavy - 1-2 reps in reserve',
      };

    case 'buildMuscle':
      return {
        compound: { sets: '4', reps: '6-10', rest: '2-3 minutes' },
        isolation: { sets: '3-4', reps: '10-12', rest: '60-90 seconds' },
        intensity: 'Moderate to Heavy - 2-3 reps in reserve',
      };

    case 'loseFat':
      return {
        compound: { sets: '3-4', reps: '10-15', rest: '60-90 seconds' },
        isolation: { sets: '3', reps: '12-15', rest: '45-60 seconds' },
        intensity: 'Moderate - keep heart rate elevated',
      };

    case 'improveEndurance':
      return {
        compound: { sets: '3', reps: '15-20', rest: '30-60 seconds' },
        isolation: { sets: '2-3', reps: '15-20', rest: '30 seconds' },
        intensity: 'Light to Moderate - sustainable effort',
      };

    case 'flexibility':
      return {
        compound: { sets: '2-3', reps: '10-12', rest: '60 seconds' },
        isolation: { sets: '2', reps: '12-15', rest: '45 seconds' },
        intensity: 'Light - focus on full range of motion',
      };

    case 'generalFitness':
    default:
      return {
        compound: { sets: '3-4', reps: '8-12', rest: '90 seconds' },
        isolation: { sets: '3', reps: '10-15', rest: '60 seconds' },
        intensity: 'Moderate - challenging but sustainable',
      };
  }
}

// ==================== PROGRESSION STRATEGY ====================

export function getProgressionStrategy(goal: FitnessGoal, experience: string): {
  strategy: 'linear' | 'undulating' | 'block';
  description: string;
  weeklyIncrements: { upperBody: string; lowerBody: string };
  deloadFrequency: string;
} {
  if (experience === 'beginner') {
    return {
      strategy: 'linear',
      description: 'Add weight each session when you complete all reps with good form',
      weeklyIncrements: {
        upperBody: '1-2.5 kg per week',
        lowerBody: '2.5-5 kg per week',
      },
      deloadFrequency: 'Every 6-8 weeks or when progress stalls',
    };
  }

  if (goal === 'getStronger') {
    return {
      strategy: 'block',
      description: 'Periodize training in 3-4 week blocks with varying intensity',
      weeklyIncrements: {
        upperBody: '1-2 kg per block',
        lowerBody: '2-3 kg per block',
      },
      deloadFrequency: 'Every 4th week',
    };
  }

  return {
    strategy: 'undulating',
    description: 'Vary rep ranges within the week to stimulate different adaptations',
    weeklyIncrements: {
      upperBody: '1-2.5 kg when completing rep targets',
      lowerBody: '2.5-5 kg when completing rep targets',
    },
    deloadFrequency: 'Every 4-6 weeks',
  };
}
