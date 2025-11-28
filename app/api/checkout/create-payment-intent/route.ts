/**
 * Create Payment Intent API
 * POST /api/checkout/create-payment-intent
 *
 * Creates a Stripe payment intent for the checkout process
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateCart } from '@/lib/services/cart';
import { createPaymentIntent, calculateOrderTotal } from '@/lib/stripe';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, planCode } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    console.log(`[Checkout API] Creating payment intent for ${email}`);

    // Validate cart
    const { valid, issues, cart } = await validateCart(email);

    if (!valid || !cart) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cart validation failed',
          issues,
        },
        { status: 400 }
      );
    }

    // Calculate order totals
    const { subtotal, shipping, tax, total } = calculateOrderTotal(cart.subtotal);

    console.log(`[Checkout API] Order total: $${total}`);

    // Create payment intent
    const paymentIntent = await createPaymentIntent(total, email, {
      cart_id: cart.id,
      plan_code: planCode || cart.planCode || '',
      item_count: cart.itemCount.toString(),
    });

    console.log(`[Checkout API] ✅ Payment intent created: ${paymentIntent.id}`);

    return NextResponse.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      orderSummary: {
        subtotal,
        shipping,
        tax,
        total,
        itemCount: cart.itemCount,
        items: cart.items.map((item) => ({
          name: `${item.brand} ${item.name}`,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
        })),
      },
    });
  } catch (error) {
    console.error('[Checkout API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create payment intent',
      },
      { status: 500 }
    );
  }
}
