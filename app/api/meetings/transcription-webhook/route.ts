/**
 * Real-time Transcription Webhook
 *
 * POST /api/meetings/transcription-webhook - Receive real-time transcription updates
 *
 * This endpoint receives transcription segments as they're generated during the meeting.
 * Recall.ai sends these in real-time if real_time_transcription is configured.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

// Types for Recall.ai real-time transcription
interface TranscriptionWord {
  word: string;
  start?: number;
  end?: number;
  confidence?: number;
}

interface TranscriptSegment {
  startTime: number;
  endTime: number;
  speaker: string;
  text: string;
  confidence: number;
  isFinal: boolean;
}

// ============================================================================
// POST - Receive Real-time Transcription Segment
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Recall.ai real-time transcription format
    const {
      bot_id,
      transcript,
      speaker,
      start_time,
      end_time,
      is_final,
      words,
    } = body;

    if (!bot_id) {
      return NextResponse.json(
        { error: 'Missing bot_id' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Find the meeting by bot session ID
    const { data: meeting } = await supabase
      .from('meeting_recordings')
      .select('id, user_email')
      .eq('bot_session_id', bot_id)
      .single();

    if (!meeting) {
      console.log('[TranscriptionWebhook] Meeting not found for bot:', bot_id);
      // Return success anyway to not retry
      return NextResponse.json({ success: true, message: 'Meeting not found' });
    }

    // Check if we already have a transcript for this meeting
    const { data: existingTranscript } = await supabase
      .from('meeting_transcripts')
      .select('id, segments')
      .eq('meeting_id', meeting.id)
      .single();

    const transcriptText = transcript || words?.map((w: TranscriptionWord) => w.word).join(' ') || '';
    const startTime = start_time || 0;
    const endTime = end_time || start_time || 0;

    const newSegment: TranscriptSegment = {
      startTime,
      endTime,
      speaker: speaker || 'Unknown',
      text: transcriptText,
      confidence: 0.9,
      isFinal: is_final !== false,
    };

    if (existingTranscript) {
      // Append to existing transcript
      const existingSegments = (existingTranscript.segments || []) as TranscriptSegment[];

      // Avoid duplicates by checking timestamps
      const isDuplicate = existingSegments.some(
        (seg: TranscriptSegment) =>
          Math.abs(seg.startTime - startTime) < 0.5 &&
          seg.text === transcriptText
      );

      if (!isDuplicate) {
        const updatedSegments = [...existingSegments, newSegment];
        const updatedRawTranscript = updatedSegments
          .map((seg: TranscriptSegment) => seg.text)
          .join(' ');

        await supabase
          .from('meeting_transcripts')
          .update({
            segments: updatedSegments,
            raw_transcript: updatedRawTranscript,
          })
          .eq('id', existingTranscript.id);
      }
    } else {
      // Create new transcript
      await supabase.from('meeting_transcripts').insert({
        meeting_id: meeting.id,
        raw_transcript: transcriptText,
        segments: [newSegment],
        speakers: [{ index: 0, label: speaker || 'Speaker 0', wordCount: transcriptText.split(' ').length }],
        detected_language: 'en',
        overall_confidence: 0.9,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[TranscriptionWebhook] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
