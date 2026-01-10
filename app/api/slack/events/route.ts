/**
 * Slack Events API Webhook
 *
 * Receives real-time events from Slack when messages are posted.
 * This enables instant analysis and notifications instead of batch polling.
 *
 * Event types handled:
 * - message: New messages in channels/DMs
 * - app_mention: When @mentioned
 * - message.channels, message.groups, message.im
 *
 * @see https://api.slack.com/events-api
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { createHmac } from 'crypto';

const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET;

/**
 * Verify Slack request signature
 */
function verifySlackSignature(
  signature: string | null,
  timestamp: string | null,
  body: string
): boolean {
  if (!signature || !timestamp || !SLACK_SIGNING_SECRET) {
    return false;
  }

  // Check timestamp is within 5 minutes to prevent replay attacks
  const time = Math.floor(Date.now() / 1000);
  if (Math.abs(time - parseInt(timestamp)) > 300) {
    console.warn('[Slack Events] Request timestamp too old');
    return false;
  }

  // Create signature base string
  const sigBasestring = `v0:${timestamp}:${body}`;

  // Create HMAC SHA256 signature
  const mySignature =
    'v0=' +
    createHmac('sha256', SLACK_SIGNING_SECRET)
      .update(sigBasestring, 'utf8')
      .digest('hex');

  // Compare signatures
  return signature === mySignature;
}

/**
 * POST /api/slack/events
 *
 * Main webhook endpoint for Slack Events API
 */
export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text();
    const body = JSON.parse(rawBody);

    // Get Slack signature headers
    const slackSignature = request.headers.get('x-slack-signature');
    const slackTimestamp = request.headers.get('x-slack-request-timestamp');

    // Handle URL verification challenge
    if (body.type === 'url_verification') {
      console.log('[Slack Events] URL verification challenge received');
      return NextResponse.json({ challenge: body.challenge });
    }

    // Verify signature for all other requests
    if (SLACK_SIGNING_SECRET && !verifySlackSignature(slackSignature, slackTimestamp, rawBody)) {
      console.warn('[Slack Events] Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Handle event callbacks
    if (body.type === 'event_callback') {
      const event = body.event;
      const teamId = body.team_id;

      console.log('[Slack Events] Received event', {
        type: event?.type,
        subtype: event?.subtype,
        teamId,
        userId: event?.user,
        channelId: event?.channel,
      });

      // Skip bot messages and message edits/deletes
      if (event?.bot_id || event?.subtype === 'message_changed' || event?.subtype === 'message_deleted') {
        return NextResponse.json({ ok: true, skipped: 'bot_or_edit' });
      }

      // Process message events
      if (event?.type === 'message' || event?.type === 'app_mention') {
        // Queue for async processing to return quickly
        processSlackEventAsync(teamId, event, body).catch((err) => {
          console.error('[Slack Events] Async processing error:', err);
        });
      }

      return NextResponse.json({ ok: true });
    }

    // Unknown event type
    console.log('[Slack Events] Unknown event type:', body.type);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Slack Events] Error processing webhook:', error);
    // Return 200 to prevent Slack from retrying
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * GET /api/slack/events
 *
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'Slack Events API webhook active',
    message: 'POST events to this endpoint',
    configured: !!SLACK_SIGNING_SECRET,
  });
}

/**
 * Process Slack event asynchronously
 */
async function processSlackEventAsync(
  teamId: string,
  event: {
    type: string;
    user?: string;
    channel?: string;
    text?: string;
    ts?: string;
    thread_ts?: string;
  },
  fullPayload: Record<string, unknown>
): Promise<void> {
  const supabase = createAdminClient();

  // Look up user email from Slack team_id + user_id
  // We need to find the user who connected this Slack workspace
  const { data: tokenData, error: lookupError } = await supabase
    .from('integration_tokens')
    .select('user_email')
    .eq('provider', 'slack')
    .eq('is_active', true)
    .limit(10);

  if (lookupError || !tokenData || tokenData.length === 0) {
    console.warn('[Slack Events] No users found for team', { teamId });
    return;
  }

  // For now, process for all users connected to Slack
  // In production, you'd match by team_id stored during OAuth
  for (const user of tokenData) {
    const email = user.user_email;

    console.log('[Slack Events] Processing event for user', {
      email,
      eventType: event.type,
      channel: event.channel,
    });

    // Store event for audit/debugging
    await supabase.from('slack_webhook_events').insert({
      user_email: email,
      team_id: teamId,
      event_type: event.type,
      channel_id: event.channel,
      user_id: event.user,
      message_ts: event.ts,
      thread_ts: event.thread_ts,
      payload: fullPayload,
      received_at: new Date().toISOString(),
    }).catch((err) => {
      console.warn('[Slack Events] Could not store event:', err);
    });

    // Trigger real-time analysis if user has it enabled
    // This would call deep-content-analyzer for the new message
    try {
      const messageText = event.text || '';

      // Skip short messages or automated ones
      if (messageText.length < 10) continue;

      // Import and call the deep content analyzer
      // This is where you'd integrate with your existing analysis pipeline
      console.log('[Slack Events] Would analyze message:', {
        email,
        messagePreview: messageText.substring(0, 50) + '...',
        channel: event.channel,
      });

      // TODO: Integrate with deep-content-analyzer
      // const analysis = await analyzeSlackMessage(email, event);
      // if (analysis.urgencyScore > 80) {
      //   await sendPushNotification(email, {
      //     title: 'Urgent Slack Message',
      //     body: analysis.summary,
      //   });
      // }

    } catch (analysisError) {
      console.error('[Slack Events] Analysis error:', analysisError);
    }
  }
}
