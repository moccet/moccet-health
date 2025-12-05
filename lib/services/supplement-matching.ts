/**
 * Supplement Matching Service
 *
 * Maps AI-generated supplement recommendations to actual purchasable products
 * in the catalog. Ensures pricing consistency by always returning the same
 * product for the same supplement name.
 */

import { createClient } from '@supabase/supabase-js';
import { fetchProductImage } from './product-image-fetcher';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Types
export interface SupplementRecommendation {
  name: string; // e.g., "Vitamin D3"
  supplement?: string; // Alternative field name
  dosage: string; // e.g., "5000 IU daily"
  timing: string;
  rationale: string;
  duration?: string;
  benefits?: string;
}

export interface ProductMatch {
  // Product details
  productId: string;
  sku: string;
  name: string;
  brand: string;
  dosageForm: string;
  strength: string;
  quantity: number;
  unit: string;

  // Pricing
  wholesaleCost: number;
  retailPrice: number;
  margin: number;
  marginPercent: number;
  perDayPrice: number; // Calculated based on dosage

  // Inventory
  stockLevel: number;
  inStock: boolean;
  lowStockAlert: boolean;

  // Content
  description: string;
  benefits: string[];
  directions: string;
  warnings: string;
  imageUrl: string;

  // Quality
  thirdPartyTested: boolean;
  certifications: string[];

  // Matching metadata
  matchScore: number; // 0.0 to 1.0
  matchReason: string;
}

export interface EnrichedRecommendation extends SupplementRecommendation {
  product: ProductMatch | null;
  matchStatus: 'matched' | 'no_match' | 'out_of_stock';
  alternatives?: ProductMatch[]; // Alternative products if primary is out of stock
}

/**
 * Normalizes supplement name for matching
 * Handles common variations and typos
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ') // Multiple spaces to single space
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except dash
    .replace(/vitamin\s+d\s*3?/i, 'vitamin d3') // Standardize Vitamin D
    .replace(/omega\s*-?\s*3/i, 'omega-3') // Standardize Omega-3
    .replace(/coq\s*10/i, 'coq10'); // Standardize CoQ10
}

/**
 * Extracts dosage information from recommendation
 */
function parseDosage(dosageString: string): {
  amount: number | null;
  unit: string | null;
} {
  // Match patterns like "5000 IU", "1000mg", "5g"
  const match = dosageString.match(/(\d+(?:\.\d+)?)\s*(iu|mg|g|mcg|µg)/i);

  if (match) {
    return {
      amount: parseFloat(match[1]),
      unit: match[2].toLowerCase(),
    };
  }

  return { amount: null, unit: null };
}

/**
 * Calculates per-day cost based on dosage and product quantity
 */
function calculatePerDayPrice(
  retailPrice: number,
  productQuantity: number,
  recommendedDailyDosage: string
): number {
  // Extract servings per day from dosage string
  // e.g., "5g daily" = 1 serving/day
  // e.g., "1000mg twice daily" = 2 servings/day

  let servingsPerDay = 1;

  if (/twice|two times/i.test(recommendedDailyDosage)) {
    servingsPerDay = 2;
  } else if (/three times|thrice/i.test(recommendedDailyDosage)) {
    servingsPerDay = 3;
  } else if (/four times/i.test(recommendedDailyDosage)) {
    servingsPerDay = 4;
  }

  const pricePerServing = retailPrice / productQuantity;
  return Math.round(pricePerServing * servingsPerDay * 100) / 100; // Round to 2 decimals
}

/**
 * Finds product match for a single supplement recommendation
 */
