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
    let userEmail = cookieStore.get('user_email')?.value;
    let userCode = cookieStore.get('user_code')?.value;
    let supabaseUserId: string | null = null;
    let isMobileApp = false;

    // Try to get email, code, userId, and source from state parameter
    if (state) {
      try {
        const stateData = JSON.parse(decodeURIComponent(state));
        if (!userEmail && stateData.email) {
          userEmail = stateData.email;
          console.log(`[Fitbit] Got email from state parameter: ${userEmail}`);
        }
        if (!userCode && stateData.code) {
          userCode = stateData.code;
          console.log(`[Fitbit] Got code from state parameter: ${userCode}`);
        }
        if (stateData.userId) {
          supabaseUserId = stateData.userId;
          console.log(`[Fitbit] Got userId from state parameter: ${supabaseUserId}`);
        }
        if (stateData.source === 'mobile') {
          isMobileApp = true;
        }
      } catch (e) {
        console.log('[Fitbit] Could not parse state data');
      }
    }

    // If we have userId but no email, look up the email from Supabase
    if (!userEmail && supabaseUserId) {
      try {
        const { createAdminClient } = await import('@/lib/supabase/server');
        const supabase = createAdminClient();
        const { data: userData } = await supabase.auth.admin.getUserById(supabaseUserId);
        if (userData?.user?.email) {
          userEmail = userData.user.email;
          console.log(`[Fitbit] Looked up email from userId: ${userEmail}`);
        }
      } catch (e) {
        console.log('[Fitbit] Could not look up email from userId:', e);
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

    // Update user_connectors table for mobile app compatibility (outside userEmail check)
    if (supabaseUserId) {
      try {
        const { createAdminClient } = await import('@/lib/supabase/server');
        const supabase = createAdminClient();
        await supabase.from('user_connectors').upsert({
          user_id: supabaseUserId,
          connector_name: 'Fitbit',
          is_connected: true,
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,connector_name' });
        console.log(`[Fitbit] Updated user_connectors for user ${supabaseUserId}`);
      } catch (connectorError) {
        console.error('[Fitbit] Failed to update user_connectors:', connectorError);
      }
    } else {
      console.warn('[Fitbit] No userId available, cannot update user_connectors');
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

    // Determine redirect path (isMobileApp already set above from state parsing)
    let redirectPath = '/forge/onboarding';
    if (state) {
      try {
        const stateData = JSON.parse(decodeURIComponent(state));
        if (stateData.returnPath) redirectPath = stateData.returnPath;
      } catch (e) {
        // Already logged above
      }
    }

    if (isMobileApp) {
      return new NextResponse(
        `<!DOCTYPE html>
        <html>
          <head>
            <title>Fitbit Connected</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@900&display=swap" rel="stylesheet">
          </head>
          <body style="margin: 0; padding: 0; background: #fff;">
            <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 60px 20px;">
              <div style="font-family: 'Inter', sans-serif; font-weight: 900; font-size: 48px; color: #000; margin-bottom: 24px;">moccet</div>
              <p style="font-size: 18px; color: #2E8B57; margin: 0 0 12px 0;">Fitbit has been connected successfully.</p>
              <p style="font-size: 14px; color: #666; margin: 0;">You can now close this window and return to the app.</p>
            </div>
          </body>
        </html>`,
        { status: 200, headers: { 'Content-Type': 'text/html' } }
      );
    }

    return new NextResponse(
      `<!DOCTYPE html>
      <html>
        <head>
          <title>Fitbit Connected</title>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@900&display=swap" rel="stylesheet">
        </head>
        <body style="margin: 0; padding: 0; background: #fff;">
          <script>
            if(window.opener){
              window.opener.postMessage({type:'fitbit-connected'},'*');
              setTimeout(()=>{window.close();},1000);
            } else {
              window.location.href='${redirectPath}?auth=fitbit&success=true';
            }
          </script>
          <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 60px 20px;">
            <div style="font-family: 'Inter', sans-serif; font-weight: 900; font-size: 48px; color: #000; margin-bottom: 24px;">moccet</div>
            <p style="font-size: 18px; color: #2E8B57; margin: 0 0 12px 0;">Fitbit has been connected successfully.</p>
            <p style="font-size: 14px; color: #666; margin: 0;">Redirecting you back...</p>
          </div>
        </body>
      </html>`,
      { status: 200, headers: { 'Content-Type': 'text/html' } }
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
