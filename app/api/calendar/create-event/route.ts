import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAccessToken } from '@/lib/services/token-manager';
import { createAdminClient } from '@/lib/supabase/server';

// Helper function to look up user's unique code from onboarding data
async function getUserCode(email: string): Promise<string | null> {
  const supabase = createAdminClient();

  // Try forge_onboarding_data first
  const { data: forgeData } = await supabase
    .from('forge_onboarding_data')
    .select('form_data')
    .eq('email', email)
    .single();

  if (forgeData?.form_data?.uniqueCode) {
    return forgeData.form_data.uniqueCode;
  }

  // Try sage_onboarding_data
  const { data: sageData } = await supabase
    .from('sage_onboarding_data')
    .select('form_data')
    .eq('email', email)
    .single();

  if (sageData?.form_data?.uniqueCode) {
    return sageData.form_data.uniqueCode;
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, userCode, title, description, startTime, endTime, location, colorId } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!title || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'Title, startTime, and endTime are required' },
        { status: 400 }
      );
    }

    console.log(`[Calendar] Creating event for ${email}: "${title}"`);

    // Get user code if not provided
    const code = userCode || await getUserCode(email);

    // Get access token using token-manager
    const tokenResult = await getAccessToken(email, 'gmail', code);

    if (!tokenResult.success || !tokenResult.accessToken) {
      console.error('[Calendar] Token error:', tokenResult.error);
      return NextResponse.json(
        { error: 'Gmail/Calendar not connected. Please reconnect with updated permissions.', needsAuth: true },
        { status: 401 }
      );
    }

    // Check if user has the calendar.events scope
    // If not, they need to re-authenticate
    const scopes = tokenResult.scopes || [];
    const hasWriteScope = scopes.some(s =>
      s.includes('calendar.events') || s.includes('calendar') && !s.includes('readonly')
    );

    if (!hasWriteScope && scopes.length > 0) {
      console.log('[Calendar] User needs to re-authenticate for calendar.events scope');
      return NextResponse.json(
        { error: 'Calendar write permission not granted. Please reconnect Gmail/Calendar.', needsAuth: true },
        { status: 401 }
      );
    }

    // Initialize Google Calendar API
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/gmail/callback'
    );

    oauth2Client.setCredentials({ access_token: tokenResult.accessToken });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Create the event
    const event = {
      summary: title,
      description: description || '',
      location: location || '',
      start: {
        dateTime: new Date(startTime).toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: new Date(endTime).toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      colorId: colorId || undefined, // Optional color (1-11)
      reminders: {
        useDefault: true,
      },
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
    });

    const createdEvent = response.data;

    console.log(`[Calendar] Created event: ${createdEvent.id}`);

    return NextResponse.json({
      success: true,
      eventId: createdEvent.id,
      eventUrl: createdEvent.htmlLink,
      title: createdEvent.summary,
      startTime: createdEvent.start?.dateTime,
      endTime: createdEvent.end?.dateTime,
      message: `Created "${title}" on your calendar`,
    });

  } catch (error: any) {
    console.error('[Calendar] Error creating event:', error);

    // Check for specific Google API errors
    if (error.code === 401 || error.message?.includes('invalid_grant')) {
      return NextResponse.json(
        { error: 'Calendar authentication expired. Please reconnect.', needsAuth: true },
        { status: 401 }
      );
    }

    if (error.code === 403) {
      return NextResponse.json(
        { error: 'Calendar permission denied. Please reconnect with calendar write access.', needsAuth: true },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create calendar event', details: error.message },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
