import { NextRequest, NextResponse } from 'next/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.NOTION_CLIENT_ID;
    const redirectUri = process.env.NOTION_REDIRECT_URI || 'http://localhost:3003/api/notion/callback';

    const searchParams = request.nextUrl.searchParams;
    const source = searchParams.get('source');
    const userId = searchParams.get('userId');
    const email = searchParams.get('email');
    const code = searchParams.get('code'); // User verification code

    const stateData = {
      random: Math.random().toString(36).substring(2, 15),
      source: source || 'web',
      userId,
      email,
      code,
    };
    const state = encodeURIComponent(JSON.stringify(stateData));

    if (!clientId) {
      return NextResponse.json({ error: 'Notion not configured' }, { status: 500, headers: corsHeaders });
    }

    // Notion OAuth URL
    // Note: Notion doesn't use traditional scopes - permissions are granted based on what the user selects
    const authUrl = `https://api.notion.com/v1/oauth/authorize?client_id=${clientId}&response_type=code&owner=user&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

    return NextResponse.json({ authUrl }, { headers: corsHeaders });
  } catch (error) {
    console.error('Error generating Notion auth URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate auth URL' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}
