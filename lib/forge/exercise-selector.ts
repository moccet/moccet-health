/**
 * Exercise Selector
 * Queries and filters exercises from forge_exercises based on user profile
 */

import { getServiceClient } from '@/lib/supabase/server';
import type {
  ForgeExercise,
  ForgeProfile,
  ExerciseQueryParams,
  CategorizedExercises,
  DifficultyLevel,
  InjuryArea,
} from './types';

// ==================== INJURY TO MUSCLE MAPPING ====================

/**
 * Maps injury areas to muscle groups that should be avoided or modified
 */
const INJURY_MUSCLE_MAP: Record<InjuryArea, string[]> = {
  shoulder: ['shoulders', 'deltoids', 'front_deltoid', 'side_deltoid', 'rear_deltoid', 'rotator_cuff'],
  elbow: ['triceps', 'biceps', 'forearms'],
  wrist: ['forearms', 'wrists', 'grip'],
  lower_back: ['lower_back', 'erector_spinae', 'lower back', 'spine'],
  hip: ['hip_flexors', 'glutes', 'hip', 'hips'],
  knee: ['quadriceps', 'quads', 'hamstrings', 'knees'],
  ankle: ['calves', 'ankles', 'feet'],
  neck: ['neck', 'traps', 'upper_traps', 'trapezius'],
};

// ==================== MUSCLE GROUP CATEGORIZATION ====================

const PUSH_MUSCLES = ['chest', 'shoulders', 'triceps', 'front_deltoid', 'pectorals', 'deltoids'];
const PULL_MUSCLES = ['back', 'biceps', 'lats', 'rear_deltoid', 'rhomboids', 'traps', 'forearms', 'upper back'];
const LEG_MUSCLES = ['quadriceps', 'quads', 'hamstrings', 'glutes', 'calves', 'hip_flexors', 'adductors', 'abductors', 'legs'];
const CORE_MUSCLES = ['core', 'abs', 'obliques', 'lower_back', 'abdominals', 'transverse_abdominis'];

// ==================== DIFFICULTY FILTERING ====================

/**
 * Get allowed difficulty levels based on user's experience
 * Beginners see beginner exercises
 * Intermediate sees beginner + intermediate
 * Advanced sees all
 */
function getAllowedDifficultyLevels(userLevel: DifficultyLevel): DifficultyLevel[] {
  switch (userLevel) {
    case 'beginner':
      return ['beginner'];
    case 'intermediate':
      return ['beginner', 'intermediate'];
    case 'advanced':
      return ['beginner', 'intermediate', 'advanced'];
    default:
      return ['beginner', 'intermediate'];
  }
}

// ==================== MAIN QUERY FUNCTION ====================

/**
 * Query eligible exercises from the database based on user parameters
 */
export async function queryEligibleExercises(
  params: ExerciseQueryParams
): Promise<ForgeExercise[]> {
  const supabase = getServiceClient();

  // Get allowed difficulty levels
  const allowedLevels = getAllowedDifficultyLevels(params.experienceLevel);

  // Build base query
  let query = supabase
    .from('forge_exercises')
    .select('*')
    .eq('is_active', true)
    .in('difficulty_level', allowedLevels);

  // Filter by exercise type if specified
  if (params.exerciseTypes.length > 0) {
    query = query.in('exercise_type', params.exerciseTypes);
  }

  // Execute query
  const { data: exercises, error } = await query;

  if (error) {
    console.error('[ExerciseSelector] Database query error:', error);
    throw new Error(`Failed to query exercises: ${error.message}`);
  }

  if (!exercises || exercises.length === 0) {
    console.warn('[ExerciseSelector] No exercises found matching criteria');
    return [];
  }

  console.log(`[ExerciseSelector] Found ${exercises.length} exercises before filtering`);

  // Post-query filtering for JSONB arrays (equipment and injuries)
  const filteredExercises = exercises.filter((ex: ForgeExercise) => {
    // Check equipment compatibility
    const requiredEquipment = (ex.equipment_required || []) as string[];
    const hasEquipment =
      requiredEquipment.length === 0 ||
      requiredEquipment.every((eq) =>
        params.equipmentAvailable.some(
          (available) => available.toLowerCase() === eq.toLowerCase()
        )
      );

    // Check injury compatibility
    const targetMuscles = (ex.muscle_groups || []) as string[];
    const avoidsInjuries = !params.injuriesToAvoid.some((injury) => {
      const musclestoAvoid = INJURY_MUSCLE_MAP[injury] || [];
      return musclestoAvoid.some((muscle) =>
        targetMuscles.some((target) => target.toLowerCase().includes(muscle.toLowerCase()))
      );
    });

    return hasEquipment && avoidsInjuries;
  });

  console.log(`[ExerciseSelector] ${filteredExercises.length} exercises after filtering`);

  return filteredExercises;
}

// ==================== CATEGORIZATION ====================

/**
 * Categorize exercises into push/pull/legs/core groups for split-based programming
 */
