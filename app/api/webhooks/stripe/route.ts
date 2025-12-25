/**
 * Unified Stripe Webhook Handler
 * POST /api/webhooks/stripe
 *
 * Handles all Stripe payment events and sends Slack notifications
 * Supports: Plan payments (Forge/Sage), Cart/Supplement orders, Subscriptions, and other payments
 */

import { NextRequest, NextResponse } from 'next/server';
import { stripe, getTierFromPriceId } from '@/lib/stripe';
import Stripe from 'stripe';
import { notifyPaymentSuccess } from '@/lib/slack';
import { createAdminClient } from '@/lib/supabase/server';

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

    // =========================================================================
    // SUBSCRIPTION EVENTS
    // =========================================================================

    // Handle subscription created
    if (event.type === 'customer.subscription.created') {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionChange(subscription, 'created');
    }

    // Handle subscription updated
    if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionChange(subscription, 'updated');
    }

    // Handle subscription deleted/canceled
    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionChange(subscription, 'deleted');
    }

    // Handle checkout session completed (for subscription checkouts)
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === 'subscription' && session.subscription) {
        console.log(`[Stripe Webhook] Subscription checkout completed: ${session.subscription}`);
        // Subscription will be handled by subscription.created event
      }
    }

    // Handle invoice paid (subscription renewal)
    if (event.type === 'invoice.paid') {
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.subscription) {
        console.log(`[Stripe Webhook] Subscription invoice paid: ${invoice.id}`);
      }
    }

    // Handle invoice payment failed (subscription payment failed)
    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.subscription) {
        console.log(`[Stripe Webhook] Subscription payment failed: ${invoice.id}`);
        // Could send a notification to the user here
      }
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

/**
 * Handle subscription changes (create, update, delete)
 */
async function handleSubscriptionChange(
  subscription: Stripe.Subscription,
  action: 'created' | 'updated' | 'deleted'
) {
  try {
    const supabase = createAdminClient();

    // Get customer email
    const customer = await stripe.customers.retrieve(subscription.customer as string);
    if (customer.deleted) {
      console.error('[Stripe Webhook] Customer was deleted');
      return;
    }
    const email = customer.email;

    if (!email) {
      // Try to get email from subscription metadata
      const metadataEmail = subscription.metadata?.customer_email;
      if (!metadataEmail) {
        console.error('[Stripe Webhook] No email found for subscription');
        return;
      }
    }

    const customerEmail = email || subscription.metadata?.customer_email;
    const priceId = subscription.items.data[0]?.price.id;
    const tier = getTierFromPriceId(priceId || '');

    console.log(`[Stripe Webhook] Subscription ${action}: ${customerEmail} -> ${tier}`);

    if (action === 'deleted') {
      // Mark subscription as canceled
      await supabase
        .from('user_subscriptions')
        .update({
          status: 'canceled',
          tier: 'free',
          updated_at: new Date().toISOString(),
        })
        .eq('user_email', customerEmail);

      console.log(`[Stripe Webhook] Subscription canceled for ${customerEmail}`);
    } else {
      // Upsert subscription record
      await supabase.from('user_subscriptions').upsert(
        {
          user_email: customerEmail,
          tier,
          status: subscription.status,
          stripe_subscription_id: subscription.id,
          stripe_customer_id: subscription.customer as string,
          stripe_price_id: priceId,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          cancel_at_period_end: subscription.cancel_at_period_end,
          created_at: action === 'created' ? new Date().toISOString() : undefined,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_email' }
      );

      console.log(`[Stripe Webhook] Subscription ${action} for ${customerEmail}: ${tier}`);

      // Send Slack notification for new subscriptions
      if (action === 'created') {
        try {
          await notifyPaymentSuccess(customerEmail!, subscription.items.data[0]?.price.unit_amount! / 100, 'plan', {
            planType: tier === 'pro' ? 'Pro' : 'Max',
          });
        } catch (slackError) {
          console.error('[Stripe Webhook] Failed to send Slack notification:', slackError);
        }
      }
    }
  } catch (error) {
    console.error('[Stripe Webhook] Error handling subscription change:', error);
  }
}
