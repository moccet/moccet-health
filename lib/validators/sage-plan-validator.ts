/**
 * Sage Plan Validator
 *
 * Validates the final Sage nutrition plan output to ensure:
 * - All required fields are present
 * - Data types are correct
 * - Content meets minimum quality standards
 * - The plan is safe to display in the UI
 */

import {
  SagePlanOutput,
  NutritionOverview,
  DailyRecommendations,
  SampleMealPlan,
  DayMealPlan,
  MealRecipe,
  MicronutrientFocus,
  MicronutrientRecommendation,
  LifestyleIntegration,
  SupplementRecommendations,
  SupplementRecommendation,
} from '../types/sage-plan-output';

// ============================================================================
// TYPES
// ============================================================================

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  fixedFields: string[];
}

// ============================================================================
// MAIN VALIDATOR
// ============================================================================

export function validateSagePlan(plan: SagePlanOutput): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fixedFields: string[] = [];

  // Validate core identity
  if (!plan.personalizedGreeting || plan.personalizedGreeting.trim().length < 10) {
    errors.push('Missing or invalid personalizedGreeting');
  }

  if (!plan.executiveSummary || plan.executiveSummary.trim().length < 100) {
    warnings.push('Executive summary is very short — may not provide enough context');
  }

  // Validate nutrition overview
  const nutritionResult = validateNutritionOverview(plan.nutritionOverview);
  errors.push(...nutritionResult.errors);
  warnings.push(...nutritionResult.warnings);
  fixedFields.push(...nutritionResult.fixedFields);

  // Validate daily recommendations
  const dailyResult = validateDailyRecommendations(plan.dailyRecommendations);
  errors.push(...dailyResult.errors);
  warnings.push(...dailyResult.warnings);
  fixedFields.push(...dailyResult.fixedFields);

  // Validate meal plan
  const mealPlanResult = validateMealPlan(plan.sampleMealPlan);
  errors.push(...mealPlanResult.errors);
  warnings.push(...mealPlanResult.warnings);
  fixedFields.push(...mealPlanResult.fixedFields);

  // Validate micronutrients
  const microResult = validateMicronutrients(plan.micronutrientFocus);
  errors.push(...microResult.errors);
  warnings.push(...microResult.warnings);
  fixedFields.push(...microResult.fixedFields);

  // Validate lifestyle integration
  const lifestyleResult = validateLifestyle(plan.lifestyleIntegration);
  errors.push(...lifestyleResult.errors);
  warnings.push(...lifestyleResult.warnings);
  fixedFields.push(...lifestyleResult.fixedFields);

  // Validate supplements
  const supplementResult = validateSupplements(plan.supplementRecommendations);
  errors.push(...supplementResult.errors);
  warnings.push(...supplementResult.warnings);
  fixedFields.push(...supplementResult.fixedFields);

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    fixedFields,
  };
}

// ============================================================================
// SECTION VALIDATORS
// ============================================================================

function validateNutritionOverview(overview: NutritionOverview): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fixedFields: string[] = [];

  if (!overview) {
    errors.push('Missing nutritionOverview');
    return { isValid: false, errors, warnings, fixedFields };
  }

  if (!overview.goals || overview.goals.length === 0) {
    warnings.push('No nutrition goals specified');
  }

  if (!overview.nutritionStructure) {
    errors.push('Missing nutritionStructure in overview');
  } else {
    const structure = overview.nutritionStructure;
    if (!structure.calories) warnings.push('Missing calories target');
    if (!structure.protein) warnings.push('Missing protein target');
    if (!structure.carbs) warnings.push('Missing carbs target');
    if (!structure.fat) warnings.push('Missing fat target');
  }

  return { isValid: errors.length === 0, errors, warnings, fixedFields };
}

function validateDailyRecommendations(daily: DailyRecommendations): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fixedFields: string[] = [];

  if (!daily) {
    errors.push('Missing dailyRecommendations');
    return { isValid: false, errors, warnings, fixedFields };
  }

  // Check for at least some sections
  const sections = [
    'morningRitual',
    'empowerGut',
    'afternoonVitality',
    'energyOptimization',
    'eveningNourishment',
  ];

  let filledSections = 0;
  for (const section of sections) {
    const value = daily[section as keyof DailyRecommendations];
    if (value && (Array.isArray(value) ? value.length > 0 : true)) {
      filledSections++;
    }
  }

  if (filledSections < 3) {
    warnings.push('Daily recommendations has few filled sections');
  }

  return { isValid: errors.length === 0, errors, warnings, fixedFields };
}

