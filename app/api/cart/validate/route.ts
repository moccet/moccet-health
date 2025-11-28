/**
 * Validate Cart API
 * GET /api/cart/validate - Validates cart before checkout
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateCart } from '@/lib/services/cart';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    console.log(`[Cart API] Validating cart for ${email}`);

    const { valid, issues, cart } = await validateCart(email);

    return NextResponse.json({
      success: true,
      valid,
      issues,
      cart,
    });
  } catch (error) {
    console.error('[Cart API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to validate cart',
      },
      { status: 500 }
    );
  }
}
