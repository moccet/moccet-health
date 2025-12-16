/**
 * Forge Plan Output Types
 *
 * These types MUST match the UI expectations in /forge/personalised-plan exactly.
 * The UI parses this structure directly - any mismatch will break rendering.
 */

// ============================================================================
// EXERCISE TYPES
// ============================================================================

export interface WarmupExercise {
  name: string;
  sets: string;                    // e.g., "2 sets"
  reps: string;                    // e.g., "10 reps each direction"
  notes: string;                   // MAX 15 words - form cues
}

export interface MainExercise {
  exercise: string;                // Exercise name (REQUIRED)
  sets: string;                    // e.g., "4 sets" (REQUIRED)
  reps: string;                    // e.g., "6-8 reps" (REQUIRED)
  weight: string;                  // NEVER empty! e.g., "80 kg", "Bodyweight" (REQUIRED)
  rest: string;                    // e.g., "90 seconds" (REQUIRED)
  tempo: string;                   // Plain language: "Lower 2 sec, lift 1 sec" (REQUIRED)
  intensity: string;               // Plain language: "Challenging but doable" (REQUIRED)
  notes: string;                   // MAX 15 words - form cues
  progressionNotes?: string;       // MAX 15 words - how to progress
}

export interface CooldownExercise {
  name: string;
  duration: string;                // e.g., "2 minutes", "30 seconds"
  notes: string;                   // MAX 15 words
}

// ============================================================================
// DAY WORKOUT STRUCTURE
// ============================================================================

export interface DayWorkout {
  dayName: string;                 // "Monday", "Tuesday", etc.
  focus: string;                   // "Lower Body Strength", "Rest & Recovery"
  duration: string;                // "45-60 minutes", "N/A" for rest days

  warmup: {
    description: string;           // Brief warmup overview (MAX 15 words)
    exercises: WarmupExercise[];
  };

  mainWorkout: MainExercise[];

  cooldown: {
    description: string;           // Brief cooldown overview (MAX 15 words)
    exercises: CooldownExercise[];
  };

  // Optional for rest days
  activities?: string;             // For rest days: "Light stretching or complete rest"
  isRestDay?: boolean;
}

// ============================================================================
// WEEKLY PROGRAM
// ============================================================================

export interface WeeklyProgram {
  monday: DayWorkout;
  tuesday: DayWorkout;
  wednesday: DayWorkout;
  thursday: DayWorkout;
  friday: DayWorkout;
  saturday: DayWorkout;
  sunday: DayWorkout;
}

// ============================================================================
// TRAINING PHILOSOPHY
// ============================================================================

export interface KeyPrinciple {
  principle: string;
  description: string;             // 1-2 sentences (20-40 words)
}

export interface TrainingPhilosophy {
  approach: string;                // 2-3 paragraphs (200-300 words)
  keyPrinciples: KeyPrinciple[];
  progressionStrategy: string;     // 2-3 paragraphs (200-300 words)
}

// ============================================================================
// WEEKLY STRUCTURE
// ============================================================================

export interface WeeklyStructure {
  overview: string;                // 2-3 paragraphs describing the split
  trainingDays: number;            // e.g., 4, 5, 6
  focusAreas: string[];            // Array of "Day Description" strings
  rationale?: string;              // Why this split
  volumeDistribution?: string;     // How volume is spread
  intensityFramework?: string;     // Intensity management approach
}

// ============================================================================
// RECOVERY PROTOCOL
// ============================================================================

export interface RecoveryProtocol {
  personalizedIntro?: string;
  dailyPractices?: string[];
  weeklyPractices?: string[];
  sleepOptimization?: string;
  stressManagement?: string;
  mobilityWork?: string;
  activeRecovery?: string;
  personalizedNotes?: string;
}

// ============================================================================
// SUPPLEMENTS
// ============================================================================

export interface SupplementRecommendation {
  supplement: string;
  dosage: string;
  timing: string;
  rationale: string;
  duration: string;
}

export interface SupplementRecommendations {
  essential?: SupplementRecommendation[];
  optional?: SupplementRecommendation[];
  considerations?: string;
  personalizedNotes?: string;
}

// ============================================================================
// NUTRITION GUIDANCE
// ============================================================================

export interface NutritionGuidance {
  personalizedIntro?: string;
  proteinTarget: string | { target?: string; range?: string; rationale?: string };
  calorieGuidance: string | { target?: string; range?: string; rationale?: string };
  mealTiming: string | {
    mealsPerDay?: string | number;
    preworkout?: string;
    postworkout?: string;
    generalGuidance?: string;
  };
  hydration: string | { dailyTarget?: string; timing?: string };
  macroBreakdown?: string;
  mealFrequency?: string;
  supplementTiming?: string;
}