function validateMealPlan(mealPlan: SampleMealPlan): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fixedFields: string[] = [];

  if (!mealPlan) {
    errors.push('Missing sampleMealPlan');
    return { isValid: false, errors, warnings, fixedFields };
  }

  // Validate all 7 days
  const days = ['day1', 'day2', 'day3', 'day4', 'day5', 'day6', 'day7'];
  let validDays = 0;

  for (const dayKey of days) {
    const day = mealPlan[dayKey as keyof SampleMealPlan] as DayMealPlan;
    if (!day || !day.meals || day.meals.length === 0) {
      warnings.push(`${dayKey} has no meals`);
    } else {
      validDays++;
      // Validate meals in this day
      for (let i = 0; i < day.meals.length; i++) {
        const meal = day.meals[i];
        const mealResult = validateMeal(meal, `${dayKey}.meal${i + 1}`);
        errors.push(...mealResult.errors);
        warnings.push(...mealResult.warnings);
        fixedFields.push(...mealResult.fixedFields);
      }
    }
  }

  if (validDays < 7) {
    warnings.push(`Only ${validDays} of 7 days have meals`);
  }

  return { isValid: errors.length === 0, errors, warnings, fixedFields };
}

function validateMeal(meal: MealRecipe, path: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fixedFields: string[] = [];

  if (!meal.name || meal.name.trim().length === 0) {
    warnings.push(`${path} — missing meal name`);
  }

  if (!meal.macros || meal.macros.trim().length === 0) {
    warnings.push(`${path} — missing macros`);
  }

  // Check for colon in text (style violation)
  if (meal.name?.includes(':') || meal.description?.includes(':')) {
    warnings.push(`${path} — contains colon (should use em dash)`);
  }

  return { isValid: errors.length === 0, errors, warnings, fixedFields };
}

function validateMicronutrients(
  focus: MicronutrientRecommendation[] | MicronutrientFocus
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fixedFields: string[] = [];

  if (!focus) {
    errors.push('Missing micronutrientFocus');
    return { isValid: false, errors, warnings, fixedFields };
  }

  // Handle both array and object formats
  const nutrients = Array.isArray(focus) ? focus : focus.nutrients;

  if (!nutrients || nutrients.length === 0) {
    warnings.push('No micronutrient recommendations');
  } else if (nutrients.length < 5) {
    warnings.push('Fewer than 5 micronutrient recommendations');
  }

  // Validate each nutrient
  for (const nutrient of nutrients || []) {
    if (!nutrient.nutrient) {
      warnings.push('Micronutrient missing name');
    }
    if (!nutrient.dailyGoal) {
      warnings.push(`${nutrient.nutrient || 'Unknown'} missing daily goal`);
    }
    if (!nutrient.foodSources) {
      warnings.push(`${nutrient.nutrient || 'Unknown'} missing food sources`);
    }
  }

  return { isValid: errors.length === 0, errors, warnings, fixedFields };
}

function validateLifestyle(lifestyle: LifestyleIntegration): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fixedFields: string[] = [];

  if (!lifestyle) {
    errors.push('Missing lifestyleIntegration');
    return { isValid: false, errors, warnings, fixedFields };
  }

  // Check sleep optimization
  if (!lifestyle.sleepOptimization) {
    warnings.push('Missing sleep optimization');
  } else if (typeof lifestyle.sleepOptimization === 'object') {
    const sleep = lifestyle.sleepOptimization;
    if (!sleep.preBedRoutine || sleep.preBedRoutine.length === 0) {
      warnings.push('Sleep optimization missing pre-bed routine');
    }
  }

  // Check exercise protocol
  if (!lifestyle.exerciseProtocol) {
    warnings.push('Missing exercise protocol');
  }

  // Check stress management
  if (!lifestyle.stressManagement) {
    warnings.push('Missing stress management');
  } else if (typeof lifestyle.stressManagement === 'object') {
    const stress = lifestyle.stressManagement;
    if (!stress.dailyPractices || stress.dailyPractices.length === 0) {
      warnings.push('Stress management missing daily practices');
    }
  }

  return { isValid: errors.length === 0, errors, warnings, fixedFields };
}

function validateSupplements(supplements: SupplementRecommendations): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fixedFields: string[] = [];

  if (!supplements) {
    errors.push('Missing supplementRecommendations');
    return { isValid: false, errors, warnings, fixedFields };
  }

  // Check essential supplements
  const essential = supplements.essential || supplements.essentialSupplements;
  if (!essential || essential.length === 0) {
    warnings.push('No essential supplements recommended');
  } else if (essential.length < 3) {
    warnings.push('Fewer than 3 essential supplements — may want to add more');
  }

  // Validate each supplement
  for (const supp of essential || []) {
    const suppResult = validateSupplement(supp, 'essential');
    errors.push(...suppResult.errors);
    warnings.push(...suppResult.warnings);
    fixedFields.push(...suppResult.fixedFields);
  }

  // Check optional supplements
  const optional = supplements.optional || supplements.optionalSupplements;
  for (const supp of optional || []) {
    const suppResult = validateSupplement(supp, 'optional');
    errors.push(...suppResult.errors);
    warnings.push(...suppResult.warnings);
    fixedFields.push(...suppResult.fixedFields);
  }

  return { isValid: errors.length === 0, errors, warnings, fixedFields };
}

