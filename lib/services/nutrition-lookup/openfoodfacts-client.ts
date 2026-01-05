/**
 * Open Food Facts API Client
 * https://wiki.openfoodfacts.org/API
 */

import { NutritionData, OFFSearchResponse, OFFProduct, MacroNutrients, MicroNutrients } from './types';

const OFF_API_BASE = 'https://world.openfoodfacts.org';

function normalizeText(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
}

function convertToNutritionData(product: OFFProduct): NutritionData {
  const nutriments = product.nutriments || {};

  // Open Food Facts provides nutrition per 100g
  const macros: MacroNutrients = {
    calories: Math.round(nutriments['energy-kcal_100g'] || 0),
    protein: Math.round((nutriments.proteins_100g || 0) * 10) / 10,
    carbs: Math.round((nutriments.carbohydrates_100g || 0) * 10) / 10,
    fat: Math.round((nutriments.fat_100g || 0) * 10) / 10,
    fiber: nutriments.fiber_100g ? Math.round(nutriments.fiber_100g * 10) / 10 : undefined,
  };

  const micros: MicroNutrients = {
    sodium: nutriments.sodium_100g ? Math.round(nutriments.sodium_100g * 1000) : undefined, // Convert g to mg
    sugar: nutriments.sugars_100g ? Math.round(nutriments.sugars_100g * 10) / 10 : undefined,
    saturatedFat: nutriments['saturated-fat_100g'] ? Math.round(nutriments['saturated-fat_100g'] * 10) / 10 : undefined,
  };

  // Try to extract serving size in grams
  let servingSizeGrams = 100; // Default per 100g
  if (product.serving_quantity) {
    servingSizeGrams = product.serving_quantity;
  } else if (product.serving_size) {
    // Try to parse serving size string (e.g., "30g", "1 cup (240ml)")
    const gramsMatch = product.serving_size.match(/(\d+)\s*g/i);
    if (gramsMatch) {
      servingSizeGrams = parseInt(gramsMatch[1], 10);
    }
  }

  return {
    name: product.product_name || 'Unknown Product',
    nameNormalized: normalizeText(product.product_name || ''),
    source: 'openfoodfacts',
    offCode: product.code,
    macros,
    micros,
    servingSizeGrams: 100, // OFF data is per 100g
    servingDescription: product.serving_size || '100g',
    brandName: product.brands,
    ingredients: product.ingredients_text,
  };
}

/**
 * Search Open Food Facts for foods matching the query
 */
export async function searchOpenFoodFacts(
  query: string,
  options: {
    pageSize?: number;
  } = {}
): Promise<NutritionData[]> {
  const pageSize = options.pageSize || 5;

  const params = new URLSearchParams({
    search_terms: query,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: pageSize.toString(),
    fields: 'code,product_name,brands,serving_size,serving_quantity,nutriments,ingredients_text',
  });

  const url = `${OFF_API_BASE}/cgi/search.pl?${params}`;

  console.log(`[OpenFoodFacts] Searching for: "${query}"`);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'MoccetHealth/1.0 (contact@moccet.ai)',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[OpenFoodFacts] API error: ${response.status} - ${errorText}`);
      throw new Error(`Open Food Facts API error: ${response.status}`);
    }

    const data: OFFSearchResponse = await response.json();
    console.log(`[OpenFoodFacts] Found ${data.count} results for "${query}"`);

    if (!data.products || data.products.length === 0) {
      return [];
    }

    // Filter out products without nutrition data or name
    const validProducts = data.products.filter(
      p => p.product_name && p.nutriments && p.nutriments['energy-kcal_100g'] !== undefined
    );

    return validProducts.map(convertToNutritionData);
  } catch (error) {
    console.error('[OpenFoodFacts] Search error:', error);
    throw error;
  }
}

/**
 * Get product by barcode
 */
export async function getProductByBarcode(barcode: string): Promise<NutritionData | null> {
  const url = `${OFF_API_BASE}/api/v2/product/${barcode}`;

  console.log(`[OpenFoodFacts] Getting product by barcode: ${barcode}`);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'MoccetHealth/1.0 (contact@moccet.ai)',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Open Food Facts API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== 1 || !data.product) {
      return null;
    }

    return convertToNutritionData(data.product);
  } catch (error) {
    console.error('[OpenFoodFacts] Get by barcode error:', error);
    throw error;
  }
}

/**
 * Find the best match for a food name (prioritizes branded products)
 */
export async function findBestMatch(foodName: string): Promise<NutritionData | null> {
  const results = await searchOpenFoodFacts(foodName, { pageSize: 3 });

  if (results.length === 0) {
    return null;
  }

  // Return the first (best) match
  return results[0];
}

/**
 * Scale nutrition values to a specific portion size
 * (Same as USDA client - could be extracted to a shared utility)
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
  } : undefined;

  return {
    ...nutrition,
    macros: scaledMacros,
    micros: scaledMicros,
    servingSizeGrams: portionGrams,
    servingDescription: `${portionGrams}g`,
  };
}
