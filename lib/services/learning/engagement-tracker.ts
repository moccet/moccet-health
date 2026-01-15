/**
 * Engagement Tracker Service
 * Tracks user engagement with notifications, learns optimal send times,
 * and provides insights for personalized communication
 */

import { createClient } from '@supabase/supabase-js';

// =============================================================================
// TYPES
// =============================================================================

export type NotificationType =
  | 'daily_briefing'
  | 'streak_reminder'
  | 'streak_at_risk'
  | 'goal_reminder'
  | 'health_insight'
  | 'intervention_checkin'
  | 'social_activity'
  | 'achievement'
  | 'proactive_tip'
  | 'schedule_alert';

export type ActionType = 'opened' | 'dismissed' | 'acted' | 'ignored';

export interface NotificationEvent {
  notificationId: string;
  notificationType: NotificationType;
  userEmail: string;
  sentAt: Date;
  openedAt?: Date;
  action?: ActionType;
  metadata?: Record<string, any>;
}

export interface NotificationEngagement {
  type: NotificationType;
  sentCount: number;
  openRate: number;                    // 0-1
  actionRate: number;                  // 0-1 (subset of opens that led to action)
  avgTimeToOpenMinutes: number | null;
  bestSendHour: number | null;         // 0-23
  bestSendDayOfWeek: number | null;    // 0-6 (Sunday = 0)
  engagementTrend: 'improving' | 'stable' | 'declining';
}

export interface UserEngagementProfile {
  userEmail: string;
  overallOpenRate: number;
  preferredHours: number[];            // Top 3 hours
  preferredDays: number[];             // Top 3 days
  highEngagementTypes: NotificationType[];
  lowEngagementTypes: NotificationType[];
  optimalNotificationsPerDay: number;
  lastEngagementAt: string | null;
  engagementByType: Map<NotificationType, NotificationEngagement>;
}

