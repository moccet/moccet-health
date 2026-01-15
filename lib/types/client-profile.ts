/**
 * Client Profile Card
 *
 * Pre-computed data structure passed between agents in the multi-agent
 * Sage nutrition plan generation system. Contains all user data condensed into
 * actionable metrics and insights for nutrition planning.
 */

// Reuse ecosystem insights and biomarker types from athlete-profile
export type { EcosystemInsight, BiomarkerFlag, DetailedEcosystemMetrics } from './athlete-profile';
import type { EcosystemInsight, BiomarkerFlag, DetailedEcosystemMetrics } from './athlete-profile';

// ============================================================================
// BASIC PROFILE SECTION
// ============================================================================

export interface ClientBasicProfile {
  name: string;
  firstName: string;
  age: number;
  gender: 'male' | 'female' | 'non-binary' | 'prefer-not-to-say';
  weightKg: number;
  heightCm: number;
  bmi: number;
}

// ============================================================================
// NUTRITION PROFILE SECTION
// ============================================================================

export interface ClientNutritionProfile {
  // Goals
  mainPriority: string;               // longevity, cognitive, physical, body-composition, emotional
  drivingGoal: string;                // e.g., "Improve energy levels", "Lose weight"
  timeHorizon: 'short-term' | 'medium-term' | 'long-term';

  // Eating Patterns
  eatingStyle: string;                // balanced, keto, vegan, vegetarian, etc.
  firstMealTiming: string;            // When they typically eat first meal
  lastMealTiming?: string;            // When they typically eat last meal
  mealsPerDay: number;
  cookingFrequency: string;           // how often they cook (daily, few times/week, rarely)
  mealPrepPreference?: string;        // batch cooking, daily prep, quick meals

  // Food Preferences
  proteinPreferences: string[];       // chicken, beef, fish, tofu, etc.
  allergies: string[];
  intolerances: string[];
  foodDislikes: string[];
  cuisinePreferences?: string[];      // Mediterranean, Asian, etc.

  // Lifestyle
  alcoholConsumption: string;         // none, occasional, moderate, frequent
  caffeineConsumption?: string;
  activityLevel: string;              // sedentary, light, moderate, active, very active
  sleepQuality: number;               // 1-10
  stressLevel: number;                // 1-10
}

// ============================================================================
// COMPUTED NUTRITION METRICS
// ============================================================================

export interface ComputedNutritionMetrics {
  // Calorie Calculations
  bmr: number;                        // Basal Metabolic Rate
  tdee: number;                       // Total Daily Energy Expenditure
  targetCalories: number;             // Adjusted for goal
  calorieAdjustment: number;          // Surplus/deficit amount

  // Macro Targets
  proteinTargetGrams: number;
  carbTargetGrams: number;
  fatTargetGrams: number;
  fiberTargetGrams: number;

  // Additional Nutrition Targets
  waterIntakeLiters: number;
  sodiumLimitMg?: number;
  sugarLimitGrams?: number;

  // Lifestyle Factors
  stressScore: 'low' | 'moderate' | 'high' | 'very-high';
  sleepScore: 'poor' | 'fair' | 'normal' | 'good' | 'excellent';
  metabolicHealth: 'needs-attention' | 'fair' | 'good' | 'excellent';

  // Data Quality
  dataConfidence: number;             // 0-100, how much real data we have
  primaryDataSources: string[];       // e.g., ['blood_analysis', 'oura', 'questionnaire']
}

// ============================================================================
// DIETARY CONSTRAINTS
// ============================================================================

export interface DietaryConstraint {
  type: 'allergy' | 'intolerance' | 'preference' | 'medical' | 'religious';
  item: string;                       // e.g., 'gluten', 'dairy', 'shellfish'
  severity: 'strict-avoid' | 'minimize' | 'prefer-avoid';
  alternatives?: string[];            // Suggested alternatives
}

export interface ClientConstraints {
  dietary: DietaryConstraint[];
  medical: string[];                  // Medical conditions affecting diet
  medications: string[];              // Medications that interact with food/supplements
  currentSupplements: string[];       // What they're already taking

  // Practical Constraints
  budget?: 'budget' | 'moderate' | 'flexible';
  cookingSkill?: 'beginner' | 'intermediate' | 'advanced';
  timeForMealPrep?: 'minimal' | 'moderate' | 'flexible';
  kitchenEquipment?: string[];        // Available cooking equipment
}

// ============================================================================
// BIOMARKER ANALYSIS (NUTRITION-FOCUSED)
// ============================================================================

export interface NutritionBiomarkerFlag {
  marker: string;                     // e.g., 'vitamin_d', 'iron', 'b12'
  status: 'deficient' | 'low' | 'optimal' | 'high' | 'excessive';
  value?: string;                     // e.g., '25 ng/mL'
  unit?: string;
  implication: string;                // What this means for nutrition
  foodRecommendations: string[];      // Foods to address this
  supplementRecommendation?: string;  // Supplement if needed
  priority: 'low' | 'medium' | 'high' | 'critical';
}

// ============================================================================
// MAIN CLIENT PROFILE CARD
// ============================================================================

export interface ClientProfileCard {
  // Metadata
  generatedAt: string;                // ISO timestamp
  profileVersion: string;             // Schema version

  // Core Sections
  profile: ClientBasicProfile & ClientNutritionProfile;
  computedMetrics: ComputedNutritionMetrics;
  constraints: ClientConstraints;
  biomarkerFlags: NutritionBiomarkerFlag[];
  keyInsights: EcosystemInsight[];

  // Detailed ecosystem metrics for personalized recommendations
  ecosystemMetrics?: DetailedEcosystemMetrics;

  // Raw Data References
  rawDataAvailable: {
    bloodAnalysis: boolean;
    ouraData: boolean;
    whoopData: boolean;
    cgmData: boolean;                 // Continuous Glucose Monitor
    calendarData: boolean;
    microbiomeData?: boolean;
  };
}

// ============================================================================
// AGENT INPUT/OUTPUT TYPES
// ============================================================================

export interface SageCoordinatorInput {
  onboardingData: Record<string, unknown>;
  bloodAnalysis?: Record<string, unknown>;
  ecosystemData?: Record<string, unknown>;
  inferenceOutputs?: Record<string, unknown>;
}

export interface SageCoordinatorOutput {
  clientProfile: ClientProfileCard;
  errors?: string[];
  warnings?: string[];
}
