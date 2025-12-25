/**
 * Connection Settings API Route
 * GET /api/connect/settings - Get sharing preferences for a friend
 * PUT /api/connect/settings - Update sharing preferences for a friend
 */

import { NextRequest, NextResponse } from 'next/server';
import { connectionService } from '@/lib/services/connect/connection-service';

export async function GET(request: NextRequest) {
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

    console.log(`[Connect] Fetching preferences for ${email} -> ${friendEmail}`);

    // Verify they are connected
    const connected = await connectionService.areConnected(email, friendEmail);
    if (!connected) {
      return NextResponse.json(
        { error: 'Not connected with this user' },
        { status: 403 }
      );
    }

    const preferences = await connectionService.getPreferences(email, friendEmail);

    if (!preferences) {
      return NextResponse.json(
        { error: 'Preferences not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      preferences,
    });
  } catch (error) {
    console.error('[Connect] Error fetching preferences:', error);
    return NextResponse.json(
      { error: 'Failed to fetch preferences' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const email = request.headers.get('x-user-email');
    const body = await request.json();
    const { friendEmail, preferences } = body;

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

    if (!preferences || typeof preferences !== 'object') {
      return NextResponse.json(
        { error: 'Preferences object is required' },
        { status: 400 }
      );
    }

    console.log(`[Connect] Updating preferences for ${email} -> ${friendEmail}`);

    // Verify they are connected
    const connected = await connectionService.areConnected(email, friendEmail);
    if (!connected) {
      return NextResponse.json(
        { error: 'Not connected with this user' },
        { status: 403 }
      );
    }

    const result = await connectionService.updatePreferences(
      email,
      friendEmail,
      preferences
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Connect] Error updating preferences:', error);
    return NextResponse.json(
      { error: 'Failed to update preferences' },
      { status: 500 }
    );
  }
}
