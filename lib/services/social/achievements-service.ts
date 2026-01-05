/**
 * Achievements Service
 *
 * Handles auto-generated achievements based on user milestones
 *
 * @module lib/services/social/achievements-service
 */

import { createAdminClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/utils/logger';
import { OneSignalService } from '../onesignal-service';

const logger = createLogger('AchievementsService');

export type AchievementType =
  | 'goal_completed'
  | 'streak_milestone'
  | 'progress_milestone'
  | 'first_goal'
  | 'category_master'
  | 'challenge_won'
  | 'early_achiever'
  | 'consistency_king'
  | 'social_butterfly';

export interface Achievement {
  id: string;
  userEmail: string;
  achievementType: AchievementType;
  title: string;
  description: string | null;
  emoji: string;
  relatedGoalId: string | null;
  relatedChallengeId: string | null;
  relatedCategory: string | null;
  streakDays: number | null;
  metadata: Record<string, unknown>;
  isShared: boolean;
  sharedAt: string | null;
  earnedAt: string;
  createdAt: string;
}

interface AchievementDefinition {
  type: AchievementType;
  title: string;
  description: string;
  emoji: string;
}

// Achievement definitions
const ACHIEVEMENT_DEFINITIONS: Record<string, AchievementDefinition> = {
  first_goal: {
    type: 'first_goal',
    title: 'First Steps',
    description: 'Created your first health goal',
    emoji: '🎯',
  },
  goal_completed: {
    type: 'goal_completed',
    title: 'Goal Crusher',
    description: 'Completed a health goal',
    emoji: '🏆',
  },
  early_achiever: {
    type: 'early_achiever',
    title: 'Early Bird',
    description: 'Completed a goal before the deadline',
    emoji: '⚡',
  },
  streak_7: {
    type: 'streak_milestone',
    title: 'Week Warrior',
    description: '7-day consistency streak',
    emoji: '🔥',
  },
  streak_14: {
    type: 'streak_milestone',
    title: 'Fortnight Fighter',
    description: '14-day consistency streak',
    emoji: '💪',
  },
  streak_30: {
    type: 'streak_milestone',
    title: 'Monthly Master',
    description: '30-day consistency streak',
    emoji: '🌟',
  },
  streak_60: {
    type: 'streak_milestone',
    title: 'Double Down',
    description: '60-day consistency streak',
    emoji: '⭐',
  },
  streak_90: {
    type: 'streak_milestone',
    title: 'Legendary',
    description: '90-day consistency streak',
    emoji: '👑',
  },
  progress_25: {
    type: 'progress_milestone',
    title: 'Getting Started',
    description: 'Reached 25% progress on a goal',
    emoji: '🌱',
  },
  progress_50: {
    type: 'progress_milestone',
    title: 'Halfway There',
    description: 'Reached 50% progress on a goal',
    emoji: '⭐',
  },
  progress_75: {
    type: 'progress_milestone',
    title: 'Almost There',
    description: 'Reached 75% progress on a goal',
    emoji: '🌟',
  },
  category_master: {
    type: 'category_master',
    title: 'Category Master',
    description: 'Completed 5 goals in the same category',
    emoji: '🎓',
  },
  challenge_won: {
    type: 'challenge_won',
    title: 'Challenge Victor',
    description: 'Won a friend challenge',
    emoji: '🥇',
  },
  consistency_king: {
    type: 'consistency_king',
    title: 'Consistency King',
    description: 'Met your goal 7 days in a row',
    emoji: '👑',
  },
  social_butterfly: {
    type: 'social_butterfly',
    title: 'Social Butterfly',
    description: 'Cheered 10 friends on their goals',
    emoji: '🦋',
  },
};

class AchievementsServiceClass {
  private supabase = createAdminClient();

  // ============================================
  // ACHIEVEMENT GRANTING
  // ============================================

  /**
   * Grant an achievement to a user
   */
  async grantAchievement(
    email: string,
    type: AchievementType,
    context: {
      goalId?: string;
      challengeId?: string;
      category?: string;
      streakDays?: number;
      metadata?: Record<string, unknown>;
    } = {}
  ): Promise<{ success: boolean; achievementId?: string; error?: string }> {
    try {
      // Get achievement definition
      let definition: AchievementDefinition;

      if (type === 'streak_milestone' && context.streakDays) {
        const key = `streak_${context.streakDays}`;
        definition = ACHIEVEMENT_DEFINITIONS[key];
        if (!definition) {
          return { success: false, error: `No definition for ${key}` };
        }
      } else if (type === 'progress_milestone' && context.metadata?.progressPct) {
        const pct = context.metadata.progressPct as number;
        const key = `progress_${pct}`;
        definition = ACHIEVEMENT_DEFINITIONS[key];
        if (!definition) {
          return { success: false, error: `No definition for ${key}` };
        }
      } else {
        definition = ACHIEVEMENT_DEFINITIONS[type];
        if (!definition) {
          return { success: false, error: `No definition for ${type}` };
        }
      }

      // Use the database function to grant (handles duplicates)
      const { data: achievementId, error } = await this.supabase.rpc('grant_achievement', {
        p_email: email,
        p_type: type,
        p_title: definition.title,
        p_description: definition.description,
        p_emoji: definition.emoji,
        p_goal_id: context.goalId || null,
        p_challenge_id: context.challengeId || null,
        p_category: context.category || null,
        p_streak_days: context.streakDays || null,
        p_metadata: context.metadata || {},
      });

      if (error) {
        logger.error('Error granting achievement', { email, type, error: error.message });
        return { success: false, error: error.message };
      }

      // If null returned, it was a duplicate
      if (!achievementId) {
        return { success: true, achievementId: undefined }; // Already earned
      }

      // Send notification
      try {
        await OneSignalService.sendPushNotification(email, {
          title: `${definition.emoji} Achievement Unlocked!`,
          body: `You earned: ${definition.title}`,
          data: { type: 'achievement_earned', achievementId },
        });
      } catch (notifError) {
        logger.warn('Failed to send achievement notification', { error: notifError });
      }

      // Generate feed items for friends if shared
      await this.supabase.rpc('generate_feed_for_friends', {
        p_friend_email: email,
        p_activity_type: 'achievement_earned',
        p_title: `Earned: ${definition.title}`,
        p_subtitle: definition.description,
        p_emoji: definition.emoji,
        p_achievement_id: achievementId,
      });

      logger.info('Achievement granted', { email, type, achievementId });
      return { success: true, achievementId };
    } catch (error) {
      logger.error('Exception granting achievement', { error });
      return { success: false, error: 'Failed to grant achievement' };
    }
  }

  /**
   * Check and grant achievements for a user based on their current state
   * Called after goal progress updates, goal completions, etc.
   */
  async checkAndGrantAchievements(email: string): Promise<void> {
    try {
      // Check first goal achievement
      await this.checkFirstGoal(email);

      // Check category master achievements
      await this.checkCategoryMaster(email);

      // Check social butterfly achievement
      await this.checkSocialButterfly(email);
    } catch (error) {
      logger.error('Exception checking achievements', { email, error });
    }
  }

  /**
   * Check for goal-related achievements after a goal update
   */
  async checkGoalAchievements(
    email: string,
    goalId: string,
    previousProgress: number,
    currentProgress: number,
    status: string,
    targetDate?: string
  ): Promise<void> {
    try {
      // Check progress milestones
      const milestones = [25, 50, 75];
      for (const milestone of milestones) {
        if (previousProgress < milestone && currentProgress >= milestone) {
          await this.grantAchievement(email, 'progress_milestone', {
            goalId,
            metadata: { progressPct: milestone },
          });
        }
      }

      // Check goal completed
      if (status === 'completed' && currentProgress >= 100) {
        await this.grantAchievement(email, 'goal_completed', { goalId });

        // Check if completed early
        if (targetDate) {
          const target = new Date(targetDate);
          const now = new Date();
          if (now < target) {
            await this.grantAchievement(email, 'early_achiever', { goalId });
          }
        }
      }
    } catch (error) {
      logger.error('Exception checking goal achievements', { email, goalId, error });
    }
  }

  /**
   * Check for streak achievements
   */
  async checkStreakAchievements(email: string, streakDays: number): Promise<void> {
    try {
      const milestones = [7, 14, 30, 60, 90];

      for (const days of milestones) {
        if (streakDays >= days) {
          await this.grantAchievement(email, 'streak_milestone', {
            streakDays: days,
          });
        }
      }
    } catch (error) {
      logger.error('Exception checking streak achievements', { email, streakDays, error });
    }
  }

  /**
   * Grant challenge won achievement
   */
  async grantChallengeWon(email: string, challengeId: string): Promise<void> {
    await this.grantAchievement(email, 'challenge_won', { challengeId });
  }

  // ============================================
  // PRIVATE CHECK METHODS
  // ============================================

  private async checkFirstGoal(email: string): Promise<void> {
    // Check if user already has this achievement
    const { data: existing } = await this.supabase
      .from('user_achievements')
      .select('id')
      .eq('user_email', email)
      .eq('achievement_type', 'first_goal')
      .single();

    if (existing) return;

    // Check if user has any goals
    const { count } = await this.supabase
      .from('user_health_goals')
      .select('id', { count: 'exact', head: true })
      .eq('email', email);

    if (count && count > 0) {
      await this.grantAchievement(email, 'first_goal');
    }
  }

  private async checkCategoryMaster(email: string): Promise<void> {
    // Get completed goals by category
    const { data: categoryCounts } = await this.supabase
      .from('user_health_goals')
      .select('category')
      .eq('email', email)
      .eq('status', 'completed');

    if (!categoryCounts) return;

    // Count by category
    const counts: Record<string, number> = {};
    for (const row of categoryCounts) {
      counts[row.category] = (counts[row.category] || 0) + 1;
    }

    // Check if any category has 5+ completed goals
    for (const [category, count] of Object.entries(counts)) {
      if (count >= 5) {
        // Check if already earned for this category
        const { data: existing } = await this.supabase
          .from('user_achievements')
          .select('id')
          .eq('user_email', email)
          .eq('achievement_type', 'category_master')
          .eq('related_category', category)
          .single();

        if (!existing) {
          await this.grantAchievement(email, 'category_master', {
            category,
            metadata: { completedCount: count },
          });
        }
      }
    }
  }

  private async checkSocialButterfly(email: string): Promise<void> {
    // Check if already earned
    const { data: existing } = await this.supabase
      .from('user_achievements')
      .select('id')
      .eq('user_email', email)
      .eq('achievement_type', 'social_butterfly')
      .single();

    if (existing) return;

    // Count unique friends cheered
    const { data: cheers } = await this.supabase
      .from('goal_interactions')
      .select('to_email')
      .eq('from_email', email)
      .eq('interaction_type', 'cheer');

    if (!cheers) return;

    const uniqueFriends = new Set(cheers.map(c => c.to_email));
    if (uniqueFriends.size >= 10) {
      await this.grantAchievement(email, 'social_butterfly', {
        metadata: { friendsCheered: uniqueFriends.size },
      });
    }
  }

  // ============================================
  // QUERIES
  // ============================================

  /**
   * Get all achievements for a user
   */
  async getUserAchievements(email: string): Promise<Achievement[]> {
    try {
      const { data, error } = await this.supabase
        .from('user_achievements')
        .select('*')
        .eq('user_email', email)
        .order('earned_at', { ascending: false });

      if (error) {
        logger.error('Error fetching user achievements', { email, error: error.message });
        return [];
      }

      return (data || []).map(this.mapAchievement);
    } catch (error) {
      logger.error('Exception fetching user achievements', { error });
      return [];
    }
  }

  /**
   * Get recent achievements for a user
   */
  async getRecentAchievements(email: string, limit: number = 5): Promise<Achievement[]> {
    try {
      const { data, error } = await this.supabase
        .from('user_achievements')
        .select('*')
        .eq('user_email', email)
        .order('earned_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Error fetching recent achievements', { email, error: error.message });
        return [];
      }

      return (data || []).map(this.mapAchievement);
    } catch (error) {
      logger.error('Exception fetching recent achievements', { error });
      return [];
    }
  }

  /**
   * Get shared achievements from friends
   */
  async getFriendsAchievements(email: string, limit: number = 20): Promise<Achievement[]> {
    try {
      // Get friends
      const { data: connections } = await this.supabase
        .from('user_connections')
        .select('requester_email, addressee_email')
        .eq('status', 'accepted')
        .or(`requester_email.eq.${email},addressee_email.eq.${email}`);

      if (!connections || connections.length === 0) {
        return [];
      }

      // Get friend emails
      const friendEmails = connections.map(c =>
        c.requester_email === email ? c.addressee_email : c.requester_email
      );

      // Get their shared achievements
      const { data, error } = await this.supabase
        .from('user_achievements')
        .select('*')
        .in('user_email', friendEmails)
        .eq('is_shared', true)
        .order('earned_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Error fetching friends achievements', { email, error: error.message });
        return [];
      }

      return (data || []).map(this.mapAchievement);
    } catch (error) {
      logger.error('Exception fetching friends achievements', { error });
      return [];
    }
  }

  /**
   * Get achievement counts/stats for a user
   */
  async getAchievementStats(email: string): Promise<{
    total: number;
    byType: Record<string, number>;
  }> {
    try {
      const { data, error } = await this.supabase
        .from('user_achievements')
        .select('achievement_type')
        .eq('user_email', email);

      if (error || !data) {
        return { total: 0, byType: {} };
      }

      const byType: Record<string, number> = {};
      for (const row of data) {
        byType[row.achievement_type] = (byType[row.achievement_type] || 0) + 1;
      }

      return { total: data.length, byType };
    } catch (error) {
      logger.error('Exception fetching achievement stats', { error });
      return { total: 0, byType: {} };
    }
  }

  // ============================================
  // SHARING
  // ============================================

  /**
   * Share an achievement
   */
  async shareAchievement(
    achievementId: string,
    email: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('user_achievements')
        .update({
          is_shared: true,
          shared_at: new Date().toISOString(),
        })
        .eq('id', achievementId)
        .eq('user_email', email);

      if (error) {
        logger.error('Error sharing achievement', { achievementId, error: error.message });
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      logger.error('Exception sharing achievement', { error });
      return { success: false, error: 'Failed to share achievement' };
    }
  }

  /**
   * Unshare an achievement
   */
  async unshareAchievement(
    achievementId: string,
    email: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('user_achievements')
        .update({
          is_shared: false,
          shared_at: null,
        })
        .eq('id', achievementId)
        .eq('user_email', email);

      if (error) {
        logger.error('Error unsharing achievement', { achievementId, error: error.message });
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      logger.error('Exception unsharing achievement', { error });
      return { success: false, error: 'Failed to unshare achievement' };
    }
  }

  // ============================================
  // HELPERS
  // ============================================

  private mapAchievement(row: any): Achievement {
    return {
      id: row.id,
      userEmail: row.user_email,
      achievementType: row.achievement_type,
      title: row.title,
      description: row.description,
      emoji: row.emoji,
      relatedGoalId: row.related_goal_id,
      relatedChallengeId: row.related_challenge_id,
      relatedCategory: row.related_category,
      streakDays: row.streak_days,
      metadata: row.metadata || {},
      isShared: row.is_shared,
      sharedAt: row.shared_at,
      earnedAt: row.earned_at,
      createdAt: row.created_at,
    };
  }
}

export const AchievementsService = new AchievementsServiceClass();
