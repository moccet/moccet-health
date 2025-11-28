/**
 * Shopping Cart API
 * GET /api/cart - Get user's cart
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCart } from '@/lib/services/cart';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get('email');

    if (!userEmail) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    console.log(`[Cart API] GET cart for ${userEmail}`);

    const { cart, error } = await getCart(userEmail);

    if (error) {
      return NextResponse.json(
        { success: false, error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      cart,
    });
  } catch (error) {
    console.error('[Cart API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get cart',
      },
      { status: 500 }
    );
  }
}
