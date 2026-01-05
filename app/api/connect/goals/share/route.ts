/**
 * Goal Sharing API
 *
 * POST - Share a goal with friends
 * PUT - Update share settings
 * DELETE - Unshare a goal
 * GET - Get share settings for a goal
 */

import { NextRequest, NextResponse } from 'next/server';
import { SocialGoalsService } from '@/lib/services/social';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('ConnectGoalsShareAPI');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, goalId, isPublic, sharedWith, shareProgress, shareCurrentValue } = body;

    if (!email || !goalId) {
      return NextResponse.json(
        { error: 'email and goalId are required' },
        { status: 400 }
      );
    }

    const result = await SocialGoalsService.shareGoal(goalId, email, {
      isPublic: isPublic ?? true,
      sharedWith: sharedWith || [],
      shareProgress: shareProgress ?? true,
      shareCurrentValue: shareCurrentValue ?? false,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to share goal' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error sharing goal', { error });
    return NextResponse.json(
      { error: 'Failed to share goal' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, goalId, ...settings } = body;

    if (!email || !goalId) {
      return NextResponse.json(
        { error: 'email and goalId are required' },
        { status: 400 }
      );
    }

    const result = await SocialGoalsService.updateShareSettings(goalId, email, settings);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to update settings' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error updating share settings', { error });
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const goalId = searchParams.get('goalId');

    if (!email || !goalId) {
      return NextResponse.json(
        { error: 'email and goalId are required' },
        { status: 400 }
      );
    }

    const result = await SocialGoalsService.unshareGoal(goalId, email);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to unshare goal' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error unsharing goal', { error });
    return NextResponse.json(
      { error: 'Failed to unshare goal' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const goalId = searchParams.get('goalId');

    if (!email) {
      return NextResponse.json(
        { error: 'email is required' },
        { status: 400 }
      );
    }

    // If goalId provided, get settings for that goal
    if (goalId) {
      const settings = await SocialGoalsService.getShareSettings(goalId, email);
      return NextResponse.json({
        success: true,
        settings,
        isShared: settings !== null,
      });
    }

    // Otherwise get friends' shared goals
    const goals = await SocialGoalsService.getFriendsSharedGoals(email);
    return NextResponse.json({
      success: true,
      goals,
      count: goals.length,
    });
  } catch (error) {
    logger.error('Error fetching shared goals', { error });
    return NextResponse.json(
      { error: 'Failed to fetch goals' },
      { status: 500 }
    );
  }
}
