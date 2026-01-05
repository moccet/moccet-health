/**
 * Social Goals Service
 *
 * Handles goal sharing, viewing friends' goals, and goal interactions (cheers, comments)
 *
 * @module lib/services/social/social-goals-service
 */

import { createAdminClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/utils/logger';
import { OneSignalService } from '../onesignal-service';

const logger = createLogger('SocialGoalsService');

export interface ShareGoalSettings {
  isPublic: boolean;
  sharedWith?: string[];
  shareProgress: boolean;
  shareCurrentValue: boolean;
}

export interface SharedGoal {
  goalId: string;
  ownerEmail: string;
  title: string;
  category: string;
  progressPct: number | null;
  currentValue: number | null;
  targetValue: number | null;
  unit: string | null;
  direction: string;
  shareProgress: boolean;
  shareCurrentValue: boolean;
  sharedAt: string;
}

export interface GoalInteraction {
  id: string;
  goalId: string;
  fromEmail: string;
  toEmail: string;
  interactionType: 'cheer' | 'comment' | 'milestone_cheer';
  emoji?: string;
  message?: string;
  atProgressPct?: number;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

class SocialGoalsServiceClass {
  private supabase = createAdminClient();

  // ============================================
  // GOAL SHARING
  // ============================================

  /**
   * Share a goal with friends
   */
  async shareGoal(
    goalId: string,
    ownerEmail: string,
    settings: ShareGoalSettings
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Verify the goal belongs to this user
      const { data: goal, error: goalError } = await this.supabase
        .from('user_health_goals')
        .select('id, email, title, category')
        .eq('id', goalId)
        .eq('email', ownerEmail)
        .single();

      if (goalError || !goal) {
        return { success: false, error: 'Goal not found or not owned by user' };
      }

      // Upsert the shared_goals record
      const { error } = await this.supabase
        .from('shared_goals')
        .upsert({
          goal_id: goalId,
          owner_email: ownerEmail,
          is_public: settings.isPublic,
          shared_with: settings.sharedWith || [],
          share_progress: settings.shareProgress,
          share_current_value: settings.shareCurrentValue,
          shared_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'goal_id',
        });

      if (error) {
        logger.error('Error sharing goal', { goalId, error: error.message });
        return { success: false, error: error.message };
      }

      // Generate feed items for friends
      await this.supabase.rpc('generate_feed_for_friends', {
        p_friend_email: ownerEmail,
        p_activity_type: 'goal_created',
        p_title: `Started a new goal: ${goal.title}`,
        p_subtitle: goal.category,
        p_emoji: '🎯',
        p_goal_id: goalId,
      });

      logger.info('Goal shared', { goalId, ownerEmail, isPublic: settings.isPublic });
      return { success: true };
    } catch (error) {
      logger.error('Exception sharing goal', { error });
      return { success: false, error: 'Failed to share goal' };
    }
  }

  /**
   * Unshare a goal
   */
  async unshareGoal(
    goalId: string,
    ownerEmail: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('shared_goals')
        .delete()
        .eq('goal_id', goalId)
        .eq('owner_email', ownerEmail);

      if (error) {
        logger.error('Error unsharing goal', { goalId, error: error.message });
        return { success: false, error: error.message };
      }

      logger.info('Goal unshared', { goalId, ownerEmail });
      return { success: true };
    } catch (error) {
      logger.error('Exception unsharing goal', { error });
      return { success: false, error: 'Failed to unshare goal' };
    }
  }

  /**
   * Update share settings for a goal
   */
  async updateShareSettings(
    goalId: string,
    ownerEmail: string,
    settings: Partial<ShareGoalSettings>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (settings.isPublic !== undefined) {
        updateData.is_public = settings.isPublic;
      }
      if (settings.sharedWith !== undefined) {
        updateData.shared_with = settings.sharedWith;
      }
      if (settings.shareProgress !== undefined) {
        updateData.share_progress = settings.shareProgress;
      }
      if (settings.shareCurrentValue !== undefined) {
        updateData.share_current_value = settings.shareCurrentValue;
      }

      const { error } = await this.supabase
        .from('shared_goals')
        .update(updateData)
        .eq('goal_id', goalId)
        .eq('owner_email', ownerEmail);

      if (error) {
        logger.error('Error updating share settings', { goalId, error: error.message });
        return { success: false, error: error.message };
      }

      logger.info('Share settings updated', { goalId, ownerEmail });
      return { success: true };
    } catch (error) {
      logger.error('Exception updating share settings', { error });
      return { success: false, error: 'Failed to update share settings' };
    }
  }

  /**
   * Check if a goal is shared
   */
  async isGoalShared(goalId: string): Promise<boolean> {
    const { data } = await this.supabase
      .from('shared_goals')
      .select('id')
      .eq('goal_id', goalId)
      .single();

    return !!data;
  }

  /**
   * Get share settings for a goal
   */
  async getShareSettings(
    goalId: string,
    ownerEmail: string
  ): Promise<ShareGoalSettings | null> {
    const { data, error } = await this.supabase
      .from('shared_goals')
      .select('is_public, shared_with, share_progress, share_current_value')
      .eq('goal_id', goalId)
      .eq('owner_email', ownerEmail)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      isPublic: data.is_public,
      sharedWith: data.shared_with || [],
      shareProgress: data.share_progress,
      shareCurrentValue: data.share_current_value,
    };
  }

  // ============================================
  // VIEWING FRIENDS' GOALS
  // ============================================

  /**
   * Get all shared goals from friends
   */
  async getFriendsSharedGoals(email: string): Promise<SharedGoal[]> {
    try {
      const { data, error } = await this.supabase.rpc('get_friends_shared_goals', {
        p_email: email,
      });

      if (error) {
        logger.error('Error fetching friends shared goals', { email, error: error.message });
        return [];
      }

      return (data || []).map((row: any) => ({
        goalId: row.goal_id,
        ownerEmail: row.owner_email,
        title: row.title,
        category: row.category,
        progressPct: row.share_progress ? row.progress_pct : null,
        currentValue: row.share_current_value ? row.current_value : null,
        targetValue: row.share_current_value ? row.target_value : null,
        unit: row.unit,
        direction: row.direction,
        shareProgress: row.share_progress,
        shareCurrentValue: row.share_current_value,
        sharedAt: row.shared_at,
      }));
    } catch (error) {
      logger.error('Exception fetching friends shared goals', { error });
      return [];
    }
  }

  /**
   * Get details of a specific friend's goal
   */
  async getFriendGoalDetails(
    goalId: string,
    viewerEmail: string
  ): Promise<{ goal: SharedGoal | null; interactions: GoalInteraction[]; error?: string }> {
    try {
      // Check if viewer can see this goal
      const { data: canView } = await this.supabase.rpc('can_view_shared_goal', {
        viewer_email: viewerEmail,
        p_goal_id: goalId,
      });

      if (!canView) {
        return { goal: null, interactions: [], error: 'Goal not visible to you' };
      }

      // Get the goal with share settings
      const { data: goalData, error: goalError } = await this.supabase
        .from('user_health_goals')
        .select(`
          id, email, title, category, progress_pct, current_value, target_value,
          unit, direction, status,
          shared_goals!inner (
            owner_email, is_public, shared_with, share_progress, share_current_value, shared_at
          )
        `)
        .eq('id', goalId)
        .single();

      if (goalError || !goalData) {
        return { goal: null, interactions: [], error: 'Goal not found' };
      }

      const shareSettings = goalData.shared_goals as any;

      const goal: SharedGoal = {
        goalId: goalData.id,
        ownerEmail: shareSettings.owner_email,
        title: goalData.title,
        category: goalData.category,
        progressPct: shareSettings.share_progress ? goalData.progress_pct : null,
        currentValue: shareSettings.share_current_value ? goalData.current_value : null,
        targetValue: shareSettings.share_current_value ? goalData.target_value : null,
        unit: goalData.unit,
        direction: goalData.direction,
        shareProgress: shareSettings.share_progress,
        shareCurrentValue: shareSettings.share_current_value,
        sharedAt: shareSettings.shared_at,
      };

      // Get interactions
      const { data: interactionsData } = await this.supabase
        .from('goal_interactions')
        .select('*')
        .eq('goal_id', goalId)
        .order('created_at', { ascending: false })
        .limit(50);

      const interactions: GoalInteraction[] = (interactionsData || []).map((row: any) => ({
        id: row.id,
        goalId: row.goal_id,
        fromEmail: row.from_email,
        toEmail: row.to_email,
        interactionType: row.interaction_type,
        emoji: row.emoji,
        message: row.message,
        atProgressPct: row.at_progress_pct,
        isRead: row.is_read,
        readAt: row.read_at,
        createdAt: row.created_at,
      }));

      return { goal, interactions };
    } catch (error) {
      logger.error('Exception fetching friend goal details', { error });
      return { goal: null, interactions: [], error: 'Failed to fetch goal details' };
    }
  }

  // ============================================
  // GOAL INTERACTIONS
  // ============================================

  /**
   * Send a cheer to a friend's goal
   */
  async cheerGoal(
    goalId: string,
    fromEmail: string,
    emoji: string = '💪'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if user can view this goal
      const { data: canView } = await this.supabase.rpc('can_view_shared_goal', {
        viewer_email: fromEmail,
        p_goal_id: goalId,
      });

      if (!canView) {
        return { success: false, error: 'Cannot cheer a goal you cannot view' };
      }

      // Get goal owner and progress
      const { data: goal } = await this.supabase
        .from('user_health_goals')
        .select('email, title, progress_pct')
        .eq('id', goalId)
        .single();

      if (!goal) {
        return { success: false, error: 'Goal not found' };
      }

      // Create the interaction
      const { error } = await this.supabase
        .from('goal_interactions')
        .insert({
          goal_id: goalId,
          from_email: fromEmail,
          to_email: goal.email,
          interaction_type: 'cheer',
          emoji,
          at_progress_pct: goal.progress_pct,
        });

      if (error) {
        logger.error('Error creating cheer', { goalId, error: error.message });
        return { success: false, error: error.message };
      }

      // Send push notification
      try {
        await OneSignalService.sendPushNotification(goal.email, {
          title: `${emoji} Someone cheered you!`,
          body: `${fromEmail.split('@')[0]} cheered your "${goal.title}" goal!`,
          data: { type: 'goal_cheer', goalId },
        });
      } catch (notifError) {
        logger.warn('Failed to send cheer notification', { error: notifError });
      }

      logger.info('Goal cheered', { goalId, fromEmail, toEmail: goal.email });
      return { success: true };
    } catch (error) {
      logger.error('Exception cheering goal', { error });
      return { success: false, error: 'Failed to send cheer' };
    }
  }

  /**
   * Comment on a friend's goal
   */
  async commentOnGoal(
    goalId: string,
    fromEmail: string,
    message: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!message || message.length > 280) {
        return { success: false, error: 'Comment must be 1-280 characters' };
      }

      // Check if user can view this goal
      const { data: canView } = await this.supabase.rpc('can_view_shared_goal', {
        viewer_email: fromEmail,
        p_goal_id: goalId,
      });

      if (!canView) {
        return { success: false, error: 'Cannot comment on a goal you cannot view' };
      }

      // Get goal owner
      const { data: goal } = await this.supabase
        .from('user_health_goals')
        .select('email, title, progress_pct')
        .eq('id', goalId)
        .single();

      if (!goal) {
        return { success: false, error: 'Goal not found' };
      }

      // Create the interaction
      const { error } = await this.supabase
        .from('goal_interactions')
        .insert({
          goal_id: goalId,
          from_email: fromEmail,
          to_email: goal.email,
          interaction_type: 'comment',
          message,
          at_progress_pct: goal.progress_pct,
        });

      if (error) {
        logger.error('Error creating comment', { goalId, error: error.message });
        return { success: false, error: error.message };
      }

      // Send push notification
      try {
        await OneSignalService.sendPushNotification(goal.email, {
          title: 'New comment on your goal!',
          body: `${fromEmail.split('@')[0]}: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`,
          data: { type: 'goal_comment', goalId },
        });
      } catch (notifError) {
        logger.warn('Failed to send comment notification', { error: notifError });
      }

      logger.info('Goal comment added', { goalId, fromEmail, toEmail: goal.email });
      return { success: true };
    } catch (error) {
      logger.error('Exception commenting on goal', { error });
      return { success: false, error: 'Failed to add comment' };
    }
  }

  /**
   * Get interactions for a goal
   */
  async getGoalInteractions(
    goalId: string,
    limit: number = 50
  ): Promise<GoalInteraction[]> {
    try {
      const { data, error } = await this.supabase
        .from('goal_interactions')
        .select('*')
        .eq('goal_id', goalId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Error fetching goal interactions', { goalId, error: error.message });
        return [];
      }

      return (data || []).map((row: any) => ({
        id: row.id,
        goalId: row.goal_id,
        fromEmail: row.from_email,
        toEmail: row.to_email,
        interactionType: row.interaction_type,
        emoji: row.emoji,
        message: row.message,
        atProgressPct: row.at_progress_pct,
        isRead: row.is_read,
        readAt: row.read_at,
        createdAt: row.created_at,
      }));
    } catch (error) {
      logger.error('Exception fetching goal interactions', { error });
      return [];
    }
  }

  /**
   * Get unread interactions for a user
   */
  async getUnreadInteractions(email: string): Promise<GoalInteraction[]> {
    try {
      const { data, error } = await this.supabase
        .from('goal_interactions')
        .select('*')
        .eq('to_email', email)
        .eq('is_read', false)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error fetching unread interactions', { email, error: error.message });
        return [];
      }

      return (data || []).map((row: any) => ({
        id: row.id,
        goalId: row.goal_id,
        fromEmail: row.from_email,
        toEmail: row.to_email,
        interactionType: row.interaction_type,
        emoji: row.emoji,
        message: row.message,
        atProgressPct: row.at_progress_pct,
        isRead: row.is_read,
        readAt: row.read_at,
        createdAt: row.created_at,
      }));
    } catch (error) {
      logger.error('Exception fetching unread interactions', { error });
      return [];
    }
  }

  /**
   * Get unread interaction count
   */
  async getUnreadCount(email: string): Promise<number> {
    try {
      const { data, error } = await this.supabase.rpc('get_unread_interaction_count', {
        p_email: email,
      });

      if (error) {
        return 0;
      }

      return data || 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Mark interactions as read
   */
  async markInteractionsRead(
    email: string,
    interactionIds: string[]
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('goal_interactions')
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq('to_email', email)
        .in('id', interactionIds);

      if (error) {
        logger.error('Error marking interactions read', { error: error.message });
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      logger.error('Exception marking interactions read', { error });
      return { success: false, error: 'Failed to mark as read' };
    }
  }

  /**
   * Mark all interactions as read for a user
   */
  async markAllRead(email: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('goal_interactions')
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq('to_email', email)
        .eq('is_read', false);

      if (error) {
        logger.error('Error marking all interactions read', { error: error.message });
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      logger.error('Exception marking all interactions read', { error });
      return { success: false, error: 'Failed to mark all as read' };
    }
  }
}

export const SocialGoalsService = new SocialGoalsServiceClass();
