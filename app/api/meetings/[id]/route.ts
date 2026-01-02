/**
 * Single Meeting API Route
 *
 * GET /api/meetings/[id] - Get meeting details
 * PUT /api/meetings/[id] - Update meeting
 * DELETE /api/meetings/[id] - Delete meeting
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { cancelBotSession } from '@/lib/services/meeting-notetaker/google-meet-bot';

// ============================================================================
// GET - Meeting Details
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!id) {
      return NextResponse.json(
        { error: 'Meeting ID is required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Fetch meeting with all related data
    const { data: meeting, error } = await supabase
      .from('meeting_recordings')
      .select(`
        *,
        meeting_transcripts (*),
        meeting_summaries (*),
        meeting_action_items (*),
        meeting_decisions (*),
        meeting_followup_drafts (*)
      `)
      .eq('id', id)
      .single();

    if (error || !meeting) {
      console.error('[MeetingAPI] Error fetching meeting:', error);
      return NextResponse.json(
        { error: 'Meeting not found' },
        { status: 404 }
      );
    }

    // Verify user has access (if email provided)
    if (email && meeting.user_email !== email && meeting.user_code !== email) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Transform to API response format
    const response = {
      id: meeting.id,
      title: meeting.title,
      meetingType: meeting.meeting_type,
      googleMeetUrl: meeting.google_meet_url,
      calendarEventId: meeting.calendar_event_id,
      scheduledStart: meeting.scheduled_start,
      scheduledEnd: meeting.scheduled_end,
      actualStart: meeting.actual_start,
      actualEnd: meeting.actual_end,
      durationSeconds: meeting.duration_seconds,
      status: meeting.status,
      notetakerEnabled: meeting.notetaker_enabled,
      recordingUrl: meeting.recording_url,
      organizerEmail: meeting.organizer_email,
      organizerName: meeting.organizer_name,
      attendees: meeting.attendees,
      emailSent: meeting.email_sent,
      emailSentAt: meeting.email_sent_at,
      errorMessage: meeting.error_message,
      createdAt: meeting.created_at,
      updatedAt: meeting.updated_at,

      // Related data
      transcript: meeting.meeting_transcripts?.[0] ? {
        id: meeting.meeting_transcripts[0].id,
        rawTranscript: meeting.meeting_transcripts[0].raw_transcript,
        editedTranscript: meeting.meeting_transcripts[0].edited_transcript,
        segments: meeting.meeting_transcripts[0].segments,
        speakers: meeting.meeting_transcripts[0].speakers,
        detectedLanguage: meeting.meeting_transcripts[0].detected_language,
        overallConfidence: meeting.meeting_transcripts[0].overall_confidence,
      } : null,

      summaries: (meeting.meeting_summaries || []).map((s: any) => ({
        id: s.id,
        style: s.summary_style,
        text: s.summary_text,
        keyPoints: s.key_points,
        topicsDiscussed: s.topics_discussed,
        isPrimary: s.is_primary,
        createdAt: s.created_at,
      })),

      actionItems: (meeting.meeting_action_items || []).map((a: any) => ({
        id: a.id,
        description: a.task_description,
        ownerEmail: a.owner_email,
        ownerName: a.owner_name,
        priority: a.priority,
        dueDate: a.due_date,
        status: a.status,
        confidence: a.confidence,
      })),

      decisions: (meeting.meeting_decisions || []).map((d: any) => ({
        id: d.id,
        text: d.decision_text,
        context: d.context,
        impactArea: d.impact_area,
        confidence: d.confidence,
      })),

      followupDraft: meeting.meeting_followup_drafts?.[0] ? {
        id: meeting.meeting_followup_drafts[0].id,
        subject: meeting.meeting_followup_drafts[0].subject,
        body: meeting.meeting_followup_drafts[0].body,
        toEmails: meeting.meeting_followup_drafts[0].to_emails,
        status: meeting.meeting_followup_drafts[0].status,
      } : null,
    };

    return NextResponse.json({ meeting: response });
  } catch (error) {
    console.error('[MeetingAPI] Exception:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PUT - Update Meeting
// ============================================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      title,
      notetakerEnabled,
      status,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Meeting ID is required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Build update object
    const updates: Record<string, any> = {};
    if (title !== undefined) updates.title = title;
    if (notetakerEnabled !== undefined) updates.notetaker_enabled = notetakerEnabled;
    if (status !== undefined) updates.status = status;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No updates provided' },
        { status: 400 }
      );
    }

    // If disabling notetaker, cancel the bot
    if (notetakerEnabled === false) {
      const { data: meeting } = await supabase
        .from('meeting_recordings')
        .select('bot_session_id')
        .eq('id', id)
        .single();

      if (meeting?.bot_session_id) {
        await cancelBotSession(meeting.bot_session_id);
      }
    }

    const { data, error } = await supabase
      .from('meeting_recordings')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[MeetingAPI] Error updating meeting:', error);
      return NextResponse.json(
        { error: 'Failed to update meeting' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      meeting: {
        id: data.id,
        title: data.title,
        notetakerEnabled: data.notetaker_enabled,
        status: data.status,
      },
    });
  } catch (error) {
    console.error('[MeetingAPI] Exception:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE - Delete Meeting
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Meeting ID is required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Get meeting to cancel bot if needed
    const { data: meeting } = await supabase
      .from('meeting_recordings')
      .select('bot_session_id')
      .eq('id', id)
      .single();

    if (meeting?.bot_session_id) {
      await cancelBotSession(meeting.bot_session_id);
    }

    // Delete meeting (cascades to related tables)
    const { error } = await supabase
      .from('meeting_recordings')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[MeetingAPI] Error deleting meeting:', error);
      return NextResponse.json(
        { error: 'Failed to delete meeting' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[MeetingAPI] Exception:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
