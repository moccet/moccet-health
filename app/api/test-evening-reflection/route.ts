import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { sendInsightNotification } from '@/lib/services/onesignal-service';

/**
 * POST /api/test-evening-reflection
 * Creates a test evening reflection insight with all rich fields and sends notification
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    // Create test evening reflection with all rich fields
    const testInsight = {
      email,
      insight_type: 'evening_reflection',
      title: 'Time to Wind Down',
      message: "It sounds like you've been really dedicated this evening, but it's important to give yourself a break, too. Take a moment to reflect on your day and consider wrapping up those tasks tomorrow; a peaceful night's rest will help you tackle them with fresh energy.",
      severity: 'info',
      actionable_recommendation: 'Consider starting your wind-down routine now. A peaceful night\'s rest will help you tackle tomorrow with fresh energy.',
      source_provider: 'proactive_engagement',
      source_data_type: 'evening_reflection',
      context_data: {
        test: true,
        timestamp: new Date().toISOString(),
        highStrain: true,
        workingLate: true,
      },
      notification_sent: false,
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
    console.log(`[Test Evening Reflection] Created insight ${insightId} for ${email}`);

    // Send push notification with all rich fields
    let sentCount = 0;
    if (insightId) {
      sentCount = await sendInsightNotification(email, {
        id: insightId,
        title: testInsight.title,
        message: testInsight.message,
        insight_type: testInsight.insight_type,
        severity: testInsight.severity,
        // Rich fields for InsightDetailView
        category: 'SLEEP',
        data_quote: "strain score of 16.5 today, working into the evening hours. It's important to give yourself a break, too.",
        recommendation: 'Consider starting your wind-down routine now. A peaceful night\'s rest will help you tackle tomorrow with fresh energy.',
        science_explanation: 'Evening wind-down routines help activate your parasympathetic nervous system, lowering cortisol and preparing your body for restorative sleep. Research shows that a consistent pre-sleep routine can improve sleep quality by up to 30% and reduce the time it takes to fall asleep.',
        action_steps: [
          'Dim the lights and reduce screen brightness',
          'Take a few slow, deep breaths to release tension',
          'Reflect on one positive moment from today',
          'Set your intentions for tomorrow, then let go of work thoughts',
        ],
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
      rich_fields_included: true,
    });
  } catch (error) {
    console.error('Test evening reflection error:', error);
    return NextResponse.json({
      error: 'Failed to create test evening reflection',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
