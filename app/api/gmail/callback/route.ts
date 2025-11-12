import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');

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

    if (!code) {
      return NextResponse.redirect(new URL('/sage-testing?error=no_code', origin));
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/gmail/callback'
    );

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user email
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const userEmail = userInfo.data.email || '';

    // Store tokens in cookie or session (for demo, we'll use a simple approach)
    // In production, you'd want to encrypt these and store in a database
    const response = NextResponse.redirect(new URL('/sage-testing', origin));

    // Set cookies with tokens (note: in production, encrypt these!)
    response.cookies.set('gmail_access_token', tokens.access_token || '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 // 1 hour
    });

    if (tokens.refresh_token) {
      response.cookies.set('gmail_refresh_token', tokens.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30 // 30 days
      });
    }

    response.cookies.set('gmail_email', userEmail, {
      httpOnly: false, // Allow client-side access to show email
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30 // 30 days
    });

    return response;
  } catch (error) {
    console.error('Error in Gmail callback:', error);

    // Fallback to localhost if we can't determine origin
    const fallbackUrl = 'http://localhost:3003';

    return NextResponse.redirect(
      new URL('/sage-testing?error=auth_failed', fallbackUrl)
    );
  }
}
