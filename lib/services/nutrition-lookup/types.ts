/**
 * Types for Nutrition Lookup Service
 */

export interface MacroNutrients {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
}

export interface MicroNutrients {
  sodium?: number;
  sugar?: number;
  saturatedFat?: number;
  cholesterol?: number;
  potassium?: number;
  calcium?: number;
  iron?: number;
  vitaminA?: number;
  vitaminC?: number;
  vitaminD?: number;
}

export interface NutritionData {
  name: string;
  nameNormalized: string;
  source: 'usda' | 'openfoodfacts' | 'ai_estimated';
  fdcId?: string;
  offCode?: string;
  macros: MacroNutrients;
  micros?: MicroNutrients;
  servingSizeGrams: number;
  servingDescription?: string;
  brandName?: string;
  ingredients?: string;
  confidence?: number;
}

export interface FoodRecognitionResult {
  name: string;
  portionGrams: number;
  confidence: number;
  estimatedMacros?: MacroNutrients;
}

export interface FoodAnalysisResponse {
  success: boolean;
  foods: Array<{
    name: string;
    portionSize: string;
    portionGrams: number;
    confidence: number;
    macros: MacroNutrients;
    micros?: MicroNutrients;
    source: 'usda' | 'openfoodfacts' | 'ai_estimated';
    fdcId?: string;
    offCode?: string;
    servingDescription?: string;
  }>;
  imageUrl?: string;
  error?: string;
}

// USDA FoodData Central API types
export interface USDASearchResponse {
  totalHits: number;
  currentPage: number;
  totalPages: number;
  foods: USDAFood[];
}

export interface USDAFood {
  fdcId: number;
  description: string;
  dataType: string;
  brandName?: string;
  brandOwner?: string;
  ingredients?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  foodNutrients: USDANutrient[];
}

export interface USDANutrient {
  nutrientId: number;
  nutrientName: string;
  nutrientNumber: string;
  unitName: string;
  value: number;
}

// Open Food Facts API types
export interface OFFSearchResponse {
  count: number;
  page: number;
  page_count: number;
  page_size: number;
  products: OFFProduct[];
}

export interface OFFProduct {
  code: string;
  product_name: string;
  brands?: string;
  serving_size?: string;
  serving_quantity?: number;
  nutriments: {
    'energy-kcal_100g'?: number;
    'energy-kcal_serving'?: number;
    proteins_100g?: number;
    proteins_serving?: number;
    carbohydrates_100g?: number;
    carbohydrates_serving?: number;
    fat_100g?: number;
    fat_serving?: number;
    fiber_100g?: number;
    fiber_serving?: number;
    sugars_100g?: number;
    sodium_100g?: number;
    'saturated-fat_100g'?: number;
  };
  ingredients_text?: string;
}

// Cache entry type
export interface NutritionCacheEntry {
  id: string;
  food_name: string;
  food_name_normalized: string;
  source: string;
  fdc_id?: string;
  off_code?: string;
  macros: MacroNutrients;
  micros?: MicroNutrients;
  serving_size_grams?: number;
  created_at: string;
  updated_at: string;
}
