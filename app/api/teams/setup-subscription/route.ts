/**
 * Teams Webhook Subscription Setup
 *
 * Creates Microsoft Graph subscriptions for real-time Teams message notifications.
 *
 * @see https://docs.microsoft.com/en-us/graph/webhooks
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getAccessToken } from '@/lib/services/token-manager';
import crypto from 'crypto';

const TEAMS_WEBHOOK_URL = 'https://moccet.ai/api/teams/webhook';

// Max subscription lifetime is 4230 minutes (~2.9 days) for chat messages
const SUBSCRIPTION_LIFETIME_MINUTES = 4200;

/**
 * POST /api/teams/setup-subscription
 *
 * Creates a webhook subscription for Teams chat messages
 */
export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    // Get user's Teams access token
    const { token, error: tokenError } = await getAccessToken(email, 'teams', code);

    if (!token) {
      console.warn('[Teams Subscription] No token found', { email, error: tokenError });
      return NextResponse.json(
        { error: 'Teams not connected', details: tokenError },
        { status: 401 }
      );
    }

    const supabase = createAdminClient();

    // Check for existing active subscription
    const { data: existing } = await supabase
      .from('teams_webhook_subscriptions')
      .select('*')
      .eq('user_email', email)
      .eq('is_active', true)
      .single();

    if (existing) {
      // Check if it needs renewal (within 24 hours of expiry)
      const expiresAt = new Date(existing.expiration);
      const renewalThreshold = new Date(Date.now() + 24 * 60 * 60 * 1000);

      if (expiresAt > renewalThreshold) {
        console.log('[Teams Subscription] Existing subscription still valid', {
          email,
          expiresAt,
        });
        return NextResponse.json({
          success: true,
          message: 'Existing subscription still valid',
          subscription_id: existing.subscription_id,
          expires_at: existing.expiration,
        });
      }

      // Delete old subscription before creating new one
      try {
        await fetch(
          `https://graph.microsoft.com/v1.0/subscriptions/${existing.subscription_id}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          }
        );
      } catch {
        // Ignore deletion errors
      }
    }

    // Generate client state for validation
    const clientState = crypto.randomBytes(32).toString('hex');

    // Calculate expiration (Graph requires ISO 8601 format)
    const expirationDateTime = new Date(
      Date.now() + SUBSCRIPTION_LIFETIME_MINUTES * 60 * 1000
    ).toISOString();

    // Create subscription for chat messages
    const subscriptionRequest = {
      changeType: 'created,updated',
      notificationUrl: TEAMS_WEBHOOK_URL,
      resource: '/me/chats/getAllMessages',
      expirationDateTime,
      clientState,
    };

    console.log('[Teams Subscription] Creating subscription', {
      email,
      resource: subscriptionRequest.resource,
      expiresAt: expirationDateTime,
    });

    const response = await fetch('https://graph.microsoft.com/v1.0/subscriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(subscriptionRequest),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Teams Subscription] Failed to create subscription', {
        email,
        status: response.status,
        error: errorText,
      });
      return NextResponse.json(
        {
          error: 'Failed to create subscription',
          details: errorText,
          status: response.status,
        },
        { status: response.status }
      );
    }

    const subscription = await response.json();

    // Store subscription in database
    await supabase.from('teams_webhook_subscriptions').upsert(
      {
        user_email: email,
        subscription_id: subscription.id,
        resource: subscription.resource,
        change_types: ['created', 'updated'],
        expiration: subscription.expirationDateTime,
        client_state: clientState,
        is_active: true,
        error_count: 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_email' }
    );

    console.log('[Teams Subscription] Created successfully', {
      email,
      subscriptionId: subscription.id,
      expiresAt: subscription.expirationDateTime,
    });

    return NextResponse.json({
      success: true,
      subscription_id: subscription.id,
      resource: subscription.resource,
      expires_at: subscription.expirationDateTime,
    });
  } catch (error) {
    console.error('[Teams Subscription] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to setup subscription',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/teams/setup-subscription
 *
 * Check subscription status
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: subscription } = await supabase
      .from('teams_webhook_subscriptions')
      .select('*')
      .eq('user_email', email)
      .eq('is_active', true)
      .single();

    if (!subscription) {
      return NextResponse.json({
        active: false,
        message: 'No active subscription',
      });
    }

    return NextResponse.json({
      active: true,
      subscription_id: subscription.subscription_id,
      resource: subscription.resource,
      expires_at: subscription.expiration,
      created_at: subscription.created_at,
    });
  } catch (error) {
    console.error('[Teams Subscription] Status check error:', error);
    return NextResponse.json(
      { error: 'Failed to check subscription status' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/teams/setup-subscription
 *
 * Remove subscription
 */
export async function DELETE(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Get existing subscription
    const { data: subscription } = await supabase
      .from('teams_webhook_subscriptions')
      .select('subscription_id')
      .eq('user_email', email)
      .eq('is_active', true)
      .single();

    if (subscription) {
      // Try to delete from Graph API
      const { token } = await getAccessToken(email, 'teams');
      if (token) {
        try {
          await fetch(
            `https://graph.microsoft.com/v1.0/subscriptions/${subscription.subscription_id}`,
            {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` },
            }
          );
        } catch {
          // Ignore deletion errors
        }
      }

      // Mark as inactive in database
      await supabase
        .from('teams_webhook_subscriptions')
        .update({ is_active: false })
        .eq('user_email', email);
    }

    return NextResponse.json({ success: true, message: 'Subscription removed' });
  } catch (error) {
    console.error('[Teams Subscription] Delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete subscription' },
      { status: 500 }
    );
  }
}
