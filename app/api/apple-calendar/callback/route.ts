import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    // Apple uses POST for OAuth callback with form_post response_mode
    const formData = await request.formData();
    const code = formData.get('code') as string;
    const state = formData.get('state') as string;

    if (!code) {
      throw new Error('No authorization code received');
    }

    // In a real implementation, you would:
    // 1. Verify the state parameter to prevent CSRF
    // 2. Exchange the authorization code for an access token
    // 3. Use the access token to request calendar permissions
    // 4. Store the access token securely in your database
    // 5. Set up webhooks for calendar updates

    // For now, we'll just set a cookie to indicate connection
    const cookieStore = await cookies();
    cookieStore.set('apple_calendar_connected', 'true', {
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
          <title>Apple Calendar Connected</title>
        </head>
        <body>
          <script>
            // Signal to parent window that connection was successful
            if (window.opener) {
              window.opener.postMessage({ type: 'apple-calendar-connected' }, '*');
            }
            // Close the popup after a short delay
            setTimeout(() => {
              window.close();
            }, 1000);
          </script>
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 40px;">
            <h1 style="color: #4CAF50;">✓ Connected</h1>
            <p>Apple Calendar has been connected successfully.</p>
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
    console.error('Error in Apple Calendar callback:', error);

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
              window.opener.postMessage({ type: 'apple-calendar-error' }, '*');
            }
            setTimeout(() => {
              window.close();
            }, 3000);
          </script>
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 40px;">
            <h1 style="color: #f44336;">✗ Connection Failed</h1>
            <p>Failed to connect Apple Calendar. Please try again.</p>
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

// Also support GET for testing
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');

  if (!code) {
    return new NextResponse(
      `<!DOCTYPE html>
      <html>
        <body>
          <div style="font-family: sans-serif; text-align: center; padding: 40px;">
            <h1>Apple Calendar OAuth Callback</h1>
            <p>This endpoint handles Apple Calendar authentication callbacks.</p>
          </div>
        </body>
      </html>`,
      {
        headers: { 'Content-Type': 'text/html' },
      }
    );
  }

  // If code exists, process it similar to POST
  const cookieStore = await cookies();
  cookieStore.set('apple_calendar_connected', 'true', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365
  });

  return new NextResponse(
    `<!DOCTYPE html>
    <html>
      <head>
        <title>Apple Calendar Connected</title>
      </head>
      <body>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'apple-calendar-connected' }, '*');
          }
          setTimeout(() => {
            window.close();
          }, 1000);
        </script>
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 40px;">
          <h1 style="color: #4CAF50;">✓ Connected</h1>
          <p>Apple Calendar has been connected successfully.</p>
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
