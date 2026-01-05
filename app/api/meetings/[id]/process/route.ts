/**
 * Meeting Processing API Route
 *
 * POST /api/meetings/[id]/process - Trigger full processing pipeline
 *
 * This endpoint is called after a meeting recording is complete to:
 * 1. Transcribe the recording (if not already done)
 * 2. Generate summaries in all styles
 * 3. Extract action items
 * 4. Extract decisions
 * 5. Update meeting status to complete
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { generateSummary } from '@/lib/services/meeting-notetaker/summary-generator';
import { extractActionItems } from '@/lib/services/meeting-notetaker/action-extractor';
import { extractDecisions } from '@/lib/services/meeting-notetaker/decision-extractor';
import { SummaryStyle, TranscriptSegment, SpeakerProfile } from '@/lib/services/meeting-notetaker/types';

// ============================================================================
// POST - Trigger Processing Pipeline
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: meetingId } = await params;

  // Optional: Verify internal API key for webhook callbacks
  // Uncomment the following to enforce API key validation in production:
  // const internalKey = request.headers.get('X-Internal-Key');
  // const expectedKey = process.env.INTERNAL_API_KEY || 'internal';
  // if (internalKey !== expectedKey) {
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // }

  const supabase = createAdminClient();

  try {
    // Parse request body (skipTranscription can be used if transcript is already available)
    await request.json().catch(() => ({}));

    console.log('[ProcessAPI] Starting processing for meeting:', meetingId);

    // Fetch meeting record
    const { data: meeting, error: meetingError } = await supabase
      .from('meeting_recordings')
      .select('*')
      .eq('id', meetingId)
      .single();

    if (meetingError || !meeting) {
      console.error('[ProcessAPI] Meeting not found:', meetingError);
      return NextResponse.json(
        { error: 'Meeting not found' },
        { status: 404 }
      );
    }

    // Check if already processed
    if (meeting.status === 'complete') {
      return NextResponse.json({
        success: true,
        message: 'Meeting already processed',
      });
    }

    // Fetch transcript
    const { data: transcript, error: transcriptError } = await supabase
      .from('meeting_transcripts')
      .select('*')
      .eq('meeting_id', meetingId)
      .single();

    if (transcriptError || !transcript) {
      console.error('[ProcessAPI] Transcript not found:', transcriptError);

      // Update status to failed
      await supabase
        .from('meeting_recordings')
        .update({
          status: 'failed',
          error_message: 'Transcript not available for processing',
        })
        .eq('id', meetingId);

      return NextResponse.json(
        { error: 'Transcript not found' },
        { status: 404 }
      );
    }

    const transcriptText = transcript.edited_transcript || transcript.raw_transcript;
    const segments: TranscriptSegment[] = transcript.segments || [];
    const speakers: SpeakerProfile[] = transcript.speakers || [];

    // Calculate duration
    const durationMinutes = meeting.duration_seconds
      ? Math.round(meeting.duration_seconds / 60)
      : segments.length > 0
        ? Math.round((segments[segments.length - 1]?.endTime || 0) / 60)
        : 30; // Default to 30 minutes

    // Update status to summarizing
    await supabase
      .from('meeting_recordings')
      .update({ status: 'summarizing' })
      .eq('id', meetingId);

    // ========================================================================
    // Generate Summaries (all styles in parallel)
    // ========================================================================

    console.log('[ProcessAPI] Generating summaries...');

    const summaryStyles: SummaryStyle[] = ['executive', 'chronological', 'sales'];
    const summaryPromises = summaryStyles.map((style) =>
      generateSummary({
        transcript: transcriptText,
        segments,
        speakers,
        style,
        meetingTitle: meeting.title || 'Untitled Meeting',
        attendees: meeting.attendees || [],
        durationMinutes,
      })
    );

    const summaryResults = await Promise.all(summaryPromises);

    // Store summaries
    for (let i = 0; i < summaryStyles.length; i++) {
      const style = summaryStyles[i];
      const result = summaryResults[i];

      if (result.success && result.summary) {
        await supabase.from('meeting_summaries').upsert(
          {
            meeting_id: meetingId,
            summary_style: style,
            summary_text: result.summary.summaryText,
            key_points: result.summary.keyPoints,
            topics_discussed: result.summary.topicsDiscussed,
            generation_model: 'claude-sonnet-4-20250514',
            is_primary: style === 'executive',
          },
          { onConflict: 'meeting_id,summary_style' }
        );

        console.log(`[ProcessAPI] ${style} summary stored`);
      } else {
        console.error(`[ProcessAPI] ${style} summary failed:`, result.error);
      }
    }

    // ========================================================================
    // Extract Action Items
    // ========================================================================

    console.log('[ProcessAPI] Extracting action items...');

    const actionResult = await extractActionItems(transcriptText, speakers);

    if (actionResult.success && actionResult.items) {
      for (const item of actionResult.items) {
        await supabase.from('meeting_action_items').insert({
          meeting_id: meetingId,
          description: item.description,
          owner_name: item.ownerName,
          owner_email: item.ownerEmail,
          priority: item.priority,
          due_date: item.deadline?.toISOString(),
          status: 'pending',
          confidence: item.confidence,
        });
      }

      console.log(`[ProcessAPI] ${actionResult.items.length} action items stored`);
    } else {
      console.error('[ProcessAPI] Action item extraction failed:', actionResult.error);
    }

    // ========================================================================
    // Extract Decisions
    // ========================================================================

    console.log('[ProcessAPI] Extracting decisions...');

    const decisionResult = await extractDecisions(transcriptText);

    if (decisionResult.success && decisionResult.decisions) {
      for (const decision of decisionResult.decisions) {
        await supabase.from('meeting_decisions').insert({
          meeting_id: meetingId,
          decision_text: decision.decisionText,
          context: decision.context,
          impact_area: decision.impactArea,
          confidence: decision.confidence,
        });
      }

      console.log(`[ProcessAPI] ${decisionResult.decisions.length} decisions stored`);
    } else {
      console.error('[ProcessAPI] Decision extraction failed:', decisionResult.error);
    }

    // ========================================================================
    // Update Meeting Status to Complete
    // ========================================================================

    const { error: updateError } = await supabase
      .from('meeting_recordings')
      .update({
        status: 'complete',
        processed_at: new Date().toISOString(),
      })
      .eq('id', meetingId);

    if (updateError) {
      console.error('[ProcessAPI] Failed to update meeting status:', updateError);
    }

    console.log('[ProcessAPI] Processing complete for meeting:', meetingId);

    // ========================================================================
    // Send Notification Email (optional)
    // ========================================================================

    try {
      await sendProcessingCompleteNotification(meeting);
    } catch (notifyError) {
      console.error('[ProcessAPI] Failed to send notification:', notifyError);
      // Don't fail the request for notification errors
    }

    return NextResponse.json({
      success: true,
      message: 'Processing complete',
      stats: {
        summaries: summaryResults.filter((r) => r.success).length,
        actionItems: actionResult.items?.length || 0,
        decisions: decisionResult.decisions?.length || 0,
      },
    });
  } catch (error) {
    console.error('[ProcessAPI] Processing error:', error);

    // Update status to failed
    await supabase
      .from('meeting_recordings')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Processing failed',
      })
      .eq('id', meetingId);

    return NextResponse.json(
      { error: 'Processing failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// Notification Helper
// ============================================================================

interface MeetingRecord {
  id: string;
  user_email?: string;
  title?: string;
}

async function sendProcessingCompleteNotification(
  meeting: MeetingRecord
): Promise<void> {
  // Skip if no user email
  if (!meeting.user_email) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://moccet.ai');

  console.log('[ProcessAPI] Sending summary email to:', meeting.user_email);

  try {
    // Call the send-summary endpoint
    const response = await fetch(`${appUrl}/api/meetings/${meeting.id}/send-summary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: meeting.user_email }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ProcessAPI] Failed to send summary email:', errorText);
    } else {
      console.log('[ProcessAPI] Summary email sent successfully');
    }
  } catch (error) {
    console.error('[ProcessAPI] Error sending summary email:', error);
  }
}
