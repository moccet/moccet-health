import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Client as QStashClient } from '@upstash/qstash';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Initialize QStash client for async insight processing
const qstash = new QStashClient({
  token: process.env.QSTASH_TOKEN || '',
});

// Verify webhook signature
function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export async function POST(request: NextRequest) {
  try {
    const webhookSecret = process.env.VITAL_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('[Vital Webhook] Webhook secret not configured');
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // Get raw body for signature verification
    const payload = await request.text();
    const signature = request.headers.get('vital-webhook-signature') || '';

    // Verify webhook signature
    if (!verifyWebhookSignature(payload, signature, webhookSecret)) {
      console.error('[Vital Webhook] Invalid signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const event = JSON.parse(payload);

    console.log(`[Vital Webhook] Received event: ${event.event_type} for user ${event.user_id}`);

    // Handle different webhook events
    // Documentation: https://docs.tryvital.io/wearables/guides/webhooks
    switch (event.event_type) {
      case 'daily.data.sleep.created':
      case 'daily.data.activity.created':
      case 'daily.data.body.created':
      case 'daily.data.workout.created':
      case 'daily.data.nutrition.created':
        // Store webhook event data and get the ID
        const { data: insertedEvent, error: insertError } = await supabase
          .from('vital_webhook_events')
          .insert({
            event_type: event.event_type,
            user_id: event.user_id,
            provider: event.provider,
            event_data: event.data,
            received_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (insertError) {
          console.error('[Vital Webhook] Error storing event:', insertError);
          break;
        }

        // Look up user email from Vital user ID (stored in integration_tokens)
        const { data: tokenData } = await supabase
          .from('integration_tokens')
          .select('user_email')
          .eq('provider_user_id', event.user_id)
          .eq('provider', 'vital')
          .single();

        // If we found the user, queue insight processing
        if (tokenData?.user_email && process.env.QSTASH_TOKEN) {
          try {
            const baseUrl = process.env.VERCEL_URL
              ? `https://${process.env.VERCEL_URL}`
              : process.env.NEXT_PUBLIC_BASE_URL || 'https://moccet.ai';

            await qstash.publishJSON({
              url: `${baseUrl}/api/webhooks/qstash/process-vital-event`,
              body: {
                eventId: insertedEvent?.id,
                eventType: event.event_type,
                email: tokenData.user_email,
              },
              retries: 3,
            });

            console.log(`[Vital Webhook] Queued insight processing for ${tokenData.user_email}`);
          } catch (qstashError) {
            console.error('[Vital Webhook] Error queuing insight processing:', qstashError);
            // Don't fail the webhook if QStash fails
          }
        } else {
          console.log(`[Vital Webhook] No user email found for Vital user ${event.user_id}`);
        }
        break;

      case 'historical.data.sleep.created':
      case 'historical.data.activity.created':
      case 'historical.data.body.created':
      case 'historical.data.workout.created':
        console.log(`[Vital Webhook] Historical data received for ${event.user_id}`);
        // Handle historical data sync completion
        break;

      case 'user.connected':
        console.log(`[Vital Webhook] User ${event.user_id} connected ${event.provider}`);
        // Update user connection status
        break;

      case 'user.deregistered':
        console.log(`[Vital Webhook] User ${event.user_id} disconnected ${event.provider}`);
        // Handle disconnection
        break;

      default:
        console.log(`[Vital Webhook] Unhandled event type: ${event.event_type}`);
    }

    return NextResponse.json({ received: true }, { status: 200 });

  } catch (error) {
    console.error('[Vital Webhook] Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
