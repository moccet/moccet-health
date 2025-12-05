/**
 * Update Product Images API
 * POST /api/admin/update-product-images
 *
 * Fetches and updates images for all products without images
 */

import { NextRequest, NextResponse } from 'next/server';
import { updateAllProductImages } from '@/lib/services/product-image-fetcher';

export async function POST(request: NextRequest) {
  try {
    console.log('[Admin] Starting product image update...');

    const result = await updateAllProductImages();

    return NextResponse.json({
      success: true,
      message: `Updated ${result.updated} products, ${result.failed} failed`,
      ...result,
    });
  } catch (error) {
    console.error('[Admin] Error updating product images:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update images',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Use POST to update product images',
    usage: 'POST /api/admin/update-product-images',
  });
}
