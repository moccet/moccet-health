import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { processWhoopWebhookEvent, fetchWhoopDataForDebug } from '@/lib/services/whoop-webhook-service';

/**
 * POST /api/test-whoop-webhook
 * Simulates a Whoop webhook event for testing the notification pipeline
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Look up the user's Whoop user_id from integration_tokens
    const { data: tokenData, error: lookupError } = await supabase
      .from('integration_tokens')
      .select('provider_user_id')
      .eq('provider', 'whoop')
      .eq('user_email', email)
      .eq('is_active', true)
      .single();

    if (lookupError || !tokenData?.provider_user_id) {
      return NextResponse.json({
        error: 'Whoop not connected for this user',
        details: lookupError?.message,
      }, { status: 404 });
    }

    const whoopUserId = tokenData.provider_user_id;
    console.log(`[Test Whoop Webhook] Found Whoop user_id: ${whoopUserId} for ${email}`);

    // Simulate a recovery.updated webhook with low recovery to trigger notification
    const testEvent = {
      type: 'recovery.updated',
      user_id: parseInt(whoopUserId) || whoopUserId,
      id: Date.now(),
      created_at: new Date().toISOString(),
    };

    // Store test webhook event
    await supabase.from('whoop_webhook_events').insert({
      email,
      whoop_user_id: whoopUserId.toString(),
      event_type: testEvent.type,
      payload: { ...testEvent, _test: true },
      received_at: new Date().toISOString(),
    });

    // Fetch raw data for debugging
    const debugData = await fetchWhoopDataForDebug(email, testEvent);

    // Process the webhook event
    const result = await processWhoopWebhookEvent(email, testEvent);

    return NextResponse.json({
      success: true,
      whoop_user_id: whoopUserId,
      event_simulated: testEvent.type,
      debug_data: debugData,
      ...result,
    });

  } catch (error) {
    console.error('Test Whoop webhook error:', error);
    return NextResponse.json({
      error: 'Failed to simulate webhook',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
