/**
 * AI-Powered Product Image Fetcher
 *
 * Uses Claude AI for intelligent web scraping and image verification.
 * Priority: Stock Images → AI Web Scraping → Verified Fallback
 */

import { createClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';
import { verifyProductImage, isLikelyValidImageUrl, type ProductInfo } from './ai-image-verifier';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface ImageSource {
  url: string;
  source: 'stock' | 'ai-scrape' | 'verified-retailer' | 'fallback';
  confidence: number; // 0-100
  verificationNotes?: string;
}

/**
 * Use Claude to intelligently find product images from verified supplement retailers
 */
async function aiWebScrapeProductImage(
  brand: string,
  name: string,
  dosageForm?: string
): Promise<ImageSource | null> {
  try {
    const prompt = buildWebScrapingPrompt(brand, name, dosageForm);

    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const textContent = response.content.find(block => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return null;
    }

    const result = parseAIScrapingResponse(textContent.text);
    return result;

  } catch (error) {
    console.error('[AI Image Fetcher] Web scraping failed:', error);
    return null;
  }
}

/**
 * Build prompt for Claude to find product images
 */
function buildWebScrapingPrompt(brand: string, name: string, dosageForm?: string): string {
  return `You are an expert at finding accurate supplement product images from verified retailers.

**Product to Find:**
- Brand: ${brand}
- Product Name: ${name}
${dosageForm ? `- Form: ${dosageForm}` : ''}

**Your Task:**
Search verified supplement retailers for this EXACT product. Focus on these trusted sources:
1. **Amazon.com** - Search: "amazon.com ${brand} ${name} supplement"
2. **iHerb.com** - Premium supplement retailer with verified products
3. **Vitacost.com** - Trusted supplement source
4. **Swanson.com** - Established supplement brand
5. **Thrive Market** - Natural products retailer

**Requirements:**
- Find the EXACT product (matching brand AND product name)
- Return a direct image URL from the product page
- Prefer product bottle/package images (not lifestyle photos)
- Verify the image shows the correct brand label
- Image must be high-quality and suitable for e-commerce

**Response Format (JSON only):**
\`\`\`json
{
  "found": true/false,
  "imageUrl": "direct URL to product image",
  "source": "retailer name (e.g., 'Amazon', 'iHerb')",
  "confidence": 0-100,
  "productUrl": "full product page URL for verification",
  "notes": "brief explanation of match quality"
}
\`\`\`

If you cannot find the EXACT product, return:
\`\`\`json
{
  "found": false,
  "confidence": 0,
  "notes": "Could not find exact match for ${brand} ${name}"
}
\`\`\`

**Important:**
- Only return URLs you are CONFIDENT point to the correct product
- Do not return generic supplement images
- Do not return images from untrusted sources
- Confidence should be >70 for acceptable matches`;
}

/**
 * Parse AI web scraping response
 */
function parseAIScrapingResponse(responseText: string): ImageSource | null {
  try {
    // Extract JSON from response
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) ||
                     responseText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return null;
    }

    const jsonText = jsonMatch[1] || jsonMatch[0];
    const parsed = JSON.parse(jsonText);

    if (!parsed.found || !parsed.imageUrl || parsed.confidence < 70) {
      console.log('[AI Image Fetcher] No confident match found:', parsed.notes);
      return null;
    }

    return {
      url: parsed.imageUrl,
      source: 'ai-scrape',
      confidence: Math.min(100, Math.max(0, parsed.confidence)),
      verificationNotes: parsed.notes,
    };

  } catch (error) {
    console.error('[AI Image Fetcher] Failed to parse AI response:', error);
    return null;
  }
}

/**
 * High-quality stock supplement images (instant, no API calls)
 */
