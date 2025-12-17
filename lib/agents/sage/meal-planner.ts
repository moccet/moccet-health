/**
 * Meal Planner Agent
 *
 * Purpose: Generate a 7-day meal plan structure based on the client's profile
 * Model: GPT-4o-mini (structured output generation)
 * Cost: ~$0.015 per call
 *
 * Creates meal plans that hit macro targets, respect dietary constraints,
 * and address biomarker concerns. Generates skeleton meals that will be
 * enriched by the Recipe Enricher agent.
 */

import OpenAI from 'openai';
import { ClientProfileCard } from '../../types/client-profile';
import {
  NutritionArchitectOutput,
  BiomarkerAnalystOutput,
  MealPlannerOutput,
  SampleMealPlan,
  DayMealPlan,
  MealRecipe,
} from '../../types/sage-plan-output';

// ============================================================================
// TYPES
// ============================================================================

export interface MealPlannerInput {
  clientProfile: ClientProfileCard;
  nutritionFramework: NutritionArchitectOutput;
  biomarkerAnalysis?: BiomarkerAnalystOutput;
}

// ============================================================================
// OPENAI CLIENT
// ============================================================================

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  return new OpenAI({ apiKey });
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

const SYSTEM_PROMPT = `You are a Professional Meal Planner — an expert at creating practical, delicious meal plans that hit nutritional targets while respecting dietary constraints.

Your task is to create a complete 7-day meal plan with MULTIPLE meals for EACH day.

CRITICAL RULES:
1. NEVER use colons (:) in meal names or descriptions — use em dashes (—) instead
2. STRICTLY respect ALL dietary constraints (allergies, intolerances, dislikes)
3. Hit the calorie and macro targets for each day (within 5% tolerance)
4. Include variety — don't repeat the same meal more than twice per week
5. Consider biomarker concerns in food choices
6. Make meals practical based on their cooking skill and time availability
7. Use their preferred protein sources

CRITICAL MEAL COUNT REQUIREMENT:
- You MUST generate the EXACT number of meals specified per day (typically 3)
- Each day's "meals" array MUST contain MULTIPLE meals (breakfast + lunch + dinner)
- DO NOT generate just one meal per day — that is WRONG
- Example for 3 meals/day — day1.meals MUST have 3 separate meal objects

MEAL STRUCTURE:
- Each day MUST have ALL meals specified (breakfast, lunch, dinner)
- Include snacks if needed to hit targets
- Balance macros throughout the day
- Front-load protein earlier in the day

OUTPUT FORMAT:
Return valid JSON with this structure. NOTE — each day has MULTIPLE meals in the meals array:
{
  "sampleMealPlan": {
    "profileSummary": {
      "goals": "Brief summary of their nutrition goals",
      "dietaryPreferences": "Key dietary preferences and restrictions",
      "keyBiomarkers": ["Biomarker concern 1", "Biomarker concern 2"]
    },
    "importantNotes": ["Note about the meal plan", "Another note"],
    "day1": {
      "meals": [
        {
          "time": "7:30 AM",
          "name": "Mediterranean Egg Scramble",
          "description": "Fluffy eggs with spinach, tomatoes, and feta cheese",
          "macros": "450 cal | 35g protein | 15g carbs | 28g fat | 4g fiber",
          "prepTime": "10 minutes",
          "difficulty": "simple",
          "prepType": "quick",
          "biomarkerNotes": "High in choline for liver health"
        },
        {
          "time": "12:30 PM",
          "name": "Grilled Chicken Salad",
          "description": "Grilled chicken breast over mixed greens with olive oil",
          "macros": "550 cal | 45g protein | 20g carbs | 30g fat | 8g fiber",
          "prepTime": "15 minutes",
          "difficulty": "simple",
          "prepType": "quick",
          "biomarkerNotes": "Lean protein for muscle maintenance"
        },
        {
          "time": "7:00 PM",
          "name": "Salmon with Roasted Vegetables",
          "description": "Baked salmon with seasonal roasted vegetables",
          "macros": "650 cal | 42g protein | 35g carbs | 38g fat | 10g fiber",
          "prepTime": "25 minutes",
          "difficulty": "moderate",
          "prepType": "standard",
          "biomarkerNotes": "Omega-3s for inflammation"
        }
      ],
      "dailyTotals": {
        "calories": 2400,
        "protein": 180,
        "carbs": 240,
        "fiber": 35,
        "fat": 80
      }
    },
    "day2": { "meals": [breakfast, lunch, dinner], ... },
    "day3": { "meals": [breakfast, lunch, dinner], ... },
    "day4": { "meals": [breakfast, lunch, dinner], ... },
    "day5": { "meals": [breakfast, lunch, dinner], ... },
    "day6": { "meals": [breakfast, lunch, dinner], ... },
    "day7": { "meals": [breakfast, lunch, dinner], ... }
  }
}

PREP TYPES:
- quick — Less than 15 minutes
- standard — 15-30 minutes
- batch-cook — Good for meal prep
- slow-cooker — Set and forget
- meal-prep — Pre-made component assembly

DIFFICULTY:
- simple — Basic cooking skills
- moderate — Some experience needed
- complex — Advanced techniques`;

