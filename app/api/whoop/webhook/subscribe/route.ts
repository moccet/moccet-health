import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getAccessToken } from '@/lib/services/token-manager';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('WhoopWebhookSubscribe');

const WHOOP_WEBHOOK_URL = 'https://moccet.ai/api/whoop/webhook';

/**
 * POST /api/whoop/webhook/subscribe
 *
 * Subscribes to Whoop webhooks for a user.
 * This should be called after Whoop connection is established.
 *
 * Whoop Webhook API: https://developer.whoop.com/docs/webhooks
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    // Get user's Whoop access token
    const { token: accessToken, error: tokenError } = await getAccessToken(email, 'whoop');

    if (!accessToken) {
      logger.warn('No Whoop token found', { email, error: tokenError });
      return NextResponse.json(
        { error: 'Whoop not connected', details: tokenError },
        { status: 401 }
      );
    }

    // Whoop webhook event types
    const eventTypes = [
      'recovery.updated',
      'recovery.created',
      'sleep.updated',
      'sleep.created',
      'workout.updated',
      'workout.created',
      'cycle.updated',
      'cycle.created',
    ];

    const subscriptions = [];
    const errors = [];

    // Subscribe to each event type
    for (const eventType of eventTypes) {
      try {
        const response = await fetch('https://api.prod.whoop.com/developer/v1/webhook', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: WHOOP_WEBHOOK_URL,
            event: eventType,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          subscriptions.push({ event_type: eventType, id: data.id });
          logger.info('Webhook subscription created', { email, eventType, id: data.id });
        } else {
          const errorText = await response.text();
          // 409 means already subscribed - that's okay
          if (response.status === 409) {
            logger.info('Webhook already subscribed', { email, eventType });
            subscriptions.push({ event_type: eventType, status: 'already_subscribed' });
          } else {
            logger.error('Webhook subscription failed', { email, eventType, status: response.status, error: errorText });
            errors.push({ event_type: eventType, error: errorText });
          }
        }
      } catch (err) {
        logger.error('Webhook subscription error', err, { email, eventType });
        errors.push({ event_type: eventType, error: err instanceof Error ? err.message : 'Unknown error' });
      }
    }

    // Store subscription info in database
    const supabase = createAdminClient();
    await supabase.from('whoop_webhook_subscriptions').upsert({
      email,
      callback_url: WHOOP_WEBHOOK_URL,
      subscriptions: subscriptions,
      subscribed_at: new Date().toISOString(),
      is_active: true,
    }, {
      onConflict: 'email',
    });

    return NextResponse.json({
      success: true,
      subscriptions,
      errors: errors.length > 0 ? errors : undefined,
      message: `Subscribed to ${subscriptions.length} webhook event types`,
    });

  } catch (error) {
    logger.error('Subscription error', error);
    return NextResponse.json({
      error: 'Failed to subscribe to webhooks',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

/**
 * GET /api/whoop/webhook/subscribe
 *
 * Lists current webhook subscriptions for a user.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    // Get user's Whoop access token
    const { token: accessToken, error: tokenError } = await getAccessToken(email, 'whoop');

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Whoop not connected', details: tokenError },
        { status: 401 }
      );
    }

    // Fetch subscriptions from Whoop
    const response = await fetch('https://api.prod.whoop.com/developer/v1/webhook', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({
        error: 'Failed to fetch subscriptions',
        details: errorText,
      }, { status: response.status });
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      subscriptions: data,
    });

  } catch (error) {
    logger.error('Error fetching subscriptions', error);
    return NextResponse.json({
      error: 'Failed to fetch subscriptions',
    }, { status: 500 });
  }
}

/**
 * DELETE /api/whoop/webhook/subscribe
 *
 * Unsubscribes from Whoop webhooks for a user.
 */
export async function DELETE(request: NextRequest) {
  try {
    const { email, subscription_id } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const { token: accessToken } = await getAccessToken(email, 'whoop');

    if (!accessToken) {
      return NextResponse.json({ error: 'Whoop not connected' }, { status: 401 });
    }

    if (subscription_id) {
      // Delete specific subscription
      const response = await fetch(`https://api.prod.whoop.com/developer/v1/webhook/${subscription_id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        return NextResponse.json({ error: 'Failed to delete subscription' }, { status: response.status });
      }

      return NextResponse.json({ success: true, message: 'Subscription deleted' });
    } else {
      // Delete all subscriptions
      const listResponse = await fetch('https://api.prod.whoop.com/developer/v1/webhook', {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (!listResponse.ok) {
        return NextResponse.json({ error: 'Failed to list subscriptions' }, { status: listResponse.status });
      }

      const subscriptions = await listResponse.json();
      let deleted = 0;

      // Handle both array and object with records array
      const subscriptionList = Array.isArray(subscriptions) ? subscriptions : (subscriptions.records || []);

      for (const sub of subscriptionList) {
        const delResponse = await fetch(`https://api.prod.whoop.com/developer/v1/webhook/${sub.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        if (delResponse.ok) deleted++;
      }

      // Update database
      const supabase = createAdminClient();
      await supabase.from('whoop_webhook_subscriptions')
        .update({ is_active: false })
        .eq('email', email);

      return NextResponse.json({ success: true, deleted, message: `Deleted ${deleted} subscriptions` });
    }

  } catch (error) {
    logger.error('Error deleting subscriptions', error);
    return NextResponse.json({ error: 'Failed to delete subscriptions' }, { status: 500 });
  }
}
