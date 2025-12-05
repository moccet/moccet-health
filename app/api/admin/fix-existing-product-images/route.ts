/**
 * Fix Existing Product Images API (AI-Powered)
 * POST /api/admin/fix-existing-product-images
 *
 * Uses Claude AI to intelligently fetch and verify product images.
 * Supports both full updates and verification of existing images.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { updateAllProductImages } from '@/lib/services/product-image-fetcher';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      verifyExisting = false,  // Re-verify existing images
      minConfidence = 70,      // Minimum confidence score to accept
      dryRun = false,          // Preview changes without applying
    } = body;

    console.log('[AI Image Fixer] Starting with options:', {
      verifyExisting,
      minConfidence,
      dryRun,
    });

    if (dryRun) {
      // Preview mode: just count and show products
      const { data: products, error } = await supabase
        .from('supplement_products')
        .select('id, brand, name, image_url, image_fetch_status, image_confidence_score')
        .or(
          verifyExisting
            ? `image_url.is.null,image_url.eq.,image_confidence_score.lt.${minConfidence},image_fetch_status.eq.pending,image_fetch_status.eq.failed`
            : 'image_url.is.null,image_url.eq.,image_url.eq./images/supplements/default.png'
        );

      if (error) {
        return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        dryRun: true,
        message: `Would process ${products?.length || 0} products`,
        count: products?.length || 0,
        preview: products?.slice(0, 10).map((p) => ({
          product: `${p.brand} ${p.name}`,
          currentImage: p.image_url || 'none',
          status: p.image_fetch_status || 'pending',
          confidence: p.image_confidence_score || 0,
        })),
      });
    }

    // Run actual batch update with AI verification
    const result = await updateAllProductImages({
      verifyExisting,
      minConfidence,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Batch update failed',
        },
        { status: 500 }
      );
    }

    console.log('[AI Image Fixer] Complete!');
    console.log(`  ✅ Verified: ${result.verified}`);
    console.log(`  ⚠️  Low Confidence: ${result.lowConfidence}`);
    console.log(`  ❌ Failed: ${result.failed}`);

    return NextResponse.json({
      success: true,
      message: `AI-verified ${result.verified} images (${result.lowConfidence} low confidence, ${result.failed} failed)`,
      verified: result.verified,
      lowConfidence: result.lowConfidence,
      failed: result.failed,
      total: result.total,
    });
  } catch (error) {
    console.error('[AI Image Fixer] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fix images',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const minConfidence = parseInt(searchParams.get('minConfidence') || '70');

    // Return comprehensive stats
    const { data: allProducts, error: allError } = await supabase
      .from('supplement_products')
      .select('image_fetch_status, image_confidence_score');

    if (allError) {
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }

    const stats = {
      total: allProducts?.length || 0,
      verified: allProducts?.filter((p) => p.image_fetch_status === 'verified').length || 0,
      success: allProducts?.filter((p) => p.image_fetch_status === 'success').length || 0,
      pending: allProducts?.filter((p) => p.image_fetch_status === 'pending').length || 0,
      fetching: allProducts?.filter((p) => p.image_fetch_status === 'fetching').length || 0,
      failed: allProducts?.filter((p) => p.image_fetch_status === 'failed').length || 0,
      lowConfidence: allProducts?.filter(
        (p) => p.image_confidence_score && p.image_confidence_score < minConfidence
      ).length || 0,
    };

    // Get preview of products needing attention
    const { data: needingAttention, error: needingError } = await supabase
      .from('supplement_products')
      .select('id, brand, name, image_url, image_fetch_status, image_confidence_score')
      .or('image_fetch_status.eq.pending,image_fetch_status.eq.failed,image_url.is.null')
      .limit(10);

    return NextResponse.json({
      message: 'Product image statistics',
      stats,
      needingAttention: needingAttention?.map((p) => ({
        product: `${p.brand} ${p.name}`,
        status: p.image_fetch_status || 'pending',
        confidence: p.image_confidence_score || 0,
        hasImage: !!p.image_url,
      })),
      usage: {
        preview: 'POST with { dryRun: true } to preview changes',
        update: 'POST to update products without images',
        verify: 'POST with { verifyExisting: true } to re-verify all images',
        custom: 'POST with { verifyExisting: true, minConfidence: 80 } for high-quality only',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get stats' }, { status: 500 });
  }
}
