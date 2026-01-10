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

    console.log('[LINEAR CALLBACK] Origin:', origin);

    if (error) {
      return NextResponse.redirect(new URL(`/sage-testing?error=${error}`, origin));
    }

    if (!code) {
      return NextResponse.redirect(new URL('/sage-testing?error=no_code', origin));
    }

    const clientId = process.env.LINEAR_CLIENT_ID;
    const clientSecret = process.env.LINEAR_CLIENT_SECRET;
    const redirectUri = process.env.LINEAR_REDIRECT_URI || 'http://localhost:3003/api/linear/callback';

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(new URL('/sage-testing?error=config_error', origin));
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://api.linear.app/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('Linear OAuth error:', tokenData);
      return NextResponse.redirect(new URL('/sage-testing?error=auth_failed', origin));
    }

    // Extract token data
    const accessToken = tokenData.access_token;
    const tokenType = tokenData.token_type;
    const expiresIn = tokenData.expires_in;
    const scope = tokenData.scope;

    console.log('[LINEAR CALLBACK] Got access token');

    // Fetch user info from Linear GraphQL API
    const userResponse = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          query {
            viewer {
              id
              name
              email
              organization {
                id
                name
                urlKey
              }
            }
          }
        `,
      }),
    });

    const userData = await userResponse.json();
    const viewer = userData?.data?.viewer;
    const organization = viewer?.organization;

    const linearUserId = viewer?.id;
    const userName = viewer?.name || 'Linear User';
    const orgName = organization?.name || 'Linear Organization';
    const orgId = organization?.id;

    console.log(`[LINEAR CALLBACK] Connection successful, user: ${userName}, org: ${orgName}`);

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
          console.log(`[Linear] Got code from state parameter: ${userCode}`);
        }
        if (!userEmail && stateData.email) {
          userEmail = stateData.email;
          console.log(`[Linear] Got email from state parameter: ${userEmail}`);
        }
        if (stateData.userId) {
          supabaseUserId = stateData.userId;
          console.log(`[Linear] Got userId from state parameter: ${supabaseUserId}`);
        }
        if (stateData.source === 'mobile') {
          isMobileApp = true;
        }
      }
    } catch (e) {
      console.log('[Linear] Could not parse state data');
    }

    // Look up email from userId if needed
    if (!userEmail && supabaseUserId) {
      try {
        const { createAdminClient } = await import('@/lib/supabase/server');
        const supabase = createAdminClient();
        const { data: dbUserData } = await supabase.auth.admin.getUserById(supabaseUserId);
        if (dbUserData?.user?.email) {
          userEmail = dbUserData.user.email;
          console.log(`[Linear] Looked up email from userId: ${userEmail}`);
        }
      } catch (e) {
        console.log('[Linear] Could not look up email from userId:', e);
      }
    }

    // Use Linear email if we still don't have one
    if (!userEmail && viewer?.email) {
      userEmail = viewer.email;
      console.log(`[Linear] Using Linear email: ${userEmail}`);
    }

    // Store tokens in database
    if (userEmail && accessToken) {
      const storeResult = await storeToken(userEmail, 'linear', {
        accessToken,
        providerUserId: linearUserId,
        expiresIn: expiresIn ? Date.now() + expiresIn * 1000 : undefined,
        scopes: scope ? scope.split(' ') : ['read'],
        metadata: {
          token_type: tokenType,
          user_name: userName,
          organization_id: orgId,
          organization_name: orgName,
          organization_url_key: organization?.urlKey,
        },
      }, userCode);

      if (storeResult.success) {
        console.log(`[Linear] Tokens stored in database for ${userEmail}${userCode ? ` (code: ${userCode})` : ''}`);

        // Trigger initial data fetch for Max tier users
        try {
          const { createClient } = await import('@supabase/supabase-js');
          const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          );

          const { data: dbUserData } = await supabase
            .from('users')
            .select('subscription_tier')
            .eq('email', userEmail)
            .single();

          if (dbUserData?.subscription_tier === 'max') {
            console.log(`[Linear] Max tier user - triggering data fetch for ${userEmail}`);
            fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://moccet.ai'}/api/linear/fetch-data`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: userEmail }),
            }).then(res => {
              if (res.ok) {
                console.log(`[Linear] Data fetch triggered successfully for ${userEmail}`);
              } else {
                console.error(`[Linear] Data fetch failed: ${res.status}`);
              }
            }).catch(err => {
              console.error(`[Linear] Data fetch error:`, err);
            });
          }

          // Set up webhook subscription for real-time updates
          console.log(`[Linear] Setting up webhook subscription for ${userEmail}`);
          fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://moccet.ai'}/api/linear/setup-subscription`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: userEmail }),
          }).then(res => {
            if (res.ok) {
              console.log(`[Linear] Webhook subscription created for ${userEmail}`);
            } else {
              console.error(`[Linear] Webhook setup failed: ${res.status}`);
            }
          }).catch(err => {
            console.error(`[Linear] Webhook setup error:`, err);
          });
        } catch (tierCheckError) {
          console.error('[Linear] Error checking user tier:', tierCheckError);
        }
      } else {
        console.error(`[Linear] Failed to store tokens:`, storeResult.error);
      }
    } else {
      console.warn(`[Linear] Cannot store token - no email available`);
    }

    // Update user_connectors table for mobile app compatibility
    if (supabaseUserId) {
      try {
        const { createAdminClient } = await import('@/lib/supabase/server');
        const supabase = createAdminClient();
        await supabase.from('user_connectors').upsert({
          user_id: supabaseUserId,
          user_email: userEmail || null,
          connector_name: 'Linear',
          is_connected: true,
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,connector_name' });
        console.log(`[Linear] Updated user_connectors for user ${supabaseUserId}`);
      } catch (connectorError) {
        console.error('[Linear] Failed to update user_connectors:', connectorError);
      }
    }

    // Return HTML based on source
    const html = isMobileApp
      ? `<!DOCTYPE html>
        <html>
          <head>
            <title>Linear Connected</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@900&display=swap" rel="stylesheet">
          </head>
          <body style="margin: 0; padding: 0; background: #fff;">
            <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 60px 20px;">
              <div style="font-family: 'Inter', sans-serif; font-weight: 900; font-size: 48px; color: #000; margin-bottom: 24px;">moccet</div>
              <p style="font-size: 18px; color: #2E8B57; margin: 0 0 12px 0;">Linear has been connected successfully.</p>
              <p style="font-size: 14px; color: #666; margin: 0;">You can now close this window and return to the app.</p>
            </div>
          </body>
        </html>`
      : `<!DOCTYPE html>
        <html>
          <head>
            <title>Linear Connected</title>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@900&display=swap" rel="stylesheet">
          </head>
          <body style="margin: 0; padding: 0; background: #fff;">
            <script>
              if(window.opener){
                window.opener.postMessage({type:'linear-connected',organization:'${orgName}'},'*');
                setTimeout(()=>{window.close();},1000);
              } else {
                window.location.href='${redirectPath}?auth=linear&success=true';
              }
            </script>
            <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 60px 20px;">
              <div style="font-family: 'Inter', sans-serif; font-weight: 900; font-size: 48px; color: #000; margin-bottom: 24px;">moccet</div>
              <p style="font-size: 18px; color: #2E8B57; margin: 0 0 12px 0;">Linear has been connected successfully.</p>
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
      response.cookies.set('linear_access_token', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30 // 30 days
      });
    }

    response.cookies.set('linear_organization', orgName, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30
    });

    console.log('[LINEAR CALLBACK] Cookies set successfully');

    return response;
  } catch (error) {
    console.error('Error in Linear callback:', error);
    const fallbackUrl = 'http://localhost:3003';
    return NextResponse.redirect(
      new URL('/sage-testing?error=auth_failed', fallbackUrl)
    );
  }
}
