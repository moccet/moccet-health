import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    const cookieStore = await cookies();

    // Remove all Strava-related cookies
    cookieStore.delete('strava_access_token');
    cookieStore.delete('strava_refresh_token');
    cookieStore.delete('strava_athlete_id');

    console.log('[Strava] Disconnected successfully');

    return NextResponse.json({
      success: true,
      message: 'Strava disconnected successfully',
    });
  } catch (error) {
    console.error('[Strava] Error disconnecting:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Strava' },
      { status: 500 }
    );
  }
}
