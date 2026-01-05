/**
 * Friend Feed API
 *
 * GET - Get friend activity feed
 * POST - Cheer a feed item
 * DELETE - Remove a feed item
 */

import { NextRequest, NextResponse } from 'next/server';
import { FriendFeedService } from '@/lib/services/social';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('ConnectFeedAPI');

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const friendEmail = searchParams.get('friend'); // Optional: filter by friend
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const activityType = searchParams.get('type') as any; // Optional filter

    if (!email) {
      return NextResponse.json(
        { error: 'email is required' },
        { status: 400 }
      );
    }

    // Get unseen count
    const unseenCount = await FriendFeedService.getUnseenCount(email);

    // Get feed items
    let items;
    let hasMore = false;

    if (friendEmail) {
      items = await FriendFeedService.getFriendFeed(email, friendEmail, limit);
    } else {
      const result = await FriendFeedService.getFeed(email, { limit, offset, activityType });
      items = result.items;
      hasMore = result.hasMore;
    }

    return NextResponse.json({
      success: true,
      items,
      unseenCount,
      hasMore,
      count: items.length,
    });
  } catch (error) {
    logger.error('Error fetching feed', { error });
    return NextResponse.json(
      { error: 'Failed to fetch feed' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, feedItemId, emoji } = body;

    if (!email || !feedItemId) {
      return NextResponse.json(
        { error: 'email and feedItemId are required' },
        { status: 400 }
      );
    }

    const result = await FriendFeedService.cheerFeedItem(feedItemId, email, emoji || '👏');

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to cheer' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error cheering feed item', { error });
    return NextResponse.json(
      { error: 'Failed to cheer' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const feedItemId = searchParams.get('id');

    if (!email || !feedItemId) {
      return NextResponse.json(
        { error: 'email and id are required' },
        { status: 400 }
      );
    }

    const result = await FriendFeedService.deleteFeedItem(feedItemId, email);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to delete' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting feed item', { error });
    return NextResponse.json(
      { error: 'Failed to delete' },
      { status: 500 }
    );
  }
}
