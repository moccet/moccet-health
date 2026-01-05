/**
 * Achievements API
 *
 * GET - Get achievements (own or friends')
 * POST - Share/unshare an achievement
 */

import { NextRequest, NextResponse } from 'next/server';
import { AchievementsService } from '@/lib/services/social';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('ConnectAchievementsAPI');

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const mode = searchParams.get('mode'); // 'own', 'friends', 'recent', 'stats'
    const limit = parseInt(searchParams.get('limit') || '20');

    if (!email) {
      return NextResponse.json(
        { error: 'email is required' },
        { status: 400 }
      );
    }

    switch (mode) {
      case 'friends':
        const friendsAchievements = await AchievementsService.getFriendsAchievements(email, limit);
        return NextResponse.json({
          success: true,
          achievements: friendsAchievements,
          count: friendsAchievements.length,
        });

      case 'recent':
        const recentAchievements = await AchievementsService.getRecentAchievements(email, limit);
        return NextResponse.json({
          success: true,
          achievements: recentAchievements,
          count: recentAchievements.length,
        });

      case 'stats':
        const stats = await AchievementsService.getAchievementStats(email);
        return NextResponse.json({
          success: true,
          stats,
        });

      case 'own':
      default:
        const achievements = await AchievementsService.getUserAchievements(email);
        return NextResponse.json({
          success: true,
          achievements,
          count: achievements.length,
        });
    }
  } catch (error) {
    logger.error('Error fetching achievements', { error });
    return NextResponse.json(
      { error: 'Failed to fetch achievements' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, achievementId, action } = body; // action: 'share' or 'unshare'

    if (!email || !achievementId || !action) {
      return NextResponse.json(
        { error: 'email, achievementId, and action are required' },
        { status: 400 }
      );
    }

    let result;
    if (action === 'share') {
      result = await AchievementsService.shareAchievement(achievementId, email);
    } else if (action === 'unshare') {
      result = await AchievementsService.unshareAchievement(achievementId, email);
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use: share, unshare' },
        { status: 400 }
      );
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || `Failed to ${action} achievement` },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error handling achievement action', { error });
    return NextResponse.json(
      { error: 'Failed to process action' },
      { status: 500 }
    );
  }
}
