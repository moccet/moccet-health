import { NextRequest, NextResponse } from 'next/server';
import { processAllProviders, getUsersWithIntegrations } from '@/lib/services/insight-trigger-service';

// Vercel Cron job - runs every 2 hours
// Configure in vercel.json: { "path": "/api/cron/sync-all-providers", "schedule": "0 */2 * * *" }
export const maxDuration = 300; // 5 minutes max for cron job

// Cron jobs are triggered by Vercel, verify the request is from Vercel
function isVercelCronRequest(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // If CRON_SECRET is set, verify it
  if (cronSecret) {
    return authHeader === `Bearer ${cronSecret}`;
  }

  // Check for Vercel's cron header
  const vercelCron = request.headers.get('x-vercel-cron');
  return vercelCron === '1';
}

export async function GET(request: NextRequest) {
  // Verify this is a legitimate cron request
  if (!isVercelCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[Cron Sync] Starting scheduled sync for all users');
  const startTime = Date.now();

  try {
    // Get all users with active integrations
    const users = await getUsersWithIntegrations();
    console.log(`[Cron Sync] Found ${users.length} users with active integrations`);

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
    const BATCH_SIZE = 10;
    let totalInsights = 0;
    let usersProcessed = 0;
    const errors: string[] = [];

    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);

      // Process batch in parallel
      const results = await Promise.all(
        batch.map(async (email) => {
          try {
            const result = await processAllProviders(email);
            return { email, ...result };
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            console.error(`[Cron Sync] Error processing ${email}:`, errorMsg);
            return { email, insights_generated: 0, errors: [errorMsg] };
          }
        })
      );

      // Aggregate results
      for (const result of results) {
        usersProcessed++;
        totalInsights += result.insights_generated;
        if (result.errors && result.errors.length > 0) {
          errors.push(`${result.email}: ${result.errors.join(', ')}`);
        }
      }

      console.log(
        `[Cron Sync] Processed batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(users.length / BATCH_SIZE)}`
      );
    }

    const duration = Date.now() - startTime;
    console.log(
      `[Cron Sync] Completed in ${duration}ms. Processed ${usersProcessed} users, generated ${totalInsights} insights`
    );

    return NextResponse.json({
      success: true,
      users_processed: usersProcessed,
      total_insights: totalInsights,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined, // Limit errors in response
      duration_ms: duration,
    });
  } catch (error) {
    console.error('[Cron Sync] Fatal error:', error);
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
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return GET(request);
}
