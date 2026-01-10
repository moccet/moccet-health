/**
 * Whoop Auto-Sync Cron Job
 *
 * Automatically fetches fresh Whoop data for all users with active Whoop integrations.
 * Runs twice daily (morning and evening) to keep health metrics up to date.
 *
 * Vercel Cron config (in vercel.json):
 * {
 *   "path": "/api/cron/sync-whoop",
 *   "schedule": "0 6,18 * * *"
 * }
 *
 * GET /api/cron/sync-whoop - Run Whoop sync for all users
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getValidatedAccessToken } from '@/lib/services/token-manager';
import { syncGoalProgress } from '@/lib/services/goal-progress-sync';

export const maxDuration = 300; // 5 minutes max

const CRON_SECRET = process.env.CRON_SECRET || 'moccet-cron-secret';

/**
 * Verify cron request
 */
function isValidCronRequest(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = request.headers.get('x-cron-secret');
  const vercelCron = request.headers.get('x-vercel-cron');

  return (
    authHeader === `Bearer ${CRON_SECRET}` ||
    cronSecret === CRON_SECRET ||
    vercelCron === '1' ||
    process.env.NODE_ENV === 'development'
  );
}

/**
 * Validate Whoop token
 */
async function validateWhoopToken(token: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.prod.whoop.com/developer/v1/user/profile/basic', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Fetch Whoop data for a single user
 */
async function fetchWhoopDataForUser(email: string): Promise<{
  success: boolean;
  cyclesAnalyzed?: number;
  error?: string;
}> {
  try {
    const supabase = createAdminClient();

    // Get user code from onboarding data
    let userCode: string | null = null;
    const { data: forgeData } = await supabase
      .from('forge_onboarding_data')
      .select('form_data')
      .eq('email', email)
      .single();

    if (forgeData?.form_data?.uniqueCode) {
      userCode = forgeData.form_data.uniqueCode;
    } else {
      const { data: sageData } = await supabase
        .from('sage_onboarding_data')
        .select('form_data')
        .eq('email', email)
        .single();
      if (sageData?.form_data?.uniqueCode) {
        userCode = sageData.form_data.uniqueCode;
      }
    }

    // Get validated token
    const { token, error: tokenError } = await getValidatedAccessToken(
      email,
      'whoop',
      userCode,
      validateWhoopToken
    );

    if (!token || tokenError) {
      return { success: false, error: tokenError || 'No valid token' };
    }

    // Fetch cycles (30 days)
    const endDate = new Date();
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const cyclesResponse = await fetch(
      `https://api.prod.whoop.com/developer/v1/cycle?start=${startDate.toISOString()}&end=${endDate.toISOString()}&limit=25`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      }
    );

    if (!cyclesResponse.ok) {
      return { success: false, error: `Whoop API error: ${cyclesResponse.status}` };
    }

    const cyclesData = await cyclesResponse.json();
    const cycles = cyclesData.records || cyclesData || [];

    // Fetch recovery data
    const recoveryResponse = await fetch(
      `https://api.prod.whoop.com/developer/v2/recovery?start=${startDate.toISOString()}&end=${endDate.toISOString()}&limit=25`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      }
    );

    if (recoveryResponse.ok) {
      const recoveryJson = await recoveryResponse.json();
      const recoveryData = recoveryJson.records || recoveryJson || [];

      // Merge recovery into cycles
      for (const cycle of cycles) {
        const matchingRecovery = recoveryData.find((r: any) => r.cycle_id === cycle.id);
        if (matchingRecovery) {
          cycle.recovery = {
            score: matchingRecovery.score?.recovery_score || 0,
            resting_heart_rate: matchingRecovery.score?.resting_heart_rate || 0,
            hrv_rmssd: matchingRecovery.score?.hrv_rmssd_milli || 0,
          };
        }
      }
    }

    // Analyze and store
    const recoveryScores = cycles.filter((c: any) => c.recovery).map((c: any) => c.recovery.score);
    const hrvValues = cycles.filter((c: any) => c.recovery?.hrv_rmssd).map((c: any) => c.recovery.hrv_rmssd);
    const restingHRs = cycles.filter((c: any) => c.recovery?.resting_heart_rate).map((c: any) => c.recovery.resting_heart_rate);
    const strainValues = cycles.filter((c: any) => c.score?.strain).map((c: any) => c.score.strain);

    const avgRecovery = recoveryScores.length > 0
      ? Math.round(recoveryScores.reduce((a: number, b: number) => a + b, 0) / recoveryScores.length)
      : 0;
    const avgHRV = hrvValues.length > 0
      ? Math.round(hrvValues.reduce((a: number, b: number) => a + b, 0) / hrvValues.length)
      : 0;
    const avgRestingHR = restingHRs.length > 0
      ? Math.round(restingHRs.reduce((a: number, b: number) => a + b, 0) / restingHRs.length)
      : 0;
    const avgStrain = strainValues.length > 0
      ? strainValues.reduce((a: number, b: number) => a + b, 0) / strainValues.length
      : 0;

    // Store in forge_training_data
    const { error: dbError } = await supabase
      .from('forge_training_data')
      .upsert(
        {
          email,
          provider: 'whoop',
          workouts: [],
          recovery_score: {
            avgRecoveryScore: avgRecovery,
            avgDailyStrain: avgStrain,
          },
          hrv_trends: {
            avgHRV,
            trend: 'stable',
          },
          resting_hr_trends: {
            avg: avgRestingHR,
            trend: 'stable',
          },
          data_period_start: startDate.toISOString().split('T')[0],
          data_period_end: endDate.toISOString().split('T')[0],
          data_points_analyzed: cycles.length,
          sync_date: new Date().toISOString(),
        },
        {
          onConflict: 'email,provider',
          ignoreDuplicates: false,
        }
      );

    if (dbError) {
      console.error(`[Whoop Sync] DB error for ${email}:`, dbError);
    }

    // Also sync goal progress with fresh data
    try {
      await syncGoalProgress(email);
    } catch (goalError) {
      console.warn(`[Whoop Sync] Goal sync error for ${email}:`, goalError);
    }

    return { success: true, cyclesAnalyzed: cycles.length };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * GET - Run Whoop sync for all users
 */
export async function GET(request: NextRequest) {
  if (!isValidCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[Whoop Sync Cron] Starting sync for all users');
  const startTime = Date.now();

  try {
    const supabase = createAdminClient();

    // Get all users with active Whoop integrations
    const { data: whoopUsers, error: queryError } = await supabase
      .from('integration_tokens')
      .select('user_email')
      .eq('provider', 'whoop')
      .eq('is_active', true);

    if (queryError) {
      console.error('[Whoop Sync Cron] Query error:', queryError);
      return NextResponse.json(
        { error: 'Failed to get users', details: queryError.message },
        { status: 500 }
      );
    }

    const users = [...new Set(whoopUsers?.map((u) => u.user_email).filter(Boolean))] as string[];
    console.log(`[Whoop Sync Cron] Found ${users.length} users with Whoop`);

    if (users.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No users with Whoop integration',
        users_processed: 0,
        duration_ms: Date.now() - startTime,
      });
    }

    // Process users in batches
    const BATCH_SIZE = 5;
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      const batch = users.slice(i, i + BATCH_SIZE);

      const results = await Promise.all(
        batch.map(async (email) => {
          const result = await fetchWhoopDataForUser(email);
          return { email, ...result };
        })
      );

      for (const result of results) {
        if (result.success) {
          successCount++;
          console.log(`[Whoop Sync Cron] Synced ${result.email}: ${result.cyclesAnalyzed} cycles`);
        } else {
          errorCount++;
          errors.push(`${result.email}: ${result.error}`);
          console.warn(`[Whoop Sync Cron] Failed ${result.email}: ${result.error}`);
        }
      }

      // Small delay between batches
      if (i + BATCH_SIZE < users.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    const duration = Date.now() - startTime;
    console.log(
      `[Whoop Sync Cron] Completed in ${duration}ms. Success: ${successCount}, Failed: ${errorCount}`
    );

    return NextResponse.json({
      success: true,
      users_processed: users.length,
      successful: successCount,
      failed: errorCount,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
      duration_ms: duration,
    });
  } catch (error) {
    console.error('[Whoop Sync Cron] Fatal error:', error);
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

/**
 * POST - Manual trigger
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return GET(request);
}
