import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { storeToken } from '@/lib/services/token-manager';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    // Detect the correct origin - check for ngrok or forwarded host headers
    const forwardedHost = request.headers.get('x-forwarded-host');
    const forwardedProto = request.headers.get('x-forwarded-proto');

    let origin: string;
    if (forwardedHost && forwardedProto) {
      // We're behind ngrok or a proxy
      origin = `${forwardedProto}://${forwardedHost}`;
    } else if (request.nextUrl.origin.includes('ngrok')) {
      // Direct ngrok access
      origin = request.nextUrl.origin;
    } else {
      // Local development without proxy
      origin = 'http://localhost:3003';
    }

    console.log('[SLACK CALLBACK] Origin:', origin);
    console.log('[SLACK CALLBACK] Headers - x-forwarded-host:', forwardedHost);
    console.log('[SLACK CALLBACK] Headers - x-forwarded-proto:', forwardedProto);
    console.log('[SLACK CALLBACK] Full URL:', request.url);

    if (error) {
      return NextResponse.redirect(new URL(`/sage-testing?error=${error}`, origin));
    }

    if (!code) {
      return NextResponse.redirect(new URL('/sage-testing?error=no_code', origin));
    }

    const clientId = process.env.SLACK_CLIENT_ID;
    const clientSecret = process.env.SLACK_CLIENT_SECRET;
    const redirectUri = process.env.SLACK_REDIRECT_URI || 'http://localhost:3003/api/slack/callback';

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(new URL('/sage-testing?error=config_error', origin));
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.ok) {
      console.error('Slack OAuth error:', tokenData);
      return NextResponse.redirect(new URL('/sage-testing?error=auth_failed', origin));
    }

    // Get team info and tokens
    // With user_scope OAuth, the user token is in authed_user.access_token
    const teamName = tokenData.team?.name || 'Slack Workspace';
    const userAccessToken = tokenData.authed_user?.access_token;
    const botAccessToken = tokenData.access_token; // May be undefined with user_scope only
    const accessToken = userAccessToken || botAccessToken; // Prefer user token
    const teamId = tokenData.team?.id;
    const userId = tokenData.authed_user?.id;

    console.log('[SLACK CALLBACK] Token type:', userAccessToken ? 'user (xoxp)' : 'bot (xoxb)');
    console.log('[SLACK CALLBACK] User ID:', userId);

    console.log('[SLACK CALLBACK] Connection successful, team:', teamName);

    // Get cookies and state first
    const cookieStore = await cookies();
    let userEmail = cookieStore.get('user_email')?.value;
    let userCode = cookieStore.get('user_code')?.value;
    let supabaseUserId: string | null = null;
    let isMobileApp = false;

    // Parse state parameter FIRST to get email/code/userId/source
    let redirectPath = '/forge/onboarding';
    const state = searchParams.get('state');
    try {
      if (state) {
        const stateData = JSON.parse(decodeURIComponent(state));
        if (stateData.returnPath) {
          redirectPath = stateData.returnPath;
        }
        // Get code from state if not in cookies
        if (!userCode && stateData.code) {
          userCode = stateData.code;
          console.log(`[Slack] Got code from state parameter: ${userCode}`);
        }
        // Get email from state if not in cookies
        if (!userEmail && stateData.email) {
          userEmail = stateData.email;
          console.log(`[Slack] Got email from state parameter: ${userEmail}`);
        }
        if (stateData.userId) {
          supabaseUserId = stateData.userId;
          console.log(`[Slack] Got userId from state parameter: ${supabaseUserId}`);
        }
        if (stateData.source === 'mobile') {
          isMobileApp = true;
        }
      }
    } catch (e) {
      console.log('[Slack] Could not parse state data');
    }

    // If we have userId but no email, look up the email from Supabase
    if (!userEmail && supabaseUserId) {
      try {
        const { createAdminClient } = await import('@/lib/supabase/server');
        const supabase = createAdminClient();
        const { data: userData } = await supabase.auth.admin.getUserById(supabaseUserId);
        if (userData?.user?.email) {
          userEmail = userData.user.email;
          console.log(`[Slack] Looked up email from userId: ${userEmail}`);
        }
      } catch (e) {
        console.log('[Slack] Could not look up email from userId:', e);
      }
    }

    // Store tokens in database (now we have email from cookies OR state OR userId lookup)
    if (userEmail && accessToken) {
      // Get scopes from the appropriate place depending on token type
      const scopes = tokenData.authed_user?.scope?.split(',') || tokenData.scope?.split(',') || [];

      const storeResult = await storeToken(userEmail, 'slack', {
        accessToken,
        providerUserId: userId,
        scopes,
        metadata: {
          team_id: teamId,
          team_name: teamName,
          token_type: userAccessToken ? 'user' : 'bot',
        },
      }, userCode);

      if (storeResult.success) {
        console.log(`[Slack] Tokens stored in database for ${userEmail}${userCode ? ` (code: ${userCode})` : ''}`);
      } else {
        console.error(`[Slack] Failed to store tokens:`, storeResult.error);
      }

    } else {
      console.warn(`[Slack] Cannot store token - no email available (cookie: ${!!cookieStore.get('user_email')?.value}, state: ${!!state})`);
    }

    // Update user_connectors table for mobile app compatibility (outside userEmail check)
    if (supabaseUserId) {
      try {
        const { createAdminClient } = await import('@/lib/supabase/server');
        const supabase = createAdminClient();
        await supabase.from('user_connectors').upsert({
          user_id: supabaseUserId,
          connector_name: 'Slack',
          is_connected: true,
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,connector_name' });
        console.log(`[Slack] Updated user_connectors for user ${supabaseUserId}`);
      } catch (connectorError) {
        console.error('[Slack] Failed to update user_connectors:', connectorError);
      }
    } else {
      console.warn('[Slack] No userId available, cannot update user_connectors');
    }

    // Store in cookies for backward compatibility
    if (accessToken) {
      cookieStore.set('slack_access_token', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365
      });
    }
    cookieStore.set('slack_team', teamName, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365
    });

    // Return HTML based on source (isMobileApp already set above from state parsing)
    const html = isMobileApp
      ? `<!DOCTYPE html><html><head><title>Slack Connected</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 60px 20px;"><div style="font-size: 64px; margin-bottom: 20px;">✓</div><h1 style="color: #4A154B; font-size: 24px;">Connected!</h1><p>Slack has been connected successfully.</p><p style="font-size: 14px; color: #666;">You can now close this window and return to the app.</p></div></body></html>`
      : `<!DOCTYPE html><html><head><title>Slack Connected</title></head><body><script>if(window.opener){window.opener.postMessage({type:'slack-connected',team:'${teamName}'},'*');setTimeout(()=>{window.close();},1000);}else{window.location.href='${redirectPath}?auth=slack&success=true';}</script><div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 40px;"><h1 style="color: #4A154B;">✓ Connected</h1><p>Slack has been connected successfully.</p></div></body></html>`;

    const response = new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
      },
    });

    response.cookies.set('slack_access_token', tokenData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30 // 30 days
    });

    response.cookies.set('slack_team', teamName, {
      httpOnly: false, // Allow client-side access to show team name
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30 // 30 days
    });

    if (tokenData.authed_user?.access_token) {
      response.cookies.set('slack_user_token', tokenData.authed_user.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30 // 30 days
      });
    }

    console.log('[SLACK CALLBACK] Cookies set successfully');

    return response;
  } catch (error) {
    console.error('Error in Slack callback:', error);

    // Fallback to localhost if we can't determine origin
    const fallbackUrl = 'http://localhost:3003';

    return NextResponse.redirect(
      new URL('/sage-testing?error=auth_failed', fallbackUrl)
    );
  }
}
