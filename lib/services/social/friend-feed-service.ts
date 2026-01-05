/**
 * Friend Feed Service
 *
 * Handles the activity feed showing friends' progress, achievements, and activities
 *
 * @module lib/services/social/friend-feed-service
 */

import { createAdminClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('FriendFeedService');

export type FeedActivityType =
  | 'goal_created'
  | 'goal_progress'
  | 'goal_completed'
  | 'achievement_earned'
  | 'challenge_created'
  | 'challenge_won';

export interface FeedItem {
  id: string;
  userEmail: string;
  friendEmail: string;
  activityType: FeedActivityType;
  title: string;
  subtitle: string | null;
  emoji: string | null;
  goalId: string | null;
  achievementId: string | null;
  challengeId: string | null;
  hasCheered: boolean;
  cheeredAt: string | null;
  cheerEmoji: string | null;
  activityAt: string;
  expiresAt: string;
  createdAt: string;
}

class FriendFeedServiceClass {
  private supabase = createAdminClient();

  /**
   * Get the activity feed for a user
   */
  async getFeed(
    email: string,
    options: {
      limit?: number;
      offset?: number;
      activityType?: FeedActivityType;
    } = {}
  ): Promise<{ items: FeedItem[]; hasMore: boolean }> {
    try {
      const { limit = 20, offset = 0, activityType } = options;

      let query = this.supabase
        .from('friend_activity_feed')
        .select('*')
        .eq('user_email', email)
        .gt('expires_at', new Date().toISOString())
        .order('activity_at', { ascending: false })
        .range(offset, offset + limit);

      if (activityType) {
        query = query.eq('activity_type', activityType);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Error fetching feed', { email, error: error.message });
        return { items: [], hasMore: false };
      }

      const items = (data || []).map(this.mapFeedItem);
      const hasMore = items.length > limit;

      return { items: items.slice(0, limit), hasMore };
    } catch (error) {
      logger.error('Exception fetching feed', { error });
      return { items: [], hasMore: false };
    }
  }

  /**
   * Get feed item count (for badge)
   */
  async getUnseenCount(email: string): Promise<number> {
    try {
      const { count, error } = await this.supabase
        .from('friend_activity_feed')
        .select('id', { count: 'exact', head: true })
        .eq('user_email', email)
        .eq('has_cheered', false)
        .gt('expires_at', new Date().toISOString())
        .gt('activity_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Last 24 hours

      if (error) {
        return 0;
      }

      return count || 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Cheer a feed item
   */
  async cheerFeedItem(
    feedItemId: string,
    email: string,
    emoji: string = '👏'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: feedItem, error: fetchError } = await this.supabase
        .from('friend_activity_feed')
        .select('friend_email, goal_id, activity_type, title')
        .eq('id', feedItemId)
        .eq('user_email', email)
        .single();

      if (fetchError || !feedItem) {
        return { success: false, error: 'Feed item not found' };
      }

      // Update the feed item
      const { error } = await this.supabase
        .from('friend_activity_feed')
        .update({
          has_cheered: true,
          cheered_at: new Date().toISOString(),
          cheer_emoji: emoji,
        })
        .eq('id', feedItemId)
        .eq('user_email', email);

      if (error) {
        logger.error('Error cheering feed item', { feedItemId, error: error.message });
        return { success: false, error: error.message };
      }

      // If it's a goal-related activity, also create a goal interaction
      if (feedItem.goal_id) {
        await this.supabase
          .from('goal_interactions')
          .insert({
            goal_id: feedItem.goal_id,
            from_email: email,
            to_email: feedItem.friend_email,
            interaction_type: 'cheer',
            emoji,
          });
      }

      logger.info('Feed item cheered', { feedItemId, email });
      return { success: true };
    } catch (error) {
      logger.error('Exception cheering feed item', { error });
      return { success: false, error: 'Failed to cheer' };
    }
  }

  /**
   * Generate a feed item for all friends of a user
   * (Called when something notable happens)
   */
  async generateFeedItem(
    friendEmail: string,
    activityType: FeedActivityType,
    data: {
      title: string;
      subtitle?: string;
      emoji?: string;
      goalId?: string;
      achievementId?: string;
      challengeId?: string;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Use the database function
      const { error } = await this.supabase.rpc('generate_feed_for_friends', {
        p_friend_email: friendEmail,
        p_activity_type: activityType,
        p_title: data.title,
        p_subtitle: data.subtitle || null,
        p_emoji: data.emoji || null,
        p_goal_id: data.goalId || null,
        p_achievement_id: data.achievementId || null,
        p_challenge_id: data.challengeId || null,
      });

      if (error) {
        logger.error('Error generating feed items', { friendEmail, error: error.message });
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      logger.error('Exception generating feed items', { error });
      return { success: false, error: 'Failed to generate feed' };
    }
  }

  /**
   * Clean up expired feed items
   */
  async cleanupExpiredItems(): Promise<{ deleted: number }> {
    try {
      const { error } = await this.supabase.rpc('cleanup_expired_feed_items');

      if (error) {
        logger.error('Error cleaning up feed items', { error: error.message });
        return { deleted: 0 };
      }

      logger.info('Cleaned up expired feed items');
      return { deleted: 0 }; // RPC doesn't return count
    } catch (error) {
      logger.error('Exception cleaning up feed items', { error });
      return { deleted: 0 };
    }
  }

  /**
   * Get feed items for a specific friend
   */
  async getFriendFeed(
    email: string,
    friendEmail: string,
    limit: number = 10
  ): Promise<FeedItem[]> {
    try {
      const { data, error } = await this.supabase
        .from('friend_activity_feed')
        .select('*')
        .eq('user_email', email)
        .eq('friend_email', friendEmail)
        .gt('expires_at', new Date().toISOString())
        .order('activity_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Error fetching friend feed', { email, friendEmail, error: error.message });
        return [];
      }

      return (data || []).map(this.mapFeedItem);
    } catch (error) {
      logger.error('Exception fetching friend feed', { error });
      return [];
    }
  }

  /**
   * Delete a feed item (for user who received it)
   */
  async deleteFeedItem(
    feedItemId: string,
    email: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('friend_activity_feed')
        .delete()
        .eq('id', feedItemId)
        .eq('user_email', email);

      if (error) {
        logger.error('Error deleting feed item', { feedItemId, error: error.message });
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      logger.error('Exception deleting feed item', { error });
      return { success: false, error: 'Failed to delete' };
    }
  }

  // ============================================
  // HELPERS
  // ============================================

  private mapFeedItem(row: any): FeedItem {
    return {
      id: row.id,
      userEmail: row.user_email,
      friendEmail: row.friend_email,
      activityType: row.activity_type,
      title: row.title,
      subtitle: row.subtitle,
      emoji: row.emoji,
      goalId: row.goal_id,
      achievementId: row.achievement_id,
      challengeId: row.challenge_id,
      hasCheered: row.has_cheered,
      cheeredAt: row.cheered_at,
      cheerEmoji: row.cheer_emoji,
      activityAt: row.activity_at,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    };
  }
}

export const FriendFeedService = new FriendFeedServiceClass();