// ============================================================================
// BUILD USER PROMPT
// ============================================================================

function buildUserPrompt(input: MealPlannerInput): string {
  const { clientProfile, nutritionFramework, biomarkerAnalysis } = input;
  const { profile, computedMetrics, constraints } = clientProfile;

  let prompt = `# MEAL PLAN REQUIREMENTS

## Target Macros (MUST HIT)
- Calories — ${computedMetrics.targetCalories}
- Protein — ${computedMetrics.proteinTargetGrams}g
- Carbs — ${computedMetrics.carbTargetGrams}g
- Fat — ${computedMetrics.fatTargetGrams}g
- Fiber — ${computedMetrics.fiberTargetGrams}g minimum

## Meals Per Day — MANDATORY REQUIREMENT
- ${profile.mealsPerDay} meals per day — YOU MUST INCLUDE ALL ${profile.mealsPerDay} MEALS FOR EACH DAY
- First meal timing — ${profile.firstMealTiming}
${profile.lastMealTiming ? `- Last meal timing — ${profile.lastMealTiming}` : ''}

CRITICAL — Each day's meals array MUST contain EXACTLY ${profile.mealsPerDay} separate meals:
- Day 1 meals array = [Meal 1 around breakfast time, Meal 2 around lunch time, Meal 3 around dinner time]
- Day 2 meals array = [Meal 1, Meal 2, Meal 3]
- And so on for all 7 days
- DO NOT generate just one meal per day rotating through times — that is WRONG

## Eating Style
- ${profile.eatingStyle}

## Cooking Profile
- Cooking Frequency — ${profile.cookingFrequency}
- Skill Level — ${constraints.cookingSkill || 'intermediate'}
- Time Available — ${constraints.timeForMealPrep || 'moderate'}
${constraints.budget ? `- Budget — ${constraints.budget}` : ''}

## Preferred Proteins
${profile.proteinPreferences.length > 0 ? profile.proteinPreferences.join(', ') : 'No specific preferences'}

## STRICT DIETARY CONSTRAINTS (MUST AVOID)
`;

  // Add allergies - STRICT
  const allergies = constraints.dietary.filter(c => c.type === 'allergy');
  if (allergies.length > 0) {
    prompt += `### ALLERGIES — DO NOT INCLUDE THESE\n`;
    for (const a of allergies) {
      prompt += `- ${a.item.toUpperCase()} — STRICT AVOID\n`;
    }
  }

  // Add intolerances
  const intolerances = constraints.dietary.filter(c => c.type === 'intolerance');
  if (intolerances.length > 0) {
    prompt += `### INTOLERANCES — MINIMIZE OR AVOID\n`;
    for (const i of intolerances) {
      prompt += `- ${i.item}\n`;
    }
  }

  // Add dislikes
  const dislikes = constraints.dietary.filter(c => c.type === 'preference');
  if (dislikes.length > 0) {
    prompt += `### FOOD DISLIKES — AVOID\n`;
    for (const d of dislikes) {
      prompt += `- ${d.item}\n`;
    }
  }

  // Add biomarker-based food recommendations
  if (biomarkerAnalysis && biomarkerAnalysis.nutritionalPriorities.length > 0) {
    prompt += `\n## BIOMARKER-BASED FOOD GUIDANCE\n`;
    for (const priority of biomarkerAnalysis.nutritionalPriorities.slice(0, 3)) {
      prompt += `### ${priority.concern}\n`;
      if (priority.foodsToEmphasize.length > 0) {
        prompt += `- EMPHASIZE — ${priority.foodsToEmphasize.join(', ')}\n`;
      }
      if (priority.foodsToLimit.length > 0) {
        prompt += `- LIMIT — ${priority.foodsToLimit.join(', ')}\n`;
      }
    }
  }

  // Add nutrition philosophy context
  if (nutritionFramework.nutritionPhilosophy) {
    prompt += `\n## NUTRITION PHILOSOPHY\n`;
    for (const principle of nutritionFramework.nutritionPhilosophy.keyPrinciples.slice(0, 3)) {
      prompt += `- ${principle.principle} — ${principle.description}\n`;
    }
  }

  // Add cuisine preferences if available
  if (profile.cuisinePreferences && profile.cuisinePreferences.length > 0) {
    prompt += `\n## PREFERRED CUISINES\n- ${profile.cuisinePreferences.join(', ')}\n`;
  }

  prompt += `
## YOUR TASK
Create a complete 7-day meal plan that:
1. Hits the macro targets for EACH day (within 5% tolerance)
2. STRICTLY avoids all allergens and intolerances listed
3. Incorporates foods that address biomarker concerns
4. Uses their preferred proteins
5. Matches their cooking skill and time availability
6. Provides variety across the week
7. CRITICAL — Each day MUST have EXACTLY ${profile.mealsPerDay} separate meals in the meals array (breakfast + lunch + dinner)

FINAL REMINDER — Your response MUST have ${profile.mealsPerDay} meals in EVERY day's meals array. Not 1 meal, but ${profile.mealsPerDay} meals per day.

Return the JSON structure as specified.`;

  return prompt;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

export async function runMealPlanner(input: MealPlannerInput): Promise<MealPlannerOutput> {
  console.log('[Meal Planner] Starting 7-day meal plan generation...');
  console.log(`[Meal Planner] Target — ${input.clientProfile.computedMetrics.targetCalories} cal, ${input.clientProfile.computedMetrics.proteinTargetGrams}g protein`);

  const openai = getOpenAIClient();
  const userPrompt = buildUserPrompt(input);

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8, // Higher for variety
      max_tokens: 16000, // Large output for 7 days x 3 meals each
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from GPT-4o-mini');
    }

    const result = JSON.parse(content);

    console.log('[Meal Planner] Meal plan generation complete');
    console.log(`[Meal Planner] Tokens used — ${response.usage?.total_tokens || 'unknown'}`);

    // Validate and normalize
    const normalizedPlan = normalizeMealPlan(result.sampleMealPlan, input);

    // Validate that each day has the expected number of meals
    const expectedMeals = input.clientProfile.profile.mealsPerDay || 3;
    const dayKeys = ['day1', 'day2', 'day3', 'day4', 'day5', 'day6', 'day7'] as const;
    let hasMealCountIssue = false;

    for (const dayKey of dayKeys) {
      const day = normalizedPlan[dayKey];
      if (!day?.meals || day.meals.length < expectedMeals) {
        console.warn(`[Meal Planner] ${dayKey} has only ${day?.meals?.length || 0} meals, expected ${expectedMeals}`);
        hasMealCountIssue = true;
        break;
      }
    }

    // If meal count is wrong, use the reliable fallback
    if (hasMealCountIssue) {
      console.log('[Meal Planner] Meal count validation failed — using fallback meal plan');
      return { sampleMealPlan: createFallbackMealPlan(input) };
    }

    return { sampleMealPlan: normalizedPlan };
  } catch (error) {
    console.error('[Meal Planner] Error:', error);
    console.log('[Meal Planner] Using fallback meal plan');
    return { sampleMealPlan: createFallbackMealPlan(input) };
  }
}

