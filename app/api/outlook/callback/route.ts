import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

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

    // In a real implementation, you would:
    // 1. Verify the state parameter to prevent CSRF
    // 2. Exchange the authorization code for an access token
    // 3. Use the access token to fetch user's email and profile
    // 4. Request calendar permissions from Microsoft Graph API
    // 5. Store the access token and refresh token securely in your database
    // 6. Set up webhooks for calendar updates

    // For now, we'll just set a cookie with a dummy email
    const cookieStore = await cookies();
    cookieStore.set('outlook_email', 'user@outlook.com', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365 // 1 year
    });

    // Return HTML to close the popup and signal success to parent window
    return new NextResponse(
      `<!DOCTYPE html>
      <html>
        <head>
          <title>Outlook Connected</title>
        </head>
        <body>
          <script>
            // Signal to parent window that connection was successful
            if (window.opener) {
              window.opener.postMessage({ type: 'outlook-connected' }, '*');
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
              window.opener.postMessage({ type: 'outlook-error' }, '*');
            }
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
