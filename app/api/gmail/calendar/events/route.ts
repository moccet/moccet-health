import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getValidatedAccessToken } from '@/lib/services/token-manager';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const days = parseInt(searchParams.get('days') || '7', 10);

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    // Get valid access token
    const accessToken = await getValidatedAccessToken(email, 'gmail');
    if (!accessToken) {
      return NextResponse.json({ error: 'Not connected to Gmail' }, { status: 401 });
    }

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ access_token: accessToken });

    // Create calendar client
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Calculate time range
    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + days);

    // Fetch calendar events
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: endDate.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 50,
    });

    const events = response.data.items || [];

    return NextResponse.json({
      events: events.map((event) => ({
        id: event.id,
        summary: event.summary,
        description: event.description,
        start: event.start,
        end: event.end,
        hangoutLink: event.hangoutLink,
        location: event.location,
        attendees: event.attendees,
        organizer: event.organizer,
      })),
    });
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch calendar events' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, title, startDateTime, endDateTime, addGoogleMeet, attendees } = body;

    if (!email || !title || !startDateTime) {
      return NextResponse.json(
        { error: 'Email, title, and startDateTime required' },
        { status: 400 }
      );
    }

    // Get valid access token
    const accessToken = await getValidatedAccessToken(email, 'gmail');
    if (!accessToken) {
      return NextResponse.json({ error: 'Not connected to Gmail' }, { status: 401 });
    }

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ access_token: accessToken });

    // Create calendar client
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Calculate end time if not provided (default 1 hour)
    const start = new Date(startDateTime);
    const end = endDateTime
      ? new Date(endDateTime)
      : new Date(start.getTime() + 60 * 60 * 1000);

    // Build event object
    const event: {
      summary: string;
      start: { dateTime: string; timeZone: string };
      end: { dateTime: string; timeZone: string };
      attendees?: Array<{ email: string }>;
      conferenceData?: {
        createRequest: {
          requestId: string;
          conferenceSolutionKey: { type: string };
        };
      };
    } = {
      summary: title,
      start: {
        dateTime: start.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: end.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    };

    // Add attendees if provided
    if (attendees && Array.isArray(attendees) && attendees.length > 0) {
      event.attendees = attendees.map((email: string) => ({ email }));
    }

    // Add Google Meet conference if requested
    if (addGoogleMeet) {
      event.conferenceData = {
        createRequest: {
          requestId: `moccet-${Date.now()}`,
          conferenceSolutionKey: {
            type: 'hangoutsMeet',
          },
        },
      };
    }

    // Create the event
    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
      conferenceDataVersion: addGoogleMeet ? 1 : 0,
      sendUpdates: attendees && attendees.length > 0 ? 'all' : 'none',
    });

    const createdEvent = response.data;

    return NextResponse.json({
      success: true,
      event: {
        id: createdEvent.id,
        summary: createdEvent.summary,
        start: createdEvent.start,
        end: createdEvent.end,
        hangoutLink: createdEvent.hangoutLink,
        htmlLink: createdEvent.htmlLink,
      },
    });
  } catch (error) {
    console.error('Error creating calendar event:', error);
    return NextResponse.json(
      { error: 'Failed to create calendar event' },
      { status: 500 }
    );
  }
}
