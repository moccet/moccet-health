/**
 * Meal Matcher Utility
 *
 * Matches meals from the curated database to user profiles based on:
 * - Allergens (strict exclusion)
 * - Dietary preferences (vegan, keto, etc.)
 * - Health goals
 * - Biomarker concerns
 * - Macro targets
 */

import * as fs from 'fs';
import * as path from 'path';
import { ClientProfileCard } from '../../types/client-profile';
import { BiomarkerAnalystOutput } from '../../types/sage-plan-output';

// ============================================================================
// TYPES
// ============================================================================

export interface CuratedMeal {
  id: string;
  name: string;
  description: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  macros: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
  };
  micros?: {
    iron?: number;
    calcium?: number;
    vitamin_c?: number;
    vitamin_d?: number;
    vitamin_b12?: number;
    potassium?: number;
    magnesium?: number;
    omega3?: number;
    zinc?: number;
    folate?: number;
    selenium?: number;
  };
  ingredients: string[];
  instructions: string[];
  prep_time_minutes: number;
  cook_time_minutes: number;
  servings: number;
  difficulty: 'easy' | 'medium' | 'hard';
  dietary_tags: string[];
  health_goal_tags: string[];
  allergens: string[];
  cuisine_types?: string[];
  meal_prep_styles?: string[];
  biomarker_relevances?: BiomarkerRelevance[];
  glycemic_index?: number;
  satiety_score?: number;
  nutrient_density_score?: number;
}

export interface BiomarkerRelevance {
  biomarker_name: string;
  relevance: 'helpsLower' | 'helpsRaise' | 'goodFor' | 'neutral';
  explanation: string;
  impact_score: number;
}

export interface MealDatabase {
  version: string;
  lastUpdated: string;
  totalMeals: number;
  meals: CuratedMeal[];
}

export interface MealMatcherInput {
  clientProfile: ClientProfileCard;
  biomarkerAnalysis?: BiomarkerAnalystOutput;
}

export interface ScoredMeal extends CuratedMeal {
  score: number;
  matchReasons: string[];
}

// ============================================================================
// LOAD DATABASE
// ============================================================================

let cachedDatabase: MealDatabase | null = null;

export function loadMealDatabase(): MealDatabase {
  if (cachedDatabase) {
    return cachedDatabase;
  }

  const dbPath = path.join(__dirname, '../../data/curated_meals.json');

  try {
    const data = fs.readFileSync(dbPath, 'utf-8');
    cachedDatabase = JSON.parse(data) as MealDatabase;
    console.log(`[Meal Matcher] Loaded ${cachedDatabase.totalMeals} meals from database`);
    return cachedDatabase;
  } catch (error) {
    console.error('[Meal Matcher] Failed to load meal database:', error);
    throw new Error('Meal database not available');
  }
}

// ============================================================================
// ALLERGEN MAPPING
// ============================================================================

const ALLERGEN_KEYWORDS: Record<string, string[]> = {
  // User allergen -> meal allergen tags
  'gluten': ['gluten', 'wheat'],
  'wheat': ['gluten', 'wheat'],
  'dairy': ['dairy', 'milk', 'cheese', 'lactose'],
  'milk': ['dairy', 'milk'],
  'lactose': ['dairy', 'lactose'],
  'eggs': ['eggs', 'egg'],
  'egg': ['eggs', 'egg'],
  'nuts': ['nuts', 'treeNuts', 'peanuts'],
  'tree nuts': ['nuts', 'treeNuts'],
  'peanuts': ['peanuts', 'nuts'],
  'soy': ['soy', 'soya'],
  'shellfish': ['shellfish', 'crustacean'],
  'fish': ['fish', 'seafood'],
  'seafood': ['fish', 'shellfish', 'seafood'],
  'sesame': ['sesame'],
};

// ============================================================================
// DIETARY PREFERENCE MAPPING
// ============================================================================

const DIET_TO_TAGS: Record<string, string[]> = {
  'vegan': ['vegan'],
  'vegetarian': ['vegetarian', 'vegan'],
  'pescatarian': ['pescatarian', 'vegetarian'],
  'keto': ['keto', 'lowCarb'],
  'low carb': ['lowCarb', 'keto'],
  'low-carb': ['lowCarb', 'keto'],
  'paleo': ['paleo'],
  'gluten-free': ['glutenFree'],
  'gluten free': ['glutenFree'],
  'dairy-free': ['dairyFree'],
  'dairy free': ['dairyFree'],
  'mediterranean': ['mediterranean', 'heartHealthy'],
  'whole30': ['whole30', 'paleo'],
  'high protein': ['highProtein'],
  'high-protein': ['highProtein'],
  'anti-inflammatory': ['antiInflammatory'],
  'heart healthy': ['heartHealthy', 'mediterranean'],
  'diabetic friendly': ['diabeticFriendly', 'lowCarb'],
};

