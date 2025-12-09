import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.OURA_CLIENT_ID;
    // Always use NEXT_PUBLIC_BASE_URL to ensure redirect matches production URL
    const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/oura/callback`;

    // Get state from query params or generate random state
    const searchParams = request.nextUrl.searchParams;
    const state = searchParams.get('state') || generateRandomState();

    if (!clientId) {
      return NextResponse.json(
        { error: 'Oura client ID not configured' },
        {
          status: 500,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          }
        }
      );
    }

    // Oura OAuth 2.0 authorization URL
    // Documentation: https://cloud.ouraring.com/v2/docs#section/Authentication
    const authUrl = new URL('https://cloud.ouraring.com/oauth/authorize');
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    // Request all available Oura scopes for comprehensive health data
    authUrl.searchParams.append('scope', 'email personal daily heartrate tag workout session spo2 ring_configuration stress heart_health');
    authUrl.searchParams.append('state', state);

    return NextResponse.json(
      { authUrl: authUrl.toString() },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      }
    );
  } catch (error) {
    console.error('Error generating Oura auth URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate auth URL' },
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

function generateRandomState(): string {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
}
