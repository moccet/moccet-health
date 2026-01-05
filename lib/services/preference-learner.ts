/**
 * Preference Learner Service
 *
 * Tracks user engagement signals (likes, shares, saves, dismisses)
 * and updates user preferences to personalize content delivery.
 *
 * Core principle: Shares are the strongest signal (10x weight)
 *
 * @module lib/services/preference-learner
 */

import { createAdminClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/utils/logger';
import { WisdomCategory, WisdomLibraryService } from './wisdom-library-service';

const logger = createLogger('PreferenceLearner');

// Signal weights - shares are the strongest signal
export const SIGNAL_WEIGHTS = {
  like: 3.0,
  share: 10.0, // Strongest signal - user stakes social capital
  save: 5.0,
  dismiss: -2.0,
  view: 1.0,
  deep_read: 2.0, // Spent significant time reading
} as const;

export type SignalType = keyof typeof SIGNAL_WEIGHTS;

export interface EngagementSignal {
  contentId: string;
  contentType: 'wisdom' | 'health_insight';
  contentCategory: string;
  signalType: SignalType;
  platform?: string; // For shares: 'whatsapp', 'imessage', 'twitter', 'copy'
  timeSpentSeconds?: number;
}

export interface CategoryPreferences {
  self_development: number;
  fitness: number;
  cooking: number;
  productivity: number;
  life_advice: number;
  health_insights: number;
}

export interface UserPreferences {
  email: string;
  preferences: CategoryPreferences;
  totalEngagements: number;
  totalLikes: number;
  totalShares: number;
  totalSaves: number;
  preferredTime: string;
  timezone: string;
}

class PreferenceLearnerClass {
  private supabase = createAdminClient();

  /**
   * Record an engagement signal and update user preferences
   */
  async recordEngagement(
    email: string,
    signal: EngagementSignal
  ): Promise<void> {
    try {
      const weight = SIGNAL_WEIGHTS[signal.signalType];

      logger.info('Recording engagement', {
        email,
        contentId: signal.contentId,
        signalType: signal.signalType,
        weight,
      });

      // 1. Store the engagement signal
      await this.supabase.from('content_engagement').insert({
        user_email: email,
        content_id: signal.contentId,
        content_type: signal.contentType,
        content_category: signal.contentCategory,
        signal_type: signal.signalType,
        signal_weight: weight,
        platform: signal.platform,
        time_spent_seconds: signal.timeSpentSeconds,
      });

      // 2. Update user preference scores via database function
      await this.supabase.rpc('update_user_preference_score', {
        p_email: email,
        p_category: signal.contentCategory,
        p_signal_weight: weight,
      });

      // 3. Update engagement counters
      await this.updateEngagementCounters(email, signal.signalType);

      // 4. If wisdom content, update its engagement stats
      if (signal.contentType === 'wisdom') {
        await WisdomLibraryService.updateEngagementStats(
          signal.contentId,
          signal.signalType as 'like' | 'share' | 'save' | 'dismiss'
        );
      }

      logger.info('Engagement recorded successfully', {
        email,
        signalType: signal.signalType,
      });
    } catch (error) {
      logger.error('Error recording engagement', { error, email, signal });
      throw error;
    }
  }

  /**
   * Update user's engagement counters
   */
  private async updateEngagementCounters(
    email: string,
    signalType: SignalType
  ): Promise<void> {
    const updates: Record<string, number> = {};

    if (signalType === 'like') {
      updates.total_likes = 1;
    } else if (signalType === 'share') {
      updates.total_shares = 1;
    } else if (signalType === 'save') {
      updates.total_saves = 1;
    }

    if (Object.keys(updates).length === 0) return;

    // Increment the appropriate counter
    const { data: existing } = await this.supabase
      .from('user_content_preferences')
      .select('total_likes, total_shares, total_saves')
      .eq('user_email', email)
      .single();

    if (existing) {
      const newValues: Record<string, number> = {};
      if (updates.total_likes) {
        newValues.total_likes = (existing.total_likes || 0) + 1;
      }
      if (updates.total_shares) {
        newValues.total_shares = (existing.total_shares || 0) + 1;
      }
      if (updates.total_saves) {
        newValues.total_saves = (existing.total_saves || 0) + 1;
      }

      await this.supabase
        .from('user_content_preferences')
        .update(newValues)
        .eq('user_email', email);
    }
  }

  /**
   * Get user's category preferences (sorted by score)
   */
  async getPreferences(email: string): Promise<UserPreferences> {
    // Ensure user has a preferences row
    await this.supabase
      .from('user_content_preferences')
      .upsert(
        { user_email: email },
        { onConflict: 'user_email' }
      );

    const { data, error } = await this.supabase
      .from('user_content_preferences')
      .select('*')
      .eq('user_email', email)
      .single();

    if (error || !data) {
      logger.error('Error fetching preferences', { error, email });
      // Return defaults
      return {
        email,
        preferences: {
          self_development: 0.5,
          fitness: 0.5,
          cooking: 0.5,
          productivity: 0.5,
          life_advice: 0.5,
          health_insights: 0.5,
        },
        totalEngagements: 0,
        totalLikes: 0,
        totalShares: 0,
        totalSaves: 0,
        preferredTime: '08:00',
        timezone: 'UTC',
      };
    }

    return {
      email,
      preferences: {
        self_development: data.self_development_score || 0.5,
        fitness: data.fitness_score || 0.5,
        cooking: data.cooking_score || 0.5,
        productivity: data.productivity_score || 0.5,
        life_advice: data.life_advice_score || 0.5,
        health_insights: data.health_insights_score || 0.5,
      },
      totalEngagements: data.total_engagements || 0,
      totalLikes: data.total_likes || 0,
      totalShares: data.total_shares || 0,
      totalSaves: data.total_saves || 0,
      preferredTime: data.preferred_time || '08:00',
      timezone: data.timezone || 'UTC',
    };
  }

  /**
   * Get user's top preferred categories (sorted)
   */
  async getTopCategories(
    email: string,
    limit: number = 3
  ): Promise<{ category: WisdomCategory; score: number }[]> {
    const prefs = await this.getPreferences(email);

    const categories: { category: WisdomCategory; score: number }[] = [
      { category: 'self_development', score: prefs.preferences.self_development },
      { category: 'fitness', score: prefs.preferences.fitness },
      { category: 'cooking', score: prefs.preferences.cooking },
      { category: 'productivity', score: prefs.preferences.productivity },
      { category: 'life_advice', score: prefs.preferences.life_advice },
    ];

    return categories
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Get engagement history for a user
   */
  async getEngagementHistory(
    email: string,
    limit: number = 50
  ): Promise<EngagementSignal[]> {
    const { data, error } = await this.supabase
      .from('content_engagement')
      .select('*')
      .eq('user_email', email)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('Error fetching engagement history', { error, email });
      return [];
    }

    return (data || []).map((e) => ({
      contentId: e.content_id,
      contentType: e.content_type,
      contentCategory: e.content_category,
      signalType: e.signal_type,
      platform: e.platform,
      timeSpentSeconds: e.time_spent_seconds,
    }));
  }

  /**
   * Update user's preferred notification time
   */
  async setPreferredTime(
    email: string,
    time: string,
    timezone?: string
  ): Promise<void> {
    const updates: Record<string, string> = { preferred_time: time };
    if (timezone) {
      updates.timezone = timezone;
    }

    await this.supabase
      .from('user_content_preferences')
      .upsert(
        { user_email: email, ...updates },
        { onConflict: 'user_email' }
      );
  }

  /**
   * Decay all user preferences over time (so recent engagement matters more)
   * Run this as a weekly cron job
   */
  async decayAllPreferences(decayFactor: number = 0.95): Promise<void> {
    try {
      // Decay all scores toward 0.5 (neutral)
      await this.supabase.rpc('decay_all_preferences', {
        decay_factor: decayFactor,
      });

      logger.info('Decayed all user preferences', { decayFactor });
    } catch (error) {
      logger.error('Error decaying preferences', { error });
    }
  }

  /**
   * Get aggregate engagement stats
   */
  async getEngagementStats(): Promise<{
    totalEngagements: number;
    totalLikes: number;
    totalShares: number;
    totalSaves: number;
    topCategories: { category: string; count: number }[];
  }> {
    // Total counts
    const { count: totalEngagements } = await this.supabase
      .from('content_engagement')
      .select('*', { count: 'exact', head: true });

    const { count: totalLikes } = await this.supabase
      .from('content_engagement')
      .select('*', { count: 'exact', head: true })
      .eq('signal_type', 'like');

    const { count: totalShares } = await this.supabase
      .from('content_engagement')
      .select('*', { count: 'exact', head: true })
      .eq('signal_type', 'share');

    const { count: totalSaves } = await this.supabase
      .from('content_engagement')
      .select('*', { count: 'exact', head: true })
      .eq('signal_type', 'save');

    // Top categories by engagement
    const { data: categoryData } = await this.supabase
      .from('content_engagement')
      .select('content_category')
      .not('content_category', 'is', null);

    const categoryCounts: Record<string, number> = {};
    for (const row of categoryData || []) {
      const cat = row.content_category;
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    }

    const topCategories = Object.entries(categoryCounts)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalEngagements: totalEngagements || 0,
      totalLikes: totalLikes || 0,
      totalShares: totalShares || 0,
      totalSaves: totalSaves || 0,
      topCategories,
    };
  }
}

// Export singleton instance
export const PreferenceLearner = new PreferenceLearnerClass();
