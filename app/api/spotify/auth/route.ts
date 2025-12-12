import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const redirectUri = process.env.SPOTIFY_REDIRECT_URI || `${process.env.NEXT_PUBLIC_BASE_URL}/api/spotify/callback`;

    // Get state from query params or generate random state
    const searchParams = request.nextUrl.searchParams;
    const source = searchParams.get('source'); // 'mobile' if from app
    const userId = searchParams.get('userId');

    // Include source in state so callback knows where request came from
    const stateData = {
      random: generateRandomState(),
      source: source || 'web',
      userId: userId,
    };
    const state = encodeURIComponent(JSON.stringify(stateData));

    if (!clientId) {
      return NextResponse.json(
        { error: 'Spotify client ID not configured' },
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

    // Spotify OAuth 2.0 authorization URL
    // Documentation: https://developer.spotify.com/documentation/web-api/concepts/authorization
    const authUrl = new URL('https://accounts.spotify.com/authorize');
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    // Request scopes for listening history, user data, and playlist creation
    authUrl.searchParams.append('scope', 'user-read-recently-played user-top-read user-read-playback-state user-read-currently-playing playlist-read-private user-library-read playlist-modify-private playlist-modify-public');
    authUrl.searchParams.append('state', state);
    authUrl.searchParams.append('show_dialog', 'true');

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
    console.error('Error generating Spotify auth URL:', error);
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