// ============================================================================
// NORMALIZE MEAL PLAN
// ============================================================================

function normalizeMealPlan(
  plan: Record<string, unknown>,
  input: MealPlannerInput
): SampleMealPlan {
  const { clientProfile, biomarkerAnalysis } = input;
  const { computedMetrics } = clientProfile;

  // Extract profile summary or create default
  const profileSummary = (plan?.profileSummary as Record<string, unknown>) || {
    goals: clientProfile.profile.drivingGoal,
    dietaryPreferences: clientProfile.profile.eatingStyle,
    keyBiomarkers: biomarkerAnalysis?.nutritionalPriorities.map(p => p.concern).slice(0, 3) || [],
  };

  const normalized: SampleMealPlan = {
    profileSummary: {
      goals: (profileSummary.goals as string) || clientProfile.profile.drivingGoal,
      dietaryPreferences: (profileSummary.dietaryPreferences as string) || clientProfile.profile.eatingStyle,
      keyBiomarkers: (profileSummary.keyBiomarkers as string[]) || [],
    },
    importantNotes: (plan?.importantNotes as string[]) || [],
    day1: normalizeDayPlan(plan?.day1 as Record<string, unknown>, computedMetrics),
    day2: normalizeDayPlan(plan?.day2 as Record<string, unknown>, computedMetrics),
    day3: normalizeDayPlan(plan?.day3 as Record<string, unknown>, computedMetrics),
    day4: normalizeDayPlan(plan?.day4 as Record<string, unknown>, computedMetrics),
    day5: normalizeDayPlan(plan?.day5 as Record<string, unknown>, computedMetrics),
    day6: normalizeDayPlan(plan?.day6 as Record<string, unknown>, computedMetrics),
    day7: normalizeDayPlan(plan?.day7 as Record<string, unknown>, computedMetrics),
  };

  return normalized;
}