function getStockSupplementImage(supplementName: string): ImageSource | null {
  const supplementImages: Record<string, string> = {
    'omega-3': 'https://images.unsplash.com/photo-1526336024174-e58f5cdd8e13?w=800&q=80',
    'fish oil': 'https://images.unsplash.com/photo-1526336024174-e58f5cdd8e13?w=800&q=80',
    'vitamin d': 'https://images.unsplash.com/photo-1550572017-4fd2452d3b6b?w=800&q=80',
    'vitamin d3': 'https://images.unsplash.com/photo-1550572017-4fd2452d3b6b?w=800&q=80',
    'vitamin c': 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=800&q=80',
    'magnesium': 'https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?w=800&q=80',
    'zinc': 'https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?w=800&q=80',
    'vitamin b': 'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=800&q=80',
    'b12': 'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=800&q=80',
    'probiotics': 'https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?w=800&q=80',
    'protein': 'https://images.unsplash.com/photo-1579722820308-d74e571900a9?w=800&q=80',
    'creatine': 'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=800&q=80',
    'collagen': 'https://images.unsplash.com/photo-1526336024174-e58f5cdd8e13?w=800&q=80',
    'turmeric': 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=800&q=80',
    'ashwagandha': 'https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?w=800&q=80',
    'multivitamin': 'https://images.unsplash.com/photo-1550572017-4fd2452d3b6b?w=800&q=80',
    'iron': 'https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?w=800&q=80',
    'calcium': 'https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?w=800&q=80',
    'coq10': 'https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?w=800&q=80',
    'curcumin': 'https://images.unsplash.com/photo-1615485290382-441e4d049cb5?w=800&q=80',
  };

  const normalized = supplementName.toLowerCase();

  for (const [key, imageUrl] of Object.entries(supplementImages)) {
    if (normalized.includes(key)) {
      return {
        url: imageUrl,
        source: 'stock',
        confidence: 85, // Good quality stock images
        verificationNotes: 'High-quality stock image',
      };
    }
  }

  return null;
}

/**
 * Main function: Fetch and verify product image
 */
export async function fetchProductImage(
  brand: string,
  name: string,
  existingUrl?: string,
  dosageForm?: string
): Promise<string> {
  // Skip if we already have a valid, verified image
  if (isLikelyValidImageUrl(existingUrl)) {
    return existingUrl!;
  }

  const query = `${brand} ${name}`;
  console.log(`[AI Image Fetcher] Searching for: ${query}`);

  // Priority 1: Check stock images (instant, free) - but still verify with AI
  const stockImage = getStockSupplementImage(name);
  if (stockImage) {
    console.log(`[AI Image Fetcher] Found stock image candidate, verifying with Claude...`);

    // Verify stock image with Claude Vision
    const verification = await verifyProductImage(stockImage.url, {
      name,
      brand,
      dosageForm,
    });

    if (verification.isMatch && verification.confidence >= 70) {
      console.log(`[AI Image Fetcher] ✅ Verified stock image (${verification.confidence}% confidence)`);
      return stockImage.url;
    } else {
      console.log(`[AI Image Fetcher] ❌ Stock image failed verification: ${verification.reasoning}`);
      // Continue to AI web scraping
    }
  }

  // Priority 2: AI web scraping (intelligent, verified sources)
  const aiImage = await aiWebScrapeProductImage(brand, name, dosageForm);
  if (aiImage && aiImage.confidence >= 70) {
    // Verify the AI-found image with Claude Vision
    console.log(`[AI Image Fetcher] Verifying AI-scraped image...`);
    const verification = await verifyProductImage(aiImage.url, {
      name,
      brand,
      dosageForm,
    });

    if (verification.isMatch && verification.confidence >= 70) {
      console.log(`[AI Image Fetcher] ✅ Verified AI image (${verification.confidence}% confidence)`);
      return aiImage.url;
    } else {
      console.log(`[AI Image Fetcher] ❌ AI image failed verification: ${verification.reasoning}`);
    }
  }

  // Priority 3: Use generic supplement fallback (don't use unverified stock images)
  console.log(`[AI Image Fetcher] All sources failed, using generic supplement image for ${query}`);
  return '/images/supplements/default.svg';
}

/**
 * Batch update products with missing images
 */
