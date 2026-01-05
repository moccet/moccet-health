/**
 * Goal Cheer API
 *
 * POST - Send a cheer to a friend's goal
 */

import { NextRequest, NextResponse } from 'next/server';
import { SocialGoalsService } from '@/lib/services/social';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('ConnectGoalCheerAPI');

export async function POST(
  request: NextRequest,
  { params }: { params: { goalId: string } }
) {
  try {
    const { goalId } = params;
    const body = await request.json();
    const { email, emoji } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'email is required' },
        { status: 400 }
      );
    }

    const result = await SocialGoalsService.cheerGoal(goalId, email, emoji || '💪');

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send cheer' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error sending cheer', { error });
    return NextResponse.json(
      { error: 'Failed to send cheer' },
      { status: 500 }
    );
  }
}
