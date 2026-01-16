/**
 * Workout Plan Generator Types
 * Database-first approach using forge_exercises table
 */

// ==================== DATABASE TYPES ====================

export interface ForgeExercise {
  id: string;
  name: string;
  description: string | null;
  exercise_type: ExerciseType;
  muscle_groups: string[];
  equipment_required: string[];
  difficulty_level: DifficultyLevel;
  alternatives: string[];
  instructions: string[];
  tips: string[];
  common_mistakes: string[];
  video_url: string | null;
  image_url: string | null;
  thumbnail_url: string | null;
  is_compound: boolean;
  is_unilateral: boolean;
  calories_per_minute: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ForgeProfile {
  id: string;
  user_email: string;
  primary_goal: FitnessGoal;
  experience_level: DifficultyLevel;
  training_days_per_week: number;
  session_length_minutes: number;
  equipment: string[];
  preferred_exercises: ExerciseType[];
  injuries: InjuryArea[];
  additional_notes: string | null;
  created_at: string;
  updated_at: string;
}

// ==================== ENUMS ====================

export type ExerciseType =
  | 'weightTraining'
  | 'hiit'
  | 'cardio'
  | 'yoga'
  | 'pilates'
  | 'calisthenics'
  | 'crossfit'
  | 'running';

export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';

export type FitnessGoal =
  | 'buildMuscle'
  | 'loseFat'
  | 'getStronger'
  | 'improveEndurance'
  | 'flexibility'
  | 'generalFitness';

export type InjuryArea =
  | 'shoulder'
  | 'elbow'
  | 'wrist'
  | 'lower_back'
  | 'hip'
  | 'knee'
  | 'ankle'
  | 'neck';

export type SplitType =
  | 'push_pull_legs'
  | 'upper_lower'
  | 'full_body'
  | 'bro_split'
  | 'auto';

export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

// ==================== CATEGORIZED EXERCISES ====================

export interface CategorizedExercises {
  push: ForgeExercise[];      // chest, shoulders, triceps
  pull: ForgeExercise[];      // back, biceps, rear delts
  legs: ForgeExercise[];      // quads, hamstrings, glutes, calves
  core: ForgeExercise[];      // abs, obliques
  cardio: ForgeExercise[];    // running, hiit, cardio types
  flexibility: ForgeExercise[]; // yoga, pilates, stretching
  compound: ForgeExercise[];  // multi-joint movements
  isolation: ForgeExercise[]; // single-joint movements
}

// ==================== QUERY PARAMS ====================

export interface ExerciseQueryParams {
  equipmentAvailable: string[];
  injuriesToAvoid: InjuryArea[];
  experienceLevel: DifficultyLevel;
  exerciseTypes: ExerciseType[];
  muscleGroups?: string[];
}

// ==================== PLAN STRUCTURE ====================

export interface WorkoutPlanData {
  version: '1.0';
  generatedAt: string;
  splitType: SplitType;
  userProfile: {
    goal: FitnessGoal;
    experience: DifficultyLevel;
    trainingDays: number;
    sessionLength: number;
  };
  weeks: WeekPlan[];
  progression: ProgressionGuidelines;
}

export interface WeekPlan {
  weekNumber: number;
  days: DayPlan[];
}

export interface DayPlan {
  dayOfWeek: DayOfWeek;
  focus: string;
  isRestDay: boolean;
  estimatedDuration: number; // minutes
  warmup?: WarmupSection;
  mainWorkout?: MainWorkoutSection;
  cooldown?: CooldownSection;
  restDayActivities?: string[];
}

export interface WarmupSection {
  description: string;
  durationMinutes: number;
  exercises: WarmupExercise[];
}

export interface WarmupExercise {
  name: string;
  duration: string; // e.g., "30 seconds", "10 reps"
  notes?: string;
}

export interface MainWorkoutSection {
  exercises: ProgrammedExercise[];
}

export interface ProgrammedExercise {
  // Reference to forge_exercises
  exerciseId: string;
  exerciseName: string;

  // Programming
  sets: number;
  reps: string;            // e.g., "8-10", "12", "30 seconds"
  restSeconds: number;

  // Intensity (simple language)
  intensity: string;       // e.g., "Moderate - 2-3 reps in reserve"
  weight?: string;         // e.g., "Start with 60kg", "Bodyweight"
  tempo?: string;          // e.g., "2-0-2" (down-pause-up)

  // Progression
  progressionNotes?: string;

