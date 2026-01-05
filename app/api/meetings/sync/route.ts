/**
 * Manual Meeting Sync API
 *
 * POST /api/meetings/sync - Manually trigger calendar sync for a user
 *
 * This endpoint allows users to manually sync their calendar and schedule
 * the Moccet Notetaker for upcoming meetings.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { syncUpcomingMeetingsForUser, scheduleBotJoin } from '@/lib/services/meeting-notetaker/google-meet-bot';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, code } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    console.log('[MeetingSync] Manual sync triggered for:', email);

    const supabase = createAdminClient();

    // Check if user has notetaker settings, create if not
    const { data: existingSettings } = await supabase
      .from('meeting_notetaker_settings')
      .select('*')
      .eq('user_email', email)
      .single();

    if (!existingSettings) {
      // Create default settings with auto-join enabled
      const { error: createError } = await supabase
        .from('meeting_notetaker_settings')
        .insert({
          user_email: email,
          user_code: code,
          auto_join_enabled: true,
          join_buffer_minutes: 1,
          default_language: 'en',
          enable_speaker_diarization: true,
          default_summary_style: 'executive',
          auto_send_summary: true,
          send_to_attendees: false,
          recap_distribution_emails: [],
          auto_generate_followup: true,
          match_email_style: true,
          retain_recordings_days: 90,
          retain_transcripts_days: 365,
        });

      if (createError) {
        console.error('[MeetingSync] Error creating settings:', createError);
        // Continue anyway - sync might still work
      } else {
        console.log('[MeetingSync] Created default settings for:', email);
      }
    }

    // Run the sync for new meetings
    const result = await syncUpcomingMeetingsForUser(email, code);

    console.log('[MeetingSync] Sync complete:', {
      email,
      scheduled: result.scheduled,
      errors: result.errors,
    });

    // Retry bot scheduling for existing meetings without bots
    const { data: meetingsWithoutBots } = await supabase
      .from('meeting_recordings')
      .select('id, google_meet_url, scheduled_start')
      .eq('user_email', email)
      .is('bot_session_id', null)
      .eq('status', 'scheduled')
      .not('google_meet_url', 'is', null)
      .gte('scheduled_start', new Date().toISOString());

    let botsRetried = 0;
    let retryErrors = 0;

    if (meetingsWithoutBots && meetingsWithoutBots.length > 0) {
      console.log(`[MeetingSync] Retrying bot scheduling for ${meetingsWithoutBots.length} meetings`);

      for (const meeting of meetingsWithoutBots) {
        try {
          const botResult = await scheduleBotJoin({
            meetingId: meeting.id,
            googleMeetUrl: meeting.google_meet_url,
            userEmail: email,
            botName: 'moccet notetaker',
            scheduledStart: new Date(meeting.scheduled_start),
            maxDurationMinutes: 120,
          });

          if (botResult.success) {
            botsRetried++;
          } else {
            console.error(`[MeetingSync] Bot retry failed for ${meeting.id}:`, botResult.error);
            retryErrors++;
          }
        } catch (err) {
          console.error(`[MeetingSync] Bot retry exception for ${meeting.id}:`, err);
          retryErrors++;
        }
      }
    }

    // Get the list of upcoming meetings that are now scheduled
    const { data: upcomingMeetings } = await supabase
      .from('meeting_recordings')
      .select('id, title, scheduled_start, status, google_meet_url')
      .eq('user_email', email)
      .gte('scheduled_start', new Date().toISOString())
      .order('scheduled_start', { ascending: true })
      .limit(10);

    const totalScheduled = result.scheduled + botsRetried;
    const totalErrors = result.errors + retryErrors;

    return NextResponse.json({
      success: true,
      message: totalScheduled > 0
        ? `Scheduled ${totalScheduled} meeting(s) for notetaker`
        : 'No new meetings to schedule',
      scheduled: result.scheduled,
      botsRetried,
      errors: totalErrors,
      upcoming_meetings: upcomingMeetings?.map(m => ({
        id: m.id,
        title: m.title,
        scheduledStart: m.scheduled_start,
        status: m.status,
        hasGoogleMeet: !!m.google_meet_url,
      })) || [],
    });
  } catch (error) {
    console.error('[MeetingSync] Exception:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to sync meetings'
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check sync status / last sync time
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter is required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Get user's notetaker settings
    const { data: settings } = await supabase
      .from('meeting_notetaker_settings')
      .select('*')
      .eq('user_email', email)
      .single();

    // Get count of scheduled meetings
    const { count: scheduledCount } = await supabase
      .from('meeting_recordings')
      .select('*', { count: 'exact', head: true })
      .eq('user_email', email)
      .eq('status', 'scheduled')
      .gte('scheduled_start', new Date().toISOString());

    // Get upcoming meetings
    const { data: upcomingMeetings } = await supabase
      .from('meeting_recordings')
      .select('id, title, scheduled_start, status, google_meet_url, bot_session_id')
      .eq('user_email', email)
      .gte('scheduled_start', new Date().toISOString())
      .order('scheduled_start', { ascending: true })
      .limit(10);

    return NextResponse.json({
      settings: settings ? {
        autoJoinEnabled: settings.auto_join_enabled,
        defaultSummaryStyle: settings.default_summary_style,
        autoSendSummary: settings.auto_send_summary,
      } : null,
      scheduledMeetingsCount: scheduledCount || 0,
      upcomingMeetings: upcomingMeetings?.map(m => ({
        id: m.id,
        title: m.title,
        scheduledStart: m.scheduled_start,
        status: m.status,
        hasGoogleMeet: !!m.google_meet_url,
        botScheduled: !!m.bot_session_id,
      })) || [],
    });
  } catch (error) {
    console.error('[MeetingSync] GET Exception:', error);
    return NextResponse.json(
      { error: 'Failed to get sync status' },
      { status: 500 }
    );
  }
}
