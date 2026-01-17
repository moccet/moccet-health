import { NextRequest, NextResponse } from 'next/server';
import { generateWeeklyAnalysis, getUsersWithIntegrations } from '@/lib/services/insight-trigger-service';
import { createClient } from '@/lib/supabase/server';
import { sendInsightNotification } from '@/lib/services/onesignal-service';
import { isValidCronRequest, requireCronSecret } from '@/lib/utils/cron-auth';

// Vercel Cron job - runs every Sunday at 9am UTC
// Configure in vercel.json: { "path": "/api/cron/weekly-analysis", "schedule": "0 9 * * 0" }
export const maxDuration = 300; // 5 minutes max for cron job

/**
 * Store a weekly insight and send push notification
 */
async function storeAndNotifyWeeklyInsight(
  email: string,
  insight: {
    insight_type: string;
    title: string;
    message: string;
    severity: string;
    actionable_recommendation: string;
    source_provider: string;
    source_data_type: string;
    context_data: Record<string, unknown>;
  }
): Promise<string | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('real_time_insights')
    .insert({
      email,
      insight_type: insight.insight_type,
      title: insight.title,
      message: insight.message,
      severity: insight.severity,
      actionable_recommendation: insight.actionable_recommendation,
      source_provider: insight.source_provider,
      source_data_type: insight.source_data_type,
      context_data: insight.context_data,
      notification_sent: false,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[Weekly Analysis] Error storing insight:', error);
    return null;
  }

  const insightId = data?.id;

  // Send push notification via OneSignal
  if (insightId) {
    try {
      const sentCount = await sendInsightNotification(email, {
        id: insightId,
        title: insight.title,
        message: insight.message,
        insight_type: insight.insight_type,
        severity: insight.severity,
      });

      // Mark notification as sent if successful
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
    } catch (pushError) {
      console.error('[Weekly Analysis] Error sending push notification:', pushError);
    }
  }

  return insightId || null;
}

export async function GET(request: NextRequest) {
  // Verify this is a legitimate cron request
  if (!isValidCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[Weekly Analysis Cron] Starting weekly analysis for all users');
  const startTime = Date.now();

  try {
    // Get all users with active integrations
    const users = await getUsersWithIntegrations();
    console.log(`[Weekly Analysis Cron] Found ${users.length} users with active integrations`);

    if (users.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No users with active integrations',
        users_processed: 0,
        total_insights: 0,
        duration_ms: Date.now() - startTime,
      });
    }

    // Process users in batches to avoid timeout
    const BATCH_SIZE = 5; // Smaller batch for weekly analysis (more data processing)
    let totalInsights = 0;
    let usersProcessed = 0;
    let notificationsSent = 0;
    const errors: string[] = [];

    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);

      // Process batch in parallel
      const results = await Promise.all(
        batch.map(async (email) => {
          try {
            // Generate weekly insights
            const insights = await generateWeeklyAnalysis(email);

            // Store each insight and send notification
            let storedCount = 0;
            let notifiedCount = 0;

            for (const insight of insights) {
              const id = await storeAndNotifyWeeklyInsight(email, insight);
              if (id) {
                storedCount++;
                notifiedCount++; // Notification is sent in storeAndNotifyWeeklyInsight
              }
            }

            return {
              email,
              insights_generated: insights.length,
              insights_stored: storedCount,
              notifications_sent: notifiedCount,
              errors: [],
            };
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[Weekly Analysis Cron] Error processing ${email}:`, errorMsg);
            return {
              email,
              insights_generated: 0,
              insights_stored: 0,
              notifications_sent: 0,
              errors: [errorMsg],
            };
          }
        })
      );

      // Aggregate results
      for (const result of results) {
        usersProcessed++;
        totalInsights += result.insights_stored;
        notificationsSent += result.notifications_sent;
        if (result.errors && result.errors.length > 0) {
          errors.push(`${result.email}: ${result.errors.join(', ')}`);
        }
      }

      console.log(
        `[Weekly Analysis Cron] Processed batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(users.length / BATCH_SIZE)}`
      );
    }

    const duration = Date.now() - startTime;
    console.log(
      `[Weekly Analysis Cron] Completed in ${duration}ms. Processed ${usersProcessed} users, generated ${totalInsights} insights, sent ${notificationsSent} notifications`
    );

    return NextResponse.json({
      success: true,
      users_processed: usersProcessed,
      total_insights: totalInsights,
      notifications_sent: notificationsSent,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
      duration_ms: duration,
    });
  } catch (error) {
    console.error('[Weekly Analysis Cron] Fatal error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration_ms: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggering (with auth)
export async function POST(request: NextRequest) {
  // For manual triggers, require CRON_SECRET
  if (!requireCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return GET(request);
}
