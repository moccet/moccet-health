/**
 * Friend Feed API
 *
 * GET - Get friend activity feed or feed item details
 * POST - Cheer a feed item, add reaction, or add comment
 * DELETE - Remove a feed item
 */

import { NextRequest, NextResponse } from 'next/server';
import { FriendFeedService } from '@/lib/services/social';
import { createLogger } from '@/lib/utils/logger';
import { createClient } from '@supabase/supabase-js';
import { sendPushNotification } from '@/lib/services/onesignal-service';

const logger = createLogger('ConnectFeedAPI');

/**
 * Get user's display name from profile
 */
async function getUserDisplayName(supabase: any, email: string): Promise<string> {
  try {
    const { data } = await supabase
      .from('user_profiles')
      .select('full_name, first_name')
      .eq('email', email)
      .single();

    if (data?.first_name) return data.first_name;
    if (data?.full_name) return data.full_name.split(' ')[0];

    // Fall back to email username
    return email.split('@')[0];
  } catch {
    return email.split('@')[0];
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const friendEmail = searchParams.get('friend'); // Optional: filter by friend
    const feedItemId = searchParams.get('id'); // Get specific item details
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const activityType = searchParams.get('type') as any; // Optional filter

    if (!email) {
      return NextResponse.json(
        { error: 'email is required' },
        { status: 400 }
      );
    }

    // If requesting specific feed item details
    if (feedItemId) {
      const { data: details, error } = await supabase.rpc('get_feed_item_details', {
        p_feed_item_id: feedItemId,
        p_user_email: email,
      });

      if (error) {
        logger.error('Error fetching feed item details', { error });
        return NextResponse.json(
          { error: 'Failed to fetch details' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        details,
      });
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
    const { email, feedItemId, action, emoji, message } = body;

    if (!email || !feedItemId) {
      return NextResponse.json(
        { error: 'email and feedItemId are required' },
        { status: 400 }
      );
    }

    // Handle different actions
    switch (action) {
      case 'comment': {
        // Add a comment
        if (!message || message.length === 0) {
          return NextResponse.json(
            { error: 'message is required for comments' },
            { status: 400 }
          );
        }

        if (message.length > 280) {
          return NextResponse.json(
            { error: 'Comment must be 280 characters or less' },
            { status: 400 }
          );
        }

        // Get the feed item to find the friend's email and activity details
        const { data: feedItem } = await supabase
          .from('friend_activity_feed')
          .select('friend_email, title, activity_type')
          .eq('id', feedItemId)
          .single();

        if (!feedItem) {
          return NextResponse.json(
            { error: 'Feed item not found' },
            { status: 404 }
          );
        }

        const { data: comment, error: commentError } = await supabase
          .from('feed_comments')
          .insert({
            feed_item_id: feedItemId,
            from_email: email,
            to_email: feedItem.friend_email,
            message,
          })
          .select()
          .single();

        if (commentError) {
          logger.error('Error adding comment', { error: commentError });
          return NextResponse.json(
            { error: 'Failed to add comment' },
            { status: 500 }
          );
        }

        // Send push notification to the achievement owner (don't notify yourself)
        if (feedItem.friend_email !== email) {
          const commenterName = await getUserDisplayName(supabase, email);
          const truncatedComment = message.length > 50 ? message.substring(0, 47) + '...' : message;

          sendPushNotification(feedItem.friend_email, {
            title: `${commenterName} commented on your achievement`,
            body: truncatedComment,
            data: {
              type: 'connect_comment',
              feed_item_id: feedItemId,
              from_email: email,
              screen: 'connect',
            },
          }).catch(err => logger.error('Failed to send comment notification', { error: err }));
        }

        return NextResponse.json({ success: true, comment });
      }

      case 'react': {
        // Add or update a reaction (emoji)
        if (!emoji) {
          return NextResponse.json(
            { error: 'emoji is required for reactions' },
            { status: 400 }
          );
        }

        // Get the feed item to find the owner's email
        const { data: feedItemForReact } = await supabase
          .from('friend_activity_feed')
          .select('friend_email, title')
          .eq('id', feedItemId)
          .single();

        // Check if this is a new reaction (not an update)
        const { data: existingReaction } = await supabase
          .from('feed_reactions')
          .select('id')
          .eq('feed_item_id', feedItemId)
          .eq('from_email', email)
          .single();

        const isNewReaction = !existingReaction;

        const { error: reactError } = await supabase
          .from('feed_reactions')
          .upsert({
            feed_item_id: feedItemId,
            from_email: email,
            emoji,
          }, { onConflict: 'feed_item_id,from_email' });

        if (reactError) {
          logger.error('Error adding reaction', { error: reactError });
          return NextResponse.json(
            { error: 'Failed to add reaction' },
            { status: 500 }
          );
        }

        // Send push notification for new reactions only (don't notify on reaction changes or self-reactions)
        if (isNewReaction && feedItemForReact && feedItemForReact.friend_email !== email) {
          const reactorName = await getUserDisplayName(supabase, email);

          sendPushNotification(feedItemForReact.friend_email, {
            title: `${reactorName} reacted to your achievement`,
            body: `${emoji} on "${feedItemForReact.title || 'your post'}"`,
            data: {
              type: 'connect_reaction',
              feed_item_id: feedItemId,
              from_email: email,
              emoji,
              screen: 'connect',
            },
          }).catch(err => logger.error('Failed to send reaction notification', { error: err }));
        }

        return NextResponse.json({ success: true });
      }

      case 'unreact': {
        // Remove a reaction
        const { error: unreactError } = await supabase
          .from('feed_reactions')
          .delete()
          .eq('feed_item_id', feedItemId)
          .eq('from_email', email);

        if (unreactError) {
          logger.error('Error removing reaction', { error: unreactError });
          return NextResponse.json(
            { error: 'Failed to remove reaction' },
            { status: 500 }
          );
        }

        return NextResponse.json({ success: true });
      }

      default: {
        // Default: cheer (legacy behavior)
        const result = await FriendFeedService.cheerFeedItem(feedItemId, email, emoji || '👏');

        if (!result.success) {
          return NextResponse.json(
            { error: result.error || 'Failed to cheer' },
            { status: 400 }
          );
        }

        return NextResponse.json({ success: true });
      }
    }
  } catch (error) {
    logger.error('Error processing feed action', { error });
    return NextResponse.json(
      { error: 'Failed to process action' },
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
