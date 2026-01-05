/**
 * Meeting Transcription API
 *
 * POST /api/meetings/[id]/transcribe - Transcribe a meeting recording
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { transcribeAudio, getCustomWordsForUser } from '@/lib/services/meeting-notetaker/transcription-service';

const RECALL_API_URL = process.env.MEETING_BOT_SERVICE_URL || 'https://us-west-2.recall.ai/api/v1';
const RECALL_API_KEY = process.env.MEETING_BOT_API_KEY;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: meetingId } = await params;
  const supabase = createAdminClient();

  try {
    console.log('[Transcribe] Starting transcription for meeting:', meetingId);

    // Get meeting record
    const { data: meeting, error: meetingError } = await supabase
      .from('meeting_recordings')
      .select('*')
      .eq('id', meetingId)
      .single();

    if (meetingError || !meeting) {
      return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
    }

    // Check if already has transcript
    const { data: existingTranscript } = await supabase
      .from('meeting_transcripts')
      .select('id')
      .eq('meeting_id', meetingId)
      .single();

    if (existingTranscript) {
      return NextResponse.json({
        success: true,
        message: 'Transcript already exists',
        transcriptId: existingTranscript.id,
      });
    }

    // Get recording URL - either from DB or fetch from Recall.ai
    let recordingUrl = meeting.recording_url;

    if (!recordingUrl && meeting.bot_session_id) {
      console.log('[Transcribe] Fetching recording URL from Recall.ai...');

      const botResponse = await fetch(`${RECALL_API_URL}/bot/${meeting.bot_session_id}`, {
        headers: { Authorization: `Token ${RECALL_API_KEY}` },
      });

      if (botResponse.ok) {
        const botData = await botResponse.json();
        recordingUrl = botData.recordings?.[0]?.media_shortcuts?.video_mixed?.data?.download_url;

        // Save recording URL to meeting
        if (recordingUrl) {
          await supabase
            .from('meeting_recordings')
            .update({ recording_url: recordingUrl })
            .eq('id', meetingId);
        }
      }
    }

    if (!recordingUrl) {
      return NextResponse.json({ error: 'No recording URL available' }, { status: 400 });
    }

    // Update status
    await supabase
      .from('meeting_recordings')
      .update({ status: 'transcribing' })
      .eq('id', meetingId);

    // Get custom words for user
    const customWords = await getCustomWordsForUser(meeting.user_email);

    // Transcribe using Deepgram
    console.log('[Transcribe] Sending to Deepgram:', recordingUrl.substring(0, 100) + '...');
    const result = await transcribeAudio(recordingUrl, customWords);

    if (!result.success || !result.transcript) {
      console.error('[Transcribe] Transcription failed:', result.error);

      await supabase
        .from('meeting_recordings')
        .update({ status: 'failed', error_message: result.error })
        .eq('id', meetingId);

      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Save transcript to database
    const { data: savedTranscript, error: saveError } = await supabase
      .from('meeting_transcripts')
      .insert({
        meeting_id: meetingId,
        raw_transcript: result.transcript.fullText,
        segments: result.transcript.segments,
        speakers: result.transcript.speakers,
        detected_language: result.transcript.detectedLanguage,
        overall_confidence: result.transcript.overallConfidence,
      })
      .select()
      .single();

    if (saveError) {
      console.error('[Transcribe] Failed to save transcript:', saveError);
      return NextResponse.json({ error: 'Failed to save transcript' }, { status: 500 });
    }

    // Update meeting status
    await supabase
      .from('meeting_recordings')
      .update({ status: 'summarizing' })
      .eq('id', meetingId);

    console.log('[Transcribe] Transcript saved:', {
      transcriptId: savedTranscript.id,
      speakers: result.transcript.speakers.length,
      segments: result.transcript.segments.length,
    });

    return NextResponse.json({
      success: true,
      message: 'Transcription complete',
      transcriptId: savedTranscript.id,
      stats: {
        speakers: result.transcript.speakers.length,
        segments: result.transcript.segments.length,
        confidence: result.transcript.overallConfidence,
      },
    });
  } catch (error) {
    console.error('[Transcribe] Exception:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Transcription failed' },
      { status: 500 }
    );
  }
}
