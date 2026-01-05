/**
 * Nutrition Lookup Service
 * Unified interface for looking up food nutrition data
 *
 * Priority:
 * 1. Check cache
 * 2. Query USDA FoodData Central
 * 3. Query Open Food Facts
 * 4. Fall back to AI-estimated values
 */

import { NutritionData, MacroNutrients } from './types';
import { findBestMatch as findUSDAMatch, scaleToPortionSize as scaleUSDA } from './usda-client';
import { findBestMatch as findOFFMatch, getProductByBarcode, scaleToPortionSize as scaleOFF } from './openfoodfacts-client';
import { getCachedNutrition, getCachedByBarcode, cacheNutrition } from './cache-service';

export * from './types';

/**
 * Look up nutrition data for a food by name
 * Checks cache first, then queries external APIs
 */
export async function lookupNutrition(
  foodName: string,
  options: {
    portionGrams?: number;
    skipCache?: boolean;
    aiEstimate?: MacroNutrients;
  } = {}
): Promise<NutritionData | null> {
  const { portionGrams, skipCache = false, aiEstimate } = options;

  console.log(`[NutritionLookup] Looking up: "${foodName}"`);

  // 1. Check cache first (unless skipped)
  if (!skipCache) {
    const cached = await getCachedNutrition(foodName);
    if (cached) {
      console.log(`[NutritionLookup] Using cached data for: "${foodName}"`);
      return portionGrams ? scaleUSDA(cached, portionGrams) : cached;
    }
  }

  // 2. Try USDA FoodData Central (best for generic foods)
  try {
    const usdaResult = await findUSDAMatch(foodName);
    if (usdaResult) {
      console.log(`[NutritionLookup] Found in USDA: "${usdaResult.name}"`);

      // Cache the result
      await cacheNutrition(usdaResult);

      return portionGrams ? scaleUSDA(usdaResult, portionGrams) : usdaResult;
    }
  } catch (error) {
    console.error(`[NutritionLookup] USDA lookup failed:`, error);
    // Continue to next source
  }

  // 3. Try Open Food Facts (good for branded products)
  try {
    const offResult = await findOFFMatch(foodName);
    if (offResult) {
      console.log(`[NutritionLookup] Found in Open Food Facts: "${offResult.name}"`);

      // Cache the result
      await cacheNutrition(offResult);

      return portionGrams ? scaleOFF(offResult, portionGrams) : offResult;
    }
  } catch (error) {
    console.error(`[NutritionLookup] Open Food Facts lookup failed:`, error);
    // Continue to fallback
  }

  // 4. Fall back to AI-estimated values if provided
  if (aiEstimate) {
    console.log(`[NutritionLookup] Using AI estimate for: "${foodName}"`);

    const aiNutrition: NutritionData = {
      name: foodName,
      nameNormalized: foodName.toLowerCase().trim(),
      source: 'ai_estimated',
      macros: aiEstimate,
      servingSizeGrams: portionGrams || 100,
      confidence: 0.7, // Lower confidence for AI estimates
    };

    // Cache the AI estimate
    await cacheNutrition(aiNutrition);

    return aiNutrition;
  }

  console.log(`[NutritionLookup] No data found for: "${foodName}"`);
  return null;
}

/**
 * Look up nutrition data by barcode
 */
export async function lookupByBarcode(
  barcode: string,
  options: {
    portionGrams?: number;
    skipCache?: boolean;
  } = {}
): Promise<NutritionData | null> {
  const { portionGrams, skipCache = false } = options;

  console.log(`[NutritionLookup] Looking up barcode: "${barcode}"`);

  // 1. Check cache first
  if (!skipCache) {
    const cached = await getCachedByBarcode(barcode);
    if (cached) {
      console.log(`[NutritionLookup] Using cached data for barcode: "${barcode}"`);
      return portionGrams ? scaleOFF(cached, portionGrams) : cached;
    }
  }

  // 2. Query Open Food Facts (primary source for barcodes)
  try {
    const offResult = await getProductByBarcode(barcode);
    if (offResult) {
      console.log(`[NutritionLookup] Found in Open Food Facts: "${offResult.name}"`);

      // Cache the result
      await cacheNutrition(offResult);

      return portionGrams ? scaleOFF(offResult, portionGrams) : offResult;
    }
  } catch (error) {
    console.error(`[NutritionLookup] Barcode lookup failed:`, error);
  }

  console.log(`[NutritionLookup] No data found for barcode: "${barcode}"`);
  return null;
}

/**
 * Look up multiple foods at once
 */
export async function lookupMultipleFoods(
  foods: Array<{
    name: string;
    portionGrams?: number;
    aiEstimate?: MacroNutrients;
  }>
): Promise<Array<NutritionData | null>> {
  console.log(`[NutritionLookup] Looking up ${foods.length} foods`);

  const results = await Promise.all(
    foods.map(food =>
      lookupNutrition(food.name, {
        portionGrams: food.portionGrams,
        aiEstimate: food.aiEstimate,
      })
    )
  );

  const foundCount = results.filter(r => r !== null).length;
  console.log(`[NutritionLookup] Found ${foundCount}/${foods.length} foods`);

  return results;
}

/**
 * Scale nutrition to a different portion size
 */
export function scaleNutrition(nutrition: NutritionData, portionGrams: number): NutritionData {
  return scaleUSDA(nutrition, portionGrams);
}
