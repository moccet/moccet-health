/**
 * Daily Digest Service
 *
 * Generates and sends personalized daily digests to users.
 * Combines health summary with relevant wisdom based on current health state.
 *
 * @module lib/services/daily-digest-service
 */

import { createAdminClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/utils/logger';
import { WisdomLibraryService, WisdomEntry, WisdomCategory } from './wisdom-library-service';
import { AIWisdomGenerator, WisdomHealthContext, GeneratedWisdom } from './ai-wisdom-generator';
import { PreferenceLearner } from './preference-learner';
import {
  sendPushNotification,
  canSendNotification,
  markThemeNotified,
} from './onesignal-service';
import { fetchAllEcosystemData } from './ecosystem-fetcher';
import OpenAI from 'openai';

const logger = createLogger('DailyDigestService');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Health context derived from ecosystem data
 * Exported for use by morning briefing service
 */
export interface HealthContext {
  recovery?: number;
  strain?: number;
  hrv?: number;
  hrvTrend?: 'rising' | 'stable' | 'declining';
  sleepHours?: number;
  sleepQuality?: 'poor' | 'fair' | 'good' | 'excellent';
  readiness?: number;
  glucoseInRange?: number;
  stressLevel: 'low' | 'moderate' | 'high';
  energyLevel: 'low' | 'moderate' | 'high';
  recommendedFocus: WisdomCategory;
  healthSummary: string;
  dataPoints: string[];
  recentPatterns?: string[];
}

export interface DigestItem {
  id: string;
  type: 'wisdom' | 'health_insight' | 'ai_generated';
  category: string;
  title: string;
  content: string;
  source?: string;
  sourceType?: string;
  actionableTip?: string;
  theme?: string;
  inspiredBy?: string[];
  personalizedFor?: string[];
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

/**
 * Analyze ecosystem data and determine health context + recommended wisdom category
 * Exported for use by morning briefing service
 */
export async function analyzeHealthContext(email: string): Promise<HealthContext | null> {
  try {
    const ecosystemData = await fetchAllEcosystemData(email);
    const dataPoints: string[] = [];
    let recovery: number | undefined;
    let strain: number | undefined;
    let hrv: number | undefined;
    let sleepHours: number | undefined;
    let readiness: number | undefined;
    let glucoseInRange: number | undefined;

    // Extract metrics from Whoop
    if (ecosystemData.whoop?.available && ecosystemData.whoop.data) {
      const whoop = ecosystemData.whoop.data;
      if (whoop.avgRecoveryScore) {
        recovery = Math.round(whoop.avgRecoveryScore);
        dataPoints.push(`Recovery: ${recovery}%`);
      }
      if (whoop.avgStrainScore) {
        strain = whoop.avgStrainScore;
        dataPoints.push(`Strain: ${strain.toFixed(1)}`);
      }
      if (whoop.avgHRV) {
        hrv = Math.round(whoop.avgHRV);
        dataPoints.push(`HRV: ${hrv}ms`);
      }
    }

    // Extract metrics from Oura
    if (ecosystemData.oura?.available && ecosystemData.oura.data) {
      const oura = ecosystemData.oura.data;
      if (oura.avgReadinessScore) {
        readiness = Math.round(oura.avgReadinessScore);
        dataPoints.push(`Readiness: ${readiness}`);
      }
      if (oura.avgSleepHours) {
        sleepHours = oura.avgSleepHours;
        dataPoints.push(`Sleep: ${sleepHours.toFixed(1)}h`);
      }
    }

    // Extract metrics from Dexcom
    if (ecosystemData.dexcom?.available && ecosystemData.dexcom.data) {
      const dexcom = ecosystemData.dexcom.data;
      if (dexcom.timeInRange) {
        glucoseInRange = Math.round(dexcom.timeInRange);
        dataPoints.push(`Glucose in range: ${glucoseInRange}%`);
      }
    }

    // If no health data available, return null
    if (dataPoints.length === 0) {
      logger.info('No health data available for digest', { email });
      return null;
    }

    // Determine stress and energy levels
    let stressLevel: 'low' | 'moderate' | 'high' = 'moderate';
    let energyLevel: 'low' | 'moderate' | 'high' = 'moderate';

    if (recovery !== undefined) {
      if (recovery >= 67) energyLevel = 'high';
      else if (recovery < 40) energyLevel = 'low';
    }

    if (hrv !== undefined && recovery !== undefined) {
      if (recovery < 50 || hrv < 40) stressLevel = 'high';
      else if (recovery >= 70 && hrv >= 60) stressLevel = 'low';
    }

    // Determine recommended wisdom category based on health state
    let recommendedFocus: WisdomCategory = 'life_advice';

    if (energyLevel === 'low' || (sleepHours !== undefined && sleepHours < 6)) {
      recommendedFocus = 'self_development'; // Rest, recovery, self-care
    } else if (stressLevel === 'high') {
      recommendedFocus = 'productivity'; // Stress management, mindfulness
    } else if (energyLevel === 'high') {
      recommendedFocus = 'fitness'; // Great day for activity
    } else if (sleepHours !== undefined && sleepHours >= 7.5) {
      recommendedFocus = 'productivity'; // Well-rested, productive day
    }

    // Generate health summary with AI
    let healthSummary = '';
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a friendly health companion. Generate a brief, personalized 1-2 sentence health summary based on the user's metrics. Be warm, specific, and include one actionable suggestion. Don't be preachy.`,
          },
          {
            role: 'user',
            content: `Today's metrics: ${dataPoints.join(', ')}. Energy level: ${energyLevel}. Stress level: ${stressLevel}.`,
          },
        ],
        max_tokens: 100,
        temperature: 0.8,
      });
      healthSummary = response.choices[0]?.message?.content?.trim() || '';
    } catch (e) {
      logger.error('Error generating health summary', { error: e });
      healthSummary = `Your metrics today: ${dataPoints.slice(0, 2).join(', ')}.`;
    }

    return {
      recovery,
      strain,
      hrv,
      sleepHours,
      readiness,
      glucoseInRange,
      stressLevel,
      energyLevel,
      recommendedFocus,
      healthSummary,
      dataPoints,
    };
  } catch (error) {
    logger.error('Error analyzing health context', { error, email });
    return null;
  }
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
   * Uses AI to generate personalized wisdom based on health context
   */
  async generateDigest(email: string, itemCount: number = 2): Promise<DailyDigest | null> {
    try {
      logger.info('Generating AI-powered digest', { email });

      // Get user preferences
      const prefs = await PreferenceLearner.getPreferences(email);

      const items: DigestItem[] = [];

      // Step 1: Get health context
      const healthContext = await analyzeHealthContext(email);

      if (healthContext) {
        // Add health summary as the first item
        items.push({
          id: `health_summary_${Date.now()}`,
          type: 'health_insight',
          category: 'HEALTH',
          title: 'Your Daily Health Summary',
          content: healthContext.healthSummary,
          actionableTip: healthContext.energyLevel === 'high'
            ? 'Great energy today - perfect for tackling something challenging!'
            : healthContext.energyLevel === 'low'
              ? 'Take it easy today. Rest is productive too.'
              : 'Listen to your body and pace yourself.',
        });

        logger.info('Added health summary to digest', {
          email,
          energyLevel: healthContext.energyLevel,
          stressLevel: healthContext.stressLevel,
          recommendedFocus: healthContext.recommendedFocus,
        });

        // Step 2: Generate personalized wisdom using AI + RAG
        try {
          // Convert to WisdomHealthContext for the AI generator
          const wisdomContext: WisdomHealthContext = {
            recovery: healthContext.recovery,
            strain: healthContext.strain,
            hrv: healthContext.hrv,
            hrvTrend: healthContext.hrvTrend,
            sleepHours: healthContext.sleepHours,
            sleepQuality: healthContext.sleepQuality,
            readiness: healthContext.readiness,
            glucoseInRange: healthContext.glucoseInRange,
            stressLevel: healthContext.stressLevel,
            energyLevel: healthContext.energyLevel,
            recommendedFocus: healthContext.recommendedFocus,
            recentPatterns: healthContext.recentPatterns,
            dayOfWeek: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
            timeOfDay: this.getTimeOfDay(),
          };

          const generatedWisdom = await AIWisdomGenerator.generate(wisdomContext);

          if (generatedWisdom) {
            // Store for learning/analytics
            const wisdomId = await AIWisdomGenerator.store(email, generatedWisdom, wisdomContext);

            items.push({
              id: wisdomId || `ai_wisdom_${Date.now()}`,
              type: 'ai_generated',
              category: generatedWisdom.category,
              title: generatedWisdom.title,
              content: generatedWisdom.content,
              actionableTip: generatedWisdom.actionableTip,
              theme: generatedWisdom.theme,
              inspiredBy: generatedWisdom.inspiredBy,
              personalizedFor: generatedWisdom.personalizedFor,
            });

            logger.info('Generated AI wisdom for digest', {
              email,
              title: generatedWisdom.title,
              theme: generatedWisdom.theme,
              personalizedFor: generatedWisdom.personalizedFor,
            });
          } else {
            // Fallback to static library if AI fails
            logger.warn('AI generation failed, falling back to library', { email });
            const fallbackWisdom = await WisdomLibraryService.getUnseen(email, healthContext.recommendedFocus);
            if (fallbackWisdom) {
              items.push({
                id: fallbackWisdom.id,
                type: 'wisdom',
                category: fallbackWisdom.category,
                title: fallbackWisdom.title,
                content: fallbackWisdom.content,
                source: fallbackWisdom.source,
                sourceType: fallbackWisdom.source_type,
                actionableTip: fallbackWisdom.actionable_tip,
              });
            }
          }
        } catch (wisdomError) {
          logger.error('Error generating wisdom', { error: wisdomError, email });
        }
      } else {
        // No health data - still generate AI wisdom with minimal context
        logger.info('No health data, generating general wisdom', { email });

        const minimalContext: WisdomHealthContext = {
          stressLevel: 'moderate',
          energyLevel: 'moderate',
          recommendedFocus: 'life_advice',
          dayOfWeek: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
          timeOfDay: this.getTimeOfDay(),
        };

        const generatedWisdom = await AIWisdomGenerator.generate(minimalContext);

        if (generatedWisdom) {
          const wisdomId = await AIWisdomGenerator.store(email, generatedWisdom, minimalContext);
          items.push({
            id: wisdomId || `ai_wisdom_${Date.now()}`,
            type: 'ai_generated',
            category: generatedWisdom.category,
            title: generatedWisdom.title,
            content: generatedWisdom.content,
            actionableTip: generatedWisdom.actionableTip,
            theme: generatedWisdom.theme,
            inspiredBy: generatedWisdom.inspiredBy,
          });
        } else {
          // Final fallback to static library
          const wisdomEntries = await WisdomLibraryService.getDigestContent(email, itemCount);
          for (const entry of wisdomEntries) {
            items.push({
              id: entry.id,
              type: 'wisdom',
              category: entry.category,
              title: entry.title,
              content: entry.content,
              source: entry.source,
              sourceType: entry.source_type,
              actionableTip: entry.actionable_tip,
            });
          }
        }
      }

      if (items.length === 0) {
        logger.warn('No items generated for digest', { email });
        return null;
      }

      const digest: DailyDigest = {
        userId: '',
        email,
        items,
        generatedAt: new Date(),
        preferredTime: prefs.preferredTime,
        timezone: prefs.timezone,
      };

      logger.info('AI-powered digest generated', {
        email,
        itemCount: items.length,
        hasHealthData: !!healthContext,
        isAIGenerated: items.some(i => i.type === 'ai_generated'),
      });

      return digest;
    } catch (error) {
      logger.error('Error generating digest', { error, email });
      return null;
    }
  }

  /**
   * Get time of day for context
   */
  private getTimeOfDay(): 'morning' | 'afternoon' | 'evening' {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
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
   * Sends wisdom title + contextualized body with health data
   * Respects daily notification limits
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

      // Check daily notification limit first
      const canSend = await canSendNotification(email, 'medium', 'digest');
      if (!canSend) {
        logger.info('Skipping digest notification - daily limit reached', { email });
        return false;
      }

      // Find health insight and wisdom items
      const healthItem = digest.items.find(item => item.type === 'health_insight');
      const wisdomItem = digest.items.find(item => item.type === 'wisdom');

      // Use wisdom for the notification (title + content)
      // Fall back to first item if no wisdom
      const mainItem = wisdomItem || digest.items[0];

      // Title: Use wisdom title
      let title = mainItem.title;
      if (title.length > 50) {
        title = title.substring(0, 47) + '...';
      }

      // Body: Prepend brief health context to wisdom content
      let body = mainItem.content;

      // Add health context at the start if available
      if (healthItem?.content) {
        // Extract key metric from health summary (first sentence or short version)
        const healthBrief = healthItem.content.split('.')[0];
        if (healthBrief && healthBrief.length < 60) {
          body = `${healthBrief}. ${body}`;
        }
      }

      if (body.length > 250) {
        body = body.substring(0, 247) + '...';
      }

      const sent = await sendPushNotification(email, {
        title,
        body,
        data: {
          type: 'daily_digest',
          item_count: digest.items.length.toString(),
          first_item_id: mainItem.id,
          first_item_type: mainItem.type,
          category: mainItem.category,
          // Include full content for rich detail view
          content: mainItem.content,
          recommendation: mainItem.actionableTip,
          // Health context for detail screen
          health_summary: healthItem?.content,
          health_tip: healthItem?.actionableTip,
          action_url: '/sage',
        },
      });

      if (sent > 0) {
        // Track digest notification for daily limit
        await markThemeNotified(email, 'digest', 'digest');
      }

      logger.info('Digest notification sent', { email, sent: sent > 0, title });
      return sent > 0;
    } catch (error) {
      logger.error('Error sending digest notification', { error, email });
      return false;
    }
  }

  /**
   * Check if user already received a digest today (prevents duplicate sends)
   */
  async alreadySentToday(email: string): Promise<boolean> {
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { data } = await this.supabase
        .from('daily_digests')
        .select('id')
        .eq('user_email', email)
        .gte('generated_at', todayStart.toISOString())
        .limit(1);

      return data && data.length > 0;
    } catch (error) {
      logger.warn('Error checking if digest sent today', { error, email });
      return false; // Allow sending if check fails
    }
  }

  /**
   * Process and deliver digest to a single user
   */
  async deliverDigestToUser(email: string): Promise<DigestDeliveryResult> {
    try {
      // Check if we already sent a digest today (prevent duplicates)
      if (await this.alreadySentToday(email)) {
        logger.info('Digest already sent today, skipping', { email });
        return {
          email,
          success: true,
          itemCount: 0,
          notificationSent: false,
          error: 'Already sent today',
        };
      }

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
