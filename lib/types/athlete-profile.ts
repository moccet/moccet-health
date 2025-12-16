/**
 * Athlete Profile Card
 *
 * Pre-computed data structure passed between agents in the multi-agent
 * Forge plan generation system. Contains all user data condensed into
 * actionable metrics and insights.
 */

// ============================================================================
// PROFILE SECTION
// ============================================================================

export interface AthleteBasicProfile {
  name: string;
  firstName: string;
  age: number;
  gender: 'male' | 'female' | 'non-binary' | 'prefer-not-to-say';
  weightKg: number;
  heightCm: number;
  bmi: number;
}

export interface AthleteTrainingProfile {
  trainingAge: 'beginner' | 'intermediate' | 'advanced';
  primaryGoal: string;
  secondaryGoals: string[];
  trainingDays: number;
  sessionLengthMinutes: number;
  preferredExerciseTime: 'morning' | 'afternoon' | 'evening' | 'varies';
  timeHorizon: 'short-term' | 'medium-term' | 'long-term';
}

// ============================================================================
// COMPUTED METRICS SECTION
// ============================================================================

export interface ComputedMetrics {
  // Nutrition
  tdee: number;                    // Total Daily Energy Expenditure
  bmr: number;                     // Basal Metabolic Rate
  proteinTargetGrams: number;
  carbTargetGrams: number;
  fatTargetGrams: number;

  // Recovery & Readiness
  sleepScore: number;              // 1-100 from Oura/questionnaire
  stressScore: 'low' | 'moderate' | 'high' | 'very-high';
  recoveryCapacity: 'poor' | 'fair' | 'normal' | 'good' | 'excellent';
  hrvTrend: 'declining' | 'stable' | 'improving' | 'unknown';

  // Training Capacity
  overtrainingRisk: 'low' | 'moderate' | 'high';
  weeklyVolumeCapacity: 'low' | 'moderate' | 'high';
  recommendedIntensity: 'conservative' | 'moderate' | 'aggressive';

  // Data Quality
  dataConfidence: number;          // 0-100, how much real data we have
  primaryDataSources: string[];    // e.g., ['oura', 'strava', 'questionnaire']
}

// ============================================================================
// CONSTRAINTS SECTION
// ============================================================================

export interface InjuryConstraint {
  area: string;                    // e.g., 'lower_back', 'shoulder', 'knee'
  severity: 'mild' | 'moderate' | 'severe';
  exercisesToAvoid: string[];
  modifications: string[];
}

export interface AthleteConstraints {
  injuries: InjuryConstraint[];
  movementRestrictions: string[];
  medicalConditions: string[];
  medications: string[];

  equipment: string[];             // Available equipment
  trainingLocation: 'home' | 'gym' | 'outdoors' | 'mix';

  timeWindows: string[];           // Preferred training times from calendar
  busyDays: string[];              // Days with heavy meetings
  optimalDays: string[];           // Days with best recovery/availability
}

// ============================================================================
// BIOMARKER FLAGS SECTION
// ============================================================================

export interface BiomarkerFlag {
  marker: string;                  // e.g., 'vitamin_d', 'ldl_cholesterol'
  status: 'low' | 'high' | 'optimal';
  value?: string;                  // e.g., '25 ng/mL'
  implication: string;             // What this means for training/nutrition
  recommendations: string[];       // Actionable recommendations
}

// ============================================================================
// KEY INSIGHTS SECTION (from ecosystem/MCP)
// ============================================================================

export interface EcosystemInsight {
  source: string;                  // e.g., 'gmail', 'oura', 'strava', 'slack'
  insight: string;                 // Human-readable insight
  dataPoint?: string;              // Specific data that led to this insight
  impact: 'training' | 'recovery' | 'nutrition' | 'schedule' | 'general';
  priority: 'low' | 'medium' | 'high';
}

// ============================================================================
// TRAINING HISTORY (from Strava/Whoop/etc)
// ============================================================================

export interface TrainingHistory {
  weeklyMinutes: number;
  weeklyFrequency: number;
  dominantWorkoutType: string;     // e.g., 'strength', 'cardio', 'mixed'
  intensityDistribution: {
    easy: number;                  // Percentage
    moderate: number;
    hard: number;
  };
  recentTrend: 'increasing' | 'stable' | 'decreasing';

  // Strength baselines (if available)
  estimatedMaxes?: {
    squat?: number;
    bench?: number;
    deadlift?: number;
    overhead?: number;
  };
}

// ============================================================================
// MAIN ATHLETE PROFILE CARD
// ============================================================================

export interface AthleteProfileCard {
  // Metadata
  generatedAt: string;             // ISO timestamp
  profileVersion: string;          // Schema version

  // Core Sections
  profile: AthleteBasicProfile & AthleteTrainingProfile;
  computedMetrics: ComputedMetrics;
  constraints: AthleteConstraints;
  biomarkerFlags: BiomarkerFlag[];
  keyInsights: EcosystemInsight[];
  trainingHistory?: TrainingHistory;

  // Raw Data References (for agents that need more detail)
  rawDataAvailable: {
    bloodAnalysis: boolean;
    ouraData: boolean;
    stravaData: boolean;
    whoopData: boolean;
    calendarData: boolean;
    slackData: boolean;
  };
}

// ============================================================================
// AGENT INPUT/OUTPUT TYPES
// ============================================================================

export interface CoordinatorInput {
  onboardingData: Record<string, unknown>;
  bloodAnalysis?: Record<string, unknown>;
  ecosystemData?: Record<string, unknown>;
  inferenceOutputs?: Record<string, unknown>;
}

export interface CoordinatorOutput {
  athleteProfile: AthleteProfileCard;
  errors?: string[];
  warnings?: string[];
}
