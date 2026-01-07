/**
 * OneSignal Push Notification Service
 *
 * Sends push notifications to users' devices via OneSignal REST API.
 * Requires OneSignal App ID and REST API Key in environment variables.
 *
 * Required env vars:
 * - ONESIGNAL_APP_ID
 * - ONESIGNAL_REST_API_KEY
 *
 * @module lib/services/onesignal-service
 */

import { createAdminClient } from '@/lib/supabase/server';

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Send a push notification to a user's devices via OneSignal
 *
 * @param email - User email to send notification to
 * @param payload - Notification content
 * @returns Number of successful sends
 */
export async function sendPushNotification(
  email: string,
  payload: PushNotificationPayload
): Promise<number> {
  const appId = process.env.ONESIGNAL_APP_ID;
  const restApiKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!appId || !restApiKey) {
    console.log('[OneSignal Service] OneSignal not configured, skipping push notification');
    return 0;
  }

  try {
    const supabase = createAdminClient();

    // Debug: First check all tokens for this user
    const { data: allTokens } = await supabase
      .from('user_device_tokens')
      .select('device_token, platform, provider, is_active')
      .eq('email', email);

    console.log(`[OneSignal Service] All tokens for ${email}:`, JSON.stringify(allTokens));

    // Get active device tokens for the user (OneSignal player IDs)
    const { data: tokens, error } = await supabase
      .from('user_device_tokens')
      .select('device_token, platform')
      .eq('email', email)
      .eq('is_active', true)
      .eq('provider', 'onesignal');

    console.log(`[OneSignal Service] Filtered tokens:`, JSON.stringify(tokens), 'Error:', error);

    if (error) {
      console.error('[OneSignal Service] Error fetching device tokens:', error);
      return 0;
    }

    // Even if no tokens in DB, we can still send via external_id
    // (if the user has called OneSignal.login(email) in the app)
    const hasTokens = tokens && tokens.length > 0;

    if (hasTokens) {
      console.log(`[OneSignal Service] Found ${tokens.length} device token(s) for ${email}`);
    } else {
      console.log(`[OneSignal Service] No device tokens for ${email}, trying external_id targeting`);
    }

    // Extract valid player IDs from tokens
    const playerIds = tokens
      ?.filter(t => t.device_token && t.device_token.length > 10)
      .map(t => t.device_token) || [];

    // Prepare notification payload
    const notificationPayload: Record<string, unknown> = {
      app_id: appId,
      headings: { en: payload.title },
      contents: { en: payload.body },
      data: payload.data || {},
      // iOS specific
      ios_sound: 'default',
      ios_badgeType: 'Increase',
      ios_badgeCount: 1,
      priority: 10,
    };

    // Use player IDs if available (more reliable), otherwise fall back to external_id
    if (playerIds.length > 0) {
      console.log(`[OneSignal Service] Using ${playerIds.length} player IDs for targeting`);
      notificationPayload.include_player_ids = playerIds;
    } else {
      console.log(`[OneSignal Service] No player IDs, falling back to external_id: ${email}`);
      notificationPayload.include_aliases = { external_id: [email] };
      notificationPayload.target_channel = 'push';
    }

    // Send notification via OneSignal REST API
    const response = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${restApiKey}`,
      },
      body: JSON.stringify(notificationPayload),
    });

    const result = await response.json();

    // Log full response for debugging
    console.log('[OneSignal Service] Full API response:', JSON.stringify(result));

    if (!response.ok) {
      console.error('[OneSignal Service] Error response:', result);
      return 0;
    }

    // Log results - check multiple possible fields
    // If we got a notification ID back, consider it successful even if recipients is 0
    const successCount = result.recipients || (result.id ? 1 : 0);
    const erroredPlayers = result.errors?.invalid_player_ids || [];

    console.log(
      `[OneSignal Service] Sent: ${successCount} success, ${erroredPlayers.length} failures`
    );

    // Handle failed tokens (mark as inactive)
    if (erroredPlayers.length > 0) {
      for (const invalidId of erroredPlayers) {
        console.log(
          `[OneSignal Service] Marking token as inactive: ${invalidId.substring(0, 20)}...`
        );
        await supabase
          .from('user_device_tokens')
          .update({ is_active: false })
          .eq('device_token', invalidId);
      }
    }

    return successCount;
  } catch (error) {
    console.error('[OneSignal Service] Error sending push notification:', error);
    return 0;
  }
}

/**
 * Send push notification for a new insight
 *
 * @param email - User email
 * @param insight - Insight details
 */
export async function sendInsightNotification(
  email: string,
  insight: {
    id: string;
    title: string;
    message: string;
    insight_type: string;
    severity: string;
  }
): Promise<number> {
  return sendPushNotification(email, {
    title: insight.title,
    body: insight.message,
    data: {
      insight_id: insight.id,
      insight_type: insight.insight_type,
      severity: insight.severity,
      action_url: `/insights/${insight.id}`,
    },
  });
}

/**
 * Send notification to specific player IDs directly
 * (useful for targeting specific devices)
 *
 * @param playerIds - Array of OneSignal player IDs
 * @param payload - Notification content
 */
export async function sendToPlayerIds(
  playerIds: string[],
  payload: PushNotificationPayload
): Promise<number> {
  const appId = process.env.ONESIGNAL_APP_ID;
  const restApiKey = process.env.ONESIGNAL_REST_API_KEY;

  if (!appId || !restApiKey) {
    console.log('[OneSignal Service] OneSignal not configured');
    return 0;
  }

  try {
    const notificationPayload: Record<string, unknown> = {
      app_id: appId,
      include_player_ids: playerIds,
      headings: { en: payload.title },
      contents: { en: payload.body },
      data: payload.data || {},
      ios_sound: 'default',
      priority: 10,
    };

    const response = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${restApiKey}`,
      },
      body: JSON.stringify(notificationPayload),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('[OneSignal Service] Error response:', result);
      return 0;
    }

    const successCount = result.recipients || 0;
    console.log(`[OneSignal Service] Sent to ${successCount} devices`);

    return successCount;
  } catch (error) {
    console.error('[OneSignal Service] Error sending to player IDs:', error);
    return 0;
  }
}
