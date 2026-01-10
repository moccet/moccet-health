import { NextRequest, NextResponse } from 'next/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.LINEAR_CLIENT_ID;
    const redirectUri = process.env.LINEAR_REDIRECT_URI || 'http://localhost:3003/api/linear/callback';

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
      return NextResponse.json({ error: 'Linear not configured' }, { status: 500, headers: corsHeaders });
    }

    // Linear OAuth scopes
    // read - Read access to user data
    // issues:read - Read issues
    // comments:read - Read comments
    const scopes = 'read';

    const authUrl = `https://linear.app/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scopes}&state=${state}&prompt=consent`;

    return NextResponse.json({ authUrl }, { headers: corsHeaders });
  } catch (error) {
    console.error('Error generating Linear auth URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate auth URL' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}
