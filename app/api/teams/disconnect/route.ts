import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    const cookieStore = await cookies();

    // Remove all Teams-related cookies
    cookieStore.delete('teams_access_token');
    cookieStore.delete('teams_refresh_token');
    cookieStore.delete('teams_user_email');

    console.log('[Teams] Disconnected successfully');

    return NextResponse.json({
      success: true,
      message: 'Microsoft Teams disconnected successfully',
    });
  } catch (error) {
    console.error('[Teams] Error disconnecting:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Microsoft Teams' },
      { status: 500 }
    );
  }
}
