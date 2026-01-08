/**
 * Daily Digest Service
 *
 * Generates and sends personalized daily digests to users.
 * Combines wisdom library content with health insights based on preferences.
 *
 * @module lib/services/daily-digest-service
 */

import { createAdminClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/utils/logger';
import { WisdomLibraryService, WisdomEntry } from './wisdom-library-service';
import { PreferenceLearner } from './preference-learner';
import { sendPushNotification } from './onesignal-service';

const logger = createLogger('DailyDigestService');

export interface DigestItem {
  id: string;
  type: 'wisdom' | 'health_insight';
  category: string;
  title: string;
  content: string;
  source?: string;
  sourceType?: string;
  actionableTip?: string;
}

export interface DailyDigest {
  userId: string;
  email: string;
  items: DigestItem[];
  generatedAt: Date;
  preferredTime: string;
  timezone: string;
}

export interface DigestDeliveryResult {
  email: string;
  success: boolean;
  itemCount: number;
  notificationSent: boolean;
  error?: string;
}

class DailyDigestServiceClass {
  private supabase = createAdminClient();

  /**
   * Get users who should receive their digest at the current time
   * Checks preferred_time against current time in their timezone
   */
  async getUsersForDigest(
    targetHour?: number,
    targetMinute?: number
  ): Promise<{ email: string; timezone: string; preferredTime: string }[]> {
    try {
      // If no target time specified, use current UTC hour
      const now = new Date();
      const currentHour = targetHour ?? now.getUTCHours();
      const currentMinute = targetMinute ?? now.getUTCMinutes();

      // Format as HH:MM for comparison
      const targetTime = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;

      logger.info('Finding users for digest', { targetTime });

      // Get users with explicit preferences
      const { data: usersWithPrefs, error: prefsError } = await this.supabase
        .from('user_content_preferences')
        .select('user_email, preferred_time, timezone')
        .not('user_email', 'is', null);

      if (prefsError) {
        logger.error('Error fetching user preferences', { error: prefsError });
      }

      // Also get users with active integrations (for auto-enrollment)
      const { data: integratedUsers, error: integrationError } = await this.supabase
        .from('integration_tokens')
        .select('user_email')
        .eq('is_active', true);

      if (integrationError) {
        logger.error('Error fetching integrated users', { error: integrationError });
      }

      // Build a map of user preferences
      const userPrefsMap = new Map<string, { preferredTime: string; timezone: string }>();
      for (const user of usersWithPrefs || []) {
        if (user.user_email && user.preferred_time) {
          userPrefsMap.set(user.user_email, {
            preferredTime: user.preferred_time as string,
            timezone: user.timezone || 'UTC',
          });
        }
      }

      // Add integrated users without preferences (default to 08:00 in their detected timezone)
      const integratedEmails = [...new Set((integratedUsers || []).map(u => u.user_email).filter(Boolean))] as string[];
      for (const email of integratedEmails) {
        if (!userPrefsMap.has(email)) {
          // Default preference: 8am UTC (users can customize later)
          userPrefsMap.set(email, {
            preferredTime: '08:00',
            timezone: 'UTC',
          });
          logger.info('Auto-enrolled user for digest', { email, defaultTime: '08:00 UTC' });
        }
      }

      // Filter users based on their local time
      const eligibleUsers: { email: string; timezone: string; preferredTime: string }[] = [];

      for (const [email, prefs] of userPrefsMap.entries()) {
        const userLocalTime = this.getUserLocalTime(prefs.timezone);
        const userHour = userLocalTime.getHours();
        const userMinute = userLocalTime.getMinutes();

        // Parse user's preferred time
        const [prefHour, prefMinute] = prefs.preferredTime.split(':').map(Number);

        // Check if within 15-minute window of preferred time
        const prefTotalMinutes = prefHour * 60 + prefMinute;
        const currentTotalMinutes = userHour * 60 + userMinute;
        const diff = Math.abs(prefTotalMinutes - currentTotalMinutes);

        if (diff <= 15 || diff >= (24 * 60 - 15)) {
          eligibleUsers.push({
            email,
            timezone: prefs.timezone,
            preferredTime: prefs.preferredTime,
          });
        }
      }

      logger.info('Found eligible users', { count: eligibleUsers.length, totalUsers: userPrefsMap.size });
      return eligibleUsers;
    } catch (error) {
      logger.error('Error in getUsersForDigest', { error });
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
   * Generate a daily digest for a specific user
   */
  async generateDigest(email: string, itemCount: number = 2): Promise<DailyDigest | null> {
    try {
      logger.info('Generating digest', { email, itemCount });

      // Get user preferences
      const prefs = await PreferenceLearner.getPreferences(email);

      // Get wisdom content
      const wisdomEntries = await WisdomLibraryService.getDigestContent(email, itemCount);

      // Transform to digest items
      const items: DigestItem[] = wisdomEntries.map((entry: WisdomEntry) => ({
        id: entry.id,
        type: 'wisdom' as const,
        category: entry.category,
        title: entry.title,
        content: entry.content,
        source: entry.source,
        sourceType: entry.source_type,
        actionableTip: entry.actionable_tip,
      }));

      const digest: DailyDigest = {
        userId: '', // Will be filled if needed
        email,
        items,
        generatedAt: new Date(),
        preferredTime: prefs.preferredTime,
        timezone: prefs.timezone,
      };

      logger.info('Digest generated', { email, itemCount: items.length });
      return digest;
    } catch (error) {
      logger.error('Error generating digest', { error, email });
      return null;
    }
  }

  /**
   * Store digest in database for later retrieval
   */
  async storeDigest(digest: DailyDigest): Promise<string | null> {
    try {
      const { data, error } = await this.supabase
        .from('daily_digests')
        .insert({
          user_email: digest.email,
          items: digest.items,
          generated_at: digest.generatedAt.toISOString(),
          delivered_at: null,
        })
        .select('id')
        .single();

      if (error) {
        // Table might not exist, that's okay - we can still send the notification
        logger.warn('Could not store digest (table may not exist)', { error: error.message });
        return null;
      }

      return data?.id || null;
    } catch (error) {
      logger.warn('Error storing digest', { error });
      return null;
    }
  }

  /**
   * Send digest notification to user
   */
  async sendDigestNotification(
    email: string,
    digest: DailyDigest
  ): Promise<boolean> {
    try {
      if (digest.items.length === 0) {
        logger.info('No items in digest, skipping notification', { email });
        return false;
      }

      // Build notification content
      const firstItem = digest.items[0];
      const title = this.getNotificationTitle(firstItem);
      const body = this.getNotificationBody(digest);

      const sent = await sendPushNotification(email, {
        title,
        body,
        data: {
          type: 'daily_digest',
          item_count: digest.items.length.toString(),
          first_item_id: firstItem.id,
          first_item_type: firstItem.type,
          action_url: '/sage',
        },
      });

      logger.info('Digest notification sent', { email, sent: sent > 0 });
      return sent > 0;
    } catch (error) {
      logger.error('Error sending digest notification', { error, email });
      return false;
    }
  }

  /**
   * Get notification title based on content
   */
  private getNotificationTitle(item: DigestItem): string {
    // Use the actual title from the wisdom entry for more context
    // But keep it concise for push notification
    let title = item.title;

    // Truncate if too long for a notification title
    if (title.length > 50) {
      title = title.substring(0, 47) + '...';
    }

    return title;
  }

  /**
   * Get notification body - now includes actionable content
   */
  private getNotificationBody(digest: DailyDigest): string {
    const item = digest.items[0];

    // Build a more in-depth notification body
    let body = '';

    // Use actionable tip if available (most valuable for user)
    if (item.actionableTip) {
      body = item.actionableTip;
    } else if (item.content) {
      // Fall back to content
      body = item.content;
    } else {
      // Last resort: use title
      body = item.title;
    }

    // Truncate to reasonable push notification length (150 chars for readability)
    if (body.length > 150) {
      body = body.substring(0, 147) + '...';
    }

    // Add source attribution on new line if space allows
    if (item.source && body.length < 120) {
      body += `\n— ${item.source}`;
    }

    return body;
  }

  /**
   * Process and deliver digest to a single user
   */
  async deliverDigestToUser(email: string): Promise<DigestDeliveryResult> {
    try {
      // Generate digest
      const digest = await this.generateDigest(email, 2);

      if (!digest || digest.items.length === 0) {
        return {
          email,
          success: false,
          itemCount: 0,
          notificationSent: false,
          error: 'No content available',
        };
      }

      // Store digest (optional, for history)
      await this.storeDigest(digest);

      // Send notification
      const notificationSent = await this.sendDigestNotification(email, digest);

      return {
        email,
        success: true,
        itemCount: digest.items.length,
        notificationSent,
      };
    } catch (error) {
      logger.error('Error delivering digest', { error, email });
      return {
        email,
        success: false,
        itemCount: 0,
        notificationSent: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Run the daily digest job for all eligible users
   */
  async runDigestJob(): Promise<{
    processed: number;
    successful: number;
    notificationsSent: number;
    results: DigestDeliveryResult[];
  }> {
    try {
      logger.info('Starting daily digest job');

      // Get eligible users
      const users = await this.getUsersForDigest();

      if (users.length === 0) {
        logger.info('No users eligible for digest at this time');
        return {
          processed: 0,
          successful: 0,
          notificationsSent: 0,
          results: [],
        };
      }

      logger.info('Processing digests', { userCount: users.length });

      // Process each user
      const results: DigestDeliveryResult[] = [];
      let successful = 0;
      let notificationsSent = 0;

      for (const user of users) {
        const result = await this.deliverDigestToUser(user.email);
        results.push(result);

        if (result.success) successful++;
        if (result.notificationSent) notificationsSent++;

        // Small delay between users to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      logger.info('Daily digest job completed', {
        processed: users.length,
        successful,
        notificationsSent,
      });

      return {
        processed: users.length,
        successful,
        notificationsSent,
        results,
      };
    } catch (error) {
      logger.error('Error running digest job', { error });
      throw error;
    }
  }

  /**
   * Send digest to a specific user (manual trigger)
   */
  async sendDigestNow(email: string): Promise<DigestDeliveryResult> {
    logger.info('Manual digest trigger', { email });
    return this.deliverDigestToUser(email);
  }

  /**
   * Get digest history for a user
   */
  async getDigestHistory(
    email: string,
    limit: number = 10
  ): Promise<DailyDigest[]> {
    try {
      const { data, error } = await this.supabase
        .from('daily_digests')
        .select('*')
        .eq('user_email', email)
        .order('generated_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Error fetching digest history', { error, email });
        return [];
      }

      return (data || []).map(d => ({
        userId: '',
        email: d.user_email,
        items: d.items as DigestItem[],
        generatedAt: new Date(d.generated_at),
        preferredTime: '08:00',
        timezone: 'UTC',
      }));
    } catch (error) {
      logger.error('Error in getDigestHistory', { error, email });
      return [];
    }
  }
}

// Export singleton instance
export const DailyDigestService = new DailyDigestServiceClass();