// ============================================================================
// HEALTH GOAL MAPPING
// ============================================================================

const GOAL_TO_TAGS: Record<string, string[]> = {
  'lose weight': ['weightLoss'],
  'weight loss': ['weightLoss'],
  'build muscle': ['muscleGain', 'highProtein'],
  'muscle gain': ['muscleGain', 'highProtein'],
  'gain muscle': ['muscleGain', 'highProtein'],
  'heart health': ['heartHealth', 'mediterranean'],
  'improve heart': ['heartHealth'],
  'gut health': ['gutHealth'],
  'digestive health': ['gutHealth'],
  'blood sugar': ['bloodSugarControl', 'diabeticFriendly'],
  'reduce inflammation': ['inflammation', 'antiInflammatory'],
  'inflammation': ['inflammation', 'antiInflammatory'],
  'energy': ['energyBoost'],
  'more energy': ['energyBoost'],
  'brain health': ['brainHealth'],
  'cognitive': ['brainHealth'],
  'bone health': ['boneHealth'],
  'immune': ['immuneSupport'],
  'hormone': ['hormoneBalance'],
  'skin health': ['skinHealth'],
  'sleep': ['sleepQuality'],
  'stress': ['stressReduction'],
};

// ============================================================================
// BIOMARKER TO MEAL RELEVANCE MAPPING
// ============================================================================

const BIOMARKER_CONCERNS: Record<string, { targetRelevance: 'helpsLower' | 'helpsRaise'; searchTerms: string[] }> = {
  // High values - need to lower
  'high ldl': { targetRelevance: 'helpsLower', searchTerms: ['LDL Cholesterol', 'LDL', 'Cholesterol'] },
  'high cholesterol': { targetRelevance: 'helpsLower', searchTerms: ['LDL Cholesterol', 'Cholesterol', 'LDL'] },
  'high triglycerides': { targetRelevance: 'helpsLower', searchTerms: ['Triglycerides'] },
  'high blood sugar': { targetRelevance: 'helpsLower', searchTerms: ['Fasting Glucose', 'Blood Glucose', 'HbA1c'] },
  'high glucose': { targetRelevance: 'helpsLower', searchTerms: ['Fasting Glucose', 'Blood Glucose'] },
  'high hba1c': { targetRelevance: 'helpsLower', searchTerms: ['HbA1c'] },
  'high crp': { targetRelevance: 'helpsLower', searchTerms: ['CRP', 'C-Reactive Protein'] },
  'inflammation': { targetRelevance: 'helpsLower', searchTerms: ['CRP', 'Inflammation'] },
  'high homocysteine': { targetRelevance: 'helpsLower', searchTerms: ['Homocysteine'] },

  // Low values - need to raise
  'low hdl': { targetRelevance: 'helpsRaise', searchTerms: ['HDL Cholesterol', 'HDL'] },
  'low vitamin d': { targetRelevance: 'helpsRaise', searchTerms: ['Vitamin D'] },
  'low vitamin b12': { targetRelevance: 'helpsRaise', searchTerms: ['Vitamin B12', 'B12'] },
  'low iron': { targetRelevance: 'helpsRaise', searchTerms: ['Iron', 'Ferritin'] },
  'low ferritin': { targetRelevance: 'helpsRaise', searchTerms: ['Ferritin', 'Iron'] },
  'low magnesium': { targetRelevance: 'helpsRaise', searchTerms: ['Magnesium'] },
  'low folate': { targetRelevance: 'helpsRaise', searchTerms: ['Folate', 'Folic Acid'] },
  'low omega-3': { targetRelevance: 'helpsRaise', searchTerms: ['Omega-3', 'Omega 3'] },
};

// ============================================================================
// FILTERING FUNCTIONS
// ============================================================================