export async function matchSupplementToProduct(
  recommendation: SupplementRecommendation
): Promise<EnrichedRecommendation> {
  try {
    const supplementName = recommendation.name || recommendation.supplement || '';
    const normalizedName = normalizeName(supplementName);

    console.log(`[Supplement Matching] Looking for: "${supplementName}" (normalized: "${normalizedName}")`);

    // Step 1: Try exact match on recommendation_name
    let { data: mappings, error: mappingError } = await supabase
      .from('supplement_name_mappings')
      .select(`
        *,
        supplement_products (*)
      `)
      .eq('recommendation_name', supplementName)
      .eq('is_primary_match', true)
      .limit(1);

    // Step 2: If no exact match, try case-insensitive match
    if (!mappings || mappings.length === 0) {
      ({ data: mappings, error: mappingError } = await supabase
        .from('supplement_name_mappings')
        .select(`
          *,
          supplement_products (*)
        `)
        .ilike('recommendation_name', supplementName)
        .eq('is_primary_match', true)
        .limit(1));
    }

    // Step 3: If still no match, check variations array
    if (!mappings || mappings.length === 0) {
      ({ data: mappings, error: mappingError } = await supabase
        .from('supplement_name_mappings')
        .select(`
          *,
          supplement_products (*)
        `)
        .contains('recommendation_name_variations', [supplementName])
        .eq('is_primary_match', true)
        .limit(1));
    }

    // Step 4: If still no match, try fuzzy search on product names
    if (!mappings || mappings.length === 0) {
      const { data: products, error: productError } = await supabase
        .from('supplement_products')
        .select('*')
        .ilike('name', `%${normalizedName}%`)
        .eq('is_active', true)
        .limit(1);

      if (products && products.length > 0) {
        console.log(`[Supplement Matching] Fuzzy match found for "${supplementName}"`);
        // Create a synthetic mapping
        mappings = [{
          match_score: 0.7,
          supplement_products: products[0]
        }];
      }
    }

    if (mappingError) {
      console.error('[Supplement Matching] Database error:', mappingError);
    }

    if (!mappings || mappings.length === 0) {
      console.log(`[Supplement Matching] No match found for: "${supplementName}" - Creating new product automatically`);

      // Automatically create product for unmatched supplement
      const newProduct = await createSupplementProduct(supplementName, recommendation.dosage);

      if (!newProduct) {
        console.error(`[Supplement Matching] Failed to create product for: "${supplementName}"`);
        return {
          ...recommendation,
          product: null,
          matchStatus: 'no_match',
        };
      }

      // Return the newly created product
      const perDayPrice = calculatePerDayPrice(
        newProduct.retail_price,
        newProduct.quantity,
        recommendation.dosage
      );

      const productMatch: ProductMatch = {
        productId: newProduct.id,
        sku: newProduct.sku,
        name: newProduct.name,
        brand: newProduct.brand,
        dosageForm: newProduct.dosage_form,
        strength: newProduct.strength,
        quantity: newProduct.quantity,
        unit: newProduct.unit,

        wholesaleCost: parseFloat(newProduct.wholesale_cost),
        retailPrice: parseFloat(newProduct.retail_price),
        margin: parseFloat(newProduct.margin),
        marginPercent: parseFloat(newProduct.margin_percent),
        perDayPrice,

        stockLevel: newProduct.stock_level,
        inStock: true,
        lowStockAlert: false,

        description: newProduct.description || '',
        benefits: newProduct.benefits || [],
        directions: newProduct.directions || '',
        warnings: newProduct.warnings || '',
        imageUrl: newProduct.image_url || '/images/supplements/default.png',

        thirdPartyTested: newProduct.third_party_tested,
        certifications: newProduct.certifications || [],

        matchScore: 1.0,
        matchReason: 'Auto-created product',
      };

      console.log(`[Supplement Matching] ✅ Created "${supplementName}" - SKU: ${newProduct.sku} - $${newProduct.retail_price}`);

      return {
        ...recommendation,
        product: productMatch,
        matchStatus: 'matched',
      };
    }

    const mapping = mappings[0];
    const product = mapping.supplement_products;

    // Check stock availability
    if (!product.is_active || product.stock_level === 0) {
      console.warn(`[Supplement Matching] Product out of stock: ${product.name}`);

      return {
        ...recommendation,
        product: null,
        matchStatus: 'out_of_stock',
      };
    }

    // Calculate per-day price
    const perDayPrice = calculatePerDayPrice(
      product.retail_price,
      product.quantity,
      recommendation.dosage
    );

    const productMatch: ProductMatch = {
      productId: product.id,
      sku: product.sku,
      name: product.name,
      brand: product.brand,
      dosageForm: product.dosage_form,
      strength: product.strength,
      quantity: product.quantity,
      unit: product.unit,

      wholesaleCost: parseFloat(product.wholesale_cost),
      retailPrice: parseFloat(product.retail_price),
      margin: parseFloat(product.margin),
      marginPercent: parseFloat(product.margin_percent),
      perDayPrice,

      stockLevel: product.stock_level,
      inStock: product.stock_level > 0,
      lowStockAlert: product.low_stock_alert,

      description: product.description || '',
      benefits: product.benefits || [],
      directions: product.directions || '',
      warnings: product.warnings || '',
      imageUrl: product.image_url || '/images/supplements/default.png',

      thirdPartyTested: product.third_party_tested,
      certifications: product.certifications || [],

      matchScore: mapping.match_score || 1.0,
      matchReason: 'Primary product match',
    };

    console.log(`[Supplement Matching] ✅ Matched "${supplementName}" to ${product.brand} ${product.name} - $${product.retail_price}`);

    return {
      ...recommendation,
      product: productMatch,
      matchStatus: 'matched',
    };
  } catch (error) {
    console.error('[Supplement Matching] Error:', error);

    return {
      ...recommendation,
      product: null,
      matchStatus: 'no_match',
    };
  }
}

