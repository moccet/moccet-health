/**
 * Subscription API
 *
 * GET /api/subscription - Get user's subscription status
 * POST /api/subscription - Create checkout session for subscription
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import {
  subscriptionTiers,
  createSubscriptionCheckout,
  createCustomerPortalSession,
  getCustomerSubscription,
  getTierFromPriceId,
  SubscriptionTier,
} from '@/lib/stripe';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * GET /api/subscription
 * Get user's current subscription status
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'email is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const supabase = createAdminClient();

    // First check our database for cached subscription info
    const { data: dbSubscription } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_email', email)
      .maybeSingle();

    // If we have a valid subscription in DB, return it
    if (dbSubscription && dbSubscription.status === 'active') {
      const currentPeriodEnd = new Date(dbSubscription.current_period_end);
      if (currentPeriodEnd > new Date()) {
        return NextResponse.json(
          {
            tier: dbSubscription.tier as SubscriptionTier,
            status: dbSubscription.status,
            currentPeriodEnd: dbSubscription.current_period_end,
            cancelAtPeriodEnd: dbSubscription.cancel_at_period_end,
            stripeSubscriptionId: dbSubscription.stripe_subscription_id,
            tiers: subscriptionTiers,
          },
          { headers: corsHeaders }
        );
      }
    }

    // Check Stripe directly for the most up-to-date info
    const stripeSubscription = await getCustomerSubscription(email);

    if (stripeSubscription) {
      const priceId = stripeSubscription.items.data[0]?.price.id;
      const tier = getTierFromPriceId(priceId || '');

      // Update our database
      await supabase.from('user_subscriptions').upsert(
        {
          user_email: email,
          tier,
          status: stripeSubscription.status,
          stripe_subscription_id: stripeSubscription.id,
          stripe_customer_id: stripeSubscription.customer as string,
          current_period_start: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
          cancel_at_period_end: stripeSubscription.cancel_at_period_end,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_email' }
      );

      return NextResponse.json(
        {
          tier,
          status: stripeSubscription.status,
          currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
          cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
          stripeSubscriptionId: stripeSubscription.id,
          tiers: subscriptionTiers,
        },
        { headers: corsHeaders }
      );
    }

    // No subscription - return free tier
    return NextResponse.json(
      {
        tier: 'free' as SubscriptionTier,
        status: 'free',
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        stripeSubscriptionId: null,
        tiers: subscriptionTiers,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[Subscription API] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * POST /api/subscription
 * Create a checkout session or customer portal session
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, tier, action } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'email is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Handle customer portal (manage subscription)
    if (action === 'manage') {
      const returnUrl = body.returnUrl || 'https://moccet.ai/subscription';
      const session = await createCustomerPortalSession(email, returnUrl);

      return NextResponse.json(
        {
          url: session.url,
          type: 'portal',
        },
        { headers: corsHeaders }
      );
    }

    // Handle new subscription checkout
    if (!tier || !['pro', 'max'].includes(tier)) {
      return NextResponse.json(
        { error: 'Valid tier (pro or max) is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const tierConfig = subscriptionTiers[tier as 'pro' | 'max'];
    if (!tierConfig.priceId) {
      return NextResponse.json(
        { error: 'Price ID not configured for this tier' },
        { status: 500, headers: corsHeaders }
      );
    }

    const successUrl = body.successUrl || 'https://moccet.ai/subscription/success';
    const cancelUrl = body.cancelUrl || 'https://moccet.ai/subscription';

    const session = await createSubscriptionCheckout(
      email,
      tierConfig.priceId,
      successUrl,
      cancelUrl
    );

    return NextResponse.json(
      {
        url: session.url,
        sessionId: session.id,
        type: 'checkout',
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[Subscription API] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}
