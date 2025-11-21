import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const clientId = process.env.OURA_CLIENT_ID;
    const redirectUri = process.env.OURA_REDIRECT_URI || `${process.env.NEXT_PUBLIC_BASE_URL}/api/oura/callback`;

    if (!clientId) {
      return NextResponse.json(
        { error: 'Oura client ID not configured' },
        { status: 500 }
      );
    }

    // Oura OAuth 2.0 authorization URL
    // Documentation: https://cloud.ouraring.com/v2/docs#section/Authentication
    const authUrl = new URL('https://cloud.ouraring.com/oauth/authorize');
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('scope', 'personal daily'); // Request personal info and daily data
    authUrl.searchParams.append('state', generateRandomState());

    return NextResponse.json({ authUrl: authUrl.toString() });
  } catch (error) {
    console.error('Error generating Oura auth URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate auth URL' },
      { status: 500 }
    );
  }
}

function generateRandomState(): string {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
}
