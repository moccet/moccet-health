/**
 * Notification Coordinator Service
 *
 * Centralized notification orchestrator that all notification services must use.
 * Provides:
 * - Single unified database table for ALL notifications
 * - Cross-system awareness and deduplication
 * - Global rate limiting
 * - Context tracking for intelligent notification decisions
 *
 * @module lib/services/notification-coordinator
 */

import { createAdminClient } from '@/lib/supabase/server';
import { sendPushNotification, PushNotificationPayload } from './onesignal-service';

// =============================================================================
// TYPES
// =============================================================================

export type SourceService =
  | 'proactive_engagement'
  | 'streak_alerts'
  | 'achievements'
  | 'insights'
  | 'sage_reminders'
  | 'daily_digest';

export type NotificationSeverity = 'critical' | 'high' | 'medium' | 'low';

export type NotificationChannel = 'push' | 'email' | 'sms' | 'in_app';

export type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'suppressed';

export interface NotificationRequest {
  userEmail: string;
  sourceService: SourceService;
  notificationType: string;
  category?: string;
  theme?: string;
  severity: NotificationSeverity;
  title: string;
  body: string;
  data?: Record<string, any>;
  channel?: NotificationChannel;
  relatedEntityType?: string;
  relatedEntityId?: string;
  bypassLimits?: boolean; // Only for truly critical alerts
}

export interface SendResult {
  success: boolean;
  notificationId?: string;
  suppressed?: boolean;
  suppressionReason?: string;
}

export interface NotificationRecord {
  id: string;
  sourceService: string;
  notificationType: string;
  category: string | null;
  theme: string | null;
  severity: string;
  title: string;
  createdAt: Date;
  sentAt: Date | null;
}

export interface CanSendResult {
  allowed: boolean;
  reason?: string;
}

// =============================================================================
// RATE LIMITS
// =============================================================================

// Global daily limit across ALL services
const GLOBAL_DAILY_LIMIT = 6;

// Per-service daily limits
const SERVICE_LIMITS: Record<SourceService, number> = {
  proactive_engagement: 2,
  streak_alerts: 2,
  achievements: 2,
  insights: 3,
  sage_reminders: 1,
  daily_digest: 1,
};

// Category saturation limit (max notifications per category per day)
const CATEGORY_LIMIT = 2;

// Quiet hours (11pm - 7am) - skip medium/low severity during this time
const QUIET_HOURS_START = 23; // 11 PM
const QUIET_HOURS_END = 7; // 7 AM

// =============================================================================
// NOTIFICATION COORDINATOR CLASS
// =============================================================================

class NotificationCoordinatorClass {
  private supabase = createAdminClient();

  // ==========================================================================
  // MAIN ENTRY POINT - ALL NOTIFICATIONS GO THROUGH HERE
  // ==========================================================================

  /**
   * Send a notification through the coordinator
   * This is the ONLY way notifications should be sent
   */
  async send(request: NotificationRequest): Promise<SendResult> {
    const {
      userEmail,
      sourceService,
      notificationType,
      category,
      theme,
      severity,
      title,
      body,
      data = {},
      channel = 'push',
      relatedEntityType,
      relatedEntityId,
      bypassLimits = false,
    } = request;

    console.log(`[NotificationCoordinator] Processing notification for ${userEmail}:`, {
      sourceService,
      notificationType,
      theme,
      severity,
      bypassLimits,
    });

    // Step 1: Record the notification attempt (pending)
    let notificationId: string | undefined;
    try {
      const { data: recordResult } = await this.supabase.rpc('record_notification', {
        p_email: userEmail,
        p_source_service: sourceService,
        p_notification_type: notificationType,
        p_title: title,
        p_body: body,
        p_category: category || null,
        p_theme: theme || null,
        p_severity: severity,
        p_data: data,
        p_channel: channel,
        p_related_entity_type: relatedEntityType || null,
        p_related_entity_id: relatedEntityId || null,
      });
      notificationId = recordResult as string;
    } catch (err) {
      console.error('[NotificationCoordinator] Error recording notification:', err);
    }

    // Step 2: Check if we can send (unless bypassing limits)
    if (!bypassLimits) {
      const canSendResult = await this.canSend({
        userEmail,
        sourceService,
        theme,
        category,
        severity,
        relatedEntityType,
        relatedEntityId,
      });

      if (!canSendResult.allowed) {
        console.log(`[NotificationCoordinator] Suppressing notification: ${canSendResult.reason}`);

        // Update status to suppressed
        if (notificationId) {
          await this.supabase.rpc('update_notification_status', {
            p_notification_id: notificationId,
            p_status: 'suppressed',
            p_suppression_reason: canSendResult.reason,
          });
        }

        return {
          success: false,
          notificationId,
          suppressed: true,
          suppressionReason: canSendResult.reason,
        };
      }
    } else {
      console.log(`[NotificationCoordinator] Bypassing limits for ${severity} notification`);
    }

    // Step 3: Dispatch the notification based on channel
    let sendSuccess = false;
    try {
      if (channel === 'push') {
        const payload: PushNotificationPayload = {
          title,
          body,
          data: {
            ...Object.fromEntries(
              Object.entries(data).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)])
            ),
            notification_id: notificationId || '',
            source_service: sourceService,
            notification_type: notificationType,
          },
        };

