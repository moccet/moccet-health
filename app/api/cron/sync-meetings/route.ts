import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { syncUpcomingMeetingsForUser } from '@/lib/services/meeting-notetaker/google-meet-bot';
import { isValidCronRequest, requireCronSecret } from '@/lib/utils/cron-auth';

// Vercel Cron job - runs every hour
// Configure in vercel.json: { "path": "/api/cron/sync-meetings", "schedule": "0 * * * *" }
export const maxDuration = 300; // 5 minutes max for cron job

export async function GET(request: NextRequest) {
  // Verify this is a legitimate cron request
  if (!isValidCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[Cron SyncMeetings] Starting scheduled meeting sync for all users');
  const startTime = Date.now();

  try {
    const supabase = createAdminClient();

    // Get all users with auto-join enabled
    const { data: settings, error: settingsError } = await supabase
      .from('meeting_notetaker_settings')
      .select('user_email, user_code')
      .eq('auto_join_enabled', true);

    if (settingsError) {
      console.error('[Cron SyncMeetings] Error fetching settings:', settingsError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch user settings' },
        { status: 500 }
      );
    }

    if (!settings || settings.length === 0) {
      console.log('[Cron SyncMeetings] No users with auto-join enabled');
      return NextResponse.json({
        success: true,
        message: 'No users with auto-join enabled',
        users_processed: 0,
        meetings_scheduled: 0,
        duration_ms: Date.now() - startTime,
      });
    }

    console.log(`[Cron SyncMeetings] Found ${settings.length} users with auto-join enabled`);

    // Process users in batches
    const BATCH_SIZE = 5;
    let totalScheduled = 0;
    let totalErrors = 0;
    let usersProcessed = 0;
    const userResults: Array<{ email: string; scheduled: number; errors: number }> = [];

    for (let i = 0; i < settings.length; i += BATCH_SIZE) {
      const batch = settings.slice(i, i + BATCH_SIZE);

      // Process batch in parallel
      const results = await Promise.all(
        batch.map(async (setting) => {
          try {
            const result = await syncUpcomingMeetingsForUser(
              setting.user_email,
              setting.user_code
            );
            return {
              email: setting.user_email,
              scheduled: result.scheduled,
              errors: result.errors,
            };
          } catch (error) {
            console.error(
              `[Cron SyncMeetings] Error syncing for ${setting.user_email}:`,
              error
            );
            return {
              email: setting.user_email,
              scheduled: 0,
              errors: 1,
            };
          }
        })
      );

      // Aggregate results
      for (const result of results) {
        usersProcessed++;
        totalScheduled += result.scheduled;
        totalErrors += result.errors;
        if (result.scheduled > 0 || result.errors > 0) {
          userResults.push(result);
        }
      }

      console.log(
        `[Cron SyncMeetings] Processed batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(settings.length / BATCH_SIZE)}`
      );
    }

    const duration = Date.now() - startTime;
    console.log(
      `[Cron SyncMeetings] Completed in ${duration}ms. Processed ${usersProcessed} users, scheduled ${totalScheduled} meetings, ${totalErrors} errors`
    );

    return NextResponse.json({
      success: true,
      users_processed: usersProcessed,
      meetings_scheduled: totalScheduled,
      total_errors: totalErrors,
      user_results: userResults.slice(0, 20), // Limit to first 20 for response size
      duration_ms: duration,
    });
  } catch (error) {
    console.error('[Cron SyncMeetings] Fatal error:', error);
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
  if (!requireCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return GET(request);
}
