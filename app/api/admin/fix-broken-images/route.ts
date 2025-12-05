/**
 * Fix Broken Images API
 * POST /api/admin/fix-broken-images
 *
 * Finds and fixes products with broken/404 image URLs
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchProductImage } from '@/lib/services/product-image-fetcher';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  try {
    // Get all products with images
    const { data: products, error } = await supabase
      .from('supplement_products')
      .select('id, brand, name, image_url, dosage_form')
      .not('image_url', 'is', null);

    if (error || !products) {
      return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
    }

    console.log(`[Fix Broken Images] Checking ${products.length} products...`);

    const results = {
      checked: 0,
      broken: 0,
      fixed: 0,
      failed: 0,
    };

    for (const product of products) {
      results.checked++;

      try {
        // Test if image URL is accessible
        const response = await fetch(product.image_url, { method: 'HEAD' });

        if (!response.ok) {
          console.log(`[Fix Broken Images] Broken: ${product.brand} ${product.name} - ${response.status}`);
          results.broken++;

          // Fetch new image
          const newImageUrl = await fetchProductImage(
            product.brand,
            product.name,
            undefined,
            product.dosage_form
          );

          // Update product
          const { error: updateError } = await supabase
            .from('supplement_products')
            .update({
              image_url: newImageUrl,
              image_fetch_status: 'success',
              image_confidence_score: 85,
              last_image_fetch_attempt: new Date().toISOString(),
            })
            .eq('id', product.id);

          if (updateError) {
            results.failed++;
            console.error(`[Fix Broken Images] Failed to update: ${updateError.message}`);
          } else {
            results.fixed++;
            console.log(`[Fix Broken Images] ✅ Fixed: ${product.brand} ${product.name}`);
          }

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error(`[Fix Broken Images] Error checking ${product.name}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Checked ${results.checked} products, found ${results.broken} broken, fixed ${results.fixed}`,
      results,
    });
  } catch (error) {
    console.error('[Fix Broken Images] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fix images' },
      { status: 500 }
    );
  }
}
