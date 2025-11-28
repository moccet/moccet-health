/**
 * Remove from Cart API
 * DELETE /api/cart/remove
 */

import { NextRequest, NextResponse } from 'next/server';
import { removeFromCart } from '@/lib/services/cart';

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const cartItemId = searchParams.get('cartItemId');

    if (!email || !cartItemId) {
      return NextResponse.json(
        { success: false, error: 'Email and cartItemId are required' },
        { status: 400 }
      );
    }

    console.log(`[Cart API] Removing cart item ${cartItemId}`);

    const { cart, error } = await removeFromCart(email, cartItemId);

    if (error) {
      return NextResponse.json(
        { success: false, error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Item removed from cart',
      cart,
    });
  } catch (error) {
    console.error('[Cart API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to remove from cart',
      },
      { status: 500 }
    );
  }
}
