/**
 * Firebase Cloud Messaging Service
 *
 * Sends push notifications to users' devices via Firebase Cloud Messaging.
 * Requires Firebase Admin SDK credentials in environment variables.
 *
 * Required env vars:
 * - FIREBASE_PROJECT_ID
 * - FIREBASE_CLIENT_EMAIL
 * - FIREBASE_PRIVATE_KEY
 *
 * @module lib/services/fcm-service
 */

import { createClient } from '@/lib/supabase/server';

// Lazy-load firebase-admin to avoid build errors if not installed
let admin: typeof import('firebase-admin') | null = null;

async function getFirebaseAdmin() {
  if (admin) return admin;

  try {
    admin = await import('firebase-admin');

    // Initialize Firebase Admin SDK if not already initialized
    if (!admin.apps.length) {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

      if (!projectId || !clientEmail || !privateKey) {
        console.warn('[FCM Service] Firebase credentials not configured');
        return null;
      }

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    }

    return admin;
  } catch (error) {
    console.error('[FCM Service] Failed to load firebase-admin:', error);
    return null;
  }
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Send a push notification to a user's devices
 *
 * @param email - User email to send notification to
 * @param payload - Notification content
 * @returns Number of successful sends
 */
export async function sendPushNotification(
  email: string,
  payload: PushNotificationPayload
): Promise<number> {
  const firebaseAdmin = await getFirebaseAdmin();

  if (!firebaseAdmin) {
    console.log('[FCM Service] Firebase not configured, skipping push notification');
    return 0;
  }

  try {
    const supabase = await createClient();

    // Get active device tokens for the user
    const { data: tokens, error } = await supabase
      .from('user_device_tokens')
      .select('device_token, platform')
      .eq('email', email)
      .eq('is_active', true);

    if (error) {
      console.error('[FCM Service] Error fetching device tokens:', error);
      return 0;
    }

    if (!tokens || tokens.length === 0) {
      console.log(`[FCM Service] No device tokens for ${email}`);
      return 0;
    }

    const tokenStrings = tokens.map((t) => t.device_token);

    console.log(`[FCM Service] Sending to ${tokenStrings.length} device(s) for ${email}`);

    // Send to all devices
    const response = await firebaseAdmin.messaging().sendEachForMulticast({
      tokens: tokenStrings,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data,
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'high_priority',
        },
      },
    });

    // Log results
    const successCount = response.successCount;
    const failureCount = response.failureCount;

    console.log(
      `[FCM Service] Sent: ${successCount} success, ${failureCount} failures`
    );

    // Handle failed tokens (mark as inactive)
    if (failureCount > 0) {
      response.responses.forEach(async (resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error?.code;
          // If token is invalid or unregistered, mark it as inactive
          if (
            errorCode === 'messaging/invalid-registration-token' ||
            errorCode === 'messaging/registration-token-not-registered'
          ) {
            console.log(
              `[FCM Service] Marking token as inactive: ${tokenStrings[idx].substring(0, 20)}...`
            );
            await supabase
              .from('user_device_tokens')
              .update({ is_active: false })
              .eq('device_token', tokenStrings[idx]);
          }
        }
      });
    }

    return successCount;
  } catch (error) {
    console.error('[FCM Service] Error sending push notification:', error);
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
