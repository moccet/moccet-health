/**
 * Streak Alert Service
 * Monitors user streaks and sends proactive alerts to protect them.
 * Helps users maintain their habits through timely reminders.
 *
 * NOTE: This service uses the NotificationCoordinator for sending alerts,
 * which handles global rate limiting and cross-system deduplication.
 */

import { createClient } from '@supabase/supabase-js';
import {
  NotificationCoordinator,
  urgencyToSeverity,
  NotificationSeverity,
} from './notification-coordinator';

// =============================================================================
// TYPES
// =============================================================================

export type StreakType =
  | 'sleep_logging'
  | 'activity'
  | 'meal_logging'
  | 'hydration'
  | 'check_in'
  | 'meditation'
  | 'weight_logging'
  | 'glucose_logging';

export type AlertUrgency = 'low' | 'medium' | 'high' | 'critical';

export interface StreakStatus {
  type: StreakType;
  displayName: string;
  currentDays: number;
  personalBest: number;
  lastActivityDate: string | null;
  isAtRisk: boolean;
  hoursUntilBroken: number;
  nextMilestone: number;
  daysToMilestone: number;
}

export interface StreakAlert {
  id: string;
  userEmail: string;
  streakType: StreakType;
  alertType: 'at_risk' | 'milestone_approaching' | 'milestone_achieved' | 'broken' | 'recovered';
  urgency: AlertUrgency;
  title: string;
  message: string;
  currentDays: number;
  actionUrl?: string;
  scheduledFor: Date;
  sentAt?: Date;
  engagedAt?: Date;
}

