import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const clientId = process.env.SLACK_CLIENT_ID;
    const redirectUri = process.env.SLACK_REDIRECT_URI || 'http://localhost:3003/api/slack/callback';

    if (!clientId) {
      return NextResponse.json({ error: 'Slack not configured' }, { status: 500 });
    }

    // Slack OAuth scopes
    const scopes = [
      'users:read',
      'users:read.email',
      'channels:history',
      'channels:read',
      'im:history',
      'im:read'
    ].join(',');

    const authUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}`;

    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('Error generating Slack auth URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate auth URL' },
      { status: 500 }
    );
  }
}
