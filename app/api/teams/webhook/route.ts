/**
 * Microsoft Teams Webhook
 *
 * Receives real-time notifications from Microsoft Graph when Teams messages arrive.
 * This enables instant analysis instead of batch polling.
 *
 * @see https://docs.microsoft.com/en-us/graph/webhooks
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * POST /api/teams/webhook
 *
 * Receives change notifications from Microsoft Graph
 */
export async function POST(request: NextRequest) {
  try {
    // Check for validation token (Graph sends this during subscription setup)
    const validationToken = request.nextUrl.searchParams.get('validationToken');
    if (validationToken) {
      console.log('[Teams Webhook] Validation request received');
      // Echo back the token as plain text
      return new NextResponse(validationToken, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    const body = await request.json();
    console.log('[Teams Webhook] Received notification', {
      value: body.value?.length || 0,
    });

    const supabase = createAdminClient();

    // Process each notification
    for (const notification of body.value || []) {
      const {
        subscriptionId,
        changeType,
        resource,
        clientState,
        resourceData,
      } = notification;

      console.log('[Teams Webhook] Processing notification', {
        subscriptionId,
        changeType,
        resource,
      });

      // Look up user by subscription ID
      const { data: subscription } = await supabase
        .from('teams_webhook_subscriptions')
        .select('user_email')
        .eq('subscription_id', subscriptionId)
        .eq('is_active', true)
        .single();

      if (!subscription) {
        console.warn('[Teams Webhook] Unknown subscription:', subscriptionId);
        continue;
      }

      const email = subscription.user_email;

      // Store event for audit
      await supabase.from('teams_webhook_events').insert({
        user_email: email,
        subscription_id: subscriptionId,
        resource,
        change_type: changeType,
        client_state: clientState,
        resource_data: resourceData,
        payload: notification,
        received_at: new Date().toISOString(),
      });

      // Process asynchronously
      processTeamsEventAsync(email, notification).catch((err) => {
        console.error('[Teams Webhook] Async processing error:', err);
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Teams Webhook] Error processing webhook:', error);
    return NextResponse.json({ ok: true }); // Return 200 to prevent retries
  }
}

/**
 * GET /api/teams/webhook
 *
 * Health check
 */
export async function GET() {
  return NextResponse.json({
    status: 'Teams webhook endpoint active',
    message: 'Microsoft Graph will POST notifications here',
  });
}

/**
 * Process Teams event asynchronously
 */
async function processTeamsEventAsync(
  email: string,
  notification: {
    changeType: string;
    resource: string;
    resourceData?: {
      id?: string;
      '@odata.type'?: string;
    };
  }
): Promise<void> {
  console.log('[Teams Webhook] Processing event for', {
    email,
    changeType: notification.changeType,
    resource: notification.resource,
  });

  // For message events, fetch the full message content
  if (notification.resource?.includes('/messages/')) {
    const supabase = createAdminClient();

    // Get user's access token
    const { data: tokenData } = await supabase
      .from('integration_tokens')
      .select('access_token')
      .eq('user_email', email)
      .eq('provider', 'teams')
      .eq('is_active', true)
      .single();

    if (!tokenData?.access_token) {
      console.warn('[Teams Webhook] No token for user:', email);
      return;
    }

    // Fetch full message content
    try {
      const messageUrl = `https://graph.microsoft.com/v1.0/${notification.resource}`;
      const response = await fetch(messageUrl, {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      });

      if (response.ok) {
        const message = await response.json();
        console.log('[Teams Webhook] Fetched message', {
          email,
          from: message.from?.user?.displayName,
          preview: message.body?.content?.substring(0, 50),
        });

        // TODO: Integrate with deep-content-analyzer
        // const analysis = await analyzeTeamsMessage(email, message);
        // if (analysis.urgencyScore > 80) {
        //   await sendPushNotification(email, {
        //     title: 'Urgent Teams Message',
        //     body: analysis.summary,
        //   });
        // }
      }
    } catch (fetchError) {
      console.error('[Teams Webhook] Error fetching message:', fetchError);
    }
  }
}
