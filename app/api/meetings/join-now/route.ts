/**
 * Join Meeting Now API
 *
 * POST /api/meetings/join-now - Send notetaker bot to join an active meeting immediately
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

const RECALL_API_URL = process.env.MEETING_BOT_SERVICE_URL || 'https://us-west-2.recall.ai/api/v1';
const RECALL_API_KEY = process.env.MEETING_BOT_API_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://moccet.ai');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, meetingUrl, title } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!meetingUrl) {
      return NextResponse.json({ error: 'Meeting URL is required' }, { status: 400 });
    }

    if (!RECALL_API_KEY) {
      return NextResponse.json({ error: 'Bot service not configured' }, { status: 500 });
    }

    console.log('[JoinNow] Sending bot to join meeting:', { email, meetingUrl });

    const supabase = createAdminClient();

    // Create meeting record
    const { data: meeting, error: createError } = await supabase
      .from('meeting_recordings')
      .insert({
        user_email: email,
        google_meet_url: meetingUrl,
        meeting_type: 'google_meet',
        title: title || 'Live Meeting',
        scheduled_start: new Date().toISOString(),
        status: 'joining',
        notetaker_enabled: true,
      })
      .select()
      .single();

    if (createError || !meeting) {
      console.error('[JoinNow] Error creating meeting:', createError);
      return NextResponse.json({ error: 'Failed to create meeting record' }, { status: 500 });
    }

    // Send bot to join immediately (no join_at means join now)
    const response = await fetch(`${RECALL_API_URL}/bot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${RECALL_API_KEY}`,
      },
      body: JSON.stringify({
        meeting_url: meetingUrl,
        bot_name: 'moccet notetaker',

        // No join_at = join immediately

        automatic_leave: {
          waiting_room_timeout: 600,
          noone_joined_timeout: 600,
          everyone_left_timeout: 60,
        },

        webhook_url: `${APP_URL}/api/meetings/webhook`,

        metadata: {
          meeting_id: meeting.id,
          user_email: email,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[JoinNow] Recall.ai API error:', response.status, errorText);

      // Update meeting as failed
      await supabase
        .from('meeting_recordings')
        .update({ status: 'failed', error_message: errorText })
        .eq('id', meeting.id);

      return NextResponse.json({
        error: 'Failed to send bot',
        details: errorText
      }, { status: 500 });
    }

    const botResult = await response.json();

    // Update meeting with bot ID
    await supabase
      .from('meeting_recordings')
      .update({
        bot_session_id: botResult.id,
        status: 'joining',
      })
      .eq('id', meeting.id);

    console.log('[JoinNow] Bot sent successfully:', {
      meetingId: meeting.id,
      botId: botResult.id,
    });

    return NextResponse.json({
      success: true,
      message: 'Notetaker is joining your meeting now',
      meeting: {
        id: meeting.id,
        botId: botResult.id,
        status: 'joining',
      },
    });
  } catch (error) {
    console.error('[JoinNow] Exception:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to join meeting' },
      { status: 500 }
    );
  }
}
