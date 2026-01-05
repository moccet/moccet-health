/**
 * Nutrition Cache Service
 * Caches nutrition lookups in Supabase for faster subsequent queries
 */

import { createClient } from '@supabase/supabase-js';
import { NutritionData, NutritionCacheEntry } from './types';

const CACHE_TTL_DAYS = 30;

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Supabase configuration missing');
  }

  return createClient(url, key);
}

function normalizeText(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
}

/**
 * Get cached nutrition data by normalized food name
 */
export async function getCachedNutrition(foodName: string): Promise<NutritionData | null> {
  const supabase = getSupabaseClient();
  const normalized = normalizeText(foodName);

  console.log(`[NutritionCache] Looking up: "${normalized}"`);

  try {
    const { data, error } = await supabase
      .from('food_nutrition_cache')
      .select('*')
      .eq('food_name_normalized', normalized)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found
        console.log(`[NutritionCache] Cache miss for: "${normalized}"`);
        return null;
      }
      throw error;
    }

    const entry = data as NutritionCacheEntry;

    // Check if cache entry is expired
    const createdAt = new Date(entry.created_at);
    const expiryDate = new Date(createdAt.getTime() + CACHE_TTL_DAYS * 24 * 60 * 60 * 1000);
    if (new Date() > expiryDate) {
      console.log(`[NutritionCache] Cache expired for: "${normalized}"`);
      return null;
    }

    console.log(`[NutritionCache] Cache hit for: "${normalized}" (source: ${entry.source})`);

    return {
      name: entry.food_name,
      nameNormalized: entry.food_name_normalized,
      source: entry.source as 'usda' | 'openfoodfacts' | 'ai_estimated',
      fdcId: entry.fdc_id || undefined,
      offCode: entry.off_code || undefined,
      macros: entry.macros,
      micros: entry.micros || undefined,
      servingSizeGrams: entry.serving_size_grams || 100,
    };
  } catch (error) {
    console.error('[NutritionCache] Error getting cached data:', error);
    return null;
  }
}

/**
 * Get cached nutrition data by barcode
 */
export async function getCachedByBarcode(barcode: string): Promise<NutritionData | null> {
  const supabase = getSupabaseClient();

  console.log(`[NutritionCache] Looking up barcode: "${barcode}"`);

  try {
    const { data, error } = await supabase
      .from('food_nutrition_cache')
      .select('*')
      .eq('off_code', barcode)
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        console.log(`[NutritionCache] Cache miss for barcode: "${barcode}"`);
        return null;
      }
      throw error;
    }

    const entry = data as NutritionCacheEntry;
    console.log(`[NutritionCache] Cache hit for barcode: "${barcode}"`);

    return {
      name: entry.food_name,
      nameNormalized: entry.food_name_normalized,
      source: entry.source as 'usda' | 'openfoodfacts' | 'ai_estimated',
      fdcId: entry.fdc_id || undefined,
      offCode: entry.off_code || undefined,
      macros: entry.macros,
      micros: entry.micros || undefined,
      servingSizeGrams: entry.serving_size_grams || 100,
    };
  } catch (error) {
    console.error('[NutritionCache] Error getting cached barcode data:', error);
    return null;
  }
}

/**
 * Cache nutrition data
 */
export async function cacheNutrition(nutrition: NutritionData): Promise<void> {
  const supabase = getSupabaseClient();

  console.log(`[NutritionCache] Caching: "${nutrition.name}" (source: ${nutrition.source})`);

  try {
    const { error } = await supabase
      .from('food_nutrition_cache')
      .upsert({
        food_name: nutrition.name,
        food_name_normalized: normalizeText(nutrition.name),
        source: nutrition.source,
        fdc_id: nutrition.fdcId || null,
        off_code: nutrition.offCode || null,
        macros: nutrition.macros,
        micros: nutrition.micros || null,
        serving_size_grams: nutrition.servingSizeGrams,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'food_name_normalized,source',
      });

    if (error) {
      console.error('[NutritionCache] Error caching data:', error);
      // Don't throw - caching failure shouldn't break the main flow
    } else {
      console.log(`[NutritionCache] Successfully cached: "${nutrition.name}"`);
    }
  } catch (error) {
    console.error('[NutritionCache] Error caching data:', error);
    // Don't throw - caching failure shouldn't break the main flow
  }
}

/**
 * Clear expired cache entries (can be called periodically)
 */
export async function clearExpiredCache(): Promise<number> {
  const supabase = getSupabaseClient();

  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() - CACHE_TTL_DAYS);

  try {
    const { data, error } = await supabase
      .from('food_nutrition_cache')
      .delete()
      .lt('updated_at', expiryDate.toISOString())
      .select('id');

    if (error) {
      throw error;
    }

    const deletedCount = data?.length || 0;
    console.log(`[NutritionCache] Cleared ${deletedCount} expired entries`);
    return deletedCount;
  } catch (error) {
    console.error('[NutritionCache] Error clearing expired cache:', error);
    return 0;
  }
}