export interface OptimalSendTime {
  hour: number;
  dayOfWeek: number;
  confidence: number;                  // 0-1
  reason: string;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

const DEFAULT_SEND_HOURS: Record<NotificationType, number> = {
  daily_briefing: 7,           // Morning
  streak_reminder: 20,         // Evening
  streak_at_risk: 18,          // Late afternoon
  goal_reminder: 9,            // Morning work hours
  health_insight: 12,          // Lunch time
  intervention_checkin: 19,    // Evening
  social_activity: 10,         // Mid-morning
  achievement: 14,             // Afternoon
  proactive_tip: 11,           // Late morning
  schedule_alert: 8,           // Before work
};

const MIN_DATA_POINTS_FOR_LEARNING = 5;
const LOOKBACK_DAYS = 30;

// =============================================================================
// DATABASE TYPES
// =============================================================================

// Type for notification_engagement table rows
interface NotificationEngagementRow {
  id: string;
  user_email: string;
  notification_id: string;
  notification_type: string;
  sent_at: string;
  opened_at?: string | null;
  action_taken?: string | null;
  time_to_open_seconds?: number | null;
  metadata?: Record<string, any>;
}

// =============================================================================
// DATABASE OPERATIONS
// =============================================================================

/**
 * Record when a notification was sent
 */
export async function recordNotificationSent(
  event: Omit<NotificationEvent, 'openedAt' | 'action'>,
  supabase: ReturnType<typeof createClient>
): Promise<string> {
  const insertData = {
    id: crypto.randomUUID(),
    user_email: event.userEmail,
    notification_id: event.notificationId,
    notification_type: event.notificationType,
    sent_at: event.sentAt.toISOString(),
    metadata: event.metadata,
  };

  const { data, error } = await (supabase
    .from('notification_engagement') as any)
    .insert(insertData)
    .select('id')
    .single();

  if (error) {
    console.error('Failed to record notification:', error);
    throw error;
  }

  return (data as { id: string }).id;
}

/**
 * Record when a notification was opened/acted upon
 */
export async function recordNotificationEngagement(
  notificationId: string,
  action: ActionType,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  const updateData = {
    opened_at: action !== 'ignored' ? new Date().toISOString() : null,
    action_taken: action,
    time_to_open_seconds: action !== 'ignored'
      ? await calculateTimeToOpen(notificationId, supabase)
      : null,
  };

  const { error } = await (supabase
    .from('notification_engagement') as any)
    .update(updateData)
    .eq('notification_id', notificationId);

  if (error) {
    console.error('Failed to record engagement:', error);
  }
}

async function calculateTimeToOpen(
  notificationId: string,
  supabase: ReturnType<typeof createClient>
): Promise<number | null> {
  const { data } = await supabase
    .from('notification_engagement')
    .select('sent_at')
    .eq('notification_id', notificationId)
    .single();

  const row = data as { sent_at?: string } | null;
  if (!row?.sent_at) return null;

  return Math.floor((Date.now() - new Date(row.sent_at).getTime()) / 1000);
}

// =============================================================================
// ANALYTICS
// =============================================================================

/**
 * Get engagement statistics for a specific notification type
 */
export async function getNotificationTypeEngagement(
  userEmail: string,
  notificationType: NotificationType,
  supabase: ReturnType<typeof createClient>
): Promise<NotificationEngagement> {
  const since = new Date();
  since.setDate(since.getDate() - LOOKBACK_DAYS);

  const { data: rawNotifications } = await supabase
    .from('notification_engagement')
    .select('*')
    .eq('user_email', userEmail)
    .eq('notification_type', notificationType)
    .gte('sent_at', since.toISOString())
    .order('sent_at', { ascending: false });

  const notifications = (rawNotifications as NotificationEngagementRow[] | null) || [];

  if (notifications.length === 0) {
    return {
      type: notificationType,
      sentCount: 0,
      openRate: 0,
      actionRate: 0,
      avgTimeToOpenMinutes: null,
      bestSendHour: DEFAULT_SEND_HOURS[notificationType],
      bestSendDayOfWeek: null,
      engagementTrend: 'stable',
    };
  }

  const sentCount = notifications.length;
  const opened = notifications.filter(n => n.opened_at);
  const acted = notifications.filter(n => n.action_taken === 'acted');
  const openRate = opened.length / sentCount;
  const actionRate = opened.length > 0 ? acted.length / opened.length : 0;

  // Calculate average time to open
  const timesToOpen = opened
    .filter(n => n.time_to_open_seconds)
    .map(n => n.time_to_open_seconds / 60);
  const avgTimeToOpenMinutes = timesToOpen.length > 0
    ? timesToOpen.reduce((a, b) => a + b, 0) / timesToOpen.length
    : null;

  // Find best send hour (hour with highest open rate)
  const hourlyStats = new Map<number, { sent: number; opened: number }>();
  for (const n of notifications) {
    const hour = new Date(n.sent_at).getHours();
    const stats = hourlyStats.get(hour) || { sent: 0, opened: 0 };
    stats.sent++;
    if (n.opened_at) stats.opened++;
    hourlyStats.set(hour, stats);
  }

  let bestSendHour: number | null = null;
  let bestOpenRate = 0;
  for (const [hour, stats] of hourlyStats) {
    if (stats.sent >= 2) { // Need at least 2 data points
      const rate = stats.opened / stats.sent;
      if (rate > bestOpenRate) {
        bestOpenRate = rate;
        bestSendHour = hour;
      }
    }
  }

  // Find best day of week
  const dailyStats = new Map<number, { sent: number; opened: number }>();
  for (const n of notifications) {
    const day = new Date(n.sent_at).getDay();
    const stats = dailyStats.get(day) || { sent: 0, opened: 0 };
    stats.sent++;
    if (n.opened_at) stats.opened++;
    dailyStats.set(day, stats);
  }

  let bestSendDayOfWeek: number | null = null;
  let bestDayOpenRate = 0;
  for (const [day, stats] of dailyStats) {
    if (stats.sent >= 2) {
      const rate = stats.opened / stats.sent;
      if (rate > bestDayOpenRate) {
        bestDayOpenRate = rate;
        bestSendDayOfWeek = day;
      }
    }
  }

  // Calculate trend (compare first half vs second half of data)
  const mid = Math.floor(notifications.length / 2);
  const recentNotifs = notifications.slice(0, mid);
  const olderNotifs = notifications.slice(mid);
  const recentOpenRate = recentNotifs.filter(n => n.opened_at).length / recentNotifs.length;
  const olderOpenRate = olderNotifs.length > 0
    ? olderNotifs.filter(n => n.opened_at).length / olderNotifs.length
    : recentOpenRate;

  let engagementTrend: 'improving' | 'stable' | 'declining' = 'stable';
  if (recentOpenRate > olderOpenRate * 1.2) engagementTrend = 'improving';
  else if (recentOpenRate < olderOpenRate * 0.8) engagementTrend = 'declining';

  return {
    type: notificationType,
    sentCount,
    openRate,
    actionRate,
    avgTimeToOpenMinutes,
    bestSendHour: bestSendHour ?? DEFAULT_SEND_HOURS[notificationType],
    bestSendDayOfWeek,
    engagementTrend,
  };
}

/**
 * Get full engagement profile for a user
 */
export async function getUserEngagementProfile(
  userEmail: string,
  supabase: ReturnType<typeof createClient>
): Promise<UserEngagementProfile> {
  const since = new Date();
  since.setDate(since.getDate() - LOOKBACK_DAYS);

  const { data: rawNotifications } = await supabase
    .from('notification_engagement')
    .select('*')
    .eq('user_email', userEmail)
    .gte('sent_at', since.toISOString())
    .order('sent_at', { ascending: false });

  const notifications = (rawNotifications as NotificationEngagementRow[] | null) || [];

  // Overall open rate
  const overallOpenRate = notifications.length > 0
    ? notifications.filter(n => n.opened_at).length / notifications.length
    : 0;

  // Find preferred hours
  const hourCounts = new Map<number, { total: number; opened: number }>();
  for (const n of notifications) {
    const hour = new Date(n.sent_at).getHours();
    const stats = hourCounts.get(hour) || { total: 0, opened: 0 };
    stats.total++;
    if (n.opened_at) stats.opened++;
    hourCounts.set(hour, stats);
  }

  const hoursWithRate = Array.from(hourCounts.entries())
    .filter(([_, stats]) => stats.total >= 2)
    .map(([hour, stats]) => ({ hour, rate: stats.opened / stats.total }))
    .sort((a, b) => b.rate - a.rate);

  const preferredHours = hoursWithRate.slice(0, 3).map(h => h.hour);

  // Find preferred days
  const dayCounts = new Map<number, { total: number; opened: number }>();
  for (const n of notifications) {
    const day = new Date(n.sent_at).getDay();
    const stats = dayCounts.get(day) || { total: 0, opened: 0 };
    stats.total++;
    if (n.opened_at) stats.opened++;
    dayCounts.set(day, stats);
  }

  const daysWithRate = Array.from(dayCounts.entries())
    .filter(([_, stats]) => stats.total >= 2)
    .map(([day, stats]) => ({ day, rate: stats.opened / stats.total }))
    .sort((a, b) => b.rate - a.rate);

  const preferredDays = daysWithRate.slice(0, 3).map(d => d.day);

  // Get engagement by type
  const engagementByType = new Map<NotificationType, NotificationEngagement>();
  const notificationTypes: NotificationType[] = [
    'daily_briefing', 'streak_reminder', 'streak_at_risk', 'goal_reminder',
    'health_insight', 'intervention_checkin', 'social_activity', 'achievement',
    'proactive_tip', 'schedule_alert'
  ];

  for (const type of notificationTypes) {
    const engagement = await getNotificationTypeEngagement(userEmail, type, supabase);
    engagementByType.set(type, engagement);
  }

  // Categorize types by engagement
  const typesWithEngagement = Array.from(engagementByType.entries())
    .filter(([_, e]) => e.sentCount >= MIN_DATA_POINTS_FOR_LEARNING)
    .sort((a, b) => b[1].openRate - a[1].openRate);

  const highEngagementTypes = typesWithEngagement
    .filter(([_, e]) => e.openRate > 0.5)
    .map(([type]) => type);

  const lowEngagementTypes = typesWithEngagement
    .filter(([_, e]) => e.openRate < 0.2)
    .map(([type]) => type);

  // Calculate optimal notifications per day based on fatigue
  const dailyNotifCounts = new Map<string, number>();
  const dailyOpenRates = new Map<string, { sent: number; opened: number }>();

  for (const n of notifications) {
    const dateKey = new Date(n.sent_at).toISOString().split('T')[0];
    dailyNotifCounts.set(dateKey, (dailyNotifCounts.get(dateKey) || 0) + 1);
    const stats = dailyOpenRates.get(dateKey) || { sent: 0, opened: 0 };
    stats.sent++;
    if (n.opened_at) stats.opened++;
    dailyOpenRates.set(dateKey, stats);
  }

  // Find the notification count that maximizes open rate
  const countToRate = new Map<number, number[]>();
  for (const [dateKey, count] of dailyNotifCounts) {
    const dayStats = dailyOpenRates.get(dateKey);
    if (dayStats && dayStats.sent > 0) {
      const rate = dayStats.opened / dayStats.sent;
      const rates = countToRate.get(count) || [];
      rates.push(rate);
      countToRate.set(count, rates);
    }
  }

  let optimalNotificationsPerDay = 3; // Default
  let bestAvgRate = 0;
  for (const [count, rates] of countToRate) {
    const avgRate = rates.reduce((a, b) => a + b, 0) / rates.length;
    if (avgRate > bestAvgRate && rates.length >= 3) {
      bestAvgRate = avgRate;
      optimalNotificationsPerDay = count;
    }
  }

  // Last engagement
  const lastEngagedNotif = notifications.find(n => n.opened_at);
  const lastEngagementAt = lastEngagedNotif?.opened_at || null;

  return {
    userEmail,
    overallOpenRate,
    preferredHours,
    preferredDays,
    highEngagementTypes,
    lowEngagementTypes,
    optimalNotificationsPerDay: Math.min(optimalNotificationsPerDay, 8),
    lastEngagementAt,
    engagementByType,
  };
}

// =============================================================================
// OPTIMAL SEND TIME
// =============================================================================

/**
 * Get the optimal time to send a specific notification type to a user
 */
export async function getOptimalSendTime(
  userEmail: string,
  notificationType: NotificationType,
  supabase: ReturnType<typeof createClient>
): Promise<OptimalSendTime> {
  const engagement = await getNotificationTypeEngagement(userEmail, notificationType, supabase);

  if (engagement.sentCount < MIN_DATA_POINTS_FOR_LEARNING) {
    // Not enough data, use defaults
    return {
      hour: DEFAULT_SEND_HOURS[notificationType],
      dayOfWeek: -1, // Any day
      confidence: 0.3,
      reason: 'Using default time (not enough engagement data)',
    };
  }

  const profile = await getUserEngagementProfile(userEmail, supabase);

  // Combine type-specific and general preferences
  let hour = engagement.bestSendHour ?? DEFAULT_SEND_HOURS[notificationType];
  let dayOfWeek = engagement.bestSendDayOfWeek ?? -1;
  let confidence = 0.5;
  let reason = 'Based on historical engagement patterns';

  // If this type has high engagement at a specific hour, use it
  if (engagement.openRate > 0.6 && engagement.sentCount >= 10) {
    confidence = 0.8;
    reason = `High engagement (${Math.round(engagement.openRate * 100)}% open rate) at this time`;
  }

  // Consider user's general preferences if type-specific data is weak
  if (engagement.sentCount < 10 && profile.preferredHours.length > 0) {
    // Find intersection of type default and user preferences
    const defaultHour = DEFAULT_SEND_HOURS[notificationType];
    const closestPreferred = profile.preferredHours
      .sort((a, b) => Math.abs(a - defaultHour) - Math.abs(b - defaultHour))[0];

    hour = closestPreferred;
    confidence = 0.6;
    reason = 'Based on overall notification preferences';
  }

  // Use preferred days if available
  if (profile.preferredDays.length > 0 && dayOfWeek === -1) {
    dayOfWeek = profile.preferredDays[0];
  }

  return { hour, dayOfWeek, confidence, reason };
}

/**
 * Get the next optimal send window for a notification
 */
export async function getNextOptimalSendWindow(
  userEmail: string,
  notificationType: NotificationType,
  supabase: ReturnType<typeof createClient>
): Promise<Date> {
  const optimal = await getOptimalSendTime(userEmail, notificationType, supabase);
  const now = new Date();

  // Start with today
  const sendTime = new Date(now);
  sendTime.setHours(optimal.hour, 0, 0, 0);

  // If optimal hour has passed today, move to tomorrow
  if (sendTime <= now) {
    sendTime.setDate(sendTime.getDate() + 1);
  }

  // If specific day preference, find next occurrence
  if (optimal.dayOfWeek >= 0) {
    while (sendTime.getDay() !== optimal.dayOfWeek) {
      sendTime.setDate(sendTime.getDate() + 1);
    }
  }

  return sendTime;
}

// =============================================================================
// ENGAGEMENT INSIGHTS FOR PROMPTS
// =============================================================================

/**
 * Format engagement insights for inclusion in agent prompts
 */
export async function formatEngagementInsightsForPrompt(
  userEmail: string,
  supabase: ReturnType<typeof createClient>
): Promise<string> {
  const profile = await getUserEngagementProfile(userEmail, supabase);

  const lines: string[] = ['## User Notification Engagement\n'];

  // Overall engagement
  lines.push(`**Overall Open Rate**: ${Math.round(profile.overallOpenRate * 100)}%`);
  lines.push(`**Optimal Daily Notifications**: ${profile.optimalNotificationsPerDay}`);

  // Timing preferences
  if (profile.preferredHours.length > 0) {
    const hourStrings = profile.preferredHours.map(h =>
      h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`
    );
    lines.push(`**Best Send Times**: ${hourStrings.join(', ')}`);
  }

  // High engagement types
  if (profile.highEngagementTypes.length > 0) {
    lines.push(`**High Engagement Notifications**: ${profile.highEngagementTypes.join(', ')}`);
  }

  // Low engagement types (reduce these)
  if (profile.lowEngagementTypes.length > 0) {
    lines.push(`**Low Engagement (reduce)**: ${profile.lowEngagementTypes.join(', ')}`);
  }

  // Recommendations
  lines.push('\n**Recommendations:**');
  lines.push(`- Send notifications primarily at: ${profile.preferredHours[0] || 9}:00`);
  lines.push(`- Limit to ${profile.optimalNotificationsPerDay} notifications per day`);

  if (profile.lowEngagementTypes.includes('proactive_tip')) {
    lines.push('- User rarely engages with proactive tips; focus on requested insights');
  }

  if (profile.highEngagementTypes.includes('streak_at_risk')) {
    lines.push('- User responds well to streak warnings; prioritize these');
  }

  return lines.join('\n');
}

/**
 * Check if we should throttle notifications for a user today
 */
export async function shouldThrottleNotifications(
  userEmail: string,
  supabase: ReturnType<typeof createClient>
): Promise<{ throttle: boolean; reason?: string; sentToday: number; limit: number }> {
  const profile = await getUserEngagementProfile(userEmail, supabase);

  // Count today's notifications
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from('notification_engagement')
    .select('*', { count: 'exact', head: true })
    .eq('user_email', userEmail)
    .gte('sent_at', today.toISOString());

  const sentToday = count || 0;
  const limit = profile.optimalNotificationsPerDay;

  if (sentToday >= limit) {
    return {
      throttle: true,
      reason: `Already sent ${sentToday} notifications today (limit: ${limit})`,
      sentToday,
      limit,
    };
  }

  // Also throttle if user hasn't engaged with last 5 notifications
  const { data: rawRecentNotifs } = await supabase
    .from('notification_engagement')
    .select('opened_at')
    .eq('user_email', userEmail)
    .order('sent_at', { ascending: false })
    .limit(5);

  const recentNotifs = rawRecentNotifs as Array<{ opened_at?: string | null }> | null;

  if (recentNotifs && recentNotifs.length >= 5) {
    const recentOpens = recentNotifs.filter(n => n.opened_at).length;
    if (recentOpens === 0) {
      return {
        throttle: true,
        reason: 'User has not engaged with last 5 notifications',
        sentToday,
        limit,
      };
    }
  }

  return { throttle: false, sentToday, limit };
}
