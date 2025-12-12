import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.DEXCOM_CLIENT_ID;
    const redirectUri = process.env.DEXCOM_REDIRECT_URI || `${process.env.NEXT_PUBLIC_BASE_URL}/api/dexcom/callback`;

    const searchParams = request.nextUrl.searchParams;
    const source = searchParams.get('source');
    const userId = searchParams.get('userId');

    if (!clientId) {
      return NextResponse.json(
        { error: 'Dexcom client ID not configured' },
        { status: 500 }
      );
    }

    // Dexcom OAuth 2.0 authorization URL
    // Documentation: https://developer.dexcom.com/authentication
    // Note: Use sandbox.api.dexcom.com for testing, api.dexcom.com for production
    const baseUrl = process.env.NODE_ENV === 'production'
      ? 'https://api.dexcom.com'
      : 'https://sandbox-api.dexcom.com';

    const stateData = { random: generateRandomState(), source: source || 'web', userId };
    const state = encodeURIComponent(JSON.stringify(stateData));

    const authUrl = new URL(`${baseUrl}/v2/oauth2/login`);
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', 'offline_access');
    authUrl.searchParams.append('state', state);

    return NextResponse.json({ authUrl: authUrl.toString() });
  } catch (error) {
    console.error('Error generating Dexcom auth URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate auth URL' },
      { status: 500 }
    );
  }
}

function generateRandomState(): string {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
}
