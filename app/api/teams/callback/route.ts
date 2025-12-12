import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { storeToken } from '@/lib/services/token-manager';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    const errorUri = searchParams.get('error_uri');

    if (error) {
      console.error('[Teams] OAuth Error Details:', {
        error,
        error_description: errorDescription,
        error_uri: errorUri,
        redirect_uri: process.env.MICROSOFT_TEAMS_REDIRECT_URI || `${process.env.NEXT_PUBLIC_BASE_URL}/api/teams/callback`
      });
      throw new Error(`OAuth error: ${error}${errorDescription ? ` - ${errorDescription}` : ''}`);
    }

    if (!code) {
      throw new Error('No authorization code received');
    }

    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    const redirectUri = process.env.MICROSOFT_TEAMS_REDIRECT_URI || `${process.env.NEXT_PUBLIC_BASE_URL}/api/teams/callback`;

    if (!clientId || !clientSecret) {
      throw new Error('Microsoft credentials not configured');
    }

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[Teams] Token exchange failed:', errorText);
      throw new Error('Failed to exchange authorization code for token');
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;

    // Get user profile from Microsoft Graph
    const profileResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!profileResponse.ok) {
      const errorText = await profileResponse.text();
      console.error('[Teams] Profile fetch failed:', profileResponse.status, errorText);
      throw new Error(`Failed to fetch user profile: ${profileResponse.status} - ${errorText}`);
    }

    const profile = await profileResponse.json();
    const userEmail = profile.mail || profile.userPrincipalName;

    console.log(`[Teams] Connected: ${userEmail}`);

    // Get user email and code from state parameter (passed from connector page) or use profile email
    const state = searchParams.get('state');
    let storedUserEmail = userEmail;
    let userCode: string | undefined;
    let supabaseUserId: string | null = null;
    let isMobileApp = false;

    // Get user_code from cookies
    const cookieStore = await cookies();
    userCode = cookieStore.get('user_code')?.value;

    if (state) {
      try {
        const stateData = JSON.parse(decodeURIComponent(state));
        if (stateData.email) {
          storedUserEmail = stateData.email;
        }
        if (!userCode && stateData.code) {
          userCode = stateData.code;
          console.log(`[Teams] Got code from state parameter: ${userCode}`);
        }
        if (stateData.userId) {
          supabaseUserId = stateData.userId;
          console.log(`[Teams] Got userId from state parameter: ${supabaseUserId}`);
        }
        if (stateData.source === 'mobile') {
          isMobileApp = true;
        }
      } catch (e) {
        console.log('[Teams] Could not parse state data');
      }
    }

    // If we have userId but no email, look up the email from Supabase
    if (!storedUserEmail && supabaseUserId) {
      try {
        const { createAdminClient } = await import('@/lib/supabase/server');
        const supabase = createAdminClient();
        const { data: userData } = await supabase.auth.admin.getUserById(supabaseUserId);
        if (userData?.user?.email) {
          storedUserEmail = userData.user.email;
          console.log(`[Teams] Looked up email from userId: ${storedUserEmail}`);
        }
      } catch (e) {
        console.log('[Teams] Could not look up email from userId:', e);
      }
    }

    // Store tokens in database
    if (storedUserEmail) {
      const expiresIn = tokenData.expires_in;
      const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : undefined;

      const storeResult = await storeToken(storedUserEmail, 'teams', {
        accessToken,
        refreshToken,
        expiresAt,
        providerUserId: profile.id,
        scopes: ['Chat.Read', 'Chat.ReadWrite', 'Team.ReadBasic.All', 'Channel.ReadBasic.All'],
      }, userCode);

      if (storeResult.success) {
        console.log(`[Teams] Tokens stored in database for ${storedUserEmail}${userCode ? ` (code: ${userCode})` : ''}`);
      } else {
        console.error(`[Teams] Failed to store tokens:`, storeResult.error);
      }

    }

    // Update user_connectors table for mobile app compatibility (outside userEmail check)
    if (supabaseUserId) {
      try {
        const { createAdminClient } = await import('@/lib/supabase/server');
        const supabase = createAdminClient();
        await supabase.from('user_connectors').upsert({
          user_id: supabaseUserId,
          connector_name: 'Teams',
          is_connected: true,
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,connector_name' });
        console.log(`[Teams] Updated user_connectors for user ${supabaseUserId}`);
      } catch (connectorError) {
        console.error('[Teams] Failed to update user_connectors:', connectorError);
      }
    } else {
      console.warn('[Teams] No userId available, cannot update user_connectors');
    }

    // Set cookies with tokens (for backward compatibility)
    cookieStore.set('teams_access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365 // 1 year
    });

    if (refreshToken) {
      cookieStore.set('teams_refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365 // 1 year
      });
    }

    cookieStore.set('teams_user_email', userEmail, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365 // 1 year
    });

    // Return HTML based on source (isMobileApp already set above from state parsing)
    if (isMobileApp) {
      return new NextResponse(
        `<!DOCTYPE html><html><head><title>Teams Connected</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 60px 20px;"><div style="font-size: 64px; margin-bottom: 20px;">✓</div><h1 style="color: #6264A7; font-size: 24px;">Connected!</h1><p>Microsoft Teams has been connected successfully.</p><p style="font-size: 14px; color: #666;">You can now close this window and return to the app.</p></div></body></html>`,
        { status: 200, headers: { 'Content-Type': 'text/html' } }
      );
    }

    return new NextResponse(
      `<!DOCTYPE html><html><head><title>Teams Connected</title></head><body><script>if(window.opener){window.opener.postMessage({type:'teams_connected',email:'${userEmail}'},window.location.origin);setTimeout(()=>{window.close();},1000);}else{window.location.href='/forge/onboarding?auth=teams&success=true';}</script><div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 40px;"><h1 style="color: #6264A7;">✓ Connected</h1><p>Microsoft Teams has been connected successfully.</p></div></body></html>`,
      { status: 200, headers: { 'Content-Type': 'text/html' } }
    );

  } catch (error) {
    console.error('[Teams] Error in callback:', error);

    return new NextResponse(
      `<!DOCTYPE html>
      <html>
        <head>
          <title>Connection Failed</title>
        </head>
        <body>
          <script>
            setTimeout(() => {
              window.close();
            }, 3000);
          </script>
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 40px;">
            <h1 style="color: #f44336;">✗ Connection Failed</h1>
            <p>Failed to connect Microsoft Teams. Please try again.</p>
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
