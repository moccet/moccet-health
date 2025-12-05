/**
 * Create Plan Payment Intent API
 * POST /api/checkout/create-plan-payment-intent
 *
 * Creates a Stripe payment intent for plan generation ($18)
 * Supports referral codes that can be used up to 100 times
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateReferralCode } from '@/lib/referral-codes';

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
    let referralCodeValid = false;

    // Validate referral code if provided
    if (promoCode) {
      const validation = validateReferralCode(promoCode);

      if (validation.valid) {
        // Valid referral code - make it free
        referralCodeValid = true;
        discount = PLAN_PRICE;
        finalAmount = 0;
        console.log(`[Plan Payment API] Valid referral code applied: ${promoCode} (100% discount)`);
      } else {
        console.log(`[Plan Payment API] Invalid referral code: ${promoCode} - ${validation.message}`);
        return NextResponse.json(
          { success: false, error: validation.message || 'Invalid referral code' },
          { status: 400 }
        );
      }
    }

    console.log(`[Plan Payment API] ✅ Payment intent created (amount: $${finalAmount})`);

    return NextResponse.json({
      success: true,
      amount: finalAmount,
      originalPrice: PLAN_PRICE,
      discount: discount,
      referralCodeApplied: referralCodeValid,
      referralCode: promoCode || '',
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