export function categorizeExercises(exercises: ForgeExercise[]): CategorizedExercises {
  const categorized: CategorizedExercises = {
    push: [],
    pull: [],
    legs: [],
    core: [],
    cardio: [],
    flexibility: [],
    compound: [],
    isolation: [],
  };

  for (const ex of exercises) {
    const muscleGroups = (ex.muscle_groups || []).map((m) => m.toLowerCase());
    const exerciseType = ex.exercise_type;

    // Categorize by exercise type first
    if (['cardio', 'hiit', 'running'].includes(exerciseType)) {
      categorized.cardio.push(ex);
      continue;
    }

    if (['yoga', 'pilates'].includes(exerciseType)) {
      categorized.flexibility.push(ex);
      continue;
    }

    // Categorize by muscle groups
    const isPush = muscleGroups.some((m) =>
      PUSH_MUSCLES.some((pm) => m.includes(pm.toLowerCase()))
    );
    const isPull = muscleGroups.some((m) =>
      PULL_MUSCLES.some((pm) => m.includes(pm.toLowerCase()))
    );
    const isLegs = muscleGroups.some((m) =>
      LEG_MUSCLES.some((lm) => m.includes(lm.toLowerCase()))
    );
    const isCore = muscleGroups.some((m) =>
      CORE_MUSCLES.some((cm) => m.includes(cm.toLowerCase()))
    );

    // Add to appropriate categories (can be in multiple)
    if (isPush) categorized.push.push(ex);
    if (isPull) categorized.pull.push(ex);
    if (isLegs) categorized.legs.push(ex);
    if (isCore) categorized.core.push(ex);

    // Also categorize by compound/isolation
    if (ex.is_compound) {
      categorized.compound.push(ex);
    } else {
      categorized.isolation.push(ex);
    }

    // If exercise doesn't fit any category, try to infer from name
    if (!isPush && !isPull && !isLegs && !isCore) {
      const name = ex.name.toLowerCase();
      if (name.includes('press') || name.includes('push') || name.includes('fly')) {
        categorized.push.push(ex);
      } else if (name.includes('row') || name.includes('pull') || name.includes('curl')) {
        categorized.pull.push(ex);
      } else if (name.includes('squat') || name.includes('lunge') || name.includes('deadlift')) {
        categorized.legs.push(ex);
      } else if (name.includes('crunch') || name.includes('plank') || name.includes('ab')) {
        categorized.core.push(ex);
      }
    }
  }

  console.log('[ExerciseSelector] Categorized exercises:', {
    push: categorized.push.length,
    pull: categorized.pull.length,
    legs: categorized.legs.length,
    core: categorized.core.length,
    cardio: categorized.cardio.length,
    flexibility: categorized.flexibility.length,
    compound: categorized.compound.length,
    isolation: categorized.isolation.length,
  });

  return categorized;
}

// ==================== PROFILE LOADING ====================

/**
 * Load user profile from forge_profiles table
 */
export async function loadUserProfile(userEmail: string): Promise<ForgeProfile | null> {
  const supabase = getServiceClient();

  const { data: profile, error } = await supabase
    .from('forge_profiles')
    .select('*')
    .eq('user_email', userEmail)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows found
      console.log(`[ExerciseSelector] No profile found for ${userEmail}`);
      return null;
    }
    console.error('[ExerciseSelector] Error loading profile:', error);
    throw new Error(`Failed to load profile: ${error.message}`);
  }

  return profile;
}

// ==================== EQUIPMENT MAPPING ====================

/**
 * Standard equipment names for consistent matching
 */
export const STANDARD_EQUIPMENT = [
  'barbell',
  'dumbbells',
  'kettlebell',
  'cable_machine',
  'resistance_bands',
  'pull_up_bar',
  'bench',
  'squat_rack',
  'leg_press',
  'smith_machine',
  'ez_bar',
  'medicine_ball',
  'stability_ball',
  'foam_roller',
  'trx',
  'rowing_machine',
  'treadmill',
  'stationary_bike',
  'elliptical',
  'yoga_mat',
  'bodyweight', // Always available
] as const;

/**
 * Map user equipment selections to standard equipment names
 */
export function normalizeEquipment(userEquipment: string[]): string[] {
  const normalized: string[] = ['bodyweight']; // Always include bodyweight

  const equipmentMap: Record<string, string[]> = {
    fullGym: [
      'barbell', 'dumbbells', 'kettlebell', 'cable_machine', 'bench',
      'squat_rack', 'leg_press', 'smith_machine', 'ez_bar', 'pull_up_bar',
      'rowing_machine', 'treadmill', 'stationary_bike',
    ],
    homeGym: [
      'barbell', 'dumbbells', 'bench', 'squat_rack', 'pull_up_bar',
    ],
    dumbbellsOnly: ['dumbbells'],
    kettlebells: ['kettlebell'],
    resistanceBands: ['resistance_bands'],
    bodyweightOnly: ['bodyweight'],
  };

  for (const eq of userEquipment) {
    if (equipmentMap[eq]) {
      normalized.push(...equipmentMap[eq]);
    } else {
      // Direct equipment name
      normalized.push(eq.toLowerCase().replace(/\s+/g, '_'));
    }
  }

  // Remove duplicates
  return [...new Set(normalized)];
}

// ==================== HELPER: GET EXERCISES FOR SPLIT ====================

/**
 * Get exercises appropriate for a specific split day
 */
export function getExercisesForDay(
  categorized: CategorizedExercises,
  focus: 'push' | 'pull' | 'legs' | 'upper' | 'lower' | 'full_body' | 'cardio' | 'rest'
): ForgeExercise[] {
  switch (focus) {
    case 'push':
      return categorized.push;
    case 'pull':
      return categorized.pull;
    case 'legs':
    case 'lower':
      return categorized.legs;
    case 'upper':
      return [...categorized.push, ...categorized.pull];
    case 'full_body':
      return [
        ...categorized.compound,
        ...categorized.push.slice(0, 3),
        ...categorized.pull.slice(0, 3),
        ...categorized.legs.slice(0, 3),
      ];
    case 'cardio':
      return categorized.cardio;
    case 'rest':
      return categorized.flexibility;
    default:
      return [];
  }
}