function validateSupplement(supp: SupplementRecommendation, category: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fixedFields: string[] = [];

  if (!supp.name) {
    warnings.push(`${category} supplement missing name`);
  }

  if (!supp.dosage) {
    warnings.push(`${supp.name || 'Unknown'} (${category}) missing dosage`);
  }

  if (!supp.rationale) {
    warnings.push(`${supp.name || 'Unknown'} (${category}) missing rationale`);
  }

  return { isValid: errors.length === 0, errors, warnings, fixedFields };
}

// ============================================================================
// FIX COMMON ISSUES
// ============================================================================

export function fixCommonIssues(plan: SagePlanOutput): { plan: SagePlanOutput; fixes: string[] } {
  const fixes: string[] = [];
  const fixed = { ...plan };

  // Fix missing greeting
  if (!fixed.personalizedGreeting || fixed.personalizedGreeting.trim().length < 10) {
    fixed.personalizedGreeting = 'Your Personalized Nutrition Plan';
    fixes.push('Added default personalized greeting');
  }

  // Fix missing executive summary
  if (!fixed.executiveSummary || fixed.executiveSummary.trim().length < 50) {
    fixed.executiveSummary = 'This nutrition plan has been designed based on your unique profile, goals, and health data. Follow the recommendations consistently for best results.';
    fixes.push('Added default executive summary');
  }

  // Ensure nutrition overview exists
  if (!fixed.nutritionOverview) {
    fixed.nutritionOverview = {
      goals: ['Optimize nutrition'],
      nutritionStructure: {
        calories: '2000 calories',
        protein: '150g',
        carbs: '200g',
        fiber: '30g',
        fat: '65g',
      },
    };
    fixes.push('Added default nutrition overview');
  }

  // Ensure daily recommendations exists
  if (!fixed.dailyRecommendations) {
    fixed.dailyRecommendations = {
      morningRitual: ['Start day with hydration'],
      empowerGut: ['Include fermented foods'],
      afternoonVitality: ['Maintain energy with balanced snacks'],
      energyOptimization: ['Balance macros at meals'],
      eveningNourishment: ['Finish eating 3 hours before bed'],
    };
    fixes.push('Added default daily recommendations');
  }

  // Ensure micronutrients exists
  if (!fixed.micronutrientFocus) {
    fixed.micronutrientFocus = {
      personalizedIntro: 'Focus on these key micronutrients.',
      nutrients: [
        { nutrient: 'Vitamin D', dailyGoal: '2000-4000 IU', foodSources: 'Fatty fish, eggs, sun exposure', priority: 'essential' },
        { nutrient: 'Magnesium', dailyGoal: '400mg', foodSources: 'Dark leafy greens, nuts, seeds', priority: 'essential' },
        { nutrient: 'Omega-3', dailyGoal: '2-3g EPA+DHA', foodSources: 'Fatty fish, fish oil, algae', priority: 'essential' },
      ],
    };
    fixes.push('Added default micronutrient focus');
  }

  // Ensure lifestyle integration exists
  if (!fixed.lifestyleIntegration) {
    fixed.lifestyleIntegration = {
      sleepOptimization: 'Prioritize 7-9 hours of quality sleep',
      exerciseProtocol: 'Incorporate regular movement aligned with your nutrition goals',
      stressManagement: 'Practice daily stress management techniques',
    };
    fixes.push('Added default lifestyle integration');
  }

  // Ensure supplement recommendations exists
  if (!fixed.supplementRecommendations) {
    fixed.supplementRecommendations = {
      essential: [
        { name: 'Vitamin D3', dosage: '2000-4000 IU', timing: 'With fat-containing meal', rationale: 'Most people are deficient' },
        { name: 'Omega-3', dosage: '2-3g EPA+DHA', timing: 'With meals', rationale: 'Anti-inflammatory, supports heart and brain' },
        { name: 'Magnesium', dosage: '300-400mg', timing: 'Evening', rationale: 'Supports sleep and muscle function' },
      ],
      optional: [],
      considerations: 'Consult with a healthcare provider before starting new supplements.',
    };
    fixes.push('Added default supplement recommendations');
  }

  return { plan: fixed, fixes };
}

// ============================================================================
// EXPORT VALIDATION FUNCTION
// ============================================================================

export function validateAndFixSagePlan(plan: SagePlanOutput): {
  plan: SagePlanOutput;
  validation: ValidationResult;
} {
  // First fix common issues
  const { plan: fixedPlan, fixes } = fixCommonIssues(plan);

  // Then validate
  const validation = validateSagePlan(fixedPlan);
  validation.fixedFields.push(...fixes);

  return {
    plan: fixedPlan,
    validation,
  };
}
