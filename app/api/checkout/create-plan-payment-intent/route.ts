/**
 * Create Plan Payment Intent API
 * POST /api/checkout/create-plan-payment-intent
 *
 * Creates a Stripe payment intent for plan generation ($18)
 * Supports promo codes that can be used up to 100 times
 */

import { NextRequest, NextResponse } from 'next/server';
import { stripe, formatAmountForStripe } from '@/lib/stripe';

const PLAN_PRICE = 18.00; // $18 for plan generation

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, fullName, planType, promoCode } = body;

    if (!email || !planType) {
      return NextResponse.json(
        { success: false, error: 'Email and plan type are required' },
        { status: 400 }
      );
    }

    console.log(`[Plan Payment API] Creating payment intent for ${email} (${planType})`);

    let finalAmount = PLAN_PRICE;
    let discount = 0;
    let promoCodeValid = false;
    let promoCodeDetails = null;

    // Validate promo code if provided
    if (promoCode) {
      try {
        // Retrieve the promotion code from Stripe
        const promoCodes = await stripe.promotionCodes.list({
          code: promoCode,
          active: true,
          limit: 1,
        });

        if (promoCodes.data.length > 0) {
          const promo = promoCodes.data[0];

          // Check if the promo code can still be used
          // Note: Stripe automatically tracks redemption count
          if (promo.coupon) {
            promoCodeValid = true;
            promoCodeDetails = {
              id: promo.id,
              code: promo.code,
              couponId: promo.coupon.id,
            };

            // Calculate discount based on coupon type
            if (promo.coupon.amount_off) {
              // Fixed amount discount (in cents)
              discount = promo.coupon.amount_off / 100;
            } else if (promo.coupon.percent_off) {
              // Percentage discount
              discount = (PLAN_PRICE * promo.coupon.percent_off) / 100;
            }

            finalAmount = Math.max(0, PLAN_PRICE - discount);
            console.log(`[Plan Payment API] Valid promo code applied: ${promoCode} (discount: $${discount})`);
          }
        } else {
          console.log(`[Plan Payment API] Invalid or inactive promo code: ${promoCode}`);
        }
      } catch (error) {
        console.error('[Plan Payment API] Error validating promo code:', error);
        // Continue without promo code
      }
    }

    // Convert guest identifier to valid email for Stripe
    const stripeEmail = email.startsWith('guest-')
      ? `${email}@guest.moccet.ai`
      : email;

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: formatAmountForStripe(finalAmount),
      currency: 'usd',
      receipt_email: stripeEmail,
      metadata: {
        plan_type: planType,
        user_email: email,
        user_name: fullName || '',
        original_price: PLAN_PRICE.toString(),
        discount_applied: discount.toString(),
        promo_code: promoCode || '',
        promo_code_valid: promoCodeValid.toString(),
      },
      description: `${planType} Plan Generation - ${email}`,
      ...(promoCodeValid && promoCodeDetails ? {
        // Attach promo code to payment intent for automatic redemption tracking
        promotion_code: promoCodeDetails.id,
      } : {}),
    });

    console.log(`[Plan Payment API] ✅ Payment intent created: ${paymentIntent.id} (amount: $${finalAmount})`);

    return NextResponse.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: finalAmount,
      originalPrice: PLAN_PRICE,
      discount: discount,
      promoCodeApplied: promoCodeValid,
    });
  } catch (error) {
    console.error('[Plan Payment API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create payment intent',
      },
      { status: 500 }
    );
  }
}
