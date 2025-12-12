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
    let userEmail = cookieStore.get('user_email')?.value;
    let userCode = cookieStore.get('user_code')?.value;

    // Parse state parameter to get email/code if not in cookies
    const state = request.nextUrl.searchParams.get('state');
    if (state) {
      try {
        const stateData = JSON.parse(decodeURIComponent(state));
        if (!userEmail && stateData.email) {
          userEmail = stateData.email;
          console.log(`[Dexcom] Got email from state parameter: ${userEmail}`);
        }
        if (!userCode && stateData.code) {
          userCode = stateData.code;
          console.log(`[Dexcom] Got code from state parameter: ${userCode}`);
        }
      } catch (e) {
        console.log('[Dexcom] Could not parse state parameter');
      }
    }

    if (userEmail) {
      const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : undefined;
      const storeResult = await storeToken(userEmail, 'dexcom', {
        accessToken,
        refreshToken,
        expiresAt,
        scopes: ['offline_access'],
      }, userCode);

      if (storeResult.success) {
        console.log(`[Dexcom] Tokens stored in database for ${userEmail}${userCode ? ` (code: ${userCode})` : ''}`);
      } else {
        console.error(`[Dexcom] Failed to store tokens:`, storeResult.error);
      }

      // Update user_connectors for mobile app
      try {
        const { createAdminClient } = await import('@/lib/supabase/server');
        const supabase = createAdminClient();
        let supabaseUserId: string | null = null;
        if (state) { try { supabaseUserId = JSON.parse(decodeURIComponent(state)).userId || null; } catch (e) {} }
        if (supabaseUserId) {
          await supabase.from('user_connectors').upsert({ user_id: supabaseUserId, connector_name: 'Dexcom', is_connected: true, connected_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'user_id,connector_name' });
          console.log(`[Dexcom] Updated user_connectors for user ${supabaseUserId}`);
        }
      } catch (e) { console.error('[Dexcom] Failed to update user_connectors:', e); }
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

    // Determine redirect and source
    let isMobileApp = false;
    if (state) { try { isMobileApp = JSON.parse(decodeURIComponent(state)).source === 'mobile'; } catch (e) {} }

    if (isMobileApp) {
      return new NextResponse(
        `<!DOCTYPE html><html><head><title>Dexcom Connected</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 60px 20px;"><div style="font-size: 64px; margin-bottom: 20px;">✓</div><h1 style="color: #4CAF50; font-size: 24px;">Connected!</h1><p>Dexcom CGM has been connected successfully.</p><p style="font-size: 14px; color: #666;">You can now close this window and return to the app.</p></div></body></html>`,
        { status: 200, headers: { 'Content-Type': 'text/html' } }
      );
    }

    return new NextResponse(
      `<!DOCTYPE html><html><head><title>Dexcom Connected</title></head><body><script>if(window.opener){window.opener.postMessage({type:'dexcom-connected'},'*');setTimeout(()=>{window.close();},1000);}else{window.location.href='/forge/onboarding?auth=dexcom&success=true';}</script><div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 40px;"><h1 style="color: #4CAF50;">✓ Connected</h1><p>Dexcom CGM has been connected successfully.</p></div></body></html>`,
      { status: 200, headers: { 'Content-Type': 'text/html' } }
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