function normalizeDayPlan(
  day: Record<string, unknown> | undefined,
  metrics: { targetCalories: number; proteinTargetGrams: number; carbTargetGrams: number; fatTargetGrams: number; fiberTargetGrams: number }
): DayMealPlan {
  if (!day) {
    return createDefaultDayPlan(metrics);
  }

  const meals = (day.meals as Array<Record<string, unknown>>) || [];
  const normalizedMeals: MealRecipe[] = meals.map(meal => ({
    time: (meal.time as string) || '',
    name: (meal.name as string) || 'Meal',
    description: (meal.description as string) || '',
    macros: (meal.macros as string) || '',
    ingredients: (meal.ingredients as string[]),
    cookingInstructions: (meal.cookingInstructions as string[]),
    prepTime: (meal.prepTime as string),
    cookTime: (meal.cookTime as string),
    cookingTime: (meal.cookingTime as string),
    difficulty: (meal.difficulty as 'simple' | 'moderate' | 'complex'),
    prepType: (meal.prepType as 'quick' | 'batch-cook' | 'slow-cooker' | 'meal-prep' | 'standard'),
    biomarkerNotes: (meal.biomarkerNotes as string),
    mealPrepTip: (meal.mealPrepTip as string),
  }));

  const dailyTotals = (day.dailyTotals as Record<string, number>) || {
    calories: metrics.targetCalories,
    protein: metrics.proteinTargetGrams,
    carbs: metrics.carbTargetGrams,
    fiber: metrics.fiberTargetGrams,
    fat: metrics.fatTargetGrams,
  };

  return {
    meals: normalizedMeals,
    dailyTotals: {
      calories: dailyTotals.calories || metrics.targetCalories,
      protein: dailyTotals.protein || metrics.proteinTargetGrams,
      carbs: dailyTotals.carbs || metrics.carbTargetGrams,
      fiber: dailyTotals.fiber || metrics.fiberTargetGrams,
      fat: dailyTotals.fat || metrics.fatTargetGrams,
    },
  };
}

