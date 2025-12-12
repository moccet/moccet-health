import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { storeToken } from '@/lib/services/token-manager';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      throw new Error(`OAuth error: ${error}`);
    }

    if (!code) {
      throw new Error('No authorization code received');
    }

    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    const redirectUri = process.env.SPOTIFY_REDIRECT_URI || `${process.env.NEXT_PUBLIC_BASE_URL}/api/spotify/callback`;

    if (!clientId || !clientSecret) {
      throw new Error('Spotify credentials not configured');
    }

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64'),
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      throw new Error('Failed to exchange authorization code for token');
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in; // seconds

    // Fetch user profile from Spotify API
    const userInfoResponse = await fetch('https://api.spotify.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!userInfoResponse.ok) {
      throw new Error('Failed to fetch Spotify user info');
    }

    const userInfo = await userInfoResponse.json();
    const userId = userInfo.id || 'spotify_user';
    const displayName = userInfo.display_name || userId;

    console.log(`[Spotify] Connected: User ${displayName} (${userId})`);

    // Get user email and code from cookies (set during onboarding) or from state parameter
    const cookieStore = await cookies();
    let userEmail = cookieStore.get('user_email')?.value;
    let userCode = cookieStore.get('user_code')?.value;

    // Try to get email and code from state parameter if not in cookies
    if (state) {
      try {
        const stateData = JSON.parse(decodeURIComponent(state));
        if (!userEmail && stateData.email) {
          userEmail = stateData.email;
          console.log(`[Spotify] Got email from state parameter: ${userEmail}`);
        }
        if (!userCode && stateData.code) {
          userCode = stateData.code;
          console.log(`[Spotify] Got code from state parameter: ${userCode}`);
        }
      } catch (e) {
        console.log('[Spotify] Could not parse email/code from state');
      }
    }

    if (!userEmail) {
      console.warn('[Spotify] No user email found in cookies or state, cannot store token in database');
    }

    // Store tokens in database (new secure method)
    if (userEmail) {
      const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : undefined;

      const storeResult = await storeToken(userEmail, 'spotify', {
        accessToken,
        refreshToken,
        expiresAt,
        providerUserId: userId,
        scopes: ['user-read-recently-played', 'user-top-read', 'user-read-playback-state', 'user-read-currently-playing', 'playlist-read-private', 'user-library-read', 'playlist-modify-private', 'playlist-modify-public'],
        metadata: {
          displayName,
          spotifyEmail: userInfo.email,
        }
      }, userCode);

      if (storeResult.success) {
        console.log(`[Spotify] Tokens stored in database for ${userEmail}${userCode ? ` (code: ${userCode})` : ''}`);
      } else {
        console.error(`[Spotify] Failed to store tokens in database:`, storeResult.error);
      }
    }

    // Keep cookies for backward compatibility and session validation
    cookieStore.set('spotify_access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365
    });

    if (refreshToken) {
      cookieStore.set('spotify_refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365
      });
    }

    cookieStore.set('spotify_user_id', userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365
    });

    // Determine redirect path based on state parameter
    let redirectPath = '/forge/onboarding';
    try {
      if (state) {
        const stateData = JSON.parse(decodeURIComponent(state));
        if (stateData.returnPath) {
          redirectPath = stateData.returnPath;
        }
      }
    } catch (e) {
      console.log('Could not parse state, using default redirect');
    }

    // Return HTML to close popup OR redirect on mobile
    return new NextResponse(
      `<!DOCTYPE html>
      <html>
        <head>
          <title>Spotify Connected</title>
        </head>
        <body>
          <script>
            // Check if we're in a popup window (desktop) or full page (mobile)
            if (window.opener) {
              // Desktop: Signal to parent window that connection was successful
              window.opener.postMessage({ type: 'spotify-connected' }, '*');
              // Close the popup after a short delay
              setTimeout(() => {
                window.close();
              }, 1000);
            } else {
              // Mobile: Redirect back to onboarding
              window.location.href = '${redirectPath}?auth=spotify&success=true';
            }
          </script>
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 40px;">
            <h1 style="color: #1DB954;">✓ Connected</h1>
            <p>Spotify has been connected successfully.</p>
            <p style="font-size: 14px; color: #666;">Redirecting you back...</p>
          </div>
        </body>
      </html>`,
      {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
        },
      }
    );

  } catch (error) {
    console.error('Error in Spotify callback:', error);

    return new NextResponse(
      `<!DOCTYPE html>
      <html>
        <head>
          <title>Connection Failed</title>
        </head>
        <body>
          <script>
            // Signal error to parent window
            if (window.opener) {
              window.opener.postMessage({ type: 'spotify-error' }, '*');
            }
            setTimeout(() => {
              window.close();
            }, 3000);
          </script>
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 40px;">
            <h1 style="color: #f44336;">✗ Connection Failed</h1>
            <p>Failed to connect Spotify. Please try again.</p>
            <p style="font-size: 14px; color: #666;">This window will close automatically...</p>
          </div>
        </body>
      </html>`,
      {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
        },
      }
    );
  }
}