/**
 * Matches multiple supplement recommendations to products
 */
export async function matchSupplementsToProducts(
  recommendations: SupplementRecommendation[]
): Promise<EnrichedRecommendation[]> {
  console.log(`[Supplement Matching] Processing ${recommendations.length} recommendations...`);

  const enrichedRecommendations = await Promise.all(
    recommendations.map((rec) => matchSupplementToProduct(rec))
  );

  const matchedCount = enrichedRecommendations.filter((r) => r.matchStatus === 'matched').length;
  const unmatchedCount = enrichedRecommendations.filter((r) => r.matchStatus === 'no_match').length;
  const outOfStockCount = enrichedRecommendations.filter((r) => r.matchStatus === 'out_of_stock').length;

  console.log(`[Supplement Matching] Results: ${matchedCount} matched, ${unmatchedCount} unmatched, ${outOfStockCount} out of stock`);

  return enrichedRecommendations;
}

/**
 * Logs unmatched supplements for manual review and catalog expansion
 */
async function logUnmatchedSupplement(
  supplementName: string,
  dosage: string
): Promise<void> {
  try {
    // Check if already logged
    const { data: existing } = await supabase
      .from('unmatched_supplements_log')
      .select('id, occurrence_count')
      .eq('supplement_name', supplementName)
      .single();

    if (existing) {
      // Increment occurrence count
      await supabase
        .from('unmatched_supplements_log')
        .update({
          occurrence_count: existing.occurrence_count + 1,
          last_seen_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      // Create new log entry
      await supabase.from('unmatched_supplements_log').insert({
        supplement_name: supplementName,
        dosage_example: dosage,
        occurrence_count: 1,
        first_seen_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      });
    }

    console.log(`[Supplement Matching] Logged unmatched supplement: "${supplementName}"`);
  } catch (error) {
    // Silent fail - logging is non-critical
    console.error('[Supplement Matching] Failed to log unmatched supplement:', error);
  }
}

/**
 * Gets available products for a supplement type (for showing alternatives)
 */
export async function getAlternativeProducts(
  supplementName: string,
  limit: number = 3
): Promise<ProductMatch[]> {
  try {
    const normalizedName = normalizeName(supplementName);

    const { data: products, error } = await supabase
      .from('supplement_products')
      .select('*')
      .ilike('name', `%${normalizedName}%`)
      .eq('is_active', true)
      .gt('stock_level', 0)
      .order('retail_price', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('[Supplement Matching] Error fetching alternatives:', error);
      return [];
    }

    return (products || []).map((product) => ({
      productId: product.id,
      sku: product.sku,
      name: product.name,
      brand: product.brand,
      dosageForm: product.dosage_form,
      strength: product.strength,
      quantity: product.quantity,
      unit: product.unit,

      wholesaleCost: parseFloat(product.wholesale_cost),
      retailPrice: parseFloat(product.retail_price),
      margin: parseFloat(product.margin),
      marginPercent: parseFloat(product.margin_percent),
      perDayPrice: 0, // Would need dosage context to calculate

      stockLevel: product.stock_level,
      inStock: product.stock_level > 0,
      lowStockAlert: product.low_stock_alert,

      description: product.description || '',
      benefits: product.benefits || [],
      directions: product.directions || '',
      warnings: product.warnings || '',
      imageUrl: product.image_url || '/images/supplements/default.png',

      thirdPartyTested: product.third_party_tested,
      certifications: product.certifications || [],

      matchScore: 0.8,
      matchReason: 'Alternative product',
    }));
  } catch (error) {
    console.error('[Supplement Matching] Error:', error);
    return [];
  }
}

/**
 * Validates that a product exists and is available for purchase
 */
export async function validateProductAvailability(productId: string): Promise<{
  available: boolean;
  product?: ProductMatch;
  reason?: string;
}> {
  try {
    const { data: product, error } = await supabase
      .from('supplement_products')
      .select('*')
      .eq('id', productId)
      .single();

    if (error || !product) {
      return {
        available: false,
        reason: 'Product not found',
      };
    }

    if (!product.is_active) {
      return {
        available: false,
        reason: 'Product is no longer available',
      };
    }

    if (product.stock_level === 0) {
      return {
        available: false,
        reason: 'Product is out of stock',
      };
    }

    return {
      available: true,
      product: {
        productId: product.id,
        sku: product.sku,
        name: product.name,
        brand: product.brand,
        dosageForm: product.dosage_form,
        strength: product.strength,
        quantity: product.quantity,
        unit: product.unit,

        wholesaleCost: parseFloat(product.wholesale_cost),
        retailPrice: parseFloat(product.retail_price),
        margin: parseFloat(product.margin),
        marginPercent: parseFloat(product.margin_percent),
        perDayPrice: 0,

        stockLevel: product.stock_level,
        inStock: true,
        lowStockAlert: product.low_stock_alert,

        description: product.description || '',
        benefits: product.benefits || [],
        directions: product.directions || '',
        warnings: product.warnings || '',
        imageUrl: product.image_url || '/images/supplements/default.png',

        thirdPartyTested: product.third_party_tested,
        certifications: product.certifications || [],

        matchScore: 1.0,
        matchReason: 'Direct product validation',
      },
    };
  } catch (error) {
    console.error('[Supplement Matching] Validation error:', error);
    return {
      available: false,
      reason: 'Validation failed',
    };
  }
}

/**
 * Automatically creates a supplement product when no match is found
 */
async function createSupplementProduct(
  supplementName: string,
  dosage: string
): Promise<any | null> {
  try {
    // Parse dosage to extract strength
    const dosageMatch = dosage.match(/(\d+(?:\.\d+)?)\s*(mg|g|mcg|µg|iu)/i);
    const strength = dosageMatch ? `${dosageMatch[1]}${dosageMatch[2]}` : '1000mg';

    // Generate SKU
    const sku = `AUTO-${supplementName.toUpperCase().replace(/[^A-Z0-9]/g, '-')}-${Date.now()}`;

    // Determine product type and set defaults
    const isProtein = /protein|whey|casein/i.test(supplementName);
    const isPowder = isProtein || /powder|creatine/i.test(supplementName);

    const quantity = isPowder ? 1000 : 120; // grams for powder, capsules otherwise
    const unit = isPowder ? 'grams' : 'capsules';
    const dosageForm = isPowder ? 'Powder' : 'Capsule';

    // Pricing: $30 margin
    const wholesaleCost = isProtein ? 35.00 : 15.00; // Higher wholesale for protein
    const retailPrice = wholesaleCost + 30.00; // Always $30 margin

    // Fetch product image automatically
    console.log(`[Supplement Matching] Fetching image for: ${supplementName}`);
    const imageUrl = await fetchProductImage('Premium Select', supplementName);
    console.log(`[Supplement Matching] Image URL: ${imageUrl}`);

    // Create product
    const { data: product, error } = await supabase
      .from('supplement_products')
      .insert({
        sku,
        name: supplementName,
        brand: 'Premium Select',
        dosage_form: dosageForm,
        strength,
        quantity,
        unit,
        wholesale_cost: wholesaleCost,
        retail_price: retailPrice,
        description: `High-quality ${supplementName} supplement`,
        image_url: imageUrl, // Add fetched image
        stock_level: 1000, // Start with good stock
        reorder_point: 100,
        is_active: true,
        third_party_tested: true,
        certifications: ['GMP Certified'],
      })
      .select()
      .single();

    if (error) {
      console.error('[Supplement Matching] Error creating product:', error);
      return null;
    }

    // Create name mapping for future lookups
    await supabase.from('supplement_name_mappings').insert({
      recommendation_name: supplementName,
      recommendation_name_variations: [],
      product_id: product.id,
      is_primary_match: true,
      match_score: 1.0,
      dosage_unit: dosageMatch ? dosageMatch[2].toLowerCase() : 'mg',
    });

    console.log(`[Supplement Matching] Created product and mapping for: ${supplementName}`);

    return product;
  } catch (error) {
    console.error('[Supplement Matching] Error in createSupplementProduct:', error);
    return null;
  }
}
