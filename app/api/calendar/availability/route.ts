import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAccessToken } from '@/lib/services/token-manager';
import { createAdminClient } from '@/lib/supabase/server';

// Helper function to look up user's unique code from onboarding data
async function getUserCode(email: string): Promise<string | null> {
  const supabase = createAdminClient();

  const { data: forgeData } = await supabase
    .from('forge_onboarding_data')
    .select('form_data')
    .eq('email', email)
    .single();

  if (forgeData?.form_data?.uniqueCode) {
    return forgeData.form_data.uniqueCode;
  }

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

interface TimeSlot {
  start: string;
  end: string;
  formatted: string;
  duration: number; // minutes
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');
    const userCode = searchParams.get('code');
    const durationMinutes = parseInt(searchParams.get('duration') || '30');
    const daysAhead = parseInt(searchParams.get('days') || '7');
    const preferredHourStart = parseInt(searchParams.get('hourStart') || '9');
    const preferredHourEnd = parseInt(searchParams.get('hourEnd') || '17');

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    console.log(`[Calendar] Finding availability for ${email}`);

    // Get user code if not provided
    const code = userCode || await getUserCode(email);

    // Get access token
    const tokenResult = await getAccessToken(email, 'gmail', code);

    if (!tokenResult.success || !tokenResult.accessToken) {
      return NextResponse.json(
        { error: 'Gmail/Calendar not connected', needsAuth: true },
        { status: 401 }
      );
    }

    // Initialize Google Calendar API
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({ access_token: tokenResult.accessToken });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    // Get calendar events for the next N days
    const now = new Date();
    const endDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

    const eventsResponse = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: endDate.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 250,
    });

    const events = eventsResponse.data.items || [];

    console.log(`[Calendar] Found ${events.length} events in the next ${daysAhead} days`);

    // Find available slots
    const availableSlots: TimeSlot[] = [];
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Create a map of busy times
    const busyTimes: { start: Date; end: Date }[] = events
      .filter(event => event.start?.dateTime && event.end?.dateTime)
      .map(event => ({
        start: new Date(event.start!.dateTime as string),
        end: new Date(event.end!.dateTime as string),
      }));

    // Check each day for available slots
    for (let day = 0; day < daysAhead; day++) {
      const currentDay = new Date(now);
      currentDay.setDate(now.getDate() + day);

      // Skip weekends (optional - could be configurable)
      const dayOfWeek = currentDay.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;

      // Set working hours for this day
      const dayStart = new Date(currentDay);
      dayStart.setHours(preferredHourStart, 0, 0, 0);

      const dayEnd = new Date(currentDay);
      dayEnd.setHours(preferredHourEnd, 0, 0, 0);

      // If today, start from now (rounded up to next 30 min)
      let slotStart = day === 0 ? new Date(Math.max(now.getTime(), dayStart.getTime())) : dayStart;

      // Round up to next 30 minute mark
      const minutes = slotStart.getMinutes();
      if (minutes > 0) {
        slotStart.setMinutes(minutes <= 30 ? 30 : 60, 0, 0);
      }

      // Find free slots in this day
      while (slotStart.getTime() + durationMinutes * 60000 <= dayEnd.getTime()) {
        const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60000);

        // Check if this slot conflicts with any busy time
        const hasConflict = busyTimes.some(busy =>
          (slotStart >= busy.start && slotStart < busy.end) ||
          (slotEnd > busy.start && slotEnd <= busy.end) ||
          (slotStart <= busy.start && slotEnd >= busy.end)
        );

        if (!hasConflict) {
          availableSlots.push({
            start: slotStart.toISOString(),
            end: slotEnd.toISOString(),
            formatted: slotStart.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              timeZone: timezone,
            }),
            duration: durationMinutes,
          });

          // Limit to 10 slots per request
          if (availableSlots.length >= 10) break;
        }

        // Move to next potential slot (30 min increments)
        slotStart = new Date(slotStart.getTime() + 30 * 60000);
      }

      if (availableSlots.length >= 10) break;
    }

    console.log(`[Calendar] Found ${availableSlots.length} available slots`);

    // Get the best slot (first available)
    const bestSlot = availableSlots[0] || null;

    return NextResponse.json({
      success: true,
      availableSlots,
      bestSlot,
      totalEventsChecked: events.length,
      searchPeriod: {
        start: now.toISOString(),
        end: endDate.toISOString(),
      },
    });

  } catch (error: any) {
    console.error('[Calendar] Error checking availability:', error);

    if (error.code === 401) {
      return NextResponse.json(
        { error: 'Calendar authentication expired', needsAuth: true },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to check calendar availability', details: error.message },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
