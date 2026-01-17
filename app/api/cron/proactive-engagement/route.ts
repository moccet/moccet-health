import { NextRequest, NextResponse } from 'next/server';
import {
  processProactiveEngagement,
  getUsersForProactiveEngagement,
} from '@/lib/services/proactive-engagement-service';
import { isValidCronRequest, requireCronSecret } from '@/lib/utils/cron-auth';

/**
 * Proactive Engagement Cron Jobs
 *
 * Sends personalized, supportive notifications at different times of day:
 * - Morning (8am UTC): Morning motivation, energy-based encouragement
 * - Midday (1pm UTC): Daily digest, stress support, mindfulness prompts
 * - Evening (8pm UTC): Wind-down reminders, reflection prompts
 *
 * Configure in vercel.json:
 * - { "path": "/api/cron/proactive-engagement?time=morning", "schedule": "0 8 * * *" }
 * - { "path": "/api/cron/proactive-engagement?time=midday", "schedule": "0 13 * * *" }
 * - { "path": "/api/cron/proactive-engagement?time=evening", "schedule": "0 20 * * *" }
 */

export const maxDuration = 300; // 5 minutes max

export async function GET(request: NextRequest) {
  if (!isValidCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get time of day from query param or determine from current hour
  const { searchParams } = new URL(request.url);
  let timeOfDay = searchParams.get('time') as 'morning' | 'midday' | 'evening' | null;

  if (!timeOfDay) {
    // Auto-detect based on current UTC hour
    const hour = new Date().getUTCHours();
    if (hour >= 6 && hour < 11) {
      timeOfDay = 'morning';
    } else if (hour >= 11 && hour < 18) {
      timeOfDay = 'midday';
    } else {
      timeOfDay = 'evening';
    }
  }

  console.log(`[Proactive Engagement Cron] Starting ${timeOfDay} engagement`);
  const startTime = Date.now();

  try {
    const users = await getUsersForProactiveEngagement();
    console.log(`[Proactive Engagement Cron] Found ${users.length} users`);

    if (users.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No users for proactive engagement',
        time_of_day: timeOfDay,
        users_processed: 0,
        total_notifications: 0,
        duration_ms: Date.now() - startTime,
      });
    }

    // Process users in batches
    const BATCH_SIZE = 5;
    let totalNotifications = 0;
    let usersProcessed = 0;
    const errors: string[] = [];

    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);

      const results = await Promise.all(
        batch.map(async (email) => {
          try {
            const notificationsSent = await processProactiveEngagement(email, timeOfDay!);
            return { email, notificationsSent, error: null };
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[Proactive Engagement Cron] Error for ${email}:`, errorMsg);
            return { email, notificationsSent: 0, error: errorMsg };
          }
        })
      );

      for (const result of results) {
        usersProcessed++;
        totalNotifications += result.notificationsSent;
        if (result.error) {
          errors.push(`${result.email}: ${result.error}`);
        }
      }

      console.log(
        `[Proactive Engagement Cron] Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(users.length / BATCH_SIZE)} complete`
      );
    }

    const duration = Date.now() - startTime;
    console.log(
      `[Proactive Engagement Cron] ${timeOfDay} complete. ${usersProcessed} users, ${totalNotifications} notifications in ${duration}ms`
    );

    return NextResponse.json({
      success: true,
      time_of_day: timeOfDay,
      users_processed: usersProcessed,
      total_notifications: totalNotifications,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
      duration_ms: duration,
    });
  } catch (error) {
    console.error('[Proactive Engagement Cron] Fatal error:', error);
    return NextResponse.json(
      {
        success: false,
        time_of_day: timeOfDay,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration_ms: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

// Manual trigger
export async function POST(request: NextRequest) {
  if (!requireCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return GET(request);
}
