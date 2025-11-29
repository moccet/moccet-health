import { NextResponse } from 'next/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function GET() {
  try {
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const redirectUri = process.env.MICROSOFT_TEAMS_REDIRECT_URI || `${process.env.NEXT_PUBLIC_BASE_URL}/api/teams/callback`;

    if (!clientId) {
      return NextResponse.json(
        { error: 'Microsoft Client ID not configured' },
        { status: 500, headers: corsHeaders }
      );
    }

    // Microsoft Teams OAuth 2.0 authorization URL
    // Documentation: https://learn.microsoft.com/en-us/graph/auth-v2-user
    const authUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('response_mode', 'query');

    // Teams-specific scopes
    // https://learn.microsoft.com/en-us/graph/permissions-reference
    const scopes = [
      'openid',
      'profile',
      'email',
      'offline_access',
      'Chat.Read',           // Read user's chats
      'Chat.ReadWrite',      // Read and send messages in chats
      'ChatMessage.Send',    // Send messages in chats
      'Team.ReadBasic.All',  // Read basic team info
      'Channel.ReadBasic.All', // Read basic channel info
      'ChannelMessage.Send', // Send messages in channels
    ].join(' ');

    authUrl.searchParams.append('scope', scopes);
    authUrl.searchParams.append('state', generateRandomState());

    return NextResponse.json({
      success: true,
      authUrl: authUrl.toString()
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('Error initiating Teams auth:', error);
    return NextResponse.json(
      { error: 'Failed to initiate Teams authentication' },
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