export async function updateAllProductImages(options: {
  verifyExisting?: boolean; // Re-verify existing images
  minConfidence?: number;   // Minimum confidence to accept (default 70)
} = {}) {
  const supabase = await createClient();
  const { verifyExisting = false, minConfidence = 70 } = options;

  // Build query based on options
  let query = supabase
    .from('supplement_products')
    .select('id, brand, name, image_url, dosage_form, image_fetch_status, image_confidence_score');

  if (verifyExisting) {
    // Update all products
    query = query.or(
      'image_url.is.null,' +
      'image_url.eq.,' +
      `image_confidence_score.lt.${minConfidence},` +
      "image_fetch_status.eq.pending," +
      "image_fetch_status.eq.failed"
    );
  } else {
    // Only update products without images
    query = query.or(
      'image_url.is.null,' +
      'image_url.eq.,' +
      "image_url.eq./images/supplements/default.png"
    );
  }

  const { data: products, error } = await query;

  if (error || !products) {
    console.error('[AI Image Fetcher] Failed to fetch products:', error);
    return { success: false, error };
  }

  console.log(`[AI Image Fetcher] Processing ${products.length} products`);

  let updated = 0;
  let failed = 0;
  let skipped = 0;

  for (const product of products) {
    try {
      // Mark as fetching
      await supabase
        .from('supplement_products')
        .update({
          image_fetch_status: 'fetching',
          last_image_fetch_attempt: new Date().toISOString(),
        })
        .eq('id', product.id);

      // Fetch new image
      const imageUrl = await fetchProductImage(
        product.brand,
        product.name,
        product.image_url || undefined,
        product.dosage_form || undefined
      );

      // Verify the fetched image
      const verification = await verifyProductImage(imageUrl, {
        name: product.name,
        brand: product.brand,
        dosageForm: product.dosage_form || undefined,
      });

      const status = verification.confidence >= 70 ? 'verified' :
                    verification.confidence >= 50 ? 'success' : 'failed';

      // Update product with new image and verification data
      const { error: updateError } = await supabase
        .from('supplement_products')
        .update({
          image_url: imageUrl,
          image_fetch_status: status,
          image_confidence_score: verification.confidence,
          image_verification_notes: verification.reasoning,
        })
        .eq('id', product.id);

      if (updateError) {
        console.error(`[AI Image Fetcher] Failed to update ${product.name}:`, updateError);
        failed++;
      } else {
        if (status === 'verified') {
          updated++;
          console.log(`[AI Image Fetcher] ✅ ${product.brand} ${product.name} (${verification.confidence}%)`);
        } else {
          skipped++;
          console.log(`[AI Image Fetcher] ⚠️ ${product.brand} ${product.name} - low confidence (${verification.confidence}%)`);
        }
      }

      // Rate limiting - 500ms between requests to avoid API throttling
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.error(`[AI Image Fetcher] Error processing ${product.name}:`, error);

      // Mark as failed
      await supabase
        .from('supplement_products')
        .update({
          image_fetch_status: 'failed',
          image_verification_notes: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('id', product.id);

      failed++;
    }
  }

  console.log(`[AI Image Fetcher] Complete: ${updated} verified, ${skipped} low confidence, ${failed} failed`);

  return {
    success: true,
    verified: updated,
    lowConfidence: skipped,
    failed,
    total: products.length,
  };
}

/**
 * Fetch image for a single product (used by on-demand endpoint)
 */
export async function fetchSingleProductImage(productId: string): Promise<{
  success: boolean;
  imageUrl?: string;
  confidence?: number;
  status?: string;
  error?: string;
}> {
  try {
    const supabase = await createClient();

    // Get product details
    const { data: product, error } = await supabase
      .from('supplement_products')
      .select('id, brand, name, image_url, dosage_form, image_fetch_status')
      .eq('id', productId)
      .single();

    if (error || !product) {
      return { success: false, error: 'Product not found' };
    }

    // Check if already has valid image
    if (isLikelyValidImageUrl(product.image_url)) {
      return {
        success: true,
        imageUrl: product.image_url,
        status: 'existing',
      };
    }

    // Fetch new image
    const imageUrl = await fetchProductImage(
      product.brand,
      product.name,
      product.image_url || undefined,
      product.dosage_form || undefined
    );

    // Verify
    const verification = await verifyProductImage(imageUrl, {
      name: product.name,
      brand: product.brand,
      dosageForm: product.dosage_form || undefined,
    });

    const status = verification.confidence >= 70 ? 'verified' :
                  verification.confidence >= 50 ? 'success' : 'failed';

    // Update database
    await supabase
      .from('supplement_products')
      .update({
        image_url: imageUrl,
        image_fetch_status: status,
        image_confidence_score: verification.confidence,
        image_verification_notes: verification.reasoning,
        last_image_fetch_attempt: new Date().toISOString(),
      })
      .eq('id', productId);

    return {
      success: true,
      imageUrl,
      confidence: verification.confidence,
      status: 'fetched',
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
