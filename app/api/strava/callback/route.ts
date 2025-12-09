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

    const clientId = process.env.STRAVA_CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Strava credentials not configured');
    }

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
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
    const athleteId = tokenData.athlete?.id;
    const expiresIn = tokenData.expires_in;

    console.log(`[Strava] Connected: Athlete ID ${athleteId}`);

    // Get user email and code, store tokens in database
    const cookieStore = await cookies();
    let userEmail = cookieStore.get('user_email')?.value;
    let userCode = cookieStore.get('user_code')?.value;

    // Try to get email and code from state parameter if not in cookies
    if (state) {
      try {
        const stateData = JSON.parse(decodeURIComponent(state));
        if (!userEmail && stateData.email) {
          userEmail = stateData.email;
          console.log(`[Strava] Got email from state parameter: ${userEmail}`);
        }
        if (!userCode && stateData.code) {
          userCode = stateData.code;
          console.log(`[Strava] Got code from state parameter: ${userCode}`);
        }
      } catch (e) {
        console.log('[Strava] Could not parse state parameter');
      }
    }

    if (userEmail) {
      const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : undefined;
      const storeResult = await storeToken(userEmail, 'strava', {
        accessToken,
        refreshToken,
        expiresAt,
        providerUserId: athleteId?.toString(),
        scopes: ['read', 'activity:read_all'],
      }, userCode);

      if (storeResult.success) {
        console.log(`[Strava] Tokens stored in database for ${userEmail}${userCode ? ` (code: ${userCode})` : ''}`);
      } else {
        console.error(`[Strava] Failed to store tokens:`, storeResult.error);
      }
    }

    // Keep cookies for backward compatibility
    cookieStore.set('strava_access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365
    });

    if (refreshToken) {
      cookieStore.set('strava_refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365
      });
    }

    cookieStore.set('strava_athlete_id', athleteId.toString(), {
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
          <title>Strava Connected</title>
        </head>
        <body>
          <script>
            // Check if we're in a popup window (desktop) or full page (mobile)
            if (window.opener) {
              // Desktop: Signal to parent window that connection was successful
              window.opener.postMessage({ type: 'strava-connected' }, '*');
              // Close the popup after a short delay
              setTimeout(() => {
                window.close();
              }, 1000);
            } else {
              // Mobile: Redirect back to onboarding
              window.location.href = '${redirectPath}?auth=strava&success=true';
            }
          </script>
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 40px;">
            <h1 style="color: #4CAF50;">✓ Connected</h1>
            <p>Strava has been connected successfully.</p>
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
    console.error('Error in Strava callback:', error);

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
              window.opener.postMessage({ type: 'strava-error' }, '*');
            }
            setTimeout(() => {
              window.close();
            }, 3000);
          </script>
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 40px;">
            <h1 style="color: #f44336;">✗ Connection Failed</h1>
            <p>Failed to connect Strava. Please try again.</p>
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
