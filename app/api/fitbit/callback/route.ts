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

    const clientId = process.env.FITBIT_CLIENT_ID;
    const clientSecret = process.env.FITBIT_CLIENT_SECRET;
    const redirectUri = process.env.FITBIT_REDIRECT_URI || `${process.env.NEXT_PUBLIC_BASE_URL}/api/fitbit/callback`;

    if (!clientId || !clientSecret) {
      throw new Error('Fitbit credentials not configured');
    }

    // Fitbit requires Basic Auth with base64 encoded client_id:client_secret
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://api.fitbit.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
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
    const userId = tokenData.user_id;
    const expiresIn = tokenData.expires_in; // seconds
    const scopes = tokenData.scope ? tokenData.scope.split(' ') : [];

    console.log(`[Fitbit] Connected: User ID ${userId}`);

    // Get user email and code from cookies
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('user_email')?.value;
    let userCode = cookieStore.get('user_code')?.value;

    // Try to get code from state parameter if not in cookies
    if (!userCode && state) {
      try {
        const stateData = JSON.parse(decodeURIComponent(state));
        if (stateData.code) {
          userCode = stateData.code;
          console.log(`[Fitbit] Got code from state parameter: ${userCode}`);
        }
      } catch (e) {
        console.log('[Fitbit] Could not parse code from state');
      }
    }

    // Store tokens in database
    if (userEmail) {
      const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : undefined;

      const storeResult = await storeToken(userEmail, 'fitbit', {
        accessToken,
        refreshToken,
        expiresAt,
        providerUserId: userId,
        scopes,
      }, userCode);

      if (storeResult.success) {
        console.log(`[Fitbit] Tokens stored in database for ${userEmail}${userCode ? ` (code: ${userCode})` : ''}`);
      } else {
        console.error(`[Fitbit] Failed to store tokens:`, storeResult.error);
      }
    }

    // Keep cookies for backward compatibility
    cookieStore.set('fitbit_access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365
    });

    if (refreshToken) {
      cookieStore.set('fitbit_refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365
      });
    }

    cookieStore.set('fitbit_user_id', userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365
    });

    // TODO: Store tokens in database for future API calls
    // For now, we just verify the connection works

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
          <title>Fitbit Connected</title>
        </head>
        <body>
          <script>
            // Check if we're in a popup window (desktop) or full page (mobile)
            if (window.opener) {
              // Desktop: Signal to parent window that connection was successful
              window.opener.postMessage({ type: 'fitbit-connected' }, '*');
              // Close the popup after a short delay
              setTimeout(() => {
                window.close();
              }, 1000);
            } else {
              // Mobile: Redirect back to onboarding
              window.location.href = '${redirectPath}?auth=fitbit&success=true';
            }
          </script>
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 40px;">
            <h1 style="color: #4CAF50;">✓ Connected</h1>
            <p>Fitbit has been connected successfully.</p>
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
    console.error('Error in Fitbit callback:', error);

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
              window.opener.postMessage({ type: 'fitbit-error' }, '*');
            }
            setTimeout(() => {
              window.close();
            }, 3000);
          </script>
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 40px;">
            <h1 style="color: #f44336;">✗ Connection Failed</h1>
            <p>Failed to connect Fitbit. Please try again.</p>
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
