/**
 * Meetings API Route
 *
 * GET /api/meetings - List meetings for a user
 * POST /api/meetings - Create a new meeting recording
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { scheduleBotJoin } from '@/lib/services/meeting-notetaker/google-meet-bot';

// ============================================================================
// GET - List Meetings
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const code = searchParams.get('code');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter is required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Build query
    let query = supabase
      .from('meeting_recordings')
      .select(`
        id,
        title,
        calendar_event_id,
        scheduled_start,
        scheduled_end,
        actual_start,
        actual_end,
        duration_seconds,
        status,
        notetaker_enabled,
        attendees,
        organizer_name,
        created_at,
        meeting_summaries (
          id,
          summary_style,
          summary_text,
          is_primary
        ),
        meeting_action_items (
          id,
          task_description,
          owner_name,
          status
        )
      `)
      .order('scheduled_start', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by user
    if (code) {
      query = query.or(`user_email.eq.${email},user_code.eq.${code}`);
    } else {
      query = query.eq('user_email', email);
    }

    // Filter by status if provided
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('[MeetingsAPI] Error fetching meetings:', error);
      return NextResponse.json(
        { error: 'Failed to fetch meetings' },
        { status: 500 }
      );
    }

    // Transform data for response
    const meetings = (data || []).map((meeting) => ({
      id: meeting.id,
      title: meeting.title,
      calendarEventId: meeting.calendar_event_id,
      scheduledStart: meeting.scheduled_start,
      scheduledEnd: meeting.scheduled_end,
      actualStart: meeting.actual_start,
      actualEnd: meeting.actual_end,
      durationSeconds: meeting.duration_seconds,
      status: meeting.status,
      notetakerEnabled: meeting.notetaker_enabled,
      attendeeCount: (meeting.attendees as any[])?.length || 0,
      organizerName: meeting.organizer_name,
      createdAt: meeting.created_at,
      primarySummary: (meeting.meeting_summaries as any[])?.find(
        (s: any) => s.is_primary
      )?.summary_text,
      actionItemCount: (meeting.meeting_action_items as any[])?.length || 0,
      openActionItems: (meeting.meeting_action_items as any[])?.filter(
        (a: any) => a.status === 'open'
      ).length || 0,
    }));

    return NextResponse.json({
      meetings,
      pagination: {
        offset,
        limit,
        total: count,
        hasMore: (data?.length || 0) === limit,
      },
    });
  } catch (error) {
    console.error('[MeetingsAPI] Exception:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Create Meeting
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      email,
      code,
      calendarEventId,
      googleMeetUrl,
      title,
      scheduledStart,
      scheduledEnd,
      organizerEmail,
      organizerName,
      attendees,
      enableNotetaker = true,
    } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Check for duplicate by calendar event ID
    if (calendarEventId) {
      const { data: existing } = await supabase
        .from('meeting_recordings')
        .select('id')
        .eq('user_email', email)
        .eq('calendar_event_id', calendarEventId)
        .single();

      if (existing) {
        return NextResponse.json(
          { error: 'Meeting already exists', meetingId: existing.id },
          { status: 409 }
        );
      }
    }

    // Create meeting record
    const { data: meeting, error: createError } = await supabase
      .from('meeting_recordings')
      .insert({
        user_email: email,
        user_code: code,
        calendar_event_id: calendarEventId,
        google_meet_url: googleMeetUrl,
        meeting_type: googleMeetUrl ? 'google_meet' : 'microphone',
        title,
        scheduled_start: scheduledStart,
        scheduled_end: scheduledEnd,
        organizer_email: organizerEmail,
        organizer_name: organizerName,
        attendees: attendees || [],
        status: 'scheduled',
        notetaker_enabled: enableNotetaker,
      })
      .select()
      .single();

    if (createError || !meeting) {
      console.error('[MeetingsAPI] Error creating meeting:', createError);
      return NextResponse.json(
        { error: 'Failed to create meeting' },
        { status: 500 }
      );
    }

    // Schedule bot if enabled and we have a Meet URL
    let botScheduled = false;
    if (enableNotetaker && googleMeetUrl && scheduledStart) {
      const botResult = await scheduleBotJoin({
        meetingId: meeting.id,
        googleMeetUrl,
        userEmail: email,
        botName: 'moccet notetaker',
        scheduledStart: new Date(scheduledStart),
        maxDurationMinutes: 120,
      });
      botScheduled = botResult.success;
    }

    return NextResponse.json({
      success: true,
      meeting: {
        id: meeting.id,
        title: meeting.title,
        scheduledStart: meeting.scheduled_start,
        status: meeting.status,
        notetakerEnabled: meeting.notetaker_enabled,
        botScheduled,
      },
    });
  } catch (error) {
    console.error('[MeetingsAPI] Exception:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
