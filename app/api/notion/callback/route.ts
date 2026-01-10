import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { storeToken } from '@/lib/services/token-manager';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    // Detect the correct origin
    const forwardedHost = request.headers.get('x-forwarded-host');
    const forwardedProto = request.headers.get('x-forwarded-proto');

    let origin: string;
    if (forwardedHost && forwardedProto) {
      origin = `${forwardedProto}://${forwardedHost}`;
    } else if (request.nextUrl.origin.includes('ngrok')) {
      origin = request.nextUrl.origin;
    } else {
      origin = 'http://localhost:3003';
    }

    console.log('[NOTION CALLBACK] Origin:', origin);

    if (error) {
      return NextResponse.redirect(new URL(`/sage-testing?error=${error}`, origin));
    }

    if (!code) {
      return NextResponse.redirect(new URL('/sage-testing?error=no_code', origin));
    }

    const clientId = process.env.NOTION_CLIENT_ID;
    const clientSecret = process.env.NOTION_CLIENT_SECRET;
    const redirectUri = process.env.NOTION_REDIRECT_URI || 'http://localhost:3003/api/notion/callback';

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(new URL('/sage-testing?error=config_error', origin));
    }

    // Exchange code for access token (Notion uses Basic Auth)
    const tokenResponse = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('Notion OAuth error:', tokenData);
      return NextResponse.redirect(new URL('/sage-testing?error=auth_failed', origin));
    }

    // Extract token data
    const accessToken = tokenData.access_token;
    const workspaceId = tokenData.workspace_id;
    const workspaceName = tokenData.workspace_name || 'Notion Workspace';
    const botId = tokenData.bot_id;
    const workspaceIcon = tokenData.workspace_icon;
    const owner = tokenData.owner; // { type: 'user', user: { id, name, avatar_url, ... } }

    console.log('[NOTION CALLBACK] Connection successful, workspace:', workspaceName);

    // Get cookies and state
    const cookieStore = await cookies();
    let userEmail = cookieStore.get('user_email')?.value;
    let userCode = cookieStore.get('user_code')?.value;
    let supabaseUserId: string | null = null;
    let isMobileApp = false;

    // Parse state parameter
    let redirectPath = '/forge/onboarding';
    const state = searchParams.get('state');
    try {
      if (state) {
        const stateData = JSON.parse(decodeURIComponent(state));
        if (stateData.returnPath) {
          redirectPath = stateData.returnPath;
        }
        if (!userCode && stateData.code) {
          userCode = stateData.code;
          console.log(`[Notion] Got code from state parameter: ${userCode}`);
        }
        if (!userEmail && stateData.email) {
          userEmail = stateData.email;
          console.log(`[Notion] Got email from state parameter: ${userEmail}`);
        }
        if (stateData.userId) {
          supabaseUserId = stateData.userId;
          console.log(`[Notion] Got userId from state parameter: ${supabaseUserId}`);
        }
        if (stateData.source === 'mobile') {
          isMobileApp = true;
        }
      }
    } catch (e) {
      console.log('[Notion] Could not parse state data');
    }

    // Look up email from userId if needed
    if (!userEmail && supabaseUserId) {
      try {
        const { createAdminClient } = await import('@/lib/supabase/server');
        const supabase = createAdminClient();
        const { data: userData } = await supabase.auth.admin.getUserById(supabaseUserId);
        if (userData?.user?.email) {
          userEmail = userData.user.email;
          console.log(`[Notion] Looked up email from userId: ${userEmail}`);
        }
      } catch (e) {
        console.log('[Notion] Could not look up email from userId:', e);
      }
    }

    // Store tokens in database
    if (userEmail && accessToken) {
      const storeResult = await storeToken(userEmail, 'notion', {
        accessToken,
        providerUserId: botId,
        scopes: ['read_content', 'read_user_info'], // Notion doesn't return scopes, but these are implicit
        metadata: {
          workspace_id: workspaceId,
          workspace_name: workspaceName,
          workspace_icon: workspaceIcon,
          owner_type: owner?.type,
          owner_user_id: owner?.user?.id,
          owner_user_name: owner?.user?.name,
        },
      }, userCode);

      if (storeResult.success) {
        console.log(`[Notion] Tokens stored in database for ${userEmail}${userCode ? ` (code: ${userCode})` : ''}`);

        // Trigger initial data fetch for Max tier users
        try {
          const { createClient } = await import('@supabase/supabase-js');
          const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          );

          const { data: userData } = await supabase
            .from('users')
            .select('subscription_tier')
            .eq('email', userEmail)
            .single();

          if (userData?.subscription_tier === 'max') {
            console.log(`[Notion] Max tier user - triggering data fetch for ${userEmail}`);
            fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://moccet.ai'}/api/notion/fetch-data`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: userEmail }),
            }).then(res => {
              if (res.ok) {
                console.log(`[Notion] Data fetch triggered successfully for ${userEmail}`);
              } else {
                console.error(`[Notion] Data fetch failed: ${res.status}`);
              }
            }).catch(err => {
              console.error(`[Notion] Data fetch error:`, err);
            });
          }
        } catch (tierCheckError) {
          console.error('[Notion] Error checking user tier:', tierCheckError);
        }
      } else {
        console.error(`[Notion] Failed to store tokens:`, storeResult.error);
      }
    } else {
      console.warn(`[Notion] Cannot store token - no email available`);
    }

    // Update user_connectors table for mobile app compatibility
    if (supabaseUserId) {
      try {
        const { createAdminClient } = await import('@/lib/supabase/server');
        const supabase = createAdminClient();
        await supabase.from('user_connectors').upsert({
          user_id: supabaseUserId,
          user_email: userEmail || null,
          connector_name: 'Notion',
          is_connected: true,
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,connector_name' });
        console.log(`[Notion] Updated user_connectors for user ${supabaseUserId}`);
      } catch (connectorError) {
        console.error('[Notion] Failed to update user_connectors:', connectorError);
      }
    }

    // Return HTML based on source
    const html = isMobileApp
      ? `<!DOCTYPE html>
        <html>
          <head>
            <title>Notion Connected</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@900&display=swap" rel="stylesheet">
          </head>
          <body style="margin: 0; padding: 0; background: #fff;">
            <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 60px 20px;">
              <div style="font-family: 'Inter', sans-serif; font-weight: 900; font-size: 48px; color: #000; margin-bottom: 24px;">moccet</div>
              <p style="font-size: 18px; color: #2E8B57; margin: 0 0 12px 0;">Notion has been connected successfully.</p>
              <p style="font-size: 14px; color: #666; margin: 0;">You can now close this window and return to the app.</p>
            </div>
          </body>
        </html>`
      : `<!DOCTYPE html>
        <html>
          <head>
            <title>Notion Connected</title>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@900&display=swap" rel="stylesheet">
          </head>
          <body style="margin: 0; padding: 0; background: #fff;">
            <script>
              if(window.opener){
                window.opener.postMessage({type:'notion-connected',workspace:'${workspaceName}'},'*');
                setTimeout(()=>{window.close();},1000);
              } else {
                window.location.href='${redirectPath}?auth=notion&success=true';
              }
            </script>
            <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 60px 20px;">
              <div style="font-family: 'Inter', sans-serif; font-weight: 900; font-size: 48px; color: #000; margin-bottom: 24px;">moccet</div>
              <p style="font-size: 18px; color: #2E8B57; margin: 0 0 12px 0;">Notion has been connected successfully.</p>
              <p style="font-size: 14px; color: #666; margin: 0;">Redirecting you back...</p>
            </div>
          </body>
        </html>`;

    const response = new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
      },
    });

    // Store in cookies for backward compatibility
    if (accessToken) {
      response.cookies.set('notion_access_token', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30 // 30 days
      });
    }

    response.cookies.set('notion_workspace', workspaceName, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30
    });

    console.log('[NOTION CALLBACK] Cookies set successfully');

    return response;
  } catch (error) {
    console.error('Error in Notion callback:', error);
    const fallbackUrl = 'http://localhost:3003';
    return NextResponse.redirect(
      new URL('/sage-testing?error=auth_failed', fallbackUrl)
    );
  }
}
