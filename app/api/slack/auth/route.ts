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

    // Get state from query params (contains email and code from onboarding)
    const searchParams = request.nextUrl.searchParams;
    const state = searchParams.get('state') || '';

    if (!clientId) {
      return NextResponse.json({ error: 'Slack not configured' }, { status: 500, headers: corsHeaders });
    }

    // Slack OAuth scopes - include all needed for conversations.list
    const scopes = [
      'users:read',
      'users:read.email',
      'channels:history',
      'channels:read',
      'groups:read',      // For private channels in conversations.list
      'groups:history',   // For reading private channel messages
      'im:history',
      'im:read'
    ].join(',');

    // Include state parameter so callback receives email/code
    const authUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

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
