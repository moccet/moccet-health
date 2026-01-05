/**
 * Google Meet Bot Service
 *
 * Orchestrates meeting bot operations using Recall.ai.
 * Handles scheduling, joining, and receiving callbacks from the bot service.
 *
 * Recall.ai API Documentation: https://docs.recall.ai/
 */

import { createAdminClient } from '@/lib/supabase/server';
import { BotJoinRequest, BotJoinResult, BotWebhookEvent } from './types';

// ============================================================================
// Configuration
// ============================================================================

const RECALL_API_URL = process.env.MEETING_BOT_SERVICE_URL || 'https://api.recall.ai/api/v1';
const RECALL_API_KEY = process.env.MEETING_BOT_API_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://moccet.ai');
const WEBHOOK_SECRET = process.env.MEETING_BOT_WEBHOOK_SECRET;

// Default bot configuration
const DEFAULT_BOT_NAME = 'moccet notetaker';
const DEFAULT_MAX_DURATION_MINUTES = 120; // 2 hours

// ============================================================================
// Bot Scheduling (Recall.ai API)
// ============================================================================

/**
 * Schedule a bot to join a meeting using Recall.ai
 * API Docs: https://docs.recall.ai/reference/bot_create
 */
export async function scheduleBotJoin(
  request: BotJoinRequest
): Promise<BotJoinResult> {
  if (!RECALL_API_URL || !RECALL_API_KEY) {
    console.error('[RecallBot] Bot service not configured');
    return { success: false, error: 'Bot service not configured' };
  }

  try {
    console.log('[RecallBot] Scheduling bot join:', {
      meetingId: request.meetingId,
      meetUrl: request.googleMeetUrl,
      scheduledStart: request.scheduledStart,
    });

    // Recall.ai API - Create Bot
    const response = await fetch(`${RECALL_API_URL}/bot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${RECALL_API_KEY}`,
      },
      body: JSON.stringify({
        // Meeting URL (required)
        meeting_url: request.googleMeetUrl,

        // Bot display name in the meeting
        bot_name: request.botName || DEFAULT_BOT_NAME,

        // Join timing - join at the scheduled time
        join_at: request.scheduledStart.toISOString(),

        // Automatic leave settings
        automatic_leave: {
          waiting_room_timeout: 600, // 10 minutes
          noone_joined_timeout: 600, // 10 minutes
          everyone_left_timeout: 60, // 1 minute after everyone leaves
        },

        // Webhook for status updates
        webhook_url: `${APP_URL}/api/meetings/webhook`,

        // Custom metadata (will be returned in webhooks)
        metadata: {
          meeting_id: request.meetingId,
          user_email: request.userEmail,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[RecallBot] Recall.ai API error:', response.status, errorText);
      return {
        success: false,
        error: `Recall.ai error: ${response.status} - ${errorText}`,
      };
    }

    const result = await response.json();

    // Update meeting with bot ID
    const supabase = createAdminClient();
    await supabase
      .from('meeting_recordings')
      .update({
        bot_session_id: result.id,
        status: 'scheduled',
      })
      .eq('id', request.meetingId);

    console.log('[RecallBot] Bot scheduled successfully:', {
      botId: result.id,
      status: result.status,
    });

    return {
      success: true,
      botSessionId: result.id,
    };
  } catch (error) {
    console.error('[RecallBot] Error scheduling bot:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Cancel/delete a scheduled bot
 * API Docs: https://docs.recall.ai/reference/bot_destroy
 */
export async function cancelBotSession(
  botSessionId: string
): Promise<{ success: boolean; error?: string }> {
  if (!RECALL_API_URL || !RECALL_API_KEY) {
    console.error('[RecallBot] Bot service not configured');
    return { success: false, error: 'Bot service not configured' };
  }

  try {
    console.log('[RecallBot] Cancelling bot session:', botSessionId);

    const response = await fetch(`${RECALL_API_URL}/bot/${botSessionId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Token ${RECALL_API_KEY}`,
      },
    });

    // 204 No Content is success, 404 means already deleted
    if (!response.ok && response.status !== 404) {
      const errorText = await response.text();
      console.error('[RecallBot] Cancel error:', response.status, errorText);
      return {
        success: false,
        error: `Cancel failed: ${response.status}`,
      };
    }

    return { success: true };
  } catch (error) {
    console.error('[RecallBot] Error cancelling bot:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get bot session status
 * API Docs: https://docs.recall.ai/reference/bot_retrieve
 */
export async function getBotSessionStatus(
  botSessionId: string
): Promise<{
  success: boolean;
  status?: string;
  recordingUrl?: string;
  transcriptUrl?: string;
  error?: string;
}> {
  if (!RECALL_API_URL || !RECALL_API_KEY) {
    return { success: false, error: 'Bot service not configured' };
  }

  try {
    const response = await fetch(`${RECALL_API_URL}/bot/${botSessionId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Token ${RECALL_API_KEY}`,
      },
    });

    if (!response.ok) {
      return { success: false, error: `Status check failed: ${response.status}` };
    }

    const result = await response.json();

    return {
      success: true,
      status: result.status_changes?.[result.status_changes.length - 1]?.code,
      recordingUrl: result.video_url,
      transcriptUrl: result.transcript?.url,
    };
  } catch (error) {
    console.error('[RecallBot] Error getting status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get bot recording/transcript after meeting ends
 */
export async function getBotRecording(
  botSessionId: string
): Promise<{
  success: boolean;
  videoUrl?: string;
  transcript?: Array<{ speaker: string; words: string; start: number; end: number }>;
  error?: string;
}> {
  if (!RECALL_API_URL || !RECALL_API_KEY) {
    return { success: false, error: 'Bot service not configured' };
  }

  try {
    const response = await fetch(`${RECALL_API_URL}/bot/${botSessionId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Token ${RECALL_API_KEY}`,
      },
    });

    if (!response.ok) {
      return { success: false, error: `Failed to get recording: ${response.status}` };
    }

    const result = await response.json();

    return {
      success: true,
      videoUrl: result.video_url,
      transcript: result.transcript,
    };
  } catch (error) {
    console.error('[RecallBot] Error getting recording:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Webhook Handler
// ============================================================================

/**
 * Process a webhook event from Recall.ai
 * Recall.ai webhook events: https://docs.recall.ai/reference/webhooks
 *
 * Status codes from Recall.ai:
 * - ready: Bot is ready to join
 * - joining_call: Bot is joining the meeting
 * - in_waiting_room: Bot is in the waiting room
 * - in_call_not_recording: Bot joined but not recording yet
 * - in_call_recording: Bot is recording
 * - call_ended: Meeting ended
 * - done: Processing complete
 * - fatal: Error occurred
 */
export async function processBotWebhook(
  event: any,
  signature?: string
): Promise<{ success: boolean; error?: string }> {
  // Verify webhook signature if secret is configured
  if (WEBHOOK_SECRET && signature) {
    const isValid = verifyRecallWebhookSignature(event, signature);
    if (!isValid) {
      console.error('[RecallBot] Invalid webhook signature');
      return { success: false, error: 'Invalid signature' };
    }
  }

  const supabase = createAdminClient();

  // Recall.ai webhook format
  const botId = event.data?.bot_id || event.bot_id;
  const statusCode = event.data?.status?.code || event.status;
  const metadata = event.data?.metadata || {};
  const meetingId = metadata.meeting_id;

  console.log('[RecallBot] Processing webhook:', {
    event: event.event,
    botId,
    statusCode,
    meetingId,
  });

  if (!meetingId) {
    // Try to find meeting by bot_session_id
    const { data: meeting } = await supabase
      .from('meeting_recordings')
      .select('id')
      .eq('bot_session_id', botId)
      .single();

    if (!meeting) {
      console.error('[RecallBot] Could not find meeting for bot:', botId);
      return { success: false, error: 'Meeting not found' };
    }
  }

  const targetMeetingId = meetingId || (await getMeetingIdByBotId(botId));

  try {
    switch (statusCode) {
      case 'ready':
        await supabase
          .from('meeting_recordings')
          .update({ status: 'scheduled' })
          .eq('id', targetMeetingId);
        break;

      case 'joining_call':
        await supabase
          .from('meeting_recordings')
          .update({ status: 'joining' })
          .eq('id', targetMeetingId);
        break;

      case 'in_waiting_room':
        await supabase
          .from('meeting_recordings')
          .update({ status: 'joining' })
          .eq('id', targetMeetingId);
        break;

      case 'in_call_not_recording':
        await supabase
          .from('meeting_recordings')
          .update({
            status: 'recording',
            actual_start: new Date().toISOString(),
          })
          .eq('id', targetMeetingId);
        break;

      case 'in_call_recording':
        await supabase
          .from('meeting_recordings')
          .update({
            status: 'recording',
            actual_start: new Date().toISOString(),
          })
          .eq('id', targetMeetingId);
        break;

      case 'call_ended':
        await supabase
          .from('meeting_recordings')
          .update({
            status: 'processing',
            actual_end: new Date().toISOString(),
          })
          .eq('id', targetMeetingId);
        break;

      case 'done':
        // Fetch the recording and transcript from Recall.ai
        const recording = await getBotRecording(botId);

        await supabase
          .from('meeting_recordings')
          .update({
            status: 'processing',
            recording_url: recording.videoUrl,
          })
          .eq('id', targetMeetingId);

        // Trigger full processing pipeline
        await triggerMeetingProcessing(targetMeetingId, botId);
        break;

      case 'fatal':
        const errorMessage = event.data?.status?.message || 'Bot error';
        await supabase
          .from('meeting_recordings')
          .update({
            status: 'failed',
            error_message: errorMessage,
          })
          .eq('id', targetMeetingId);
        break;

      default:
        console.log('[RecallBot] Unhandled status code:', statusCode);
    }

    return { success: true };
  } catch (error) {
    console.error('[RecallBot] Webhook processing error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Processing Pipeline
// ============================================================================

/**
 * Trigger the full meeting processing pipeline after recording is complete
 */
async function triggerMeetingProcessing(meetingId: string, botId: string): Promise<void> {
  console.log('[RecallBot] Triggering meeting processing:', meetingId);

  try {
    // Get bot data including transcript from Recall.ai
    const botData = await getBotRecording(botId);

    if (!botData.success) {
      console.error('[RecallBot] Failed to get bot data:', botData.error);
      return;
    }

    const supabase = createAdminClient();

    // Update status to transcribing
    await supabase
      .from('meeting_recordings')
      .update({
        status: 'transcribing',
        recording_url: botData.videoUrl,
      })
      .eq('id', meetingId);

    // If Recall.ai provided a transcript, use it
    if (botData.transcript && botData.transcript.length > 0) {
      // Convert Recall.ai transcript format to our format
      const segments = botData.transcript.map((seg, index) => ({
        startTime: seg.start,
        endTime: seg.end,
        speaker: seg.speaker || `Speaker ${index % 3}`,
        text: seg.words,
        confidence: 0.95,
        isFinal: true,
      }));

      const fullText = botData.transcript.map(seg => seg.words).join(' ');

      // Extract unique speakers
      const speakerSet = new Set(segments.map(s => s.speaker));
      const speakers = Array.from(speakerSet).map((label, index) => {
        const speakerSegments = segments.filter(s => s.speaker === label);
        return {
          index,
          label,
          wordCount: speakerSegments.reduce((acc, s) => acc + s.text.split(' ').length, 0),
          speakingTimeSeconds: speakerSegments.reduce((acc, s) => acc + (s.endTime - s.startTime), 0),
        };
      });

      // Save transcript
      await supabase
        .from('meeting_transcripts')
        .insert({
          meeting_id: meetingId,
          raw_transcript: fullText,
          segments,
          speakers,
          detected_language: 'en',
          overall_confidence: 0.95,
        });

      // Update status
      await supabase
        .from('meeting_recordings')
        .update({ status: 'summarizing' })
        .eq('id', meetingId);

      // Trigger summary generation via API
      try {
        await fetch(`${APP_URL}/api/meetings/${meetingId}/process`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Key': process.env.INTERNAL_API_KEY || 'internal',
          },
          body: JSON.stringify({ skipTranscription: true }),
        });
      } catch (err) {
        console.error('[RecallBot] Failed to trigger processing API:', err);
      }
    } else {
      // No transcript from Recall.ai, use Deepgram directly
      // This will be handled by the process API
      try {
        await fetch(`${APP_URL}/api/meetings/${meetingId}/process`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Key': process.env.INTERNAL_API_KEY || 'internal',
          },
        });
      } catch (err) {
        console.error('[RecallBot] Failed to trigger processing API:', err);
      }
    }
  } catch (error) {
    console.error('[RecallBot] Error in processing pipeline:', error);

    // Mark as failed
    const supabase = createAdminClient();
    await supabase
      .from('meeting_recordings')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Processing failed',
      })
      .eq('id', meetingId);
  }
}

// ============================================================================
// Utilities
// ============================================================================

async function getMeetingIdByBotId(botId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('meeting_recordings')
    .select('id')
    .eq('bot_session_id', botId)
    .single();

  return data?.id || null;
}

function verifyRecallWebhookSignature(payload: any, signature: string): boolean {
  // Recall.ai uses HMAC-SHA256 for webhook signatures
  try {
    const crypto = require('crypto');
    const payloadString = JSON.stringify(payload);
    const expectedSignature = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(payloadString)
      .digest('hex');

    return signature === expectedSignature ||
           signature === `sha256=${expectedSignature}`;
  } catch (error) {
    console.error('[RecallBot] Signature verification error:', error);
    return false;
  }
}

// ============================================================================
// Calendar Sync
// ============================================================================

/**
 * Sync upcoming meetings from calendar and schedule bots
 */
export async function syncUpcomingMeetingsForUser(
  userEmail: string,
  userCode?: string
): Promise<{ scheduled: number; errors: number }> {
  const supabase = createAdminClient();
  let scheduled = 0;
  let errors = 0;

  try {
    // Get user's notetaker settings
    const { data: settings } = await supabase
      .from('meeting_notetaker_settings')
      .select('*')
      .eq('user_email', userEmail)
      .single();

    if (!settings?.auto_join_enabled) {
      console.log('[RecallBot] Auto-join disabled for user:', userEmail);
      return { scheduled: 0, errors: 0 };
    }

    // Fetch upcoming meetings from calendar API
    const calendarResponse = await fetch(
      `${APP_URL}/api/gmail/calendar/events?email=${encodeURIComponent(userEmail)}&days=7`
    );

    if (!calendarResponse.ok) {
      console.error('[RecallBot] Calendar fetch failed');
      return { scheduled: 0, errors: 1 };
    }

    const { events } = await calendarResponse.json();

    for (const meeting of events || []) {
      // Skip if no Google Meet link
      if (!meeting.hangoutLink) continue;

      // Skip if meeting is in the past
      if (new Date(meeting.start.dateTime) < new Date()) continue;

      // Check if we already have a recording for this event
      const { data: existing } = await supabase
        .from('meeting_recordings')
        .select('id')
        .eq('user_email', userEmail)
        .eq('calendar_event_id', meeting.id)
        .single();

      if (existing) continue;

      try {
        // Create meeting record
        const { data: newMeeting, error: createError } = await supabase
          .from('meeting_recordings')
          .insert({
            user_email: userEmail,
            user_code: userCode,
            calendar_event_id: meeting.id,
            google_meet_url: meeting.hangoutLink,
            title: meeting.summary,
            scheduled_start: meeting.start.dateTime,
            scheduled_end: meeting.end.dateTime,
            organizer_email: meeting.organizer?.email,
            organizer_name: meeting.organizer?.displayName,
            attendees: meeting.attendees || [],
            notetaker_enabled: true,
          })
          .select('id')
          .single();

        if (createError || !newMeeting) {
          errors++;
          continue;
        }

        // Schedule bot
        const result = await scheduleBotJoin({
          meetingId: newMeeting.id,
          googleMeetUrl: meeting.hangoutLink,
          userEmail,
          botName: DEFAULT_BOT_NAME,
          scheduledStart: new Date(meeting.start.dateTime),
          maxDurationMinutes: DEFAULT_MAX_DURATION_MINUTES,
        });

        if (result.success) {
          scheduled++;
        } else {
          errors++;
        }
      } catch (error) {
        console.error('[RecallBot] Error scheduling meeting:', error);
        errors++;
      }
    }

    console.log('[RecallBot] Sync complete:', { userEmail, scheduled, errors });
    return { scheduled, errors };
  } catch (error) {
    console.error('[RecallBot] Sync error:', error);
    return { scheduled: 0, errors: 1 };
  }
}
