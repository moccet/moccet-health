/**
 * OneSignal Push Notification Service
 *
 * Sends push notifications to users' devices via OneSignal REST API.
 * Requires OneSignal App ID and REST API Key in environment variables.
 *
 * IMPORTANT: For coordinated notifications with rate limiting and deduplication,
 * use the NotificationCoordinator service instead of calling these functions directly.
 * Direct calls bypass all rate limiting and deduplication logic.
 *
 * Required env vars:
 * - ONESIGNAL_APP_ID
 * - ONESIGNAL_REST_API_KEY
 *
 * @module lib/services/onesignal-service
 */

import { createAdminClient } from '@/lib/supabase/server';
import {
  NotificationCoordinator,
  SourceService,
  NotificationSeverity,
  SendResult,
  extractTheme,
} from './notification-coordinator';

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Notification types for throttling purposes
 */
export type NotificationType = 'insight' | 'achievement' | 'digest' | 'critical';

/**
 * Daily notification limit (excluding critical alerts and achievements)
 */
const DAILY_NOTIFICATION_LIMIT = 5;

/**
 * Theme keywords for categorizing insights
 * Used to prevent duplicate theme notifications (e.g., multiple music insights)
 */
const INSIGHT_THEMES: Record<string, string[]> = {
  'music': ['spotify', 'music', 'playlist', 'listening', 'song', 'track', 'rhythm', 'audio', 'melody'],
  'social': ['social', 'connection', 'collaboration', 'friend', 'colleague', 'community', 'together'],
  'sleep': ['sleep', 'bed', 'rest', 'circadian', 'night', 'wake', 'morning'],
  'recovery': ['recovery', 'hrv', 'strain', 'fatigue', 'overtraining', 'resilience'],
  'exercise': ['cardio', 'workout', 'exercise', 'active', 'steps', 'fitness', 'walk', 'run'],
  'work_balance': ['work', 'meeting', 'email', 'after-hours', 'digital', 'calendar', 'focus', 'cognitive'],
  'nutrition': ['diet', 'food', 'glucose', 'meal', 'nutrition', 'eating', 'mediterranean', 'immune'],
};

/**
 * Extract the theme from an insight based on title and message content
 */
export function getInsightTheme(title: string, message: string): string {
  const text = `${title} ${message}`.toLowerCase();
  for (const [theme, keywords] of Object.entries(INSIGHT_THEMES)) {
    if (keywords.some(kw => text.includes(kw))) {
      return theme;
    }
  }
  return 'general';
}

/**
 * Get count of notifications sent today for a user
 */
export async function getDailyNotificationCount(email: string): Promise<number> {
  const supabase = createAdminClient();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from('notification_daily_themes')
    .select('id', { count: 'exact', head: true })
    .eq('email', email)
    .gte('notified_at', todayStart.toISOString());

  if (error) {
    console.error('[OneSignal Service] Error getting daily notification count:', error);
    return 0;
  }

  return count || 0;
}

/**
 * Check if a specific theme was already notified today
 */
export async function wasThemeNotifiedToday(email: string, theme: string): Promise<boolean> {
  const supabase = createAdminClient();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('notification_daily_themes')
    .select('id')
    .eq('email', email)
    .eq('theme', theme)
    .gte('notified_at', todayStart.toISOString())
    .limit(1);

  if (error) {
    console.error('[OneSignal Service] Error checking theme notification:', error);
    return false; // Allow sending if check fails
  }

  return data && data.length > 0;
}

/**
 * Mark a theme as notified for today
 */
export async function markThemeNotified(
  email: string,
  theme: string,
  notificationType: NotificationType = 'insight'
): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from('notification_daily_themes')
    .insert({
      email,
      theme,
      notification_type: notificationType,
      notified_at: new Date().toISOString(),
    });

  if (error) {
    console.error('[OneSignal Service] Error marking theme as notified:', error);
  }
}

/**
 * Check if a notification can be sent based on daily limits and type
 *
 * @param email - User email
 * @param severity - Insight severity (critical always bypasses)
 * @param notificationType - Type of notification
 * @returns Whether the notification can be sent
 */
