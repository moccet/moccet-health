import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { storeToken } from '@/lib/services/token-manager';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');
    const errorUri = searchParams.get('error_uri');

    if (error) {
      console.error('[Outlook] OAuth Error Details:', {
        error,
        error_description: errorDescription,
        error_uri: errorUri,
        redirect_uri: `${process.env.NEXT_PUBLIC_BASE_URL}/api/outlook/callback`
      });
      throw new Error(`OAuth error: ${error}${errorDescription ? ` - ${errorDescription}` : ''}`);
    }

    if (!code) {
      throw new Error('No authorization code received');
    }

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID || '',
        client_secret: process.env.MICROSOFT_CLIENT_SECRET || '',
        code,
        redirect_uri: `${process.env.NEXT_PUBLIC_BASE_URL}/api/outlook/callback`,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      console.error('Status:', tokenResponse.status);
      console.error('Client ID:', process.env.MICROSOFT_CLIENT_ID);
      console.error('Redirect URI:', `${process.env.NEXT_PUBLIC_BASE_URL}/api/outlook/callback`);
      throw new Error(`Failed to exchange authorization code for token: ${errorText}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in;

    // Fetch user profile from Microsoft Graph
    const profileResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!profileResponse.ok) {
      const errorText = await profileResponse.text();
      console.error('[Outlook] Profile fetch failed:', profileResponse.status, errorText);
      throw new Error(`Failed to fetch user profile: ${profileResponse.status} - ${errorText}`);
    }

    const profile = await profileResponse.json();
    const userEmail = profile.mail || profile.userPrincipalName;

    console.log(`[Outlook] Connected: ${userEmail}`);

    // Store tokens in database
    const cookieStore = await cookies();
    let appUserEmail = cookieStore.get('user_email')?.value || userEmail;
    let userCode = cookieStore.get('user_code')?.value;
    let supabaseUserId: string | null = null;
    let isMobileApp = false;

    // Try to get code, userId, and source from state parameter
    if (state) {
      try {
        const stateData = JSON.parse(decodeURIComponent(state));
        if (stateData.code) {
          userCode = stateData.code;
          console.log(`[Outlook] Got code from state parameter: ${userCode}`);
        }
        if (stateData.userId) {
          supabaseUserId = stateData.userId;
          console.log(`[Outlook] Got userId from state parameter: ${supabaseUserId}`);
        }
        if (stateData.source === 'mobile') {
          isMobileApp = true;
        }
      } catch (e) {
        console.log('[Outlook] Could not parse state data');
      }
    }

    // If we have userId but no email, look up the email from Supabase
    if (!appUserEmail && supabaseUserId) {
      try {
        const { createAdminClient } = await import('@/lib/supabase/server');
        const supabase = createAdminClient();
        const { data: userData } = await supabase.auth.admin.getUserById(supabaseUserId);
        if (userData?.user?.email) {
          appUserEmail = userData.user.email;
          console.log(`[Outlook] Looked up email from userId: ${appUserEmail}`);
        }
      } catch (e) {
        console.log('[Outlook] Could not look up email from userId:', e);
      }
    }

    if (appUserEmail && accessToken) {
      const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : undefined;
      const storeResult = await storeToken(appUserEmail, 'outlook', {
        accessToken,
        refreshToken,
        expiresAt,
        providerUserId: userEmail,
        scopes: tokenData.scope?.split(' '),
      }, userCode);

      if (storeResult.success) {
        console.log(`[Outlook] Tokens stored in database for ${appUserEmail}${userCode ? ` (code: ${userCode})` : ''}`);
      } else {
        console.error(`[Outlook] Failed to store tokens:`, storeResult.error);
      }

    }

    // Update user_connectors table for mobile app compatibility (outside userEmail check)
    if (supabaseUserId) {
      try {
        const { createAdminClient } = await import('@/lib/supabase/server');
        const supabase = createAdminClient();
        await supabase.from('user_connectors').upsert({
          user_id: supabaseUserId,
          user_email: appUserEmail || null, // Store email for queries that use user_email
          connector_name: 'Outlook',
          is_connected: true,
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,connector_name' });
        console.log(`[Outlook] Updated user_connectors for user ${supabaseUserId}${appUserEmail ? ` (email: ${appUserEmail})` : ''}`);
      } catch (connectorError) {
        console.error('[Outlook] Failed to update user_connectors:', connectorError);
      }
    } else {
      console.warn('[Outlook] No userId available, cannot update user_connectors');
    }

    // Store in cookies for backward compatibility
    cookieStore.set('outlook_access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365
    });
    if (refreshToken) {
      cookieStore.set('outlook_refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365
      });
    }
    cookieStore.set('outlook_email', userEmail, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365
    });

    // Set cookie with actual user email
    cookieStore.set('outlook_email', userEmail, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365 // 1 year
    });

    // Return HTML based on source (isMobileApp already set above from state parsing)
    if (isMobileApp) {
      return new NextResponse(
        `<!DOCTYPE html><html><head><title>Outlook Connected</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 60px 20px;"><div style="font-size: 64px; margin-bottom: 20px;">✓</div><h1 style="color: #0078D4; font-size: 24px;">Connected!</h1><p>Outlook has been connected successfully.</p><p style="font-size: 14px; color: #666;">You can now close this window and return to the app.</p></div></body></html>`,
        { status: 200, headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Web: Return HTML to close the popup
    return new NextResponse(
      `<!DOCTYPE html><html><head><title>Outlook Connected</title></head><body><script>if(window.opener){window.opener.postMessage({type:'outlook_connected',email:'${userEmail}'},window.location.origin);setTimeout(()=>{window.close();},1000);}else{window.location.href='/forge/onboarding?auth=outlook&success=true';}</script><div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 40px;">
            <h1 style="color: #4CAF50;">✓ Connected</h1>
            <p>Outlook has been connected successfully.</p>
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
    console.error('Error in Outlook callback:', error);
    console.error('Error details:', error instanceof Error ? error.message : String(error));
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');

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
            <p>Failed to connect Outlook. Please try again.</p>
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
