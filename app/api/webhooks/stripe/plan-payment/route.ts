/**
 * Stripe Webhook Handler for Plan Payments
 * POST /api/webhooks/stripe/plan-payment
 *
 * Handles successful plan generation payments and triggers plan generation
 */

import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import Stripe from 'stripe';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      console.error('[Plan Payment Webhook] Missing Stripe signature');
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 400 }
      );
    }

    const webhookSecret = process.env.STRIPE_PLAN_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('[Plan Payment Webhook] Webhook secret not configured');
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('[Plan Payment Webhook] Signature verification failed:', err);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    console.log(`[Plan Payment Webhook] Received event: ${event.type}`);

    // Handle payment intent succeeded event
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const metadata = paymentIntent.metadata;

      console.log(`[Plan Payment Webhook] Payment succeeded for ${metadata.user_email}`);

      // Extract metadata
      const email = metadata.user_email;
      const planType = metadata.plan_type; // 'Sage' or 'Forge'
      const fullName = metadata.user_name;

      // Get unique code from the onboarding data
      const onboardingApiUrl = planType === 'Sage'
        ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/sage-onboarding?email=${encodeURIComponent(email)}`
        : `${process.env.NEXT_PUBLIC_BASE_URL}/api/forge-onboarding?email=${encodeURIComponent(email)}`;

      let uniqueCode = '';
      try {
        const response = await fetch(onboardingApiUrl);
        const data = await response.json();
        uniqueCode = data.data?.form_data?.uniqueCode || '';
      } catch (error) {
        console.error('[Plan Payment Webhook] Failed to get unique code:', error);
      }

      // Trigger plan generation
      const planGenApiUrl = planType === 'Sage'
        ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/generate-plan-async`
        : `${process.env.NEXT_PUBLIC_BASE_URL}/api/forge-generate-plan-async`;

      try {
        const planResponse = await fetch(planGenApiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            uniqueCode,
            fullName: fullName || email.split('@')[0],
          }),
        });

        if (planResponse.ok) {
          console.log(`[Plan Payment Webhook] ✅ ${planType} plan generation queued for ${email}`);
        } else {
          console.error(`[Plan Payment Webhook] Failed to queue plan generation:`, await planResponse.text());
        }
      } catch (error) {
        console.error('[Plan Payment Webhook] Error triggering plan generation:', error);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Plan Payment Webhook] Error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}
