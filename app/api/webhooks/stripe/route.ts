/**
 * Unified Stripe Webhook Handler
 * POST /api/webhooks/stripe
 *
 * Handles all Stripe payment events and sends Slack notifications
 * Supports: Plan payments (Forge/Sage), Cart/Supplement orders, and other payments
 */

import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import Stripe from 'stripe';
import { notifyPaymentSuccess } from '@/lib/slack';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      console.error('[Stripe Webhook] Missing Stripe signature');
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 400 }
      );
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('[Stripe Webhook] Webhook secret not configured');
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
      console.error('[Stripe Webhook] Signature verification failed:', err);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    console.log(`[Stripe Webhook] Received event: ${event.type}`);

    // Handle payment intent succeeded event
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const metadata = paymentIntent.metadata;
      const amount = paymentIntent.amount / 100; // Convert from cents to dollars

      // Determine payment type from metadata
      const email = metadata.customer_email || metadata.user_email || metadata.original_identifier;
      const planType = metadata.plan_type as 'Sage' | 'Forge' | undefined;
      const cartId = metadata.cart_id;
      const itemCount = metadata.item_count ? parseInt(metadata.item_count) : undefined;
      const fullName = metadata.full_name || metadata.user_name;

      console.log(`[Stripe Webhook] Payment succeeded - Email: ${email}, Amount: $${amount}`);

      // Determine payment type and send appropriate Slack notification
      let paymentType: 'plan' | 'cart' | 'other' = 'other';

      if (planType) {
        paymentType = 'plan';
        console.log(`[Stripe Webhook] Plan payment detected: ${planType}`);
      } else if (cartId) {
        paymentType = 'cart';
        console.log(`[Stripe Webhook] Cart payment detected: ${cartId}`);
      }

      // Send Slack notification
      if (email) {
        try {
          await notifyPaymentSuccess(email, amount, paymentType, {
            planType: planType,
            fullName: fullName,
            itemCount: itemCount,
            paymentIntentId: paymentIntent.id,
          });
          console.log(`[Stripe Webhook] ✅ Slack notification sent for ${email}`);
        } catch (slackError) {
          console.error('[Stripe Webhook] Failed to send Slack notification:', slackError);
          // Don't fail the webhook if Slack fails
        }
      } else {
        console.warn('[Stripe Webhook] No email found in payment metadata, skipping Slack notification');
      }
    }

    // Handle payment intent payment failed event
    if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const metadata = paymentIntent.metadata;
      const email = metadata.customer_email || metadata.user_email;

      console.log(`[Stripe Webhook] Payment failed for ${email}: ${paymentIntent.last_payment_error?.message}`);
      // Could add a Slack notification for failed payments if desired
    }

    // Handle charge succeeded (backup for payment confirmation)
    if (event.type === 'charge.succeeded') {
      const charge = event.data.object as Stripe.Charge;
      console.log(`[Stripe Webhook] Charge succeeded: ${charge.id}, Amount: $${charge.amount / 100}`);
    }

    // Handle charge refunded
    if (event.type === 'charge.refunded') {
      const charge = event.data.object as Stripe.Charge;
      console.log(`[Stripe Webhook] Charge refunded: ${charge.id}, Amount: $${charge.amount_refunded / 100}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Stripe Webhook] Error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}
