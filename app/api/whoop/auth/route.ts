import { NextRequest, NextResponse } from 'next/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.WHOOP_CLIENT_ID;
    const redirectUri = process.env.WHOOP_REDIRECT_URI || `${process.env.NEXT_PUBLIC_BASE_URL}/api/whoop/callback`;

    const searchParams = request.nextUrl.searchParams;
    const source = searchParams.get('source');
    const userId = searchParams.get('userId');

    const stateData = { random: Math.random().toString(36).substring(2, 15), source: source || 'web', userId };
    const state = encodeURIComponent(JSON.stringify(stateData));

    if (!clientId) {
      return NextResponse.json(
        { error: 'Whoop client ID not configured' },
        { status: 500, headers: corsHeaders }
      );
    }

    // Whoop OAuth 2.0 authorization URL
    // Documentation: https://developer.whoop.com/docs/developing/oauth
    const authUrl = new URL('https://api.prod.whoop.com/oauth/oauth2/auth');
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    // Request all Whoop scopes for comprehensive health data
    // offline_access ensures we get a refresh_token for long-lived access
    authUrl.searchParams.append('scope', 'offline_access read:recovery read:cycles read:sleep read:workout read:profile read:body_measurement');
    authUrl.searchParams.append('state', state);

    return NextResponse.json(
      { authUrl: authUrl.toString() },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('Error generating Whoop auth URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate auth URL' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}
