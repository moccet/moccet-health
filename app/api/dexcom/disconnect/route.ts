import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    const cookieStore = await cookies();

    // Remove all Dexcom-related cookies
    cookieStore.delete('dexcom_access_token');
    cookieStore.delete('dexcom_refresh_token');
    cookieStore.delete('dexcom_connected');

    console.log('[Dexcom] Disconnected successfully');

    return NextResponse.json({
      success: true,
      message: 'Dexcom CGM disconnected successfully',
    });
  } catch (error) {
    console.error('[Dexcom] Error disconnecting:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Dexcom CGM' },
      { status: 500 }
    );
  }
}