export async function canSendNotification(
  email: string,
  severity: string,
  notificationType: NotificationType
): Promise<boolean> {
  // Critical alerts always send immediately
  if (severity === 'critical') {
    console.log(`[OneSignal Service] Critical alert for ${email} - bypassing limits`);
    return true;
  }

  // Achievements always send (per user preference)
  if (notificationType === 'achievement') {
    console.log(`[OneSignal Service] Achievement for ${email} - bypassing limits`);
    return true;
  }

  // Check daily count for other notification types
  const dailyCount = await getDailyNotificationCount(email);

  if (dailyCount >= DAILY_NOTIFICATION_LIMIT) {
    console.log(
      `[OneSignal Service] Daily limit reached for ${email}: ${dailyCount}/${DAILY_NOTIFICATION_LIMIT} - skipping`
    );
    return false;
  }

  console.log(
    `[OneSignal Service] Daily count for ${email}: ${dailyCount}/${DAILY_NOTIFICATION_LIMIT} - can send`
  );
  return true;
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
    // Rich content for notification detail screen
    category?: string;
    design_category?: string;
    data_quote?: string;
    recommendation?: string;
    science_explanation?: string;
    action_steps?: string[];
  }
): Promise<number> {
  return sendPushNotification(email, {
    title: insight.title,
    body: insight.message,
    data: {
      insight_id: insight.id,
      insight_type: insight.insight_type,
      severity: insight.severity,
      // Rich content for full-screen detail view
      category: insight.category || insight.insight_type,
      design_category: insight.design_category,
      data_quote: insight.data_quote,
      recommendation: insight.recommendation,
      science_explanation: insight.science_explanation,
      action_steps: insight.action_steps,
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

/**
 * OneSignal Service Class
 *
 * Wrapper class for push notification functionality.
 * Provides a class-based interface for use in services.
 */
export class OneSignalService {
  /**
   * Send a push notification to a user
   */
  static async sendNotification(
    email: string,
    title: string,
    body: string,
    data?: Record<string, string>
  ): Promise<number> {
    return sendPushNotification(email, { title, body, data });
  }

  /**
   * Send an achievement notification
   */
  static async sendAchievementNotification(
    email: string,
    achievement: {
      title: string;
      description: string;
      emoji: string;
      type: string;
    }
  ): Promise<number> {
    return sendPushNotification(email, {
      title: `${achievement.emoji} ${achievement.title}`,
      body: achievement.description,
      data: {
        type: 'achievement',
        achievement_type: achievement.type,
      },
    });
  }

  /**
   * Send a challenge notification
   */
  static async sendChallengeNotification(
    email: string,
    notification: {
      title: string;
      message: string;
      challengeId: string;
      type: 'invite' | 'update' | 'complete' | 'reminder';
    }
  ): Promise<number> {
    return sendPushNotification(email, {
      title: notification.title,
      body: notification.message,
      data: {
        type: 'challenge',
        challenge_id: notification.challengeId,
        notification_type: notification.type,
      },
    });
  }

  /**
   * Send a goal update notification
   */
  static async sendGoalNotification(
    email: string,
    notification: {
      title: string;
      message: string;
      goalId: string;
      type: 'progress' | 'milestone' | 'complete' | 'reminder';
    }
  ): Promise<number> {
    return sendPushNotification(email, {
      title: notification.title,
      body: notification.message,
      data: {
        type: 'goal',
        goal_id: notification.goalId,
        notification_type: notification.type,
      },
    });
  }

  /**
   * Check if notification can be sent (respects daily limits)
   */
  static async canSend(
    email: string,
    severity: string,
    notificationType: NotificationType
  ): Promise<boolean> {
    return canSendNotification(email, severity, notificationType);
  }

  /**
   * Mark a theme as notified for today
   * @deprecated Use NotificationCoordinator.send() instead - it handles theme tracking automatically
   */
  static async markTheme(
    email: string,
    theme: string,
    notificationType: NotificationType = 'insight'
  ): Promise<void> {
    return markThemeNotified(email, theme, notificationType);
  }

  /**
   * Send a coordinated notification through the NotificationCoordinator
   * This is the RECOMMENDED way to send notifications - it handles:
   * - Global rate limiting (6/day max)
   * - Per-service rate limiting
   * - Theme deduplication
   * - Cross-system awareness
   * - Quiet hours
   */
  static async sendCoordinated(
    email: string,
    title: string,
    body: string,
    options: {
      sourceService?: SourceService;
      notificationType?: string;
      theme?: string;
      category?: string;
      severity?: NotificationSeverity;
      data?: Record<string, any>;
      relatedEntityType?: string;
      relatedEntityId?: string;
      bypassLimits?: boolean;
    } = {}
  ): Promise<SendResult> {
    return NotificationCoordinator.send({
      userEmail: email,
      sourceService: options.sourceService || 'insights',
      notificationType: options.notificationType || 'general',
      theme: options.theme || extractTheme(title, body),
      category: options.category,
      severity: options.severity || 'medium',
      title,
      body,
      data: options.data,
      relatedEntityType: options.relatedEntityType,
      relatedEntityId: options.relatedEntityId,
      bypassLimits: options.bypassLimits,
    });
  }
}

// =============================================================================
// COORDINATED NOTIFICATION FUNCTIONS
// =============================================================================

/**
 * Send a coordinated push notification through the NotificationCoordinator
 * This is the RECOMMENDED way to send notifications from any service
 *
 * @param email - User email to send notification to
 * @param payload - Notification content
 * @param options - Coordination options (source, type, theme, severity, etc.)
 * @returns SendResult with success status and suppression info
 */
export async function sendCoordinatedNotification(
  email: string,
  payload: PushNotificationPayload,
  options: {
    sourceService: SourceService;
    notificationType: string;
    theme?: string;
    category?: string;
    severity?: NotificationSeverity;
    relatedEntityType?: string;
    relatedEntityId?: string;
    bypassLimits?: boolean;
  }
): Promise<SendResult> {
  return NotificationCoordinator.send({
    userEmail: email,
    sourceService: options.sourceService,
    notificationType: options.notificationType,
    theme: options.theme || extractTheme(payload.title, payload.body),
    category: options.category,
    severity: options.severity || 'medium',
    title: payload.title,
    body: payload.body,
    data: payload.data,
    relatedEntityType: options.relatedEntityType,
    relatedEntityId: options.relatedEntityId,
    bypassLimits: options.bypassLimits,
  });
}

/**
 * Send a coordinated insight notification
 * Routes through the NotificationCoordinator for proper rate limiting
 */
export async function sendCoordinatedInsightNotification(
  email: string,
  insight: {
    id: string;
    title: string;
    message: string;
    insight_type: string;
    severity: string;
    category?: string;
    data_quote?: string;
    recommendation?: string;
    science_explanation?: string;
    action_steps?: string[];
  }
): Promise<SendResult> {
  // Map severity to NotificationSeverity type
  const severityMap: Record<string, NotificationSeverity> = {
    critical: 'critical',
    high: 'high',
    medium: 'medium',
    low: 'low',
    info: 'low',
  };

  return NotificationCoordinator.send({
    userEmail: email,
    sourceService: 'insights',
    notificationType: insight.insight_type,
    theme: extractTheme(insight.title, insight.message),
    category: insight.category || insight.insight_type.toUpperCase(),
    severity: severityMap[insight.severity] || 'medium',
    title: insight.title,
    body: insight.message,
    data: {
      insight_id: insight.id,
      insight_type: insight.insight_type,
      severity: insight.severity,
      category: insight.category || insight.insight_type,
      data_quote: insight.data_quote,
      recommendation: insight.recommendation,
      science_explanation: insight.science_explanation,
      action_steps: insight.action_steps,
    },
    relatedEntityType: 'insight',
    relatedEntityId: insight.id,
    bypassLimits: insight.severity === 'critical',
  });
}
