/**
 * Morning Briefing Service
 *
 * Generates and sends proactive morning briefings that combine:
 * - Wellness recommendations based on HRV/recovery
 * - Aggregated tasks from Slack, Linear, Notion, Gmail
 *
 * @module lib/services/morning-briefing-service
 */

import { createAdminClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/utils/logger';
import { sendPushNotification } from './onesignal-service';
import { analyzeHealthContext, HealthContext } from './daily-digest-service';
import {
  aggregateAllPlatforms,
  SlackBriefingData,
  LinearBriefingData,
  NotionBriefingData,
  GmailBriefingData,
} from './morning-briefing-aggregators';

const logger = createLogger('MorningBriefingService');

// Base URL for internal API calls
const BASE_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

const CRON_SECRET = process.env.CRON_SECRET || 'moccet-cron-secret';

// ============================================================================
// TYPES
// ============================================================================

export interface MorningBriefing {
  wellness: {
    available: boolean;
    hrv?: number;
    recovery?: number;
    sleepHours?: number;
    energyLevel: 'low' | 'moderate' | 'high';
    recommendation: string;
    dataPoints: string[];
  };
  slack: SlackBriefingData | null;
  linear: LinearBriefingData | null;
  notion: NotionBriefingData | null;
  gmail: GmailBriefingData | null;
  totals: {
    actionItems: number;
    urgentItems: number;
  };
  generatedAt: string;
}

export interface BriefingDeliveryResult {
  email: string;
  success: boolean;
  actionItems: number;
  notificationSent: boolean;
  error?: string;
}

// ============================================================================
// WELLNESS RECOMMENDATIONS
// ============================================================================

/**
 * Generate a wellness recommendation based on health metrics
 */
function generateWellnessRecommendation(health: HealthContext | null): string {
  if (!health) {
    return "Start your day with intention. A short walk or stretch can set a positive tone.";
  }

  const { recovery, hrv, sleepHours, energyLevel } = health;

  // Low recovery/HRV - suggest easy morning
  if (recovery !== undefined && recovery < 50) {
    return "Your recovery is on the lower side today. Consider a gentle start - a short walk and some deep breaths before diving into tasks.";
  }

  if (hrv !== undefined && hrv < 40) {
    return "Your HRV suggests some stress. A 10-minute walk or light stretch before opening Slack could help you focus.";
  }

  // Sleep-based recommendations
  if (sleepHours !== undefined && sleepHours < 6) {
    return "You had a shorter night. Be kind to yourself - tackle your most important task first while energy is fresh.";
  }

  // High recovery - great day ahead
  if (recovery !== undefined && recovery >= 70) {
    return "Great recovery! You're primed for a productive day. Perfect time to tackle challenging tasks.";
  }

  if (energyLevel === 'high') {
    return "Your body is well-rested. A brief energizing stretch will have you ready to crush your tasks.";
  }

  if (energyLevel === 'low') {
    return "Take it easy this morning. A gentle walk and some water will help you find your rhythm.";
  }

  // Default moderate energy
  return "A quick 5-10 minute walk before work can boost your focus and set a productive tone.";
}

// ============================================================================
// MAIN SERVICE
// ============================================================================

class MorningBriefingServiceClass {
  private supabase = createAdminClient();

  /**
   * Refresh platform data by triggering fresh fetches for Slack and Gmail
   * This ensures we have the latest messages/tasks before aggregating
   */
  private async refreshPlatformData(email: string): Promise<void> {
    logger.info('Refreshing platform data before briefing', { email });

    // Check which platforms are connected
    const { data: tokens } = await this.supabase
      .from('integration_tokens')
      .select('provider')
      .eq('user_email', email)
      .eq('is_active', true);

    const connectedProviders = new Set((tokens || []).map(t => t.provider));

    // Trigger fetches in parallel for connected platforms
    const fetchPromises: Promise<void>[] = [];

    if (connectedProviders.has('slack')) {
      fetchPromises.push(this.triggerFetch('slack', email));
    }

    if (connectedProviders.has('gmail')) {
      fetchPromises.push(this.triggerFetch('gmail', email));
    }

    // Wait for all fetches with a timeout
    try {
      await Promise.race([
        Promise.allSettled(fetchPromises),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Fetch timeout')), 30000)),
      ]);
      logger.info('Platform data refresh completed', { email });
    } catch (error) {
      logger.warn('Platform data refresh timed out or failed', { error, email });
      // Continue anyway - we'll use whatever data we have
    }
  }

  /**
   * Trigger a fetch for a specific platform
   */
  private async triggerFetch(platform: 'slack' | 'gmail', email: string): Promise<void> {
    try {
      const url = `${BASE_URL}/api/${platform}/fetch-data`;
      logger.info(`Triggering ${platform} fetch`, { email, url });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-cron-secret': CRON_SECRET,
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const text = await response.text();
        logger.warn(`${platform} fetch failed`, { status: response.status, text, email });
      } else {
        logger.info(`${platform} fetch completed`, { email });
      }
    } catch (error) {
      logger.warn(`${platform} fetch error`, { error, email });
    }
  }

  /**
   * Generate a morning briefing for a user
   */
  async generateBriefing(email: string): Promise<MorningBriefing> {
    logger.info('Generating morning briefing', { email });

    // First, refresh platform data to get latest messages/tasks
    await this.refreshPlatformData(email);

    // Fetch health context and platform data in parallel
    const [healthContext, platformData] = await Promise.all([
      analyzeHealthContext(email),
      aggregateAllPlatforms(email),
    ]);

    // Generate wellness recommendation
    const recommendation = generateWellnessRecommendation(healthContext);

    const briefing: MorningBriefing = {
      wellness: {
        available: !!healthContext,
        hrv: healthContext?.hrv,
        recovery: healthContext?.recovery,
        sleepHours: healthContext?.sleepHours,
        energyLevel: healthContext?.energyLevel || 'moderate',
        recommendation,
        dataPoints: healthContext?.dataPoints || [],
      },
      slack: platformData.slack,
      linear: platformData.linear,
      notion: platformData.notion,
      gmail: platformData.gmail,
      totals: platformData.totals,
      generatedAt: new Date().toISOString(),
    };

    logger.info('Generated morning briefing', {
      email,
      hasWellness: briefing.wellness.available,
      hasSlack: !!briefing.slack,
      hasLinear: !!briefing.linear,
      hasNotion: !!briefing.notion,
      hasGmail: !!briefing.gmail,
      actionItems: briefing.totals.actionItems,
      urgentItems: briefing.totals.urgentItems,
    });

    return briefing;
  }

  /**
   * Format the notification title based on available wellness data
   */
  private formatTitle(briefing: MorningBriefing): string {
    const { wellness } = briefing;

    if (wellness.hrv) {
      return `Good morning! HRV: ${wellness.hrv}ms`;
    }

    if (wellness.recovery) {
      return `Good morning! Recovery: ${wellness.recovery}%`;
    }

    if (wellness.sleepHours) {
      return `Good morning! Sleep: ${wellness.sleepHours.toFixed(1)}h`;
    }

    return 'Good morning!';
  }

  /**
   * Format the notification body with wellness + task summary
   */
  private formatBody(briefing: MorningBriefing): string {
    const parts: string[] = [];

    // Add wellness recommendation
    parts.push(briefing.wellness.recommendation);
    parts.push('');

    // Check if there are any action items
    if (briefing.totals.actionItems === 0) {
      parts.push('Clear day ahead! Great time for deep work.');
      return parts.join('\n');
    }

    parts.push('Waiting for you:');

    // Slack - show top person if available
    if (briefing.slack && briefing.slack.totalPending > 0) {
      if (briefing.slack.byPerson.length > 0) {
        const topPerson = briefing.slack.byPerson[0];
        if (briefing.slack.byPerson.length > 1) {
          parts.push(`• ${topPerson.name} (Slack): ${topPerson.count} requests +${briefing.slack.byPerson.length - 1} others`);
        } else {
          parts.push(`• ${topPerson.name} (Slack): ${topPerson.count} requests`);
        }
      } else {
        parts.push(`• Slack: ${briefing.slack.totalPending} pending`);
      }
    }

    // Linear - show urgent/high priority
    if (briefing.linear) {
      const { urgentCount, highPriorityCount } = briefing.linear;
      const total = urgentCount + highPriorityCount;
      if (total > 0) {
        if (urgentCount > 0) {
          parts.push(`• Linear: ${urgentCount} urgent${highPriorityCount > 0 ? `, ${highPriorityCount} high priority` : ''}`);
        } else {
          parts.push(`• Linear: ${highPriorityCount} high priority issues`);
        }
      }
    }

    // Notion - show due today/overdue
    if (briefing.notion) {
      const { dueToday, overdue } = briefing.notion;
      const total = dueToday + overdue;
      if (total > 0) {
        if (overdue > 0) {
          parts.push(`• Notion: ${overdue} overdue${dueToday > 0 ? `, ${dueToday} due today` : ''}`);
        } else {
          parts.push(`• Notion: ${dueToday} due today`);
        }
      }
    }

    // Gmail - show needs response
    if (briefing.gmail && briefing.gmail.needsResponse > 0) {
      const { needsResponse, highPriority } = briefing.gmail;
      if (highPriority > 0) {
        parts.push(`• Gmail: ${needsResponse} need response (${highPriority} urgent)`);
      } else {
        parts.push(`• Gmail: ${needsResponse} need response`);
      }
    }

    parts.push('');
    parts.push('Tap to view your priorities.');

    return parts.join('\n');
  }

  /**
   * Store briefing in database
   */
  private async storeBriefing(email: string, briefing: MorningBriefing): Promise<string | null> {
    try {
      const { data, error } = await this.supabase
        .from('morning_briefings')
        .insert({
          user_email: email,
          wellness_data: briefing.wellness,
          slack_summary: briefing.slack || {},
          linear_summary: briefing.linear || {},
          notion_summary: briefing.notion || {},
          gmail_summary: briefing.gmail || {},
          total_action_items: briefing.totals.actionItems,
          urgent_items: briefing.totals.urgentItems,
          notification_sent: false,
          generated_at: briefing.generatedAt,
        })
        .select('id')
        .single();

      if (error) {
        // Table might not exist yet
        logger.warn('Could not store briefing', { error: error.message });
        return null;
      }

      return data?.id || null;
    } catch (error) {
      logger.warn('Error storing briefing', { error });
      return null;
    }
  }

  /**
   * Update briefing as sent
   */
  private async markBriefingSent(briefingId: string): Promise<void> {
    try {
      await this.supabase
        .from('morning_briefings')
        .update({
          notification_sent: true,
          sent_at: new Date().toISOString(),
        })
        .eq('id', briefingId);
    } catch (error) {
      logger.warn('Error marking briefing as sent', { error });
    }
  }

  /**
   * Check if user already received a briefing today
   */
  async alreadySentToday(email: string): Promise<boolean> {
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data } = await this.supabase
        .from('morning_briefings')
        .select('id')
        .eq('user_email', email)
        .eq('notification_sent', true)
        .gte('generated_at', todayStart.toISOString())
        .limit(1);

      return data && data.length > 0;
    } catch (error) {
      // If table doesn't exist, allow sending
      return false;
    }
  }

  /**
   * Send morning briefing to a user
   */
  async sendBriefing(email: string): Promise<BriefingDeliveryResult> {
    try {
      // Check if already sent today
      if (await this.alreadySentToday(email)) {
        logger.info('Briefing already sent today', { email });
        return {
          email,
          success: true,
          actionItems: 0,
          notificationSent: false,
          error: 'Already sent today',
        };
      }

      // Generate briefing
      const briefing = await this.generateBriefing(email);

      // Store in database
      const briefingId = await this.storeBriefing(email, briefing);

      // Format notification
      const title = this.formatTitle(briefing);
      let body = this.formatBody(briefing);

      // Truncate body if too long
      if (body.length > 250) {
        body = body.substring(0, 247) + '...';
      }

      // Send notification
      const sent = await sendPushNotification(email, {
        title,
        body,
        data: {
          type: 'morning_briefing',
          slack_count: String(briefing.slack?.totalPending || 0),
          linear_count: String((briefing.linear?.urgentCount || 0) + (briefing.linear?.highPriorityCount || 0)),
          notion_count: String((briefing.notion?.dueToday || 0) + (briefing.notion?.overdue || 0)),
          gmail_count: String(briefing.gmail?.needsResponse || 0),
          total_urgent: String(briefing.totals.urgentItems),
          total_action_items: String(briefing.totals.actionItems),
          wellness_available: String(briefing.wellness.available),
          hrv: String(briefing.wellness.hrv || ''),
          recovery: String(briefing.wellness.recovery || ''),
          recommendation: briefing.wellness.recommendation,
          action_url: '/home',
        },
      });

      // Mark as sent
      if (briefingId && sent > 0) {
        await this.markBriefingSent(briefingId);
      }

      logger.info('Sent morning briefing', {
        email,
        actionItems: briefing.totals.actionItems,
        notificationSent: sent > 0,
      });

      return {
        email,
        success: true,
        actionItems: briefing.totals.actionItems,
        notificationSent: sent > 0,
      };
    } catch (error) {
      logger.error('Error sending briefing', { error, email });
      return {
        email,
        success: false,
        actionItems: 0,
        notificationSent: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get users eligible for morning briefing
   * Reuses the same timing logic as daily digest
   */
  async getUsersForBriefing(): Promise<{ email: string; timezone: string }[]> {
    try {
      // Get users with active integrations
      const { data: integratedUsers, error } = await this.supabase
        .from('integration_tokens')
        .select('user_email')
        .eq('is_active', true);

      if (error) {
        logger.error('Error fetching users for briefing', { error });
        return [];
      }

      // Get unique emails
      const uniqueEmails = [...new Set(
        (integratedUsers || [])
          .map(u => u.user_email)
          .filter(Boolean) as string[]
      )];

      // Get user preferences for timing
      const { data: prefs } = await this.supabase
        .from('user_content_preferences')
        .select('user_email, preferred_time, timezone, morning_briefing_enabled')
        .in('user_email', uniqueEmails);

      const prefMap = new Map(
        (prefs || []).map(p => [p.user_email, p])
      );

      // Filter users by their local time
      const now = new Date();
      const eligibleUsers: { email: string; timezone: string }[] = [];

      for (const email of uniqueEmails) {
        const userPref = prefMap.get(email);

        // Check if briefing is enabled (default: true)
        if (userPref?.morning_briefing_enabled === false) {
          continue;
        }

        const timezone = userPref?.timezone || 'UTC';
        const preferredTime = userPref?.preferred_time || '08:00';

        // Get user's local time
        const userLocalTime = this.getUserLocalTime(timezone);
        const userHour = userLocalTime.getHours();
        const userMinute = userLocalTime.getMinutes();

        // Parse preferred time
        const [prefHour, prefMinute] = preferredTime.split(':').map(Number);

        // Check if within 15-minute window
        const prefTotalMinutes = prefHour * 60 + prefMinute;
        const currentTotalMinutes = userHour * 60 + userMinute;
        const diff = Math.abs(prefTotalMinutes - currentTotalMinutes);

        if (diff <= 15 || diff >= (24 * 60 - 15)) {
          eligibleUsers.push({ email, timezone });
        }
      }

      logger.info('Found eligible users for briefing', { count: eligibleUsers.length });
      return eligibleUsers;
    } catch (error) {
      logger.error('Error getting users for briefing', { error });
      return [];
    }
  }

  /**
   * Get current time in a specific timezone
   */
  private getUserLocalTime(timezone: string): Date {
    try {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        timeZone: timezone,
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
      };
      const formatter = new Intl.DateTimeFormat('en-US', options);
      const parts = formatter.formatToParts(now);

      const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
      const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');

      const localDate = new Date();
      localDate.setHours(hour, minute, 0, 0);
      return localDate;
    } catch {
      return new Date();
    }
  }

  /**
   * Run the morning briefing job for all eligible users
   */
  async runBriefingJob(): Promise<{
    processed: number;
    sent: number;
    results: BriefingDeliveryResult[];
  }> {
    logger.info('Starting morning briefing job');

    try {
      const users = await this.getUsersForBriefing();

      if (users.length === 0) {
        logger.info('No users eligible for briefing at this time');
        return { processed: 0, sent: 0, results: [] };
      }

      logger.info('Processing briefings', { userCount: users.length });

      const results: BriefingDeliveryResult[] = [];
      let sent = 0;

      for (const user of users) {
        const result = await this.sendBriefing(user.email);
        results.push(result);

        if (result.notificationSent) sent++;

        // Small delay between users
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      logger.info('Morning briefing job completed', {
        processed: users.length,
        sent,
      });

      return { processed: users.length, sent, results };
    } catch (error) {
      logger.error('Error running briefing job', { error });
      throw error;
    }
  }

  /**
   * Send briefing to a specific user (manual trigger)
   */
  async sendBriefingNow(email: string): Promise<BriefingDeliveryResult> {
    logger.info('Manual briefing trigger', { email });
    return this.sendBriefing(email);
  }
}

// Export singleton instance
export const MorningBriefingService = new MorningBriefingServiceClass();
