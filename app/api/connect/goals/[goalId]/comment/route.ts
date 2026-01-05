/**
 * Goal Comment API
 *
 * POST - Add a comment to a friend's goal
 * GET - Get comments on a goal
 */

import { NextRequest, NextResponse } from 'next/server';
import { SocialGoalsService } from '@/lib/services/social';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('ConnectGoalCommentAPI');

export async function POST(
  request: NextRequest,
  { params }: { params: { goalId: string } }
) {
  try {
    const { goalId } = params;
    const body = await request.json();
    const { email, message } = body;

    if (!email || !message) {
      return NextResponse.json(
        { error: 'email and message are required' },
        { status: 400 }
      );
    }

    if (message.length > 280) {
      return NextResponse.json(
        { error: 'Comment must be 280 characters or less' },
        { status: 400 }
      );
    }

    const result = await SocialGoalsService.commentOnGoal(goalId, email, message);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to add comment' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error adding comment', { error });
    return NextResponse.json(
      { error: 'Failed to add comment' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { goalId: string } }
) {
  try {
    const { goalId } = params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');

    const interactions = await SocialGoalsService.getGoalInteractions(goalId, limit);

    return NextResponse.json({
      success: true,
      interactions,
      count: interactions.length,
    });
  } catch (error) {
    logger.error('Error fetching comments', { error });
    return NextResponse.json(
      { error: 'Failed to fetch comments' },
      { status: 500 }
    );
  }
}
