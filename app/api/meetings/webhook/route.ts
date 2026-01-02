/**
 * Meeting Bot Webhook API Route
 *
 * POST /api/meetings/webhook - Receive webhook events from Recall.ai
 *
 * Recall.ai webhook documentation: https://docs.recall.ai/reference/webhooks
 */

import { NextRequest, NextResponse } from 'next/server';
import { processBotWebhook } from '@/lib/services/meeting-notetaker/google-meet-bot';

// ============================================================================
// POST - Handle Webhook
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Recall.ai sends signature in 'x-recall-signature' header
    const signature =
      request.headers.get('x-recall-signature') ||
      request.headers.get('x-webhook-signature') ||
      undefined;

    console.log('[WebhookAPI] Received Recall.ai webhook:', {
      event: body.event,
      botId: body.data?.bot_id || body.bot_id,
      status: body.data?.status?.code,
    });

    // Pass the raw Recall.ai webhook body to the processor
    // The processBotWebhook function handles Recall.ai's format directly
    const result = await processBotWebhook(body, signature);

    if (!result.success) {
      console.error('[WebhookAPI] Processing failed:', result.error);
      // Return 200 anyway to prevent Recall.ai from retrying
      // Log the error for debugging
      return NextResponse.json({
        received: true,
        processed: false,
        error: result.error,
      });
    }

    return NextResponse.json({ received: true, processed: true });
  } catch (error) {
    console.error('[WebhookAPI] Exception:', error);
    // Return 200 to prevent retries, but indicate failure
    return NextResponse.json({
      received: true,
      processed: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// ============================================================================
// OPTIONS - CORS Support
// ============================================================================

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Webhook-Signature',
    },
  });
}
