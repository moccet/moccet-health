/**
 * Add to Cart API
 * POST /api/cart/add
 */

import { NextRequest, NextResponse } from 'next/server';
import { addToCart } from '@/lib/services/cart';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, productId, quantity, planCode, recommendationContext } = body;

    if (!email || !productId) {
      return NextResponse.json(
        { success: false, error: 'Email and productId are required' },
        { status: 400 }
      );
    }

    console.log(`[Cart API] Adding product ${productId} to cart for ${email}`);

    const { cart, error } = await addToCart(
      email,
      productId,
      quantity || 1,
      planCode,
      recommendationContext
    );

    if (error) {
      return NextResponse.json(
        { success: false, error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Added to cart',
      cart,
    });
  } catch (error) {
    console.error('[Cart API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add to cart',
      },
      { status: 500 }
    );
  }
}
