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

    const clientId = process.env.WHOOP_CLIENT_ID;
    const clientSecret = process.env.WHOOP_CLIENT_SECRET;
    const redirectUri = process.env.WHOOP_REDIRECT_URI || `${process.env.NEXT_PUBLIC_BASE_URL}/api/whoop/callback`;

    if (!clientId || !clientSecret) {
      throw new Error('Whoop credentials not configured');
    }

    // Exchange authorization code for access token
    // Whoop uses client_secret_post method (credentials in body, not header)
    const tokenResponse = await fetch('https://api.prod.whoop.com/oauth/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[Whoop] Token exchange failed:', errorText);
      throw new Error('Failed to exchange authorization code for token');
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in; // seconds

    // Fetch user profile from Whoop API
    const userInfoResponse = await fetch('https://api.prod.whoop.com/developer/v1/user/profile/basic', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    let userId = 'whoop_user';
    if (userInfoResponse.ok) {
      const userInfo = await userInfoResponse.json();
      userId = userInfo.user_id?.toString() || 'whoop_user';
    } else {
      console.warn('[Whoop] Could not fetch user profile');
    }

    console.log(`[Whoop] Connected: User ID ${userId}`);

    // Get user email and code from cookies (set during onboarding) or from state parameter
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
          console.log(`[Whoop] Got email from state parameter: ${userEmail}`);
        }
        if (!userCode && stateData.code) {
          userCode = stateData.code;
          console.log(`[Whoop] Got code from state parameter: ${userCode}`);
        }
        if (stateData.userId) {
          supabaseUserId = stateData.userId;
          console.log(`[Whoop] Got userId from state parameter: ${supabaseUserId}`);
        }
        if (stateData.source === 'mobile') {
          isMobileApp = true;
        }
      } catch (e) {
        console.log('[Whoop] Could not parse state data');
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
          console.log(`[Whoop] Looked up email from userId: ${userEmail}`);
        }
      } catch (e) {
        console.log('[Whoop] Could not look up email from userId:', e);
      }
    }

    if (!userEmail) {
      console.warn('[Whoop] No user email found, cannot store token in database');
    }

    // Store tokens in database (new secure method)
    if (userEmail) {
      const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : undefined;

      const storeResult = await storeToken(userEmail, 'whoop', {
        accessToken,
        refreshToken,
        expiresAt,
        providerUserId: userId,
        scopes: ['read:recovery', 'read:cycles', 'read:sleep', 'read:workout', 'read:profile', 'read:body_measurement'],
      }, userCode);

      if (storeResult.success) {
        console.log(`[Whoop] Tokens stored in database for ${userEmail}${userCode ? ` (code: ${userCode})` : ''}`);
      } else {
        console.error(`[Whoop] Failed to store tokens in database:`, storeResult.error);
      }

    }

    // Update user_connectors table for mobile app compatibility (outside userEmail check)
    if (supabaseUserId) {
      try {
        const { createAdminClient } = await import('@/lib/supabase/server');
        const supabase = createAdminClient();
        await supabase.from('user_connectors').upsert({
          user_id: supabaseUserId,
          connector_name: 'Whoop',
          is_connected: true,
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,connector_name' });
        console.log(`[Whoop] Updated user_connectors for user ${supabaseUserId}`);
      } catch (connectorError) {
        console.error('[Whoop] Failed to update user_connectors:', connectorError);
      }
    } else {
      console.warn('[Whoop] No userId available, cannot update user_connectors');
    }

    // Keep cookies for backward compatibility and session validation
    cookieStore.set('whoop_access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365
    });

    if (refreshToken) {
      cookieStore.set('whoop_refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365
      });
    }

    cookieStore.set('whoop_user_id', userId, {
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
        `<!DOCTYPE html><html><head><title>Whoop Connected</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 60px 20px;"><div style="font-size: 64px; margin-bottom: 20px;">✓</div><h1 style="color: #44D62C; font-size: 24px;">Connected!</h1><p>Whoop has been connected successfully.</p><p style="font-size: 14px; color: #666;">You can now close this window and return to the app.</p></div></body></html>`,
        { status: 200, headers: { 'Content-Type': 'text/html' } }
      );
    }

    return new NextResponse(
      `<!DOCTYPE html><html><head><title>Whoop Connected</title></head><body><script>if(window.opener){window.opener.postMessage({type:'whoop-connected'},'*');setTimeout(()=>{window.close();},1000);}else{window.location.href='${redirectPath}?auth=whoop&success=true';}</script><div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 40px;"><h1 style="color: #44D62C;">✓ Connected</h1><p>Whoop has been connected successfully.</p></div></body></html>`,
      { status: 200, headers: { 'Content-Type': 'text/html' } }
    );

  } catch (error) {
    console.error('Error in Whoop callback:', error);

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
              window.opener.postMessage({ type: 'whoop-error' }, '*');
            }
            setTimeout(() => {
              window.close();
            }, 3000);
          </script>
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 40px;">
            <h1 style="color: #f44336;">✗ Connection Failed</h1>
            <p>Failed to connect Whoop. Please try again.</p>
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
