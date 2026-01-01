import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function GET(request: NextRequest) {
  try {
    // Check if request is from mobile app
    const searchParams = request.nextUrl.searchParams;
    const source = searchParams.get('source') || 'web';
    const userId = searchParams.get('userId') || '';
    const userEmail = searchParams.get('userEmail') || ''; // Supabase user's email for web users

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/gmail/callback'
    );

    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.compose', // Allow creating drafts
      'https://www.googleapis.com/auth/gmail.labels',  // Create/manage labels
      'https://www.googleapis.com/auth/gmail.modify',  // Apply labels to messages
      'https://www.googleapis.com/auth/gmail.send',    // Send emails (requires user approval)
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events', // Allow creating/editing calendar events
      'https://www.googleapis.com/auth/userinfo.email'
    ];

    // Pass source, userId, and userEmail in state parameter
    const state = JSON.stringify({ source, userId, userEmail });

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      state: state
    });

    return NextResponse.json({ authUrl }, { headers: corsHeaders });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate auth URL' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}