        const sentCount = await sendPushNotification(userEmail, payload);
        sendSuccess = sentCount > 0;
      }
      // Future: handle email, sms, in_app channels
    } catch (err) {
      console.error('[NotificationCoordinator] Error dispatching notification:', err);
    }

    // Step 4: Update status based on result
    if (notificationId) {
      await this.supabase.rpc('update_notification_status', {
        p_notification_id: notificationId,
        p_status: sendSuccess ? 'sent' : 'failed',
        p_suppression_reason: null,
      });
    }

    console.log(`[NotificationCoordinator] Notification ${sendSuccess ? 'sent' : 'failed'} to ${userEmail}`);

    return {
      success: sendSuccess,
      notificationId,
      suppressed: false,
    };
  }

  // ==========================================================================
  // PRE-FLIGHT CHECK
  // ==========================================================================

  /**
   * Check if we can send a notification (for pre-flight checks)
   */
  async canSend(request: Partial<NotificationRequest>): Promise<CanSendResult> {
    const {
      userEmail,
      sourceService,
      theme,
      category,
      severity = 'medium',
      relatedEntityType,
      relatedEntityId,
    } = request;

    if (!userEmail) {
      return { allowed: false, reason: 'No user email provided' };
    }

    // Critical severity bypasses all checks except quiet hours for truly urgent matters
    const isCritical = severity === 'critical';

    // Step 1: Check quiet hours (skip for critical)
    if (!isCritical && (severity === 'medium' || severity === 'low')) {
      const hour = new Date().getHours();
      if (hour >= QUIET_HOURS_START || hour < QUIET_HOURS_END) {
        return { allowed: false, reason: 'quiet_hours' };
      }
    }

    // Step 2: Check global daily limit
    const { data: globalCount } = await this.supabase.rpc('count_notifications_today', {
      p_email: userEmail,
      p_source: null,
    });

    if ((globalCount as number) >= GLOBAL_DAILY_LIMIT && !isCritical) {
      return { allowed: false, reason: `global_daily_limit_reached (${globalCount}/${GLOBAL_DAILY_LIMIT})` };
    }

    // Step 3: Check service-specific limit
    if (sourceService) {
      const serviceLimit = SERVICE_LIMITS[sourceService] || 2;
      const { data: serviceCount } = await this.supabase.rpc('count_notifications_today', {
        p_email: userEmail,
        p_source: sourceService,
      });

      if ((serviceCount as number) >= serviceLimit && !isCritical) {
        return { allowed: false, reason: `service_limit_reached (${serviceCount}/${serviceLimit} for ${sourceService})` };
      }
    }

    // Step 4: Check theme deduplication
    if (theme) {
      const { data: themeExists } = await this.supabase.rpc('was_theme_sent_today', {
        p_email: userEmail,
        p_theme: theme,
      });

      if (themeExists && !isCritical) {
        return { allowed: false, reason: `theme_already_sent (${theme})` };
      }
    }

    // Step 5: Check category saturation
    if (category) {
      const { data: categoryCount } = await this.supabase.rpc('count_category_today', {
        p_email: userEmail,
        p_category: category,
      });

      if ((categoryCount as number) >= CATEGORY_LIMIT && !isCritical) {
        return { allowed: false, reason: `category_saturation (${categoryCount}/${CATEGORY_LIMIT} for ${category})` };
      }
    }

    // Step 6: Check related entity (prevent duplicate notifications for same entity)
    if (relatedEntityType && relatedEntityId) {
      const { data: entityNotified } = await this.supabase.rpc('was_entity_notified_today', {
        p_email: userEmail,
        p_entity_type: relatedEntityType,
        p_entity_id: relatedEntityId,
      });

      if (entityNotified && !isCritical) {
        return { allowed: false, reason: `entity_already_notified (${relatedEntityType}:${relatedEntityId})` };
      }
    }

    // Step 7: Cross-system conflict check
    const crossSystemConflict = await this.checkCrossSystemConflicts(request);
    if (crossSystemConflict && !isCritical) {
      return { allowed: false, reason: crossSystemConflict };
    }

    return { allowed: true };
  }

  // ==========================================================================
  // CROSS-SYSTEM AWARENESS
  // ==========================================================================

  /**
   * Check for cross-system conflicts that might warrant suppression
   */
  private async checkCrossSystemConflicts(
    request: Partial<NotificationRequest>
  ): Promise<string | null> {
    const { userEmail, theme, relatedEntityId } = request;
    if (!userEmail) return null;

    // Get today's notification history
    const today = await this.getTodayHistory(userEmail);

    // Check for theme overlap from different services
    if (theme) {
      const sameThemeFromOtherService = today.find(
        n => n.theme === theme && n.sourceService !== request.sourceService
      );
      if (sameThemeFromOtherService) {
        return `cross_system_theme_conflict: Theme '${theme}' already notified by ${sameThemeFromOtherService.sourceService}`;
      }
    }

    // Check for related content (e.g., don't send achievement + streak for same thing)
    if (relatedEntityId) {
      const relatedNotification = today.find(
        n =>
          n.sourceService !== request.sourceService &&
          // Check if any notification data contains this entity ID
          (n as any).related_entity_id === relatedEntityId
      );
      if (relatedNotification) {
        return `cross_system_entity_conflict: Already notified about entity ${relatedEntityId}`;
      }
    }

    return null;
  }

  // ==========================================================================
  // HISTORY & QUERIES
  // ==========================================================================

  /**
   * Get today's notification history for a user
   */
  async getTodayHistory(userEmail: string): Promise<NotificationRecord[]> {
    const { data, error } = await this.supabase.rpc('get_notifications_today', {
      p_email: userEmail,
    });

    if (error) {
      console.error('[NotificationCoordinator] Error getting today history:', error);
      return [];
    }

    return ((data as any[]) || []).map(this.mapNotificationRecord);
  }

  /**
   * Get notification history for context-aware decisions
   */
  async getNotificationHistory(
    userEmail: string,
    days: number = 7,
    theme?: string
  ): Promise<NotificationRecord[]> {
    const { data, error } = await this.supabase.rpc('get_notification_history', {
      p_email: userEmail,
      p_days: days,
      p_theme: theme || null,
    });

    if (error) {
      console.error('[NotificationCoordinator] Error getting notification history:', error);
      return [];
    }

    return ((data as any[]) || []).map(this.mapNotificationRecord);
  }

  /**
   * Get the count of notifications sent today
   */
  async getTodayCount(userEmail: string, sourceService?: SourceService): Promise<number> {
    const { data, error } = await this.supabase.rpc('count_notifications_today', {
      p_email: userEmail,
      p_source: sourceService || null,
    });

    if (error) {
      console.error('[NotificationCoordinator] Error getting today count:', error);
      return 0;
    }

    return (data as number) || 0;
  }

  /**
   * Check if a theme was already sent today
   */
  async wasThemeSentToday(userEmail: string, theme: string): Promise<boolean> {
    const { data, error } = await this.supabase.rpc('was_theme_sent_today', {
      p_email: userEmail,
      p_theme: theme,
    });

    if (error) {
      console.error('[NotificationCoordinator] Error checking theme:', error);
      return false;
    }

    return !!data;
  }

  /**
   * Suppress a pending notification
   */
  async suppress(notificationId: string, reason: string): Promise<void> {
    await this.supabase.rpc('update_notification_status', {
      p_notification_id: notificationId,
      p_status: 'suppressed',
      p_suppression_reason: reason,
    });
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private mapNotificationRecord(row: any): NotificationRecord {
    return {
      id: row.id,
      sourceService: row.source_service,
      notificationType: row.notification_type,
      category: row.category,
      theme: row.theme,
      severity: row.severity,
      title: row.title,
      createdAt: new Date(row.created_at),
      sentAt: row.sent_at ? new Date(row.sent_at) : null,
    };
  }

  // ==========================================================================
  // STATIC INSTANCE
  // ==========================================================================

  private static instance: NotificationCoordinatorClass;

  static getInstance(): NotificationCoordinatorClass {
    if (!NotificationCoordinatorClass.instance) {
      NotificationCoordinatorClass.instance = new NotificationCoordinatorClass();
    }
    return NotificationCoordinatorClass.instance;
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export const NotificationCoordinator = NotificationCoordinatorClass.getInstance();

// Convenience functions for direct use
export async function sendNotification(request: NotificationRequest): Promise<SendResult> {
  return NotificationCoordinator.send(request);
}

export async function canSendNotification(
  request: Partial<NotificationRequest>
): Promise<CanSendResult> {
  return NotificationCoordinator.canSend(request);
}

export async function getNotificationHistory(
  userEmail: string,
  days?: number,
  theme?: string
): Promise<NotificationRecord[]> {
  return NotificationCoordinator.getNotificationHistory(userEmail, days, theme);
}

export async function getTodayNotificationCount(
  userEmail: string,
  sourceService?: SourceService
): Promise<number> {
  return NotificationCoordinator.getTodayCount(userEmail, sourceService);
}

// =============================================================================
// THEME EXTRACTION HELPER
// =============================================================================

/**
 * Extract theme from notification content for deduplication
 * Maps content to predefined themes for consistent dedup
 */
export function extractTheme(title: string, body: string): string {
  const text = `${title} ${body}`.toLowerCase();

  const THEME_KEYWORDS: Record<string, string[]> = {
    sleep: ['sleep', 'bed', 'rest', 'circadian', 'night', 'wake', 'morning', 'insomnia'],
    recovery: ['recovery', 'hrv', 'strain', 'fatigue', 'overtraining', 'resilience', 'readiness'],
    exercise: ['cardio', 'workout', 'exercise', 'active', 'steps', 'fitness', 'walk', 'run', 'gym'],
    nutrition: ['diet', 'food', 'glucose', 'meal', 'nutrition', 'eating', 'mediterranean', 'immune', 'vitamin'],
    stress: ['stress', 'anxiety', 'cortisol', 'overwhelm', 'burnout', 'pressure'],
    work: ['work', 'meeting', 'email', 'after-hours', 'digital', 'calendar', 'focus', 'cognitive', 'task'],
    social: ['social', 'connection', 'collaboration', 'friend', 'colleague', 'community', 'together'],
    music: ['spotify', 'music', 'playlist', 'listening', 'song', 'track', 'rhythm', 'audio', 'melody'],
    achievement: ['achievement', 'milestone', 'badge', 'earned', 'unlocked', 'accomplished'],
    streak: ['streak', 'consecutive', 'days in a row', 'consistency'],
    goal: ['goal', 'target', 'objective', 'progress'],
  };

  for (const [theme, keywords] of Object.entries(THEME_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) {
      return theme;
    }
  }

  return 'general';
}

/**
 * Map urgency levels to severity
 */
export function urgencyToSeverity(urgency: string): NotificationSeverity {
  switch (urgency) {
    case 'critical':
      return 'critical';
    case 'high':
      return 'high';
    case 'medium':
      return 'medium';
    case 'low':
    default:
      return 'low';
  }
}
