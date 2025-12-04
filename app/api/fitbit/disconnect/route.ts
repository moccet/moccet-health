import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    const cookieStore = await cookies();

    // Remove all Fitbit-related cookies
    cookieStore.delete('fitbit_access_token');
    cookieStore.delete('fitbit_refresh_token');
    cookieStore.delete('fitbit_user_id');

    console.log('[Fitbit] Disconnected successfully');

    return NextResponse.json({
      success: true,
      message: 'Fitbit disconnected successfully',
    });
  } catch (error) {
    console.error('[Fitbit] Error disconnecting:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Fitbit' },
      { status: 500 }
    );
  }
}
