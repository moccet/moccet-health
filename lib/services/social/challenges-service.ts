/**
 * Challenges Service
 *
 * Handles friendly competitions between connected friends
 *
 * @module lib/services/social/challenges-service
 */

import { createAdminClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/utils/logger';
import { OneSignalService } from '../onesignal-service';
import { AchievementsService } from './achievements-service';
import { FriendFeedService } from './friend-feed-service';

const logger = createLogger('ChallengesService');

export type ChallengeType = 'head_to_head' | 'combined' | 'streak';
export type ChallengeStatus = 'pending' | 'active' | 'completed' | 'declined' | 'cancelled';

export interface Challenge {
  id: string;
  challengerEmail: string;
  challengedEmail: string;
  title: string;
  description: string | null;
  challengeType: ChallengeType;
  metricType: string;
  targetValue: number | null;
  startDate: string;
  endDate: string;
  challengerProgress: number;
  challengedProgress: number;
  challengerStreakDays: number;
  challengedStreakDays: number;
  status: ChallengeStatus;
  winnerEmail: string | null;
  createdAt: string;
  acceptedAt: string | null;
  completedAt: string | null;
}

export interface CreateChallengeInput {
  title: string;
  description?: string;
  challengeType: ChallengeType;
  metricType: string;
  targetValue?: number;
  startDate: string;
  endDate: string;
}

class ChallengesServiceClass {
  private supabase = createAdminClient();

  // ============================================
  // CHALLENGE CRUD
  // ============================================

  /**
   * Create a new challenge
   */
  async createChallenge(
    challengerEmail: string,
    challengedEmail: string,
    input: CreateChallengeInput
  ): Promise<{ success: boolean; challenge?: Challenge; error?: string }> {
    try {
      // Check if they're friends
      const { data: areFriends } = await this.supabase.rpc('are_friends', {
        email1: challengerEmail,
        email2: challengedEmail,
      });

      if (!areFriends) {
        return { success: false, error: 'You can only challenge connected friends' };
      }

      // Check for existing active challenge between these users
      const { data: existing } = await this.supabase
        .from('goal_challenges')
        .select('id')
        .or(`and(challenger_email.eq.${challengerEmail},challenged_email.eq.${challengedEmail}),and(challenger_email.eq.${challengedEmail},challenged_email.eq.${challengerEmail})`)
        .in('status', ['pending', 'active'])
        .single();

      if (existing) {
        return { success: false, error: 'You already have an active challenge with this friend' };
      }

      // Create the challenge
      const { data, error } = await this.supabase
        .from('goal_challenges')
        .insert({
          challenger_email: challengerEmail,
          challenged_email: challengedEmail,
          title: input.title,
          description: input.description || null,
          challenge_type: input.challengeType,
          metric_type: input.metricType,
          target_value: input.targetValue || null,
          start_date: input.startDate,
          end_date: input.endDate,
          status: 'pending',
        })
        .select()
        .single();

      if (error) {
        logger.error('Error creating challenge', { error: error.message });
        return { success: false, error: error.message };
      }

      // Send notification to challenged user
      try {
        await OneSignalService.sendPushNotification(challengedEmail, {
          title: '⚔️ New Challenge!',
          body: `${challengerEmail.split('@')[0]} challenged you: ${input.title}`,
          data: { type: 'challenge_invite', challengeId: data.id },
        });
      } catch (notifError) {
        logger.warn('Failed to send challenge notification', { error: notifError });
      }

      logger.info('Challenge created', { challengeId: data.id, challengerEmail, challengedEmail });
      return { success: true, challenge: this.mapChallenge(data) };
    } catch (error) {
      logger.error('Exception creating challenge', { error });
      return { success: false, error: 'Failed to create challenge' };
    }
  }

  /**
   * Accept a challenge
   */
  async acceptChallenge(
    challengeId: string,
    email: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get the challenge
      const { data: challenge, error: fetchError } = await this.supabase
        .from('goal_challenges')
        .select('*')
        .eq('id', challengeId)
        .eq('challenged_email', email)
        .eq('status', 'pending')
        .single();

      if (fetchError || !challenge) {
        return { success: false, error: 'Challenge not found or already responded to' };
      }

      // Update status
      const { error } = await this.supabase
        .from('goal_challenges')
        .update({
          status: 'active',
          accepted_at: new Date().toISOString(),
        })
        .eq('id', challengeId);

      if (error) {
        logger.error('Error accepting challenge', { challengeId, error: error.message });
        return { success: false, error: error.message };
      }

      // Notify challenger
      try {
        await OneSignalService.sendPushNotification(challenge.challenger_email, {
          title: '🎉 Challenge Accepted!',
          body: `${email.split('@')[0]} accepted your "${challenge.title}" challenge!`,
          data: { type: 'challenge_accepted', challengeId },
        });
      } catch (notifError) {
        logger.warn('Failed to send acceptance notification', { error: notifError });
      }

      // Generate feed items
      await FriendFeedService.generateFeedItem(email, 'challenge_created', {
        title: `Accepted: ${challenge.title}`,
        subtitle: `Challenge with ${challenge.challenger_email.split('@')[0]}`,
        emoji: '⚔️',
        challengeId,
      });

      logger.info('Challenge accepted', { challengeId, email });
      return { success: true };
    } catch (error) {
      logger.error('Exception accepting challenge', { error });
      return { success: false, error: 'Failed to accept challenge' };
    }
  }

  /**
   * Decline a challenge
   */
  async declineChallenge(
    challengeId: string,
    email: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('goal_challenges')
        .update({ status: 'declined' })
        .eq('id', challengeId)
        .eq('challenged_email', email)
        .eq('status', 'pending');

      if (error) {
        logger.error('Error declining challenge', { challengeId, error: error.message });
        return { success: false, error: error.message };
      }

      logger.info('Challenge declined', { challengeId, email });
      return { success: true };
    } catch (error) {
      logger.error('Exception declining challenge', { error });
      return { success: false, error: 'Failed to decline challenge' };
    }
  }

  /**
   * Cancel a challenge (by challenger before it starts)
   */
  async cancelChallenge(
    challengeId: string,
    email: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await this.supabase
        .from('goal_challenges')
        .update({ status: 'cancelled' })
        .eq('id', challengeId)
        .eq('challenger_email', email)
        .in('status', ['pending', 'active']);

      if (error) {
        logger.error('Error cancelling challenge', { challengeId, error: error.message });
        return { success: false, error: error.message };
      }

      logger.info('Challenge cancelled', { challengeId, email });
      return { success: true };
    } catch (error) {
      logger.error('Exception cancelling challenge', { error });
      return { success: false, error: 'Failed to cancel challenge' };
    }
  }

  // ============================================
  // PROGRESS TRACKING
  // ============================================

  /**
   * Update progress for a challenge participant
   */
  async updateProgress(
    challengeId: string,
    email: string,
    value: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get the challenge
      const { data: challenge, error: fetchError } = await this.supabase
        .from('goal_challenges')
        .select('*')
        .eq('id', challengeId)
        .eq('status', 'active')
        .single();

      if (fetchError || !challenge) {
        return { success: false, error: 'Active challenge not found' };
      }

      // Determine which participant
      const isChallenger = challenge.challenger_email === email;
      const isChallenged = challenge.challenged_email === email;

      if (!isChallenger && !isChallenged) {
        return { success: false, error: 'You are not a participant in this challenge' };
      }

      // Update the appropriate progress field
      const updateData: Record<string, unknown> = {};
      if (isChallenger) {
        updateData.challenger_progress = value;
      } else {
        updateData.challenged_progress = value;
      }

      const { error } = await this.supabase
        .from('goal_challenges')
        .update(updateData)
        .eq('id', challengeId);

      if (error) {
        logger.error('Error updating challenge progress', { challengeId, error: error.message });
        return { success: false, error: error.message };
      }

      // Check if challenge is complete
      await this.checkAndCompleteChallenge(challengeId);

      logger.info('Challenge progress updated', { challengeId, email, value });
      return { success: true };
    } catch (error) {
      logger.error('Exception updating challenge progress', { error });
      return { success: false, error: 'Failed to update progress' };
    }
  }

  /**
   * Update streak days for a participant
   */
  async updateStreak(
    challengeId: string,
    email: string,
    streakDays: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: challenge } = await this.supabase
        .from('goal_challenges')
        .select('challenger_email, challenged_email')
        .eq('id', challengeId)
        .eq('status', 'active')
        .single();

      if (!challenge) {
        return { success: false, error: 'Challenge not found' };
      }

      const isChallenger = challenge.challenger_email === email;
      const updateData = isChallenger
        ? { challenger_streak_days: streakDays }
        : { challenged_streak_days: streakDays };

      const { error } = await this.supabase
        .from('goal_challenges')
        .update(updateData)
        .eq('id', challengeId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: 'Failed to update streak' };
    }
  }

  /**
   * Check if challenge should be completed and determine winner
   */
  async checkAndCompleteChallenge(challengeId: string): Promise<void> {
    try {
      const { data: challenge } = await this.supabase
        .from('goal_challenges')
        .select('*')
        .eq('id', challengeId)
        .eq('status', 'active')
        .single();

      if (!challenge) return;

      const now = new Date();
      const endDate = new Date(challenge.end_date);
      let winner: string | null = null;
      let isComplete = false;

      // Check based on challenge type
      switch (challenge.challenge_type) {
        case 'head_to_head':
          // First to reach target wins, or highest at end
          if (challenge.target_value) {
            if (challenge.challenger_progress >= challenge.target_value) {
              winner = challenge.challenger_email;
              isComplete = true;
            } else if (challenge.challenged_progress >= challenge.target_value) {
              winner = challenge.challenged_email;
              isComplete = true;
            }
          }
          // If end date passed, compare progress
          if (!isComplete && now > endDate) {
            isComplete = true;
            if (challenge.challenger_progress > challenge.challenged_progress) {
              winner = challenge.challenger_email;
            } else if (challenge.challenged_progress > challenge.challenger_progress) {
              winner = challenge.challenged_email;
            }
            // Tie = no winner
          }
          break;

        case 'combined':
          // Combined progress reaches target
          if (challenge.target_value) {
            const combined = challenge.challenger_progress + challenge.challenged_progress;
            if (combined >= challenge.target_value) {
              isComplete = true;
              // Both win in combined challenges
              winner = 'both';
            }
          }
          if (!isComplete && now > endDate) {
            isComplete = true;
          }
          break;

        case 'streak':
          // End date reached, compare streak days
          if (now > endDate) {
            isComplete = true;
            if (challenge.challenger_streak_days > challenge.challenged_streak_days) {
              winner = challenge.challenger_email;
            } else if (challenge.challenged_streak_days > challenge.challenger_streak_days) {
              winner = challenge.challenged_email;
            }
          }
          break;
      }

      if (isComplete) {
        await this.completeChallenge(challengeId, winner);
      }
    } catch (error) {
      logger.error('Exception checking challenge completion', { challengeId, error });
    }
  }

  /**
   * Mark a challenge as complete
   */
  private async completeChallenge(
    challengeId: string,
    winner: string | null
  ): Promise<void> {
    try {
      const { data: challenge } = await this.supabase
        .from('goal_challenges')
        .select('*')
        .eq('id', challengeId)
        .single();

      if (!challenge) return;

      await this.supabase
        .from('goal_challenges')
        .update({
          status: 'completed',
          winner_email: winner === 'both' ? null : winner,
          completed_at: new Date().toISOString(),
        })
        .eq('id', challengeId);

      // Grant achievement(s) and notify
      if (winner && winner !== 'both') {
        // Grant challenge won achievement
        await AchievementsService.grantChallengeWon(winner, challengeId);

        // Notify winner
        await OneSignalService.sendPushNotification(winner, {
          title: '🏆 Challenge Won!',
          body: `You won: ${challenge.title}`,
          data: { type: 'challenge_won', challengeId },
        });

        // Notify loser
        const loser = winner === challenge.challenger_email
          ? challenge.challenged_email
          : challenge.challenger_email;
        await OneSignalService.sendPushNotification(loser, {
          title: 'Challenge Complete',
          body: `${challenge.title} has ended. Better luck next time!`,
          data: { type: 'challenge_lost', challengeId },
        });

        // Generate feed item
        await FriendFeedService.generateFeedItem(winner, 'challenge_won', {
          title: `Won: ${challenge.title}`,
          emoji: '🏆',
          challengeId,
        });
      } else if (winner === 'both') {
        // Combined challenge success
        await OneSignalService.sendPushNotification(challenge.challenger_email, {
          title: '🎉 Challenge Complete!',
          body: `You both completed: ${challenge.title}`,
          data: { type: 'challenge_completed', challengeId },
        });
        await OneSignalService.sendPushNotification(challenge.challenged_email, {
          title: '🎉 Challenge Complete!',
          body: `You both completed: ${challenge.title}`,
          data: { type: 'challenge_completed', challengeId },
        });
      }

      logger.info('Challenge completed', { challengeId, winner });
    } catch (error) {
      logger.error('Exception completing challenge', { challengeId, error });
    }
  }

  // ============================================
  // QUERIES
  // ============================================

  /**
   * Get active challenges for a user
   */
  async getActiveChallenges(email: string): Promise<Challenge[]> {
    try {
      const { data, error } = await this.supabase
        .from('goal_challenges')
        .select('*')
        .or(`challenger_email.eq.${email},challenged_email.eq.${email}`)
        .eq('status', 'active')
        .order('start_date', { ascending: true });

      if (error) {
        logger.error('Error fetching active challenges', { email, error: error.message });
        return [];
      }

      return (data || []).map(this.mapChallenge);
    } catch (error) {
      logger.error('Exception fetching active challenges', { error });
      return [];
    }
  }

  /**
   * Get pending challenges for a user (invites)
   */
  async getPendingChallenges(email: string): Promise<Challenge[]> {
    try {
      const { data, error } = await this.supabase
        .from('goal_challenges')
        .select('*')
        .eq('challenged_email', email)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Error fetching pending challenges', { email, error: error.message });
        return [];
      }

      return (data || []).map(this.mapChallenge);
    } catch (error) {
      logger.error('Exception fetching pending challenges', { error });
      return [];
    }
  }

  /**
   * Get challenge history for a user
   */
  async getChallengeHistory(
    email: string,
    limit: number = 20
  ): Promise<Challenge[]> {
    try {
      const { data, error } = await this.supabase
        .from('goal_challenges')
        .select('*')
        .or(`challenger_email.eq.${email},challenged_email.eq.${email}`)
        .in('status', ['completed', 'declined', 'cancelled'])
        .order('completed_at', { ascending: false, nullsFirst: false })
        .limit(limit);

      if (error) {
        logger.error('Error fetching challenge history', { email, error: error.message });
        return [];
      }

      return (data || []).map(this.mapChallenge);
    } catch (error) {
      logger.error('Exception fetching challenge history', { error });
      return [];
    }
  }

  /**
   * Get a specific challenge
   */
  async getChallenge(challengeId: string): Promise<Challenge | null> {
    try {
      const { data, error } = await this.supabase
        .from('goal_challenges')
        .select('*')
        .eq('id', challengeId)
        .single();

      if (error || !data) {
        return null;
      }

      return this.mapChallenge(data);
    } catch (error) {
      logger.error('Exception fetching challenge', { challengeId, error });
      return null;
    }
  }

  /**
   * Get challenge stats for a user
   */
  async getChallengeStats(email: string): Promise<{
    totalChallenges: number;
    wins: number;
    losses: number;
    active: number;
  }> {
    try {
      const { data: all } = await this.supabase
        .from('goal_challenges')
        .select('status, winner_email')
        .or(`challenger_email.eq.${email},challenged_email.eq.${email}`);

      if (!all) {
        return { totalChallenges: 0, wins: 0, losses: 0, active: 0 };
      }

      const completed = all.filter(c => c.status === 'completed');
      const wins = completed.filter(c => c.winner_email === email).length;
      const losses = completed.filter(c => c.winner_email && c.winner_email !== email).length;
      const active = all.filter(c => c.status === 'active').length;

      return {
        totalChallenges: completed.length,
        wins,
        losses,
        active,
      };
    } catch (error) {
      return { totalChallenges: 0, wins: 0, losses: 0, active: 0 };
    }
  }

  // ============================================
  // HELPERS
  // ============================================

  private mapChallenge(row: any): Challenge {
    return {
      id: row.id,
      challengerEmail: row.challenger_email,
      challengedEmail: row.challenged_email,
      title: row.title,
      description: row.description,
      challengeType: row.challenge_type,
      metricType: row.metric_type,
      targetValue: row.target_value,
      startDate: row.start_date,
      endDate: row.end_date,
      challengerProgress: row.challenger_progress || 0,
      challengedProgress: row.challenged_progress || 0,
      challengerStreakDays: row.challenger_streak_days || 0,
      challengedStreakDays: row.challenged_streak_days || 0,
      status: row.status,
      winnerEmail: row.winner_email,
      createdAt: row.created_at,
      acceptedAt: row.accepted_at,
      completedAt: row.completed_at,
    };
  }
}

export const ChallengesService = new ChallengesServiceClass();
