/**
 * Update Cart Item API
 * PUT /api/cart/update
 */

import { NextRequest, NextResponse } from 'next/server';
import { updateCartItemQuantity } from '@/lib/services/cart';

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, cartItemId, quantity } = body;

    if (!email || !cartItemId || quantity === undefined) {
      return NextResponse.json(
        { success: false, error: 'Email, cartItemId, and quantity are required' },
        { status: 400 }
      );
    }

    console.log(`[Cart API] Updating cart item ${cartItemId} quantity to ${quantity}`);

    const { cart, error } = await updateCartItemQuantity(
      email,
      cartItemId,
      quantity
    );

    if (error) {
      return NextResponse.json(
        { success: false, error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Cart updated',
      cart,
    });
  } catch (error) {
    console.error('[Cart API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update cart',
      },
      { status: 500 }
    );
  }
}
