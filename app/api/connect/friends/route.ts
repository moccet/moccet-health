/**
 * Friends API Route
 * GET /api/connect/friends - Get all friends for the authenticated user
 * DELETE /api/connect/friends - Remove a friend connection
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectionService } from '@/lib/services/connect/connection-service';

export async function GET(request: NextRequest) {
  try {
    const email = request.headers.get('x-user-email');

    if (!email) {
      return NextResponse.json(
        { error: 'User email is required' },
        { status: 401 }
      );
    }

    console.log(`[Connect] Fetching friends for ${email}`);

    const friends = await connectionService.getFriends(email);
    const stats = await connectionService.getStats(email);

    return NextResponse.json({
      success: true,
      friends,
      stats,
    });
  } catch (error) {
    console.error('[Connect] Error fetching friends:', error);
    return NextResponse.json(
      { error: 'Failed to fetch friends' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const email = request.headers.get('x-user-email');
    const { searchParams } = new URL(request.url);
    const friendEmail = searchParams.get('friendEmail');

    if (!email) {
      return NextResponse.json(
        { error: 'User email is required' },
        { status: 401 }
      );
    }

    if (!friendEmail) {
      return NextResponse.json(
        { error: 'Friend email is required' },
        { status: 400 }
      );
    }

    console.log(`[Connect] Removing friend ${friendEmail} for ${email}`);

    const result = await connectionService.removeFriend(email, friendEmail);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Connect] Error removing friend:', error);
    return NextResponse.json(
      { error: 'Failed to remove friend' },
      { status: 500 }
    );
  }
}
