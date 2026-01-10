/**
 * Wearables Auto-Sync Cron Job
 *
 * Automatically fetches fresh data from Whoop and Oura for all users with active integrations.
 * Runs twice daily (morning and evening) to keep health metrics up to date.
 *
 * Vercel Cron config (in vercel.json):
 * {
 *   "path": "/api/cron/sync-whoop",
 *   "schedule": "0 6,18 * * *"
 * }
 *
 * GET /api/cron/sync-whoop - Run Whoop + Oura sync for all users
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getValidatedAccessToken, getAccessToken } from '@/lib/services/token-manager';
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
 * Fetch Oura data for a single user
 */
async function fetchOuraDataForUser(email: string): Promise<{
  success: boolean;
  recordsAnalyzed?: number;
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

    // Get token
    const { token, error: tokenError } = await getAccessToken(email, 'oura', userCode);

    if (!token || tokenError) {
      return { success: false, error: tokenError || 'No valid token' };
    }

    // Date range (30 days)
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Fetch data from Oura API
    const dataTypes = [
      { name: 'sleep', endpoint: 'sleep' },
      { name: 'daily_activity', endpoint: 'daily_activity' },
      { name: 'daily_readiness', endpoint: 'daily_readiness' },
    ];

    const allData: Record<string, unknown[]> = {};
    let totalRecords = 0;

    for (const dataType of dataTypes) {
      try {
        const url = `https://api.ouraring.com/v2/usercollection/${dataType.endpoint}?start_date=${startDate}&end_date=${endDate}`;
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (response.ok) {
          const data = await response.json();
          allData[dataType.name] = data.data || [];
          totalRecords += allData[dataType.name].length;
        }
      } catch (e) {
        console.warn(`[Oura Sync] Failed to fetch ${dataType.name}:`, e);
      }
    }

    // Store in oura_data table
    const { error: dbError } = await supabase.from('oura_data').insert({
      email,
      sync_date: new Date().toISOString(),
      start_date: startDate,
      end_date: endDate,
      sleep_data: allData.sleep || [],
      activity_data: allData.daily_activity || [],
      readiness_data: allData.daily_readiness || [],
      heart_rate_data: [],
      workout_data: [],
      raw_data: allData,
    });

    if (dbError) {
      console.error(`[Oura Sync] DB error for ${email}:`, dbError);
    }

    // Also update oura_daily_data for goal tracking
    const sleepData = allData.sleep as any[] || [];
    const readinessData = allData.daily_readiness as any[] || [];

    for (const sleep of sleepData.slice(-7)) { // Last 7 days
      const day = sleep.day;
      if (!day) continue;

      const readiness = readinessData.find((r: any) => r.day === day);

      await supabase.from('oura_daily_data').upsert(
        {
          user_email: email,
          date: day,
          sleep_score: sleep.score,
          total_sleep_duration: sleep.total_sleep_duration,
          deep_sleep_duration: sleep.deep_sleep_duration,
          rem_sleep_duration: sleep.rem_sleep_duration,
          sleep_efficiency: sleep.efficiency,
          readiness_score: readiness?.score,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_email,date' }
      );
    }

    // Sync goal progress
    try {
      await syncGoalProgress(email);
    } catch (goalError) {
      console.warn(`[Oura Sync] Goal sync error for ${email}:`, goalError);
    }

    return { success: true, recordsAnalyzed: totalRecords };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * GET - Run Whoop + Oura sync for all users
 */
export async function GET(request: NextRequest) {
  if (!isValidCronRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[Wearables Sync Cron] Starting sync for all users');
  const startTime = Date.now();

  try {
    const supabase = createAdminClient();

    // Get all users with active Whoop integrations
    const { data: whoopUsers } = await supabase
      .from('integration_tokens')
      .select('user_email')
      .eq('provider', 'whoop')
      .eq('is_active', true);

    // Get all users with active Oura integrations
    const { data: ouraUsers } = await supabase
      .from('integration_tokens')
      .select('user_email')
      .eq('provider', 'oura')
      .eq('is_active', true);

    const whoopEmails = [...new Set(whoopUsers?.map((u) => u.user_email).filter(Boolean))] as string[];
    const ouraEmails = [...new Set(ouraUsers?.map((u) => u.user_email).filter(Boolean))] as string[];

    console.log(`[Wearables Sync Cron] Found ${whoopEmails.length} Whoop users, ${ouraEmails.length} Oura users`);

    const results = {
      whoop: { processed: 0, success: 0, failed: 0, errors: [] as string[] },
      oura: { processed: 0, success: 0, failed: 0, errors: [] as string[] },
    };

    // Process Whoop users in batches
    const BATCH_SIZE = 5;

    for (let i = 0; i < whoopEmails.length; i += BATCH_SIZE) {
      const batch = whoopEmails.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.all(
        batch.map(async (email) => {
          const result = await fetchWhoopDataForUser(email);
          return { email, ...result };
        })
      );

      for (const result of batchResults) {
        results.whoop.processed++;
        if (result.success) {
          results.whoop.success++;
          console.log(`[Whoop Sync] Synced ${result.email}: ${result.cyclesAnalyzed} cycles`);
        } else {
          results.whoop.failed++;
          results.whoop.errors.push(`${result.email}: ${result.error}`);
        }
      }

      if (i + BATCH_SIZE < whoopEmails.length) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    // Process Oura users in batches
    for (let i = 0; i < ouraEmails.length; i += BATCH_SIZE) {
      const batch = ouraEmails.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.all(
        batch.map(async (email) => {
          const result = await fetchOuraDataForUser(email);
          return { email, ...result };
        })
      );

      for (const result of batchResults) {
        results.oura.processed++;
        if (result.success) {
          results.oura.success++;
          console.log(`[Oura Sync] Synced ${result.email}: ${result.recordsAnalyzed} records`);
        } else {
          results.oura.failed++;
          results.oura.errors.push(`${result.email}: ${result.error}`);
        }
      }

      if (i + BATCH_SIZE < ouraEmails.length) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    const duration = Date.now() - startTime;
    console.log(
      `[Wearables Sync Cron] Completed in ${duration}ms. Whoop: ${results.whoop.success}/${results.whoop.processed}, Oura: ${results.oura.success}/${results.oura.processed}`
    );

    return NextResponse.json({
      success: true,
      whoop: {
        users_processed: results.whoop.processed,
        successful: results.whoop.success,
        failed: results.whoop.failed,
        errors: results.whoop.errors.length > 0 ? results.whoop.errors.slice(0, 5) : undefined,
      },
      oura: {
        users_processed: results.oura.processed,
        successful: results.oura.success,
        failed: results.oura.failed,
        errors: results.oura.errors.length > 0 ? results.oura.errors.slice(0, 5) : undefined,
      },
      duration_ms: duration,
    });
  } catch (error) {
    console.error('[Wearables Sync Cron] Fatal error:', error);
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
