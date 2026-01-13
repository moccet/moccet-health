/**
 * USDA FoodData Central API Client
 * https://fdc.nal.usda.gov/api-guide.html
 */

import { NutritionData, USDASearchResponse, USDAFood, MacroNutrients, MicroNutrients } from './types';

const USDA_API_BASE = 'https://api.nal.usda.gov/fdc/v1';

// USDA Nutrient IDs
const NUTRIENT_IDS = {
  ENERGY: 1008,        // kcal
  PROTEIN: 1003,       // g
  CARBS: 1005,         // g
  FAT: 1004,           // g
  FIBER: 1079,         // g
  SUGAR: 2000,         // g
  SODIUM: 1093,        // mg
  SATURATED_FAT: 1258, // g
  CHOLESTEROL: 1253,   // mg
  POTASSIUM: 1092,     // mg
  CALCIUM: 1087,       // mg
  IRON: 1089,          // mg
  VITAMIN_A: 1106,     // IU
  VITAMIN_C: 1162,     // mg
  VITAMIN_D: 1114,     // IU
};

function getApiKey(): string {
  const key = process.env.USDA_API_KEY;
  if (!key) {
    console.warn('[USDA] No API key found - using DEMO_KEY (limited to 30 requests/hour)');
    return 'DEMO_KEY';
  }
  return key;
}

function normalizeText(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
}

function extractNutrientValue(food: USDAFood, nutrientId: number): number | undefined {
  const nutrient = food.foodNutrients.find(n => n.nutrientId === nutrientId);
  return nutrient?.value;
}

function convertToNutritionData(food: USDAFood): NutritionData {
  const macros: MacroNutrients = {
    calories: extractNutrientValue(food, NUTRIENT_IDS.ENERGY) || 0,
    protein: extractNutrientValue(food, NUTRIENT_IDS.PROTEIN) || 0,
    carbs: extractNutrientValue(food, NUTRIENT_IDS.CARBS) || 0,
    fat: extractNutrientValue(food, NUTRIENT_IDS.FAT) || 0,
    fiber: extractNutrientValue(food, NUTRIENT_IDS.FIBER),
  };

  const micros: MicroNutrients = {
    sodium: extractNutrientValue(food, NUTRIENT_IDS.SODIUM),
    sugar: extractNutrientValue(food, NUTRIENT_IDS.SUGAR),
    saturatedFat: extractNutrientValue(food, NUTRIENT_IDS.SATURATED_FAT),
    cholesterol: extractNutrientValue(food, NUTRIENT_IDS.CHOLESTEROL),
    potassium: extractNutrientValue(food, NUTRIENT_IDS.POTASSIUM),
    calcium: extractNutrientValue(food, NUTRIENT_IDS.CALCIUM),
    iron: extractNutrientValue(food, NUTRIENT_IDS.IRON),
    vitaminA: extractNutrientValue(food, NUTRIENT_IDS.VITAMIN_A),
    vitaminC: extractNutrientValue(food, NUTRIENT_IDS.VITAMIN_C),
    vitaminD: extractNutrientValue(food, NUTRIENT_IDS.VITAMIN_D),
  };

  // Default serving size is 100g for USDA data (per 100g values)
  const servingSizeGrams = food.servingSize || 100;

  return {
    name: food.description,
    nameNormalized: normalizeText(food.description),
    source: 'usda',
    fdcId: food.fdcId.toString(),
    macros,
    micros,
    servingSizeGrams,
    servingDescription: food.servingSizeUnit ? `${food.servingSize} ${food.servingSizeUnit}` : '100g',
    brandName: food.brandName || food.brandOwner,
    ingredients: food.ingredients,
  };
}

/**
 * Search USDA FoodData Central for foods matching the query
 */
