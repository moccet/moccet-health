import { NextRequest, NextResponse } from 'next/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.SLACK_CLIENT_ID;
    const redirectUri = process.env.SLACK_REDIRECT_URI || 'http://localhost:3003/api/slack/callback';

    const searchParams = request.nextUrl.searchParams;
    const source = searchParams.get('source');
    const userId = searchParams.get('userId');

    const stateData = { random: Math.random().toString(36).substring(2, 15), source: source || 'web', userId };
    const state = encodeURIComponent(JSON.stringify(stateData));

    if (!clientId) {
      return NextResponse.json({ error: 'Slack not configured' }, { status: 500, headers: corsHeaders });
    }

    // User scopes - these grant permissions to the USER token (not bot)
    // This allows us to identify the user's own messages
    const userScopes = [
      'users:read',
      'users:read.email',
      'channels:history',
      'channels:read',
      'groups:read',      // For private channels
      'groups:history',   // For reading private channel messages
      'im:history',
      'im:read',
      'mpim:history',     // For group DMs
      'mpim:read',
      'reactions:read'    // For engagement metrics
    ].join(',');

    // Use user_scope instead of scope to get a USER token (xoxp-) not a bot token (xoxb-)
    // This allows auth.test to return the actual user's ID for accurate message filtering
    const authUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&user_scope=${userScopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

    return NextResponse.json({ authUrl }, { headers: corsHeaders });
  } catch (error) {
    console.error('Error generating Slack auth URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate auth URL' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}