// ============================================================================
// PROGRESS TRACKING
// ============================================================================

export interface ProgressTracking {
  metricsOverview?: string;
  weeklyMetrics?: string[];
  monthlyMetrics?: string[];
  performanceBenchmarks?: string[];
  biometricTargets?: string;
  reassessmentSchedule?: string;
  progressionIndicators?: string;
}

// ============================================================================
// INJURY PREVENTION
// ============================================================================

export interface InjuryPrevention {
  personalizedRiskAssessment?: string;
  commonRisks: string[];
  preventionStrategies: string[];
  warningSignals: string[];
  injuryProtocol?: string;
  mobilityPrescription?: string;
}

// ============================================================================
// ADAPTIVE FEATURES
// ============================================================================

export interface AdaptiveFeatures {
  energyBasedAdjustments?: string;
  highEnergyDay: string | { description?: string; modifications?: string[] };
  normalEnergyDay?: string;
  lowEnergyDay: string | { description?: string; modifications?: string[] };
  travelAdjustments: string;
  busyScheduleAdjustments?: string;
  scheduleAdaptations?: string;
}

// ============================================================================
// MAIN FORGE FITNESS PLAN OUTPUT
// ============================================================================

export interface ForgeFitnessPlan {
  // Core identity fields (REQUIRED)
  personalizedGreeting: string;    // e.g., "John's Personalized 8-Week Program"
  executiveSummary: string;        // 2-3 paragraphs explaining the approach

  // Training Definition (REQUIRED)
  trainingPhilosophy: TrainingPhilosophy;
  weeklyStructure: WeeklyStructure;
  weeklyProgram: WeeklyProgram;    // lowercase keys: monday, tuesday, etc.

  // Support Systems (REQUIRED)
  recoveryProtocol: RecoveryProtocol;
  supplementRecommendations: SupplementRecommendations;
  nutritionGuidance: NutritionGuidance;

  // Progress & Safety (REQUIRED)
  progressTracking: ProgressTracking;
  injuryPrevention: InjuryPrevention;
  adaptiveFeatures: AdaptiveFeatures;
}

// ============================================================================
// AGENT OUTPUT TYPES
// ============================================================================

export interface ProgramDesignerOutput {
  trainingPhilosophy: TrainingPhilosophy;
  weeklyStructure: WeeklyStructure;
  dayFocusAssignments: {
    monday: string;
    tuesday: string;
    wednesday: string;
    thursday: string;
    friday: string;
    saturday: string;
    sunday: string;
  };
}

export interface ExercisePrescriberOutput {
  weeklyProgram: WeeklyProgram;
}

export interface FormCoachOutput {
  weeklyProgram: WeeklyProgram;    // Same structure but with polished notes
}

export interface AdaptiveReadiness {
  readinessIndicators?: string;
  lowReadinessProtocol?: string;
  highEnergyDay?: string | { description?: string; modifications?: string[] };
  lowEnergyDay?: string | { description?: string; modifications?: string[] };
  travelAdjustments?: string;
}

export interface RecoveryScientistOutput {
  recoveryProtocol: RecoveryProtocol;
  injuryPrevention: InjuryPrevention;
  progressTracking: ProgressTracking;
  adaptiveReadiness: AdaptiveReadiness;
}

export interface NutritionCoachOutput {
  nutritionGuidance: NutritionGuidance;
  supplementRecommendations: SupplementRecommendations;
}

export interface ChiefCoachOutput {
  personalizedGreeting: string;
  executiveSummary: string;
  adaptiveFeatures: AdaptiveFeatures;
  crossReferences: {
    training: string[];            // Cross-references to add to training sections
    recovery: string[];
    nutrition: string[];
  };
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

export const REQUIRED_TOP_LEVEL_FIELDS = [
  'personalizedGreeting',
  'executiveSummary',
  'trainingPhilosophy',
  'weeklyStructure',
  'weeklyProgram',
  'recoveryProtocol',
  'supplementRecommendations',
  'nutritionGuidance',
  'progressTracking',
  'injuryPrevention',
  'adaptiveFeatures',
] as const;

export const REQUIRED_EXERCISE_FIELDS = [
  'exercise',
  'sets',
  'reps',
  'weight',
  'rest',
  'tempo',
  'intensity',
  'notes',
] as const;

export const DAY_ORDER = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export type DayKey = typeof DAY_ORDER[number];