export async function searchUSDA(
  query: string,
  options: {
    pageSize?: number;
    dataType?: string[];
  } = {}
): Promise<NutritionData[]> {
  const apiKey = getApiKey();
  const pageSize = options.pageSize || 5;

  // Prefer Foundation and SR Legacy data types for better accuracy
  const dataTypes = options.dataType || ['Foundation', 'SR Legacy', 'Survey (FNDDS)', 'Branded'];

  const params = new URLSearchParams({
    api_key: apiKey,
    query: query,
    pageSize: pageSize.toString(),
    dataType: dataTypes.join(','),
  });

  const url = `${USDA_API_BASE}/foods/search?${params}`;

  console.log(`[USDA] Searching for: "${query}"`);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[USDA] API error: ${response.status} - ${errorText}`);
      // Return empty results for 400 errors (often means no matches found)
      if (response.status === 400) {
        console.log(`[USDA] No results for "${query}" (400 response)`);
        return [];
      }
      throw new Error(`USDA API error: ${response.status}`);
    }

    const data: USDASearchResponse = await response.json();
    console.log(`[USDA] Found ${data.totalHits} results for "${query}"`);

    if (!data.foods || data.foods.length === 0) {
      return [];
    }

    // Convert and return top results
    return data.foods.map(convertToNutritionData);
  } catch (error) {
    console.error('[USDA] Search error:', error);
    throw error;
  }
}

/**
 * Get food by FDC ID
 */
export async function getFoodById(fdcId: string): Promise<NutritionData | null> {
  const apiKey = getApiKey();
  const url = `${USDA_API_BASE}/food/${fdcId}?api_key=${apiKey}`;

  console.log(`[USDA] Getting food by ID: ${fdcId}`);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`USDA API error: ${response.status}`);
    }

    const food: USDAFood = await response.json();
    return convertToNutritionData(food);
  } catch (error) {
    console.error('[USDA] Get by ID error:', error);
    throw error;
  }
}

/**
 * Find the best match for a food name
 */
export async function findBestMatch(foodName: string): Promise<NutritionData | null> {
  const results = await searchUSDA(foodName, { pageSize: 3 });

  if (results.length === 0) {
    return null;
  }

  // Return the first (best) match
  // USDA already ranks by relevance
  return results[0];
}

/**
 * Scale nutrition values to a specific portion size
 */
export function scaleToPortionSize(
  nutrition: NutritionData,
  portionGrams: number
): NutritionData {
  const scaleFactor = portionGrams / nutrition.servingSizeGrams;

  const scaledMacros: MacroNutrients = {
    calories: Math.round(nutrition.macros.calories * scaleFactor),
    protein: Math.round(nutrition.macros.protein * scaleFactor * 10) / 10,
    carbs: Math.round(nutrition.macros.carbs * scaleFactor * 10) / 10,
    fat: Math.round(nutrition.macros.fat * scaleFactor * 10) / 10,
    fiber: nutrition.macros.fiber
      ? Math.round(nutrition.macros.fiber * scaleFactor * 10) / 10
      : undefined,
  };

  const scaledMicros: MicroNutrients | undefined = nutrition.micros ? {
    sodium: nutrition.micros.sodium ? Math.round(nutrition.micros.sodium * scaleFactor) : undefined,
    sugar: nutrition.micros.sugar ? Math.round(nutrition.micros.sugar * scaleFactor * 10) / 10 : undefined,
    saturatedFat: nutrition.micros.saturatedFat ? Math.round(nutrition.micros.saturatedFat * scaleFactor * 10) / 10 : undefined,
    cholesterol: nutrition.micros.cholesterol ? Math.round(nutrition.micros.cholesterol * scaleFactor) : undefined,
    potassium: nutrition.micros.potassium ? Math.round(nutrition.micros.potassium * scaleFactor) : undefined,
    calcium: nutrition.micros.calcium ? Math.round(nutrition.micros.calcium * scaleFactor) : undefined,
    iron: nutrition.micros.iron ? Math.round(nutrition.micros.iron * scaleFactor * 10) / 10 : undefined,
    vitaminA: nutrition.micros.vitaminA ? Math.round(nutrition.micros.vitaminA * scaleFactor) : undefined,
    vitaminC: nutrition.micros.vitaminC ? Math.round(nutrition.micros.vitaminC * scaleFactor * 10) / 10 : undefined,
    vitaminD: nutrition.micros.vitaminD ? Math.round(nutrition.micros.vitaminD * scaleFactor) : undefined,
  } : undefined;

  return {
    ...nutrition,
    macros: scaledMacros,
    micros: scaledMicros,
    servingSizeGrams: portionGrams,
    servingDescription: `${portionGrams}g`,
  };
}