function hasAllergen(meal: CuratedMeal, userAllergens: string[]): boolean {
  if (userAllergens.length === 0) return false;

  const mealAllergens = meal.allergens.map(a => a.toLowerCase());

  for (const userAllergen of userAllergens) {
    const allergenLower = userAllergen.toLowerCase();

    // Check direct match
    if (mealAllergens.includes(allergenLower)) {
      return true;
    }

    // Check keyword mapping
    const keywords = ALLERGEN_KEYWORDS[allergenLower] || [allergenLower];
    for (const keyword of keywords) {
      if (mealAllergens.some(ma => ma.includes(keyword.toLowerCase()))) {
        return true;
      }
    }

    // Check ingredients for allergen keywords
    const ingredientsLower = meal.ingredients.map(i => i.toLowerCase()).join(' ');
    if (ingredientsLower.includes(allergenLower)) {
      return true;
    }
  }

  return false;
}

function matchesDietaryPreference(meal: CuratedMeal, preferences: string[]): number {
  if (preferences.length === 0) return 0;

  let matchCount = 0;
  const mealTags = meal.dietary_tags.map(t => t.toLowerCase());

  for (const pref of preferences) {
    const prefLower = pref.toLowerCase();
    const targetTags = DIET_TO_TAGS[prefLower] || [prefLower];

    for (const tag of targetTags) {
      if (mealTags.includes(tag.toLowerCase())) {
        matchCount++;
        break;
      }
    }
  }

  return matchCount;
}

function matchesHealthGoals(meal: CuratedMeal, goals: string[]): number {
  if (goals.length === 0) return 0;

  let matchCount = 0;
  const mealGoalTags = meal.health_goal_tags.map(t => t.toLowerCase());

  for (const goal of goals) {
    const goalLower = goal.toLowerCase();
    const targetTags = GOAL_TO_TAGS[goalLower] || [goalLower];

    for (const tag of targetTags) {
      if (mealGoalTags.some(mt => mt.includes(tag.toLowerCase()))) {
        matchCount++;
        break;
      }
    }
  }

  return matchCount;
}

function getBiomarkerScore(meal: CuratedMeal, biomarkerConcerns: string[]): number {
  if (!meal.biomarker_relevances || biomarkerConcerns.length === 0) return 0;

  let score = 0;

  for (const concern of biomarkerConcerns) {
    const concernLower = concern.toLowerCase();

    // Find matching biomarker concern config
    let targetConfig: { targetRelevance: string; searchTerms: string[] } | null = null;
    for (const [key, config] of Object.entries(BIOMARKER_CONCERNS)) {
      if (concernLower.includes(key)) {
        targetConfig = config;
        break;
      }
    }

    if (!targetConfig) continue;

    // Check meal's biomarker relevances
    for (const relevance of meal.biomarker_relevances) {
      const biomarkerName = relevance.biomarker_name.toLowerCase();

      for (const searchTerm of targetConfig.searchTerms) {
        if (biomarkerName.includes(searchTerm.toLowerCase())) {
          // Meal addresses this biomarker
          if (relevance.relevance === targetConfig.targetRelevance) {
            // Positive match - meal helps with this concern
            score += Math.abs(relevance.impact_score) * 2;
          } else if (relevance.relevance === 'goodFor') {
            score += 0.5;
          }
          break;
        }
      }
    }
  }

  return score;
}

function getMacroScore(meal: CuratedMeal, targetMacros: { calories: number; protein: number; carbs: number; fat: number }, mealType: string): number {
  // Distribute macros across meals (roughly 30/35/35 for breakfast/lunch/dinner)
  let calorieTarget: number;
  let proteinTarget: number;

  switch (mealType) {
    case 'breakfast':
      calorieTarget = targetMacros.calories * 0.28;
      proteinTarget = targetMacros.protein * 0.28;
      break;
    case 'lunch':
      calorieTarget = targetMacros.calories * 0.35;
      proteinTarget = targetMacros.protein * 0.35;
      break;
    case 'dinner':
      calorieTarget = targetMacros.calories * 0.37;
      proteinTarget = targetMacros.protein * 0.37;
      break;
    default:
      calorieTarget = targetMacros.calories * 0.1;
      proteinTarget = targetMacros.protein * 0.1;
  }

  // Calculate how close the meal is to targets (within 30% is good)
  const calorieDiff = Math.abs(meal.macros.calories - calorieTarget) / calorieTarget;
  const proteinDiff = Math.abs(meal.macros.protein - proteinTarget) / proteinTarget;

  let score = 0;

  // Calories within 30% target
  if (calorieDiff < 0.3) {
    score += (1 - calorieDiff) * 2;
  }

  // Protein within 30% target
  if (proteinDiff < 0.3) {
    score += (1 - proteinDiff) * 3; // Weight protein higher
  }

  return score;
}

// ============================================================================
// MAIN MATCHING FUNCTION
// ============================================================================