  // From database (denormalized for fast rendering)
  tips: string[];
  commonMistakes: string[];
  isCompound: boolean;
  muscleGroups: string[];
}

export interface CooldownSection {
  description: string;
  durationMinutes: number;
  exercises: CooldownExercise[];
}

export interface CooldownExercise {
  name: string;
  duration: string;
  notes?: string;
}

export interface ProgressionGuidelines {
  strategy: 'linear' | 'undulating' | 'block';
  weeklyIncrements: {
    upperBody: string;
    lowerBody: string;
  };
  repProgression: string;
  deloadFrequency: string;
  plateauStrategy: string;
}

// ==================== API TYPES ====================

export interface GenerateWorkoutPlanRequest {
  userEmail: string;
  overrides?: {
    trainingDays?: number;
    sessionLength?: number;
    splitType?: SplitType;
    excludeExercises?: string[]; // exercise IDs to exclude
  };
}

export interface GenerateWorkoutPlanResponse {
  success: boolean;
  planId?: string;
  plan?: WorkoutPlanData;
  error?: string;
  metadata?: {
    exercisesUsed: number;
    exercisesAvailable: number;
    generationTimeMs: number;
    estimatedCost: number;
    splitTypeUsed: SplitType;
  };
}

// ==================== SPLIT TEMPLATES ====================

export interface DayFocus {
  day: DayOfWeek;
  focus: string;
  isRest: boolean;
  muscleGroups: string[];
  exerciseTypes: ExerciseType[];
}

export interface SplitTemplate {
  name: string;
  description: string;
  minDays: number;
  maxDays: number;
  days: DayFocus[];
}

// ==================== HEALTH-AWARE TRAINING MODIFICATIONS ====================

/**
 * AI-interpreted training modifications based on health data
 * Cached for 24 hours
 */
export interface TrainingModifications {
  // Global adjustments (percentages, -30 to +10)
  volumeAdjustment: number;
  intensityAdjustment: number;

  // Flags
  avoidHighIntensity: boolean;
  prioritizeRecovery: boolean;
  skipTrainingToday: boolean;

  // Training day adjustments
  extraRestDays: number;
  maxTrainingDays: number | null;

  // Muscle-specific modifications
  muscleGroupModifiers: Record<string, MuscleGroupModifier>;

  // Exercise type restrictions
  avoidExerciseTypes: ExerciseType[];
  prioritizeExerciseTypes: ExerciseType[];

  // Metadata
  reasoningSummary: string;
  dataSourcesUsed: string[];
  generatedAt: string;
  expiresAt: string;
}

export interface MuscleGroupModifier {
  avoid?: boolean;
  reduceVolume?: number;
  reason?: string;
}

/**
 * Default training modifications (no health concerns)
 */
export function getDefaultTrainingModifications(): TrainingModifications {
  return {
    volumeAdjustment: 0,
    intensityAdjustment: 0,
    avoidHighIntensity: false,
    prioritizeRecovery: false,
    skipTrainingToday: false,
    extraRestDays: 0,
    maxTrainingDays: null,
    muscleGroupModifiers: {},
    avoidExerciseTypes: [],
    prioritizeExerciseTypes: [],
    reasoningSummary: 'Normal training - no health concerns detected',
    dataSourcesUsed: [],
    generatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

// ==================== UNIFIED HEALTH CONTEXT ====================

/**
 * Aggregated health data from all sources for AI interpretation
 */
export interface UnifiedHealthContext {
  bloodBiomarkers?: BloodBiomarkersContext;
  recovery?: RecoveryContext;
  sleep?: SleepContext;
  glucose?: GlucoseContext;
  activity?: ActivityContext;
}

export interface BloodBiomarkersContext {
  available: boolean;
  lastTestDate?: string;
  biomarkers?: Array<{
    name: string;
    value: number;
    unit: string;
    status: 'normal' | 'low' | 'high' | 'critical';
    referenceRange?: string;
  }>;
}

export interface RecoveryContext {
  source: 'oura' | 'whoop' | 'apple_health' | 'manual';
  score?: number; // 0-100
  status?: 'red' | 'yellow' | 'green';
  hrvAvg?: number;
  hrvTrend?: 'improving' | 'stable' | 'declining';
  restingHR?: number;
  strainLevel?: number;
  overtrainingRisk?: 'low' | 'moderate' | 'high';
}

export interface SleepContext {
  source: 'oura' | 'whoop' | 'apple_health' | 'manual';
  avgHoursLast7Days: number;
  lastNightHours?: number;
  quality: 'poor' | 'fair' | 'good' | 'excellent';
  deepSleepMinutes?: number;
  remSleepMinutes?: number;
  sleepDebtHours?: number;
}

export interface GlucoseContext {
  source: 'dexcom' | 'libre' | 'manual';
  avgGlucose: number; // mg/dL
  variabilityCV: number; // coefficient of variation %
  timeInRange: number; // % time in 70-180 mg/dL
  spikeCountLast24h: number;
  status: 'optimal' | 'good' | 'needs_optimization';
}

export interface ActivityContext {
  source: 'apple_health' | 'whoop' | 'oura' | 'manual';
  avgStepsLast7Days: number;
  workoutsLast7Days: number;
  activityLevel: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active';
  lastWorkoutDate?: string;
  lastWorkoutType?: string;
}

// ==================== ENHANCED QUERY PARAMS ====================

export interface EnhancedExerciseQueryParams extends ExerciseQueryParams {
  healthModifications?: TrainingModifications;
  excludeMuscleGroups?: string[];
  maxDifficulty?: DifficultyLevel;
  preferCompound?: boolean;
  avoidHighImpact?: boolean;
}
