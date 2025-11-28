/**
 * Clear Cart API
 * DELETE /api/cart/clear
 */

import { NextRequest, NextResponse } from 'next/server';
import { clearCart } from '@/lib/services/cart';

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    console.log(`[Cart API] Clearing cart for ${email}`);

    const { success, error } = await clearCart(email);

    if (!success) {
      return NextResponse.json(
        { success: false, error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Cart cleared',
    });
  } catch (error) {
    console.error('[Cart API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to clear cart',
      },
      { status: 500 }
    );
  }
}
