/**
 * Sage Plan Output Types
 *
 * Type definitions for the Sage nutrition plan output that matches
 * the UI expectations in /sage/personalised-plan.
 */

// ============================================================================
// NUTRITION OVERVIEW
// ============================================================================

export interface NutritionStructure {
  calories: string;                   // e.g., "2400 calories"
  protein: string;                    // e.g., "180g (30% of calories)"
  carbs: string;                      // e.g., "240g (40% of calories)"
  fiber: string;                      // e.g., "35g minimum"
  fat: string;                        // e.g., "80g (30% of calories)"
}

export interface NutritionOverview {
  goals: string[];                    // e.g., ["Optimize metabolic health", "Reduce inflammation"]
  nutritionStructure: NutritionStructure;
}

// ============================================================================
// NUTRITION PHILOSOPHY (from Nutrition Architect)
// ============================================================================

export interface NutritionPhilosophy {
  personalizedApproach: string;       // 2-3 paragraphs
  keyPrinciples: Array<{
    principle: string;
    description: string;
  }>;
  eatingStrategyRationale: string;
}

// ============================================================================
// DAILY RECOMMENDATIONS
// ============================================================================

export interface DailyRecommendationItem {
  time?: string;
  action: string;
  description?: string;
}

export interface DailyRecommendationSection {
  title?: string;
  items?: DailyRecommendationItem[];
}

export interface DailyRecommendations {
  morningRitual: string[] | DailyRecommendationSection;
  empowerGut: string[] | DailyRecommendationSection;
  afternoonVitality: string[] | DailyRecommendationSection;
  energyOptimization: string[] | DailyRecommendationSection;
  middayMastery?: string[] | DailyRecommendationSection;
  eveningNourishment: string[] | DailyRecommendationSection;
  eveningWellness?: string[] | DailyRecommendationSection;
  nutritionGuidelines?: string[] | DailyRecommendationSection;
}

// ============================================================================
// MICRONUTRIENT FOCUS
// ============================================================================

export interface MicronutrientRecommendation {
  nutrient: string;                   // e.g., "Vitamin D"
  dailyGoal: string;                  // e.g., "4000 IU"
  foodSources: string;                // e.g., "Fatty fish, eggs, fortified foods"
  purpose?: string;                   // Why this nutrient matters
  priority?: 'essential' | 'recommended' | 'optional';
}

export interface MicronutrientFocus {
  personalizedIntro?: string;
  nutrients: MicronutrientRecommendation[];
}

// ============================================================================
// MEAL PLAN
// ============================================================================

export interface MealRecipe {
  time: string;                       // e.g., "7:30 AM"
  name: string;                       // e.g., "Mediterranean Scramble"
  description: string;                // Brief description
  macros: string;                     // e.g., "450 cal | 35g protein | 25g carbs | 8g fiber"
  ingredients?: string[];
  cookingInstructions?: string[];
  prepTime?: string;
  cookTime?: string;
  cookingTime?: string;               // Alias for cookTime
  difficulty?: 'simple' | 'moderate' | 'complex';
  prepType?: 'quick' | 'batch-cook' | 'slow-cooker' | 'meal-prep' | 'standard';
  biomarkerNotes?: string;            // How this meal addresses biomarkers
  mealPrepTip?: string;
}

export interface DayMealPlan {
  meals: MealRecipe[];
  dailyTotals?: {
    calories: number;
    protein: number;
    carbs: number;
    fiber: number;
    fat: number;
  };
}

export interface SampleMealPlan {
  profileSummary?: {
    goals: string;
    dietaryPreferences: string;
    keyBiomarkers: string[];
  };
  importantNotes?: string[];
  day1: DayMealPlan;
  day2: DayMealPlan;
  day3: DayMealPlan;
  day4: DayMealPlan;
  day5: DayMealPlan;
  day6: DayMealPlan;
  day7: DayMealPlan;
  [key: string]: DayMealPlan | unknown;  // Allow dynamic day keys
}

// ============================================================================
// LIFESTYLE INTEGRATION
// ============================================================================

export interface SleepOptimization {
  personalizedIntro: string;
  optimalSleepWindow?: string;
  preBedRoutine: string[];
  morningProtocol: string[];
  supplementSupport?: string[];
  whyThisMatters: string;
}