function createDefaultDayPlan(
  metrics: { targetCalories: number; proteinTargetGrams: number; carbTargetGrams: number; fatTargetGrams: number; fiberTargetGrams: number }
): DayMealPlan {
  return {
    meals: [
      {
        time: '8:00 AM',
        name: 'Protein Breakfast Bowl',
        description: 'Balanced breakfast to start the day',
        macros: `${Math.round(metrics.targetCalories * 0.25)} cal | ${Math.round(metrics.proteinTargetGrams * 0.3)}g protein`,
        prepTime: '15 minutes',
        difficulty: 'simple',
        prepType: 'quick',
      },
      {
        time: '12:30 PM',
        name: 'Balanced Lunch',
        description: 'Nutrient-dense midday meal',
        macros: `${Math.round(metrics.targetCalories * 0.35)} cal | ${Math.round(metrics.proteinTargetGrams * 0.35)}g protein`,
        prepTime: '20 minutes',
        difficulty: 'moderate',
        prepType: 'standard',
      },
      {
        time: '7:00 PM',
        name: 'Wholesome Dinner',
        description: 'Satisfying evening meal',
        macros: `${Math.round(metrics.targetCalories * 0.35)} cal | ${Math.round(metrics.proteinTargetGrams * 0.3)}g protein`,
        prepTime: '30 minutes',
        difficulty: 'moderate',
        prepType: 'standard',
      },
    ],
    dailyTotals: {
      calories: metrics.targetCalories,
      protein: metrics.proteinTargetGrams,
      carbs: metrics.carbTargetGrams,
      fiber: metrics.fiberTargetGrams,
      fat: metrics.fatTargetGrams,
    },
  };
}

// ============================================================================
// FALLBACK MEAL PLAN
// ============================================================================

function createFallbackMealPlan(input: MealPlannerInput): SampleMealPlan {
  const { clientProfile, biomarkerAnalysis } = input;
  const { profile, computedMetrics, constraints } = clientProfile;

  // Determine preferred proteins
  const proteins = profile.proteinPreferences.length > 0
    ? profile.proteinPreferences
    : ['chicken', 'fish', 'eggs', 'legumes'];

  // Filter out any allergens from proteins
  const allergies = constraints.dietary
    .filter(c => c.type === 'allergy')
    .map(c => c.item.toLowerCase());

  const safeProteins = proteins.filter(p =>
    !allergies.some(a => p.toLowerCase().includes(a))
  );

  const mealsPerDay = profile.mealsPerDay || 3;
  const caloriesPerMeal = Math.round(computedMetrics.targetCalories / mealsPerDay);
  const proteinPerMeal = Math.round(computedMetrics.proteinTargetGrams / mealsPerDay);

  // Generate 7 days
  const days: Record<string, DayMealPlan> = {};
  const dayNames = ['day1', 'day2', 'day3', 'day4', 'day5', 'day6', 'day7'];
  const mealTimes = mealsPerDay === 3
    ? ['8:00 AM', '12:30 PM', '7:00 PM']
    : mealsPerDay === 4
    ? ['8:00 AM', '12:00 PM', '3:30 PM', '7:00 PM']
    : ['8:00 AM', '11:00 AM', '1:30 PM', '4:00 PM', '7:30 PM'];

  for (let d = 0; d < 7; d++) {
    const meals: MealRecipe[] = [];
    const proteinRotation = safeProteins[d % safeProteins.length];

    for (let m = 0; m < mealsPerDay; m++) {
      const mealType = m === 0 ? 'Breakfast' : m === mealsPerDay - 1 ? 'Dinner' : 'Lunch';
      meals.push({
        time: mealTimes[m] || `${8 + m * 4}:00`,
        name: `${mealType} — Day ${d + 1}`,
        description: `Balanced ${mealType.toLowerCase()} featuring ${proteinRotation}`,
        macros: `${caloriesPerMeal} cal | ${proteinPerMeal}g protein | ${Math.round(computedMetrics.carbTargetGrams / mealsPerDay)}g carbs | ${Math.round(computedMetrics.fatTargetGrams / mealsPerDay)}g fat`,
        prepTime: '20 minutes',
        difficulty: 'simple',
        prepType: 'standard',
      });
    }

    days[dayNames[d]] = {
      meals,
      dailyTotals: {
        calories: computedMetrics.targetCalories,
        protein: computedMetrics.proteinTargetGrams,
        carbs: computedMetrics.carbTargetGrams,
        fiber: computedMetrics.fiberTargetGrams,
        fat: computedMetrics.fatTargetGrams,
      },
    };
  }

  return {
    profileSummary: {
      goals: profile.drivingGoal,
      dietaryPreferences: profile.eatingStyle,
      keyBiomarkers: biomarkerAnalysis?.nutritionalPriorities.map(p => p.concern).slice(0, 3) || [],
    },
    importantNotes: [
      'This is a template meal plan — customize based on your preferences',
      'Swap similar foods while maintaining macro balance',
    ],
    ...days,
  } as SampleMealPlan;
}
