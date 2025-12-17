/**
 * Recipe Enricher Agent
 *
 * Purpose: Add detailed ingredients, cooking instructions, and prep tips to meals
 * Model: GPT-4o-mini (structured output generation)
 * Cost: ~$0.008 per call
 *
 * This agent takes the skeleton meal plan and enriches each recipe with
 * detailed ingredients, step-by-step cooking instructions, and meal prep tips.
 */

import OpenAI from 'openai';
import { ClientProfileCard } from '../../types/client-profile';
import {
  RecipeEnricherOutput,
  SampleMealPlan,
  DayMealPlan,
  MealRecipe,
} from '../../types/sage-plan-output';

// ============================================================================
// TYPES
// ============================================================================

export interface RecipeEnricherInput {
  clientProfile: ClientProfileCard;
  mealPlanSkeleton: SampleMealPlan;
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

const SYSTEM_PROMPT = `You are a Professional Recipe Developer — expert at creating clear, detailed recipes that anyone can follow.

Your task is to enrich meal skeletons with detailed ingredients and cooking instructions.

CRITICAL RULES:
1. NEVER use colons (:) in text — use em dashes (—) instead
2. STRICTLY respect ALL dietary constraints (NO allergens)
3. Ingredients must include specific quantities (e.g., "2 tbsp olive oil", "150g chicken breast")
4. Instructions should be clear and numbered
5. Match the complexity to their cooking skill level
6. Include meal prep tips where applicable

OUTPUT FORMAT:
For each meal, add:
- ingredients — array of strings with quantities (e.g., ["150g chicken breast", "2 tbsp olive oil"])
- cookingInstructions — numbered steps (e.g., ["1. Preheat oven to 200°C", "2. Season the chicken..."])
- mealPrepTip — Optional tip for batch cooking or prep ahead

IMPORTANT:
- Keep instructions practical and achievable
- Use common ingredients when possible
- Provide alternatives for harder-to-find items
- Include resting times, internal temperatures for meats
- Consider their equipment availability`;

// ============================================================================
// BUILD USER PROMPT
// ============================================================================

function buildUserPrompt(input: RecipeEnricherInput): string {
  const { clientProfile, mealPlanSkeleton } = input;
  const { constraints } = clientProfile;

  let prompt = `# RECIPE ENRICHMENT REQUEST

## Cooking Profile
- Skill Level — ${constraints.cookingSkill || 'intermediate'}
- Time Available — ${constraints.timeForMealPrep || 'moderate'}
- Budget — ${constraints.budget || 'moderate'}
${constraints.kitchenEquipment ? `- Equipment Available — ${constraints.kitchenEquipment.join(', ')}` : ''}

## STRICT DIETARY CONSTRAINTS
`;

  // Add allergies - STRICT
  const allergies = constraints.dietary.filter(c => c.type === 'allergy');
  if (allergies.length > 0) {
    prompt += `### ALLERGIES — NEVER USE THESE INGREDIENTS\n`;
    for (const a of allergies) {
      prompt += `- ${a.item.toUpperCase()}\n`;
    }
  }

  // Add intolerances
  const intolerances = constraints.dietary.filter(c => c.type === 'intolerance');
  if (intolerances.length > 0) {
    prompt += `### INTOLERANCES — AVOID OR USE ALTERNATIVES\n`;
    for (const i of intolerances) {
      prompt += `- ${i.item}${i.alternatives ? ` — use ${i.alternatives.join(' or ')} instead` : ''}\n`;
    }
  }

  prompt += `\n## MEALS TO ENRICH\n\n`;

  // Add meals that need enrichment (we'll do this in batches)
  const days = ['day1', 'day2', 'day3', 'day4', 'day5', 'day6', 'day7'];
  for (const dayKey of days) {
    const day = mealPlanSkeleton[dayKey as keyof SampleMealPlan] as DayMealPlan;
    if (!day || !day.meals) continue;

    prompt += `### ${dayKey.toUpperCase()}\n`;
    for (let i = 0; i < day.meals.length; i++) {
      const meal = day.meals[i];
      prompt += `
**Meal ${i + 1} — ${meal.name}**
- Time — ${meal.time}
- Description — ${meal.description}
- Macros — ${meal.macros}
- Difficulty — ${meal.difficulty || 'moderate'}
- Prep Type — ${meal.prepType || 'standard'}
`;
    }
  }

  prompt += `
## YOUR TASK
For EACH meal above, provide:
1. Detailed ingredients list with exact quantities
2. Step-by-step cooking instructions
3. Optional meal prep tip

Return JSON in this format:
{
  "enrichedMealPlan": {
    "day1": {
      "meals": [
        {
          "time": "7:30 AM",
          "name": "Original meal name",
          "description": "Original description",
          "macros": "Original macros",
          "ingredients": ["150g chicken breast", "2 tbsp olive oil", "..."],
          "cookingInstructions": ["1. Preheat pan over medium heat", "2. Season chicken with...", "..."],
          "prepTime": "10 minutes",
          "cookTime": "15 minutes",
          "difficulty": "simple",
          "prepType": "quick",
          "mealPrepTip": "Can be prepped in advance..."
        }
      ],
      "dailyTotals": { ... }
    },
    ...
  }
}`;

  return prompt;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

export async function runRecipeEnricher(input: RecipeEnricherInput): Promise<RecipeEnricherOutput> {
  console.log('[Recipe Enricher] Starting recipe enrichment...');
  console.log(`[Recipe Enricher] Enriching ${countMeals(input.mealPlanSkeleton)} meals`);

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
      temperature: 0.7,
      max_tokens: 12000, // Large output for all recipes
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from GPT-4o-mini');
    }

    const result = JSON.parse(content);

    console.log('[Recipe Enricher] Recipe enrichment complete');
    console.log(`[Recipe Enricher] Tokens used — ${response.usage?.total_tokens || 'unknown'}`);

    // Merge enriched recipes with original plan
    const enrichedPlan = mergeEnrichedPlan(input.mealPlanSkeleton, result.enrichedMealPlan);

    return { enrichedMealPlan: enrichedPlan };
  } catch (error) {
    console.error('[Recipe Enricher] Error:', error);
    console.log('[Recipe Enricher] Using basic enrichment');
    return { enrichedMealPlan: basicEnrichment(input.mealPlanSkeleton) };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function countMeals(plan: SampleMealPlan): number {
  let count = 0;
  const days = ['day1', 'day2', 'day3', 'day4', 'day5', 'day6', 'day7'];
  for (const dayKey of days) {
    const day = plan[dayKey as keyof SampleMealPlan] as DayMealPlan;
    if (day?.meals) {
      count += day.meals.length;
    }
  }
  return count;
}

function mergeEnrichedPlan(
  original: SampleMealPlan,
  enriched: Record<string, unknown>
): SampleMealPlan {
  const merged: SampleMealPlan = {
    profileSummary: original.profileSummary,
    importantNotes: original.importantNotes,
    day1: mergeDayPlan(original.day1, enriched?.day1 as Record<string, unknown>),
    day2: mergeDayPlan(original.day2, enriched?.day2 as Record<string, unknown>),
    day3: mergeDayPlan(original.day3, enriched?.day3 as Record<string, unknown>),
    day4: mergeDayPlan(original.day4, enriched?.day4 as Record<string, unknown>),
    day5: mergeDayPlan(original.day5, enriched?.day5 as Record<string, unknown>),
    day6: mergeDayPlan(original.day6, enriched?.day6 as Record<string, unknown>),
    day7: mergeDayPlan(original.day7, enriched?.day7 as Record<string, unknown>),
  };

  return merged;
}

function mergeDayPlan(
  original: DayMealPlan,
  enriched: Record<string, unknown> | undefined
): DayMealPlan {
  if (!enriched || !enriched.meals) {
    return original;
  }

  const enrichedMeals = enriched.meals as Array<Record<string, unknown>>;
  const mergedMeals: MealRecipe[] = original.meals.map((meal, index) => {
    const enrichedMeal = enrichedMeals[index] || {};
    return {
      ...meal,
      ingredients: (enrichedMeal.ingredients as string[]) || meal.ingredients || generateBasicIngredients(meal),
      cookingInstructions: (enrichedMeal.cookingInstructions as string[]) || meal.cookingInstructions || generateBasicInstructions(meal),
      prepTime: (enrichedMeal.prepTime as string) || meal.prepTime,
      cookTime: (enrichedMeal.cookTime as string) || meal.cookTime,
      mealPrepTip: (enrichedMeal.mealPrepTip as string) || meal.mealPrepTip,
    };
  });

  return {
    meals: mergedMeals,
    dailyTotals: original.dailyTotals,
  };
}

// ============================================================================
// BASIC ENRICHMENT FALLBACK
// ============================================================================

function basicEnrichment(plan: SampleMealPlan): SampleMealPlan {
  const enriched: SampleMealPlan = {
    profileSummary: plan.profileSummary,
    importantNotes: plan.importantNotes,
    day1: enrichDay(plan.day1),
    day2: enrichDay(plan.day2),
    day3: enrichDay(plan.day3),
    day4: enrichDay(plan.day4),
    day5: enrichDay(plan.day5),
    day6: enrichDay(plan.day6),
    day7: enrichDay(plan.day7),
  };

  return enriched;
}

function enrichDay(day: DayMealPlan): DayMealPlan {
  const enrichedMeals = day.meals.map(meal => ({
    ...meal,
    ingredients: meal.ingredients || generateBasicIngredients(meal),
    cookingInstructions: meal.cookingInstructions || generateBasicInstructions(meal),
  }));

  return {
    meals: enrichedMeals,
    dailyTotals: day.dailyTotals,
  };
}

function generateBasicIngredients(meal: MealRecipe): string[] {
  // Parse macros to estimate portions
  const macroMatch = meal.macros?.match(/(\d+)\s*cal.*?(\d+)g\s*protein/i);
  const calories = macroMatch ? parseInt(macroMatch[1]) : 500;
  const protein = macroMatch ? parseInt(macroMatch[2]) : 30;

  // Estimate protein source amount (roughly 25g protein per 100g meat)
  const proteinGrams = Math.round((protein / 25) * 100);

  const mealName = meal.name.toLowerCase();
  const ingredients: string[] = [];

  // Add protein source
  if (mealName.includes('chicken')) {
    ingredients.push(`${proteinGrams}g chicken breast`);
  } else if (mealName.includes('salmon') || mealName.includes('fish')) {
    ingredients.push(`${proteinGrams}g salmon fillet`);
  } else if (mealName.includes('egg')) {
    ingredients.push(`${Math.ceil(protein / 6)} large eggs`);
  } else if (mealName.includes('beef')) {
    ingredients.push(`${proteinGrams}g lean beef`);
  } else {
    ingredients.push(`${proteinGrams}g protein of choice`);
  }

  // Add common ingredients based on meal type
  if (mealName.includes('breakfast') || mealName.includes('scramble')) {
    ingredients.push('1 tbsp olive oil or butter');
    ingredients.push('Salt and pepper to taste');
    ingredients.push('1 cup mixed vegetables (optional)');
  } else {
    ingredients.push('1-2 tbsp olive oil');
    ingredients.push('1 cup mixed vegetables');
    ingredients.push('Herbs and spices to taste');
    ingredients.push('Salt and pepper to taste');
  }

  // Add carb source based on calories
  if (calories > 400) {
    if (mealName.includes('rice')) {
      ingredients.push('150g cooked rice');
    } else if (mealName.includes('pasta')) {
      ingredients.push('100g dry pasta');
    } else {
      ingredients.push('150g complex carbohydrate (rice, potatoes, or quinoa)');
    }
  }

  return ingredients;
}

function generateBasicInstructions(meal: MealRecipe): string[] {
  const mealName = meal.name.toLowerCase();
  const instructions: string[] = [];

  // Start with prep
  instructions.push('1. Gather and prep all ingredients');

  if (mealName.includes('scramble') || mealName.includes('egg')) {
    instructions.push('2. Beat eggs in a bowl with a pinch of salt');
    instructions.push('3. Heat oil or butter in a non-stick pan over medium heat');
    instructions.push('4. Add eggs and gently stir until just set');
    instructions.push('5. Remove from heat while still slightly wet — they will continue cooking');
    instructions.push('6. Season with pepper and serve immediately');
  } else if (mealName.includes('chicken')) {
    instructions.push('2. Season chicken with salt, pepper, and preferred spices');
    instructions.push('3. Heat oil in a pan over medium-high heat');
    instructions.push('4. Cook chicken for 6-7 minutes per side until internal temp reaches 74°C (165°F)');
    instructions.push('5. Let rest for 5 minutes before slicing');
    instructions.push('6. Serve with prepared vegetables and carbohydrate');
  } else if (mealName.includes('salmon') || mealName.includes('fish')) {
    instructions.push('2. Season fish with salt, pepper, and lemon');
    instructions.push('3. Heat oil in a pan over medium-high heat');
    instructions.push('4. Cook skin-side down for 4 minutes');
    instructions.push('5. Flip and cook for another 3-4 minutes until cooked through');
    instructions.push('6. Serve immediately with sides');
  } else {
    instructions.push('2. Prepare protein according to package instructions or preference');
    instructions.push('3. Sauté vegetables in olive oil until tender');
    instructions.push('4. Season everything with salt, pepper, and herbs');
    instructions.push('5. Plate and serve with your prepared carbohydrate');
  }

  return instructions;
}