export interface ExerciseProtocol {
  personalizedIntro: string;
  weeklyStructure: string;
  nutritionTiming: string;
  recoveryProtocol: string;
  whyThisMatters: string;
}

export interface StressManagementPractice {
  practice: string;
  timing: string;
  duration: string;
  benefit: string;
}

export interface StressManagement {
  personalizedIntro: string;
  dailyPractices: StressManagementPractice[];
  acuteStressProtocols: string[];
  whyThisMatters: string;
}

export interface LifestyleIntegration {
  sleepOptimization: string | SleepOptimization;
  exerciseProtocol: string | ExerciseProtocol;
  stressManagement: string | StressManagement;
  skinImprovement?: string;
}

// ============================================================================
// SUPPLEMENT RECOMMENDATIONS
// ============================================================================

export interface SupplementRecommendation {
  name: string;
  dosage: string;
  timing: string;
  rationale: string;
  benefits?: string;
  duration?: string;
}

export interface SupplementRecommendations {
  essentialSupplements?: SupplementRecommendation[];
  essential?: SupplementRecommendation[];        // Alias
  optionalSupplements?: SupplementRecommendation[];
  optional?: SupplementRecommendation[];         // Alias
  considerations?: string;
  personalizedNotes?: string;
}

// ============================================================================
// BIOMARKER ANALYSIS
// ============================================================================

export interface BiomarkerAnalysis {
  summary: string;
  concerns: string[];
  positives: string[];
  optimizations: string[];
  recommendations?: {
    dietary: string[];
    lifestyle: string[];
    supplements: string[];
    followUp: string[];
    retestTiming?: string;
  };
}

// ============================================================================
// MAIN SAGE PLAN OUTPUT
// ============================================================================

export interface SagePlanOutput {
  // Core Identity
  personalizedGreeting: string;       // e.g., "Sofian's Personalized Nutrition Plan"
  executiveSummary: string;           // 2-3 paragraphs

  // Nutrition Core
  nutritionPhilosophy?: NutritionPhilosophy;
  nutritionOverview: NutritionOverview;
  dailyRecommendations: DailyRecommendations;

  // Micronutrients
  micronutrientFocus: MicronutrientRecommendation[] | MicronutrientFocus;

  // Meal Planning
  sampleMealPlan: SampleMealPlan;

  // Lifestyle
  lifestyleIntegration: LifestyleIntegration;

  // Supplements
  supplementRecommendations: SupplementRecommendations;

  // Biomarkers (if blood work available)
  biomarkers?: Record<string, unknown>;
  biomarkerAnalysis?: BiomarkerAnalysis;

  // Preventive Features
  preventiveFeatures?: string[];

  // Metadata
  confidenceTransparency?: {
    overallConfidence: number;
    dataSources: string[];
  };
}

// ============================================================================
// AGENT OUTPUT TYPES
// ============================================================================

export interface NutritionArchitectOutput {
  nutritionPhilosophy: NutritionPhilosophy;
  nutritionOverview: NutritionOverview;
  dailyRecommendations: DailyRecommendations;
}

export interface BiomarkerAnalystOutput {
  biomarkerAnalysis: BiomarkerAnalysis;
  nutritionalPriorities: Array<{
    concern: string;
    markers: string[];
    severity: 'mild' | 'moderate' | 'severe';
    nutritionalStrategy: string;
    foodsToEmphasize: string[];
    foodsToLimit: string[];
  }>;
  supplementFlags: Array<{
    supplement: string;
    rationale: string;
    priority: 'essential' | 'recommended' | 'optional';
  }>;
}

export interface MealPlannerOutput {
  sampleMealPlan: SampleMealPlan;
}

export interface RecipeEnricherOutput {
  enrichedMealPlan: SampleMealPlan;
}

export interface MicronutrientSpecialistOutput {
  micronutrientFocus: MicronutrientFocus;
}

export interface LifestyleIntegratorOutput {
  lifestyleIntegration: LifestyleIntegration;
}

export interface ChiefNutritionistOutput {
  personalizedGreeting: string;
  executiveSummary: string;
  supplementRecommendations: SupplementRecommendations;
  crossReferences: {
    nutrition: string[];
    lifestyle: string[];
    supplements: string[];
  };
}
