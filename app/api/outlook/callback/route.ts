import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

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

    // Set cookie with actual user email
    const cookieStore = await cookies();
    cookieStore.set('outlook_email', userEmail, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365 // 1 year
    });

    // TODO: Store tokens in database for future API calls
    // For now, we just verify the connection works

    // Return HTML to close the popup and signal success to parent window
    return new NextResponse(
      `<!DOCTYPE html>
      <html>
        <head>
          <title>Outlook Connected</title>
        </head>
        <body>
          <script>
            // Send message to parent window
            if (window.opener) {
              window.opener.postMessage({
                type: 'outlook_connected',
                email: '${userEmail}'
              }, window.location.origin);
            }

            // Close the popup after a short delay
            setTimeout(() => {
              window.close();
            }, 1000);
          </script>
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 40px;">
            <h1 style="color: #4CAF50;">✓ Connected</h1>
            <p>Outlook has been connected successfully.</p>
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
