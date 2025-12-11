import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { revokeToken } from '@/lib/services/token-manager';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('user_email')?.value;
    const userCode = cookieStore.get('user_code')?.value;

    // Revoke token in database
    if (userEmail) {
      const result = await revokeToken(userEmail, 'spotify', userCode);
      if (result.success) {
        console.log(`[Spotify] Token revoked for ${userEmail}`);
      } else {
        console.error(`[Spotify] Failed to revoke token:`, result.error);
      }
    }

    // Clear cookies
    cookieStore.delete('spotify_access_token');
    cookieStore.delete('spotify_refresh_token');
    cookieStore.delete('spotify_user_id');

    return NextResponse.json(
      { success: true, message: 'Spotify disconnected successfully' },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      }
    );
  } catch (error) {
    console.error('Error disconnecting Spotify:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to disconnect Spotify' },
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
