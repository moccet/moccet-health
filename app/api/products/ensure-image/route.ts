/**
 * Ensure Product Image API (AI-Powered)
 * POST /api/products/ensure-image
 *
 * Uses Claude AI to fetch and verify product images on-demand.
 * Used when displaying products in cart/checkout to guarantee accurate images exist.
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchSingleProductImage } from '@/lib/services/product-image-fetcher';

export async function POST(request: NextRequest) {
  try {
    const { productId } = await request.json();

    if (!productId) {
      return NextResponse.json(
        { success: false, error: 'Product ID required' },
        { status: 400 }
      );
    }

    console.log(`[Ensure Image] Processing product: ${productId}`);

    // Use AI-powered fetch with automatic verification
    const result = await fetchSingleProductImage(productId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to fetch image' },
        { status: result.error === 'Product not found' ? 404 : 500 }
      );
    }

    const statusMessage =
      result.status === 'existing'
        ? 'Using existing image'
        : `Fetched new image (${result.confidence}% confidence)`;

    console.log(`[Ensure Image] ✅ ${statusMessage}`);

    return NextResponse.json({
      success: true,
      imageUrl: result.imageUrl,
      status: result.status,
      confidence: result.confidence,
    });
  } catch (error) {
    console.error('[Ensure Image] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to ensure image',
      },
      { status: 500 }
    );
  }
}
