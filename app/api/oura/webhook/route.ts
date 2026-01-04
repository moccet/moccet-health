import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { processOuraWebhookEvent } from '@/lib/services/oura-webhook-service';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('OuraWebhook');

/**
 * POST /api/oura/webhook
 *
 * Receives webhook events from Oura when new data is available.
 * Oura sends webhooks for:
 * - daily_sleep
 * - daily_activity
 * - daily_readiness
 * - workout
 * - session
 * - tag
 *
 * Documentation: https://cloud.ouraring.com/docs/webhooks
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    logger.info('Received Oura webhook', {
      event_type: body.event_type,
      data_type: body.data_type,
      user_id: body.user_id,
    });

    // Validate required fields
    if (!body.user_id || !body.data_type) {
      logger.warn('Invalid webhook payload - missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields: user_id, data_type' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Look up user email from Oura user_id
    // We store this mapping when user connects Oura
    const { data: tokenData, error: lookupError } = await supabase
      .from('integration_tokens')
      .select('user_email')
      .eq('provider', 'oura')
      .eq('provider_user_id', body.user_id)
      .eq('is_active', true)
      .single();

    if (lookupError || !tokenData?.user_email) {
      logger.warn('Unknown Oura user_id', { user_id: body.user_id, error: lookupError });
      // Return 200 to acknowledge receipt (Oura will retry on non-2xx)
      return NextResponse.json({
        success: false,
        message: 'User not found for this Oura ID'
      });
    }

    const email = tokenData.user_email;
    logger.info('Matched Oura user to email', { user_id: body.user_id, email });

    // Store webhook event for debugging/audit
    await supabase.from('oura_webhook_events').insert({
      email,
      oura_user_id: body.user_id,
      event_type: body.event_type,
      data_type: body.data_type,
      payload: body,
      received_at: new Date().toISOString(),
    });

    // Process the webhook event asynchronously
    // This fetches fresh data, generates insights, and sends notifications
    const result = await processOuraWebhookEvent(email, body);

    logger.info('Webhook processed', {
      email,
      data_type: body.data_type,
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
    // Return 200 to prevent Oura from retrying
    // Log the error for investigation
    return NextResponse.json({
      success: false,
      message: 'Error processing webhook',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * GET /api/oura/webhook
 *
 * Oura uses GET for webhook verification during setup.
 * Returns the verification token if provided.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const verificationToken = searchParams.get('verification_token');

  if (verificationToken) {
    logger.info('Webhook verification request received');
    // Echo back the verification token
    return new NextResponse(verificationToken, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return NextResponse.json({
    status: 'Oura webhook endpoint active',
    message: 'POST to this endpoint to receive webhook events',
  });
}
