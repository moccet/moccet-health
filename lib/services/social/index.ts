/**
 * Social Services Index
 *
 * Exports all social-related services for Moccet Connect
 */

export { SocialGoalsService } from './social-goals-service';
export type { ShareGoalSettings, SharedGoal, GoalInteraction } from './social-goals-service';

export { AchievementsService } from './achievements-service';
export type { Achievement, AchievementType } from './achievements-service';

export { FriendFeedService } from './friend-feed-service';
export type { FeedItem, FeedActivityType } from './friend-feed-service';

export { ChallengesService } from './challenges-service';
export type { Challenge, ChallengeType, ChallengeStatus, CreateChallengeInput } from './challenges-service';
