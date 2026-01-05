/**
 * Goal Interactions API
 *
 * GET - Get unread interactions
 * POST - Mark interactions as read
 */

import { NextRequest, NextResponse } from 'next/server';
import { SocialGoalsService } from '@/lib/services/social';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('ConnectInteractionsAPI');

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'email is required' },
        { status: 400 }
      );
    }

    const [interactions, unreadCount] = await Promise.all([
      SocialGoalsService.getUnreadInteractions(email),
      SocialGoalsService.getUnreadCount(email),
    ]);

    return NextResponse.json({
      success: true,
      interactions,
      unreadCount,
    });
  } catch (error) {
    logger.error('Error fetching interactions', { error });
    return NextResponse.json(
      { error: 'Failed to fetch interactions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, interactionIds, markAll } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'email is required' },
        { status: 400 }
      );
    }

    let result;
    if (markAll) {
      result = await SocialGoalsService.markAllRead(email);
    } else if (interactionIds && interactionIds.length > 0) {
      result = await SocialGoalsService.markInteractionsRead(email, interactionIds);
    } else {
      return NextResponse.json(
        { error: 'interactionIds or markAll is required' },
        { status: 400 }
      );
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to mark as read' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error marking interactions read', { error });
    return NextResponse.json(
      { error: 'Failed to mark as read' },
      { status: 500 }
    );
  }
}