export function matchMealsForUser(input: MealMatcherInput): {
  breakfast: ScoredMeal[];
  lunch: ScoredMeal[];
  dinner: ScoredMeal[];
  snacks: ScoredMeal[];
} {
  const db = loadMealDatabase();
  const { clientProfile, biomarkerAnalysis } = input;
  const { profile, constraints, computedMetrics } = clientProfile;

  // Extract user constraints
  const userAllergens = constraints.dietary
    .filter(c => c.type === 'allergy')
    .map(c => c.item);

  const userIntolerances = constraints.dietary
    .filter(c => c.type === 'intolerance')
    .map(c => c.item);

  // Combine allergens and strict intolerances for filtering
  const strictAvoid = [...userAllergens, ...userIntolerances];

  // Extract dietary preferences from eating style
  const dietaryPrefs = extractDietaryPreferences(profile.eatingStyle);

  // Extract health goals
  const healthGoals = extractHealthGoals(profile.drivingGoal);

  // Extract biomarker concerns
  const biomarkerConcerns = biomarkerAnalysis?.nutritionalPriorities
    .map(p => p.concern) || [];

  // Target macros
  const targetMacros = {
    calories: computedMetrics.targetCalories,
    protein: computedMetrics.proteinTargetGrams,
    carbs: computedMetrics.carbTargetGrams,
    fat: computedMetrics.fatTargetGrams,
  };

  // Score all meals
  const scoredMeals: ScoredMeal[] = [];

  for (const meal of db.meals) {
    // STRICT: Filter out meals with allergens
    if (hasAllergen(meal, strictAvoid)) {
      continue;
    }

    // Calculate score
    let score = 0;
    const matchReasons: string[] = [];

    // Dietary preference score (up to 3 points per match)
    const dietScore = matchesDietaryPreference(meal, dietaryPrefs);
    if (dietScore > 0) {
      score += dietScore * 3;
      matchReasons.push(`Matches dietary preferences`);
    }

    // Health goal score (up to 2 points per match)
    const goalScore = matchesHealthGoals(meal, healthGoals);
    if (goalScore > 0) {
      score += goalScore * 2;
      matchReasons.push(`Supports health goals`);
    }

    // Biomarker score (variable based on impact)
    const bioScore = getBiomarkerScore(meal, biomarkerConcerns);
    if (bioScore > 0) {
      score += bioScore;
      matchReasons.push(`Addresses biomarker concerns`);
    }

    // Macro score (up to 5 points)
    const macroScore = getMacroScore(meal, targetMacros, meal.meal_type);
    score += macroScore;
    if (macroScore > 3) {
      matchReasons.push(`Good macro fit`);
    }

    // Bonus for high nutrient density
    if (meal.nutrient_density_score && meal.nutrient_density_score >= 8) {
      score += 1;
      matchReasons.push(`High nutrient density`);
    }

    // Bonus for high satiety (helps with weight management)
    if (meal.satiety_score && meal.satiety_score >= 8) {
      score += 0.5;
    }

    // Bonus for low glycemic index (blood sugar friendly)
    if (meal.glycemic_index && meal.glycemic_index < 50) {
      score += 0.5;
    }

    // Protein preference bonus
    if (profile.proteinPreferences.length > 0) {
      const ingredientsLower = meal.ingredients.join(' ').toLowerCase();
      for (const pref of profile.proteinPreferences) {
        if (ingredientsLower.includes(pref.toLowerCase())) {
          score += 1;
          matchReasons.push(`Contains preferred protein: ${pref}`);
          break;
        }
      }
    }

    scoredMeals.push({
      ...meal,
      score,
      matchReasons,
    });
  }

  // Separate by meal type and sort by score
  const result = {
    breakfast: scoredMeals
      .filter(m => m.meal_type === 'breakfast')
      .sort((a, b) => b.score - a.score),
    lunch: scoredMeals
      .filter(m => m.meal_type === 'lunch')
      .sort((a, b) => b.score - a.score),
    dinner: scoredMeals
      .filter(m => m.meal_type === 'dinner')
      .sort((a, b) => b.score - a.score),
    snacks: scoredMeals
      .filter(m => m.meal_type === 'snack')
      .sort((a, b) => b.score - a.score),
  };

  console.log(`[Meal Matcher] Matched meals — Breakfast: ${result.breakfast.length}, Lunch: ${result.lunch.length}, Dinner: ${result.dinner.length}, Snacks: ${result.snacks.length}`);

  return result;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function extractDietaryPreferences(eatingStyle: string): string[] {
  const prefs: string[] = [];
  const styleLower = eatingStyle.toLowerCase();

  if (styleLower.includes('vegan')) prefs.push('vegan');
  if (styleLower.includes('vegetarian')) prefs.push('vegetarian');
  if (styleLower.includes('pescatarian')) prefs.push('pescatarian');
  if (styleLower.includes('keto')) prefs.push('keto');
  if (styleLower.includes('low carb') || styleLower.includes('low-carb')) prefs.push('low carb');
  if (styleLower.includes('paleo')) prefs.push('paleo');
  if (styleLower.includes('mediterranean')) prefs.push('mediterranean');
  if (styleLower.includes('gluten') && styleLower.includes('free')) prefs.push('gluten-free');
  if (styleLower.includes('dairy') && styleLower.includes('free')) prefs.push('dairy-free');
  if (styleLower.includes('whole30')) prefs.push('whole30');
  if (styleLower.includes('high protein') || styleLower.includes('high-protein')) prefs.push('high protein');

  return prefs;
}

function extractHealthGoals(drivingGoal: string): string[] {
  const goals: string[] = [];
  const goalLower = drivingGoal.toLowerCase();

  if (goalLower.includes('lose') || goalLower.includes('weight loss')) goals.push('weight loss');
  if (goalLower.includes('muscle') || goalLower.includes('strength')) goals.push('muscle gain');
  if (goalLower.includes('heart') || goalLower.includes('cardiovascular')) goals.push('heart health');
  if (goalLower.includes('gut') || goalLower.includes('digest')) goals.push('gut health');
  if (goalLower.includes('blood sugar') || goalLower.includes('diabetes') || goalLower.includes('glucose')) goals.push('blood sugar');
  if (goalLower.includes('inflamm')) goals.push('inflammation');
  if (goalLower.includes('energy')) goals.push('energy');
  if (goalLower.includes('brain') || goalLower.includes('cognitive') || goalLower.includes('focus')) goals.push('brain health');
  if (goalLower.includes('immune')) goals.push('immune');
  if (goalLower.includes('hormone')) goals.push('hormone');
  if (goalLower.includes('skin')) goals.push('skin health');
  if (goalLower.includes('sleep')) goals.push('sleep');

  return goals;
}

// ============================================================================
// SELECT MEALS FOR 7-DAY PLAN
// ============================================================================

export function selectMealsFor7Days(
  matchedMeals: ReturnType<typeof matchMealsForUser>,
  mealsPerDay: number = 3
): { day: number; meals: ScoredMeal[] }[] {
  const plan: { day: number; meals: ScoredMeal[] }[] = [];

  // Track used meal IDs to ensure variety
  const usedMealIds = new Set<string>();

  for (let day = 1; day <= 7; day++) {
    const dayMeals: ScoredMeal[] = [];

    // Select breakfast
    const breakfast = selectNextMeal(matchedMeals.breakfast, usedMealIds);
    if (breakfast) {
      dayMeals.push(breakfast);
      usedMealIds.add(breakfast.id);
    }

    // Select lunch
    const lunch = selectNextMeal(matchedMeals.lunch, usedMealIds);
    if (lunch) {
      dayMeals.push(lunch);
      usedMealIds.add(lunch.id);
    }

    // Select dinner
    const dinner = selectNextMeal(matchedMeals.dinner, usedMealIds);
    if (dinner) {
      dayMeals.push(dinner);
      usedMealIds.add(dinner.id);
    }

    // Add snacks if needed
    if (mealsPerDay > 3) {
      const snacksNeeded = mealsPerDay - 3;
      for (let s = 0; s < snacksNeeded; s++) {
        const snack = selectNextMeal(matchedMeals.snacks, usedMealIds);
        if (snack) {
          dayMeals.push(snack);
          usedMealIds.add(snack.id);
        }
      }
    }

    plan.push({ day, meals: dayMeals });
  }

  // If we've used all meals and need more, allow repeats but still pick highest scored
  if (usedMealIds.size >= matchedMeals.breakfast.length + matchedMeals.lunch.length + matchedMeals.dinner.length) {
    console.log('[Meal Matcher] Note: Some meals may repeat due to limited matches for dietary requirements');
  }

  return plan;
}

function selectNextMeal(meals: ScoredMeal[], usedIds: Set<string>): ScoredMeal | null {
  // First try to find an unused meal
  for (const meal of meals) {
    if (!usedIds.has(meal.id)) {
      return meal;
    }
  }

  // If all meals used, return the highest scored one (allow repeat)
  return meals[0] || null;
}
