import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { sendInsightNotification } from '@/lib/services/onesignal-service';

/**
 * POST /api/test-insight-notification
 * Creates a test insight and sends a push notification
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Create a test insight
    const testInsight = {
      email,
      insight_type: 'test_notification',
      title: 'Test Health Insight',
      message: 'This is a test insight to verify the notification pipeline is working correctly.',
      severity: 'medium',
      actionable_recommendation: 'No action needed - this is just a test!',
      source_provider: 'test',
      source_data_type: 'test',
      context_data: { test: true, timestamp: new Date().toISOString() },
      notification_sent: false,
      design_category: 'PROACTIVE', // Use proactive design for notification cards with studio images
    };

    // Store the insight
    const { data, error } = await supabase
      .from('real_time_insights')
      .insert(testInsight)
      .select('id')
      .single();

    if (error) {
      console.error('Error storing test insight:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const insightId = data?.id;
    console.log(`[Test Insight] Created insight ${insightId} for ${email}`);

    // Send push notification
    let sentCount = 0;
    if (insightId) {
      sentCount = await sendInsightNotification(email, {
        id: insightId,
        title: testInsight.title,
        message: testInsight.message,
        insight_type: testInsight.insight_type,
        severity: testInsight.severity,
        design_category: 'PROACTIVE', // Use proactive design for notification cards
      });

      // Mark as sent if successful
      if (sentCount > 0) {
        await supabase
          .from('real_time_insights')
          .update({
            notification_sent: true,
            notification_sent_at: new Date().toISOString(),
            notification_channel: 'push',
          })
          .eq('id', insightId);
      }
    }

    return NextResponse.json({
      success: true,
      insight_id: insightId,
      notification_sent: sentCount > 0,
      devices_notified: sentCount,
    });
  } catch (error) {
    console.error('Test insight notification error:', error);
    return NextResponse.json({
      error: 'Failed to create test insight',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