export interface AlertPreferences {
  userEmail: string;
  enableStreakAlerts: boolean;
  preferredAlertHour: number;      // 0-23
  minStreakDaysForAlert: number;   // Don't alert for streaks under N days
  alertBuffer: number;             // Hours before midnight to alert
  enableMilestoneAlerts: boolean;
  enableRecoveryAlerts: boolean;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const STREAK_DISPLAY_NAMES: Record<StreakType, string> = {
  sleep_logging: 'Sleep Logging',
  activity: 'Daily Activity',
  meal_logging: 'Meal Logging',
  hydration: 'Hydration',
  check_in: 'Daily Check-in',
  meditation: 'Meditation',
  weight_logging: 'Weight Logging',
  glucose_logging: 'Glucose Logging',
};

const MILESTONES = [3, 7, 14, 21, 30, 60, 90, 180, 365];

const DEFAULT_PREFERENCES: Omit<AlertPreferences, 'userEmail'> = {
  enableStreakAlerts: true,
  preferredAlertHour: 18,          // 6 PM
  minStreakDaysForAlert: 3,        // Only alert for 3+ day streaks
  alertBuffer: 4,                  // Alert 4 hours before midnight
  enableMilestoneAlerts: true,
  enableRecoveryAlerts: true,
};

// =============================================================================
// STREAK CHECKING
// =============================================================================

/**
 * Get all streaks for a user with their current status
 */
export async function getUserStreakStatus(
  userEmail: string,
  supabase: ReturnType<typeof createClient>
): Promise<StreakStatus[]> {
  const { data: streaks } = await supabase
    .from('user_streaks')
    .select('*')
    .eq('user_email', userEmail);

  const streakList = (streaks as any[]) || [];
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  return streakList.map(streak => {
    const lastActivity = streak.last_activity_date
      ? new Date(streak.last_activity_date)
      : null;

    let isAtRisk = false;
    let hoursUntilBroken = 24;

    if (lastActivity) {
      lastActivity.setHours(0, 0, 0, 0);
      const daysSinceActivity = Math.floor(
        (today.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24)
      );

      // At risk if last activity was yesterday
      isAtRisk = daysSinceActivity === 1;

      // Calculate hours until streak breaks (end of today)
      if (isAtRisk) {
        const endOfDay = new Date(today);
        endOfDay.setHours(23, 59, 59, 999);
        hoursUntilBroken = Math.max(
          0,
          Math.floor((endOfDay.getTime() - now.getTime()) / (1000 * 60 * 60))
        );
      }
    }

    // Find next milestone
    const currentDays = streak.current_days || 0;
    let nextMilestone = MILESTONES.find(m => m > currentDays) || 365;
    if (currentDays >= 365) {
      nextMilestone = Math.ceil((currentDays + 1) / 365) * 365;
    }

    return {
      type: streak.streak_type as StreakType,
      displayName: STREAK_DISPLAY_NAMES[streak.streak_type as StreakType] || streak.streak_type,
      currentDays,
      personalBest: streak.personal_best || 0,
      lastActivityDate: streak.last_activity_date,
      isAtRisk,
      hoursUntilBroken,
      nextMilestone,
      daysToMilestone: nextMilestone - currentDays,
    };
  });
}

/**
 * Get only at-risk streaks for a user
 */
export async function getAtRiskStreaks(
  userEmail: string,
  supabase: ReturnType<typeof createClient>
): Promise<StreakStatus[]> {
  const allStreaks = await getUserStreakStatus(userEmail, supabase);
  return allStreaks.filter(s => s.isAtRisk && s.currentDays >= 3);
}

// =============================================================================
// ALERT GENERATION
// =============================================================================

/**
 * Generate streak protection alerts for a user
 */
export async function generateStreakAlerts(
  userEmail: string,
  supabase: ReturnType<typeof createClient>
): Promise<StreakAlert[]> {
  const alerts: StreakAlert[] = [];

  // Get user preferences
  const preferences = await getAlertPreferences(userEmail, supabase);
  if (!preferences.enableStreakAlerts) {
    return [];
  }

  // Get streak status
  const streaks = await getUserStreakStatus(userEmail, supabase);

  // Get user's timezone (default to UTC)
  const { data: profile } = await supabase
    .from('sage_onboarding_data')
    .select('form_data')
    .eq('email', userEmail)
    .maybeSingle();

  const timezone = (profile as any)?.form_data?.timezone || 'UTC';

  const now = new Date();

  for (const streak of streaks) {
    // Skip low streaks
    if (streak.currentDays < preferences.minStreakDaysForAlert) {
      continue;
    }

    // At-risk alerts
    if (streak.isAtRisk) {
      const urgency = getUrgency(streak.hoursUntilBroken, streak.currentDays);
      const alert = createAtRiskAlert(userEmail, streak, urgency);
      alerts.push(alert);
    }

    // Milestone approaching (1 day away)
    if (preferences.enableMilestoneAlerts && streak.daysToMilestone === 1 && !streak.isAtRisk) {
      const alert = createMilestoneApproachingAlert(userEmail, streak);
      alerts.push(alert);
    }
  }

  return alerts;
}

function getUrgency(hoursUntilBroken: number, streakDays: number): AlertUrgency {
  // Critical if long streak and very little time left
  if (streakDays >= 30 && hoursUntilBroken <= 2) return 'critical';
  if (streakDays >= 14 && hoursUntilBroken <= 4) return 'critical';

  // High urgency for significant streaks at risk
  if (streakDays >= 7 && hoursUntilBroken <= 4) return 'high';
  if (streakDays >= 14) return 'high';

  // Medium for moderate streaks
  if (streakDays >= 7) return 'medium';

  return 'low';
}

function createAtRiskAlert(
  userEmail: string,
  streak: StreakStatus,
  urgency: AlertUrgency
): StreakAlert {
  const timeLeft = streak.hoursUntilBroken > 1
    ? `${streak.hoursUntilBroken} hours`
    : 'less than an hour';

  let title: string;
  let message: string;

  switch (urgency) {
    case 'critical':
      title = `${streak.currentDays}-day streak at risk!`;
      message = `Your ${streak.displayName} streak is about to break! Only ${timeLeft} left. Don't lose ${streak.currentDays} days of progress!`;
      break;
    case 'high':
      title = `Protect your ${streak.currentDays}-day streak`;
      message = `Your ${streak.displayName} streak needs attention. ${timeLeft} remaining today.`;
      break;
    case 'medium':
      title = `Don't forget your ${streak.displayName}`;
      message = `Keep your ${streak.currentDays}-day streak alive. Log your activity before midnight!`;
      break;
    default:
      title = `${streak.displayName} reminder`;
      message = `You haven't logged today. Keep your ${streak.currentDays}-day streak going!`;
  }

  return {
    id: crypto.randomUUID(),
    userEmail,
    streakType: streak.type,
    alertType: 'at_risk',
    urgency,
    title,
    message,
    currentDays: streak.currentDays,
    scheduledFor: new Date(),
  };
}

function createMilestoneApproachingAlert(
  userEmail: string,
  streak: StreakStatus
): StreakAlert {
  return {
    id: crypto.randomUUID(),
    userEmail,
    streakType: streak.type,
    alertType: 'milestone_approaching',
    urgency: 'medium',
    title: `Almost at ${streak.nextMilestone} days!`,
    message: `One more day and you'll hit a ${streak.nextMilestone}-day ${streak.displayName} streak! You're doing great!`,
    currentDays: streak.currentDays,
    scheduledFor: new Date(),
  };
}

/**
 * Create a milestone achieved alert
 */
export function createMilestoneAchievedAlert(
  userEmail: string,
  streakType: StreakType,
  milestone: number
): StreakAlert {
  const displayName = STREAK_DISPLAY_NAMES[streakType];

  let title: string;
  let message: string;

  if (milestone >= 365) {
    title = `${milestone}-day streak achieved!`;
    message = `Incredible! You've maintained your ${displayName} streak for ${milestone} days. That's over a year of consistency!`;
  } else if (milestone >= 90) {
    title = `${milestone}-day milestone reached!`;
    message = `Amazing commitment! ${milestone} days of consistent ${displayName}. You're in the top tier!`;
  } else if (milestone >= 30) {
    title = `${milestone} days strong!`;
    message = `Congratulations! A ${milestone}-day ${displayName} streak shows real dedication.`;
  } else {
    title = `${milestone}-day streak!`;
    message = `Great job! You've hit ${milestone} days of ${displayName}. Keep it up!`;
  }

  return {
    id: crypto.randomUUID(),
    userEmail,
    streakType,
    alertType: 'milestone_achieved',
    urgency: 'low',
    title,
    message,
    currentDays: milestone,
    scheduledFor: new Date(),
  };
}

/**
 * Create a streak broken alert
 */
export function createStreakBrokenAlert(
  userEmail: string,
  streakType: StreakType,
  lostDays: number
): StreakAlert {
  const displayName = STREAK_DISPLAY_NAMES[streakType];

  let message: string;
  if (lostDays >= 30) {
    message = `Your ${lostDays}-day ${displayName} streak has ended. It happens to everyone! Ready to start fresh?`;
  } else {
    message = `Your ${displayName} streak has reset. Don't worry - every journey has bumps. Let's start again!`;
  }

  return {
    id: crypto.randomUUID(),
    userEmail,
    streakType,
    alertType: 'broken',
    urgency: 'low',
    title: `${displayName} streak reset`,
    message,
    currentDays: 0,
    scheduledFor: new Date(),
  };
}

// =============================================================================
// PREFERENCE MANAGEMENT
// =============================================================================

/**
 * Get alert preferences for a user
 */
export async function getAlertPreferences(
  userEmail: string,
  supabase: ReturnType<typeof createClient>
): Promise<AlertPreferences> {
  const { data } = await supabase
    .from('user_notification_preferences')
    .select('*')
    .eq('user_email', userEmail)
    .maybeSingle();

  if (!data) {
    return { userEmail, ...DEFAULT_PREFERENCES };
  }

  const prefs = data as any;
  return {
    userEmail,
    enableStreakAlerts: prefs.enable_streak_alerts ?? DEFAULT_PREFERENCES.enableStreakAlerts,
    preferredAlertHour: prefs.preferred_alert_hour ?? DEFAULT_PREFERENCES.preferredAlertHour,
    minStreakDaysForAlert: prefs.min_streak_days_for_alert ?? DEFAULT_PREFERENCES.minStreakDaysForAlert,
    alertBuffer: prefs.alert_buffer ?? DEFAULT_PREFERENCES.alertBuffer,
    enableMilestoneAlerts: prefs.enable_milestone_alerts ?? DEFAULT_PREFERENCES.enableMilestoneAlerts,
    enableRecoveryAlerts: prefs.enable_recovery_alerts ?? DEFAULT_PREFERENCES.enableRecoveryAlerts,
  };
}

/**
 * Update alert preferences for a user
 */
export async function updateAlertPreferences(
  userEmail: string,
  preferences: Partial<Omit<AlertPreferences, 'userEmail'>>,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  const updates: Record<string, any> = {};

  if (preferences.enableStreakAlerts !== undefined) {
    updates.enable_streak_alerts = preferences.enableStreakAlerts;
  }
  if (preferences.preferredAlertHour !== undefined) {
    updates.preferred_alert_hour = preferences.preferredAlertHour;
  }
  if (preferences.minStreakDaysForAlert !== undefined) {
    updates.min_streak_days_for_alert = preferences.minStreakDaysForAlert;
  }
  if (preferences.alertBuffer !== undefined) {
    updates.alert_buffer = preferences.alertBuffer;
  }
  if (preferences.enableMilestoneAlerts !== undefined) {
    updates.enable_milestone_alerts = preferences.enableMilestoneAlerts;
  }
  if (preferences.enableRecoveryAlerts !== undefined) {
    updates.enable_recovery_alerts = preferences.enableRecoveryAlerts;
  }

  await (supabase.from('user_notification_preferences') as any)
    .upsert({
      user_email: userEmail,
      ...updates,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_email',
    });
}

// =============================================================================
// BATCH PROCESSING (for cron jobs)
// =============================================================================

/**
 * Process all users for streak alerts (called by cron)
 *
 * NOTE: This function now uses the NotificationCoordinator for sending alerts.
 * The sendNotification callback is deprecated but kept for backward compatibility.
 * The coordinator handles all rate limiting and cross-system deduplication.
 */
export async function processAllStreakAlerts(
  supabase: ReturnType<typeof createClient>,
  sendNotification?: (alert: StreakAlert) => Promise<void>
): Promise<{ processed: number; alertsSent: number }> {
  // Get all users with active streaks
  const { data: activeUsers } = await supabase
    .from('user_streaks')
    .select('user_email')
    .gte('current_days', 3);

  if (!activeUsers) {
    return { processed: 0, alertsSent: 0 };
  }

  const userEmails = [...new Set((activeUsers as any[]).map(u => u.user_email))];
  let alertsSent = 0;

  for (const email of userEmails) {
    const alerts = await generateStreakAlerts(email, supabase);

    for (const alert of alerts) {
      try {
        // Send through NotificationCoordinator - it handles rate limiting, dedup, etc.
        const result = await NotificationCoordinator.send({
          userEmail: alert.userEmail,
          sourceService: 'streak_alerts',
          notificationType: alert.alertType,
          theme: `streak_${alert.streakType}`,
          category: 'ACTIVITY',
          severity: urgencyToSeverity(alert.urgency) as NotificationSeverity,
          title: alert.title,
          body: alert.message,
          data: {
            streak_type: alert.streakType,
            current_days: alert.currentDays,
            alert_type: alert.alertType,
            urgency: alert.urgency,
          },
          relatedEntityType: 'streak',
          relatedEntityId: `${alert.userEmail}_${alert.streakType}`,
          bypassLimits: alert.urgency === 'critical', // Critical alerts bypass limits
        });

        if (result.success) {
          alertsSent++;

          // Record that alert was sent (for backward compatibility)
          await (supabase.from('streak_alerts_log') as any).insert({
            id: alert.id,
            user_email: alert.userEmail,
            streak_type: alert.streakType,
            alert_type: alert.alertType,
            urgency: alert.urgency,
            sent_at: new Date().toISOString(),
          });
        } else if (result.suppressed) {
          console.log(`[StreakAlerts] Alert suppressed for ${email}: ${result.suppressionReason}`);
        }
      } catch (error) {
        console.error(`[StreakAlerts] Failed to send alert to ${email}:`, error);
      }
    }
  }

  return { processed: userEmails.length, alertsSent };
}

/**
 * Send a single streak alert through the coordinator
 * Use this for ad-hoc alert sending outside of batch processing
 */
export async function sendStreakAlert(alert: StreakAlert): Promise<boolean> {
  const result = await NotificationCoordinator.send({
    userEmail: alert.userEmail,
    sourceService: 'streak_alerts',
    notificationType: alert.alertType,
    theme: `streak_${alert.streakType}`,
    category: 'ACTIVITY',
    severity: urgencyToSeverity(alert.urgency) as NotificationSeverity,
    title: alert.title,
    body: alert.message,
    data: {
      streak_type: alert.streakType,
      current_days: alert.currentDays,
      alert_type: alert.alertType,
      urgency: alert.urgency,
    },
    relatedEntityType: 'streak',
    relatedEntityId: `${alert.userEmail}_${alert.streakType}`,
    bypassLimits: alert.urgency === 'critical',
  });

  return result.success;
}

// =============================================================================
// FORMATTING FOR AGENT
// =============================================================================

/**
 * Format at-risk streaks for inclusion in agent context
 */
export function formatStreakAlertsForAgent(atRiskStreaks: StreakStatus[]): string {
  if (atRiskStreaks.length === 0) {
    return '';
  }

  const lines: string[] = ['## At-Risk Streaks\n'];
  lines.push('The following streaks need attention today:\n');

  for (const streak of atRiskStreaks) {
    const urgencyIcon = streak.hoursUntilBroken <= 4 ? '🔴' :
      streak.hoursUntilBroken <= 8 ? '🟡' : '🟢';

    lines.push(`${urgencyIcon} **${streak.displayName}**: ${streak.currentDays} days (${streak.hoursUntilBroken}h left)`);

    if (streak.currentDays >= streak.personalBest) {
      lines.push(`  → This is their personal best!`);
    }

    if (streak.daysToMilestone <= 3) {
      lines.push(`  → Only ${streak.daysToMilestone} days to ${streak.nextMilestone}-day milestone`);
    }
  }

  lines.push('\n**Suggestion**: Proactively remind the user about at-risk streaks if appropriate to the conversation.');

  return lines.join('\n');
}

/**
 * Get a quick summary for limited context
 */
export function getStreakAlertSummary(atRiskStreaks: StreakStatus[]): string {
  if (atRiskStreaks.length === 0) {
    return 'No streaks at risk';
  }

  const critical = atRiskStreaks.filter(s => s.hoursUntilBroken <= 4);
  const warning = atRiskStreaks.filter(s => s.hoursUntilBroken > 4);

  const parts: string[] = [];

  if (critical.length > 0) {
    parts.push(`🔴 ${critical.length} critical`);
  }
  if (warning.length > 0) {
    parts.push(`🟡 ${warning.length} at risk`);
  }

  return parts.join(', ');
}
