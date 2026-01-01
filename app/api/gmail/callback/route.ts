import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { cookies } from 'next/headers';
import { storeToken } from '@/lib/services/token-manager';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const stateParam = searchParams.get('state');

    // Parse state to check if this is from mobile and get user info
    let source = 'web';
    let mobileUserId = '';
    let stateUserEmail = ''; // Supabase user's email passed from auth
    if (stateParam) {
      try {
        const state = JSON.parse(stateParam);
        source = state.source || 'web';
        mobileUserId = state.userId || '';
        stateUserEmail = state.userEmail || ''; // Email from web auth flow
      } catch (e) {
        // State is not JSON, ignore
      }
    }
    const isMobile = source === 'mobile';

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

    // Get Google account email
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const googleEmail = userInfo.data.email || '';

    // Get user email - priority: state param (from web auth) > cookies > Google email
    const cookieStore = await cookies();
    const forgeEmail = cookieStore.get('user_email')?.value;
    const userCode = cookieStore.get('user_code')?.value;

    // Use state email first (from web Supabase users), then cookie, then Google email
    const userEmail = stateUserEmail || forgeEmail || googleEmail;

    // Store tokens in database
    if (userEmail && tokens.access_token) {
      const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date) : undefined;
      const storeResult = await storeToken(userEmail, 'gmail', {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt,
        scopes: tokens.scope?.split(' ') || [
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/calendar.readonly',
          'https://www.googleapis.com/auth/calendar.events',
          'https://www.googleapis.com/auth/userinfo.email'
        ],
        providerUserId: googleEmail, // Store the Google email as provider ID
      }, userCode);

      if (storeResult.success) {
        console.log(`[Gmail] Tokens stored in database for ${userEmail}${userCode ? ` (code: ${userCode})` : ''} (Google: ${googleEmail})`);
        // Note: Email draft agent setup is now opt-in via /api/gmail/enable-drafts
        // Called explicitly from the Flutter app when user enables the feature
      } else {
        console.error(`[Gmail] Failed to store tokens:`, storeResult.error);
      }

    }

    // Update user_connectors table for mobile app compatibility (outside userEmail check)
    if (mobileUserId) {
      try {
        const { createAdminClient } = await import('@/lib/supabase/server');
        const supabase = createAdminClient();
        await supabase.from('user_connectors').upsert({
          user_id: mobileUserId,
          user_email: userEmail || null, // Store email for queries that use user_email
          connector_name: 'Google',
          is_connected: true,
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,connector_name' });
        console.log(`[Gmail] Updated user_connectors for user ${mobileUserId}${userEmail ? ` (email: ${userEmail})` : ''}`);
      } catch (connectorError) {
        console.error('[Gmail] Failed to update user_connectors:', connectorError);
      }
    } else {
      console.warn('[Gmail] No userId available, cannot update user_connectors');
    }

    // Store in cookies for backward compatibility (cookieStore already defined above)
    if (tokens.access_token) {
      cookieStore.set('gmail_access_token', tokens.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365
      });
    }
    if (tokens.refresh_token) {
      cookieStore.set('gmail_refresh_token', tokens.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365
      });
    }
    cookieStore.set('gmail_email', userEmail, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365
    });

    // Return HTML based on source (mobile vs web)
    const html = isMobile ? `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Gmail Connected</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              text-align: center;
              padding: 60px 20px;
              background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
              min-height: 100vh;
              margin: 0;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
            }
            .success-icon {
              width: 80px;
              height: 80px;
              background: #4CAF50;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              margin-bottom: 24px;
            }
            .success-icon svg {
              width: 40px;
              height: 40px;
              fill: white;
            }
            h1 {
              color: #1a1a1a;
              font-size: 24px;
              margin: 0 0 12px 0;
            }
            p {
              color: #666;
              font-size: 16px;
              margin: 0 0 8px 0;
            }
            .hint {
              font-size: 14px;
              color: #888;
              margin-top: 32px;
              padding: 16px;
              background: rgba(255,255,255,0.8);
              border-radius: 12px;
            }
          </style>
        </head>
        <body>
          <div class="success-icon">
            <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
          </div>
          <h1>Gmail Connected!</h1>
          <p>Your account has been linked successfully.</p>
          <div class="hint">
            You can now close this window<br>and return to the moccet app.
          </div>
        </body>
      </html>
    ` : `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Gmail Connected</title>
        </head>
        <body>
          <script>
            // Check if we're in a popup window (desktop) or full page (web)
            if (window.opener) {
              // Desktop: Signal to parent window that connection was successful
              window.opener.postMessage({ type: 'gmail-connected', email: '${userEmail}' }, '*');
              // Close the popup after a short delay
              setTimeout(() => {
                window.close();
              }, 1000);
            } else {
              // Web: Redirect back to onboarding (moccet-mail for Supabase users, forge for others)
              const returnPath = '${stateUserEmail ? '/moccet-mail/onboarding' : '/forge/onboarding'}';
              window.location.href = returnPath + '?auth=gmail&success=true';
            }
          </script>
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 40px;">
            <h1 style="color: #4CAF50;">✓ Connected</h1>
            <p>Gmail has been connected successfully.</p>
            <p style="font-size: 14px; color: #666;">Redirecting you back...</p>
          </div>
        </body>
      </html>
    `;

    const response = new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
      },
    });

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

// Note: Email draft agent setup moved to /api/gmail/enable-drafts
// This is now an opt-in feature controlled from the Flutter app
