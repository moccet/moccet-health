import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { storeToken } from '@/lib/services/token-manager';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      throw new Error(`OAuth error: ${error}`);
    }

    if (!code) {
      throw new Error('No authorization code received');
    }

    const clientId = process.env.DEXCOM_CLIENT_ID;
    const clientSecret = process.env.DEXCOM_CLIENT_SECRET;
    const redirectUri = process.env.DEXCOM_REDIRECT_URI || `${process.env.NEXT_PUBLIC_BASE_URL}/api/dexcom/callback`;

    if (!clientId || !clientSecret) {
      throw new Error('Dexcom credentials not configured');
    }

    // Determine base URL based on environment
    const baseUrl = process.env.NODE_ENV === 'production'
      ? 'https://api.dexcom.com'
      : 'https://sandbox-api.dexcom.com';

    // Exchange authorization code for access token
    const tokenResponse = await fetch(`${baseUrl}/v2/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cache-Control': 'no-cache',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
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
    const expiresIn = tokenData.expires_in;

    console.log('[Dexcom] Connected successfully');

    // Store tokens in database
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('user_email')?.value;

    if (userEmail) {
      const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : undefined;
      const storeResult = await storeToken(userEmail, 'dexcom', {
        accessToken,
        refreshToken,
        expiresAt,
        scopes: ['offline_access'],
      });

      if (storeResult.success) {
        console.log(`[Dexcom] Tokens stored in database for ${userEmail}`);
      } else {
        console.error(`[Dexcom] Failed to store tokens:`, storeResult.error);
      }
    }

    // Keep cookies for backward compatibility
    cookieStore.set('dexcom_access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365
    });

    if (refreshToken) {
      cookieStore.set('dexcom_refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365
      });
    }

    cookieStore.set('dexcom_connected', 'true', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365 // 1 year
    });

    // Return HTML to close the popup and signal success to parent window
    return new NextResponse(
      `<!DOCTYPE html>
      <html>
        <head>
          <title>Dexcom Connected</title>
        </head>
        <body>
          <script>
            // Check if we're in a popup window (desktop) or full page (mobile)
            if (window.opener) {
              // Desktop: Signal to parent window that connection was successful
              window.opener.postMessage({ type: 'dexcom-connected' }, '*');
              // Close the popup after a short delay
              setTimeout(() => {
                window.close();
              }, 1000);
            } else {
              // Mobile: Redirect back to onboarding
              const returnPath = '/forge/onboarding'; // Default
              window.location.href = returnPath + '?auth=dexcom&success=true';
            }
          </script>
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 40px;">
            <h1 style="color: #4CAF50;">✓ Connected</h1>
            <p>Dexcom CGM has been connected successfully.</p>
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
    console.error('Error in Dexcom callback:', error);

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
              window.opener.postMessage({ type: 'dexcom-error' }, '*');
            }
            setTimeout(() => {
              window.close();
            }, 3000);
          </script>
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 40px;">
            <h1 style="color: #f44336;">✗ Connection Failed</h1>
            <p>Failed to connect Dexcom CGM. Please try again.</p>
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
