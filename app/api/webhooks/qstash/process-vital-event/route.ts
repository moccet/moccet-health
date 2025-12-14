import { NextRequest, NextResponse } from 'next/server';
import { verifySignatureAppRouter } from '@upstash/qstash/nextjs';
import { processVitalEvent } from '@/lib/services/insight-trigger-service';
import { createClient } from '@/lib/supabase/server';

// This endpoint handles Vital webhook events queued by QStash
export const maxDuration = 120; // 2 minutes max

interface VitalEventPayload {
  eventId: string;
  eventType: string;
  email: string;
}

async function handler(request: NextRequest) {
  try {
    const payload = (await request.json()) as VitalEventPayload;
    const { eventId, eventType, email } = payload;

    console.log(`[Process Vital Event] Processing event ${eventId} (${eventType}) for ${email}`);

    if (!email || !eventType) {
      return NextResponse.json({ error: 'Missing email or eventType' }, { status: 400 });
    }

    // Fetch the event data from vital_webhook_events if needed
    const supabase = await createClient();
    let eventData: Record<string, unknown> = {};

    if (eventId) {
      const { data: event } = await supabase
        .from('vital_webhook_events')
        .select('event_data')
        .eq('id', eventId)
        .single();

      if (event?.event_data) {
        eventData = event.event_data as Record<string, unknown>;
      }
    }

    // Process the event and generate insights
    const insights = await processVitalEvent(email, eventType, eventData);

    // Mark the event as processed
    if (eventId) {
      await supabase
        .from('vital_webhook_events')
        .update({
          processed_at: new Date().toISOString(),
          insights_generated: insights.length,
        })
        .eq('id', eventId);
    }

    console.log(
      `[Process Vital Event] Generated ${insights.length} insights for ${email} from ${eventType}`
    );

    return NextResponse.json({
      success: true,
      insights_generated: insights.length,
      event_type: eventType,
    });
  } catch (error) {
    console.error('[Process Vital Event] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Wrap with QStash signature verification
export const POST = verifySignatureAppRouter(handler);
