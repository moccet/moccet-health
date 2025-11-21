import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    const cookieStore = await cookies();

    // Remove all Oura-related cookies
    cookieStore.delete('oura_access_token');
    cookieStore.delete('oura_refresh_token');
    cookieStore.delete('oura_user_id');

    console.log('[Oura] Disconnected successfully');

    return NextResponse.json({
      success: true,
      message: 'Oura Ring disconnected successfully',
    });
  } catch (error) {
    console.error('[Oura] Error disconnecting:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Oura Ring' },
      { status: 500 }
    );
  }
}
