import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Apple Calendar uses Sign in with Apple OAuth
    // Same flow as Apple Health but with calendar scope

    const clientId = process.env.APPLE_CALENDAR_CLIENT_ID || process.env.APPLE_HEALTH_CLIENT_ID;
    const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/apple-calendar/callback`;

    // Apple Sign In with Apple OAuth URL
    const authUrl = new URL('https://appleid.apple.com/auth/authorize');
    authUrl.searchParams.append('client_id', clientId || 'com.moccet.sage');
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('response_mode', 'form_post');
    authUrl.searchParams.append('scope', 'name email');
    authUrl.searchParams.append('state', generateRandomState());

    return NextResponse.json({
      success: true,
      authUrl: authUrl.toString()
    });

  } catch (error) {
    console.error('Error initiating Apple Calendar auth:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Apple Calendar authentication' },
      { status: 500 }
    );
  }
}

function generateRandomState(): string {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
}
