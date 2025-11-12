import { NextRequest, NextResponse } from 'next/server';

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

    // Get team info
    const teamName = tokenData.team?.name || 'Slack Workspace';

    // Store tokens in cookies
    const redirectUrl = new URL('/sage-testing', origin);
    console.log('[SLACK CALLBACK] Redirecting to:', redirectUrl.toString());

    const response = NextResponse.redirect(redirectUrl);

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

    console.log('[SLACK CALLBACK] Cookies set successfully, team:', teamName);

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
