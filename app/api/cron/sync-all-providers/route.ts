import { NextRequest, NextResponse } from 'next/server';
import { processAllProviders, getUsersWithIntegrations } from '@/lib/services/insight-trigger-service';
import { createAdminClient } from '@/lib/supabase/server';

// Vercel Cron job - runs every 2 hours
// Configure in vercel.json: { "path": "/api/cron/sync-all-providers", "schedule": "0 */2 * * *" }
export const maxDuration = 300; // 5 minutes max for cron job

const BASE_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET || '';

/**
 * Fetch fresh data from Slack/Gmail APIs for a user
 * This actually calls the external APIs, not just reads cached data
 */
async function refreshUserData(email: string): Promise<{ slack: boolean; gmail: boolean }> {
  const supabase = createAdminClient();
  const results = { slack: false, gmail: false };

  // Check which providers the user has connected
  const { data: tokens } = await supabase
    .from('integration_tokens')
    .select('provider')
    .eq('user_email', email)
    .eq('is_active', true);

  const providers = new Set((tokens || []).map(t => t.provider));

  // Fetch Slack data if connected
  if (providers.has('slack')) {
    try {
      const response = await fetch(`${BASE_URL}/api/slack/fetch-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      results.slack = response.ok;
      if (!response.ok) {
        console.log(`[Cron Sync] Slack fetch failed for ${email}: ${response.status}`);
      }
    } catch (e) {
      console.log(`[Cron Sync] Slack fetch error for ${email}:`, e);
    }
  }

  // Fetch Gmail data if connected
  if (providers.has('gmail')) {
    try {
      const response = await fetch(`${BASE_URL}/api/gmail/fetch-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      results.gmail = response.ok;
      if (!response.ok) {
        console.log(`[Cron Sync] Gmail fetch failed for ${email}: ${response.status}`);
      }
    } catch (e) {
      console.log(`[Cron Sync] Gmail fetch error for ${email}:`, e);
    }
  }

  return results;
}

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
            // FIRST: Fetch fresh data from Slack/Gmail APIs
            const refreshResults = await refreshUserData(email);
            console.log(`[Cron Sync] Refreshed data for ${email}: Slack=${refreshResults.slack}, Gmail=${refreshResults.gmail}`);

            // THEN: Process the fresh data to generate insights
            const result = await processAllProviders(email);
            return { email, refreshed: refreshResults, ...result };
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
