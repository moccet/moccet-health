import { NextResponse } from 'next/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function GET() {
  try {
    // Microsoft OAuth 2.0 configuration for Outlook Calendar
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/outlook/callback`;

    // Microsoft Identity Platform OAuth URL
    const authUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
    authUrl.searchParams.append('client_id', clientId || 'your-client-id');
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('response_mode', 'query');
    authUrl.searchParams.append('scope', 'openid profile email User.Read Calendars.Read Calendars.ReadWrite Mail.Read offline_access');
    authUrl.searchParams.append('state', generateRandomState());

    return NextResponse.json({
      success: true,
      authUrl: authUrl.toString()
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('Error initiating Outlook auth:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Outlook authentication' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

function generateRandomState(): string {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
}
