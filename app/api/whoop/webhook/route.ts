import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { processWhoopWebhookEvent } from '@/lib/services/whoop-webhook-service';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('WhoopWebhook');

/**
 * POST /api/whoop/webhook
 *
 * Receives webhook events from Whoop when new data is available.
 * Whoop sends webhooks for:
 * - recovery.updated
 * - sleep.updated
 * - workout.updated
 * - cycle.updated
 *
 * Documentation: https://developer.whoop.com/docs/webhooks
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    logger.info('Received Whoop webhook', {
      event_type: body.type,
      user_id: body.user_id,
    });

    // Validate required fields
    if (!body.user_id || !body.type) {
      logger.warn('Invalid webhook payload - missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields: user_id, type' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Look up user email from Whoop user_id
    // We store this mapping when user connects Whoop
    const { data: tokenData, error: lookupError } = await supabase
      .from('integration_tokens')
      .select('user_email')
      .eq('provider', 'whoop')
      .eq('provider_user_id', body.user_id.toString())
      .eq('is_active', true)
      .single();

    if (lookupError || !tokenData?.user_email) {
      logger.warn('Unknown Whoop user_id', { user_id: body.user_id, error: lookupError });
      // Return 200 to acknowledge receipt (Whoop will retry on non-2xx)
      return NextResponse.json({
        success: false,
        message: 'User not found for this Whoop ID'
      });
    }

    const email = tokenData.user_email;
    logger.info('Matched Whoop user to email', { user_id: body.user_id, email });

    // Store webhook event for debugging/audit
    await supabase.from('whoop_webhook_events').insert({
      email,
      whoop_user_id: body.user_id.toString(),
      event_type: body.type,
      payload: body,
      received_at: new Date().toISOString(),
    });

    // Process the webhook event asynchronously
    // This fetches fresh data, generates insights, and sends notifications
    const result = await processWhoopWebhookEvent(email, body);

    logger.info('Webhook processed', {
      email,
      event_type: body.type,
      insights_generated: result.insights_generated,
      notification_sent: result.notification_sent,
    });

    return NextResponse.json({
      success: true,
      message: 'Webhook processed successfully',
      ...result,
    });

  } catch (error) {
    logger.error('Webhook processing error', error);
    // Return 200 to prevent Whoop from retrying
    // Log the error for investigation
    return NextResponse.json({
      success: false,
      message: 'Error processing webhook',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * GET /api/whoop/webhook
 *
 * Whoop uses GET for webhook verification during setup.
 * Returns the challenge if provided.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const challenge = searchParams.get('challenge');

  if (challenge) {
    logger.info('Webhook verification request received');
    // Echo back the challenge
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return NextResponse.json({
    status: 'Whoop webhook endpoint active',
    message: 'POST to this endpoint to receive webhook events',
  });
}
