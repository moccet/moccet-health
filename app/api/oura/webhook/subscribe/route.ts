import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getAccessToken } from '@/lib/services/token-manager';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('OuraWebhookSubscribe');

const OURA_WEBHOOK_URL = 'https://moccet.ai/api/oura/webhook';

/**
 * POST /api/oura/webhook/subscribe
 *
 * Subscribes to Oura webhooks for a user.
 * This should be called after Oura connection is established.
 *
 * Oura Webhook API: https://cloud.ouraring.com/docs/webhooks
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    // Get user's Oura access token
    const { token: accessToken, error: tokenError } = await getAccessToken(email, 'oura');

    if (!accessToken) {
      logger.warn('No Oura token found', { email, error: tokenError });
      return NextResponse.json(
        { error: 'Oura not connected', details: tokenError },
        { status: 401 }
      );
    }

    // Subscribe to all relevant webhook event types
    const eventTypes = [
      'daily_sleep',
      'daily_activity',
      'daily_readiness',
      'daily_spo2',
      'workout',
      'session',
      'tag',
    ];

    const subscriptions = [];
    const errors = [];

    for (const eventType of eventTypes) {
      try {
        const response = await fetch('https://api.ouraring.com/v2/webhook/subscription', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            callback_url: OURA_WEBHOOK_URL,
            event_type: eventType,
            data_type: eventType,
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
    await supabase.from('oura_webhook_subscriptions').upsert({
      email,
      callback_url: OURA_WEBHOOK_URL,
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
 * GET /api/oura/webhook/subscribe
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

    // Get user's Oura access token
    const { token: accessToken, error: tokenError } = await getAccessToken(email, 'oura');

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Oura not connected', details: tokenError },
        { status: 401 }
      );
    }

    // Fetch subscriptions from Oura
    const response = await fetch('https://api.ouraring.com/v2/webhook/subscription', {
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
 * DELETE /api/oura/webhook/subscribe
 *
 * Unsubscribes from Oura webhooks for a user.
 */
export async function DELETE(request: NextRequest) {
  try {
    const { email, subscription_id } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const { token: accessToken } = await getAccessToken(email, 'oura');

    if (!accessToken) {
      return NextResponse.json({ error: 'Oura not connected' }, { status: 401 });
    }

    if (subscription_id) {
      // Delete specific subscription
      const response = await fetch(`https://api.ouraring.com/v2/webhook/subscription/${subscription_id}`, {
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
      const listResponse = await fetch('https://api.ouraring.com/v2/webhook/subscription', {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (!listResponse.ok) {
        return NextResponse.json({ error: 'Failed to list subscriptions' }, { status: listResponse.status });
      }

      const subscriptions = await listResponse.json();
      let deleted = 0;

      for (const sub of subscriptions) {
        const delResponse = await fetch(`https://api.ouraring.com/v2/webhook/subscription/${sub.id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });
        if (delResponse.ok) deleted++;
      }

      // Update database
      const supabase = createAdminClient();
      await supabase.from('oura_webhook_subscriptions')
        .update({ is_active: false })
        .eq('email', email);

      return NextResponse.json({ success: true, deleted, message: `Deleted ${deleted} subscriptions` });
    }

  } catch (error) {
    logger.error('Error deleting subscriptions', error);
    return NextResponse.json({ error: 'Failed to delete subscriptions' }, { status: 500 });
  }
}
