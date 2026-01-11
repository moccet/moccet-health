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
    const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

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
    const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

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
 * Fetch Dexcom data for a single user
 */
async function fetchDexcomDataForUser(email: string): Promise<{
  success: boolean;
  recordsAnalyzed?: number;
  error?: string;
}> {
  try {
    const supabase = createAdminClient();

    // Get user code
    let userCode: string | null = null;
    const { data: forgeData } = await supabase
      .from('forge_onboarding_data')
      .select('form_data')
      .eq('email', email)
      .single();

    if (forgeData?.form_data?.uniqueCode) {
      userCode = forgeData.form_data.uniqueCode;
    }

    // Get token
    const { token, error: tokenError } = await getAccessToken(email, 'dexcom', userCode);

    if (!token || tokenError) {
      return { success: false, error: tokenError || 'No valid token' };
    }

    // Date range (7 days for CGM data - more frequent readings)
    const endDate = new Date().toISOString();
    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Determine base URL
    const baseUrl = process.env.NODE_ENV === 'production'
      ? 'https://api.dexcom.com'
      : 'https://sandbox-api.dexcom.com';

    // Fetch EGV data (glucose readings)
    let egvData: any[] = [];
    try {
      const url = `${baseUrl}/v2/users/self/egvs?startDate=${startDate}&endDate=${endDate}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        egvData = data.egvs || [];
      }
    } catch (e) {
      console.warn(`[Dexcom Sync] Failed to fetch EGV data:`, e);
    }

    if (egvData.length === 0) {
      return { success: true, recordsAnalyzed: 0 };
    }

    // Calculate glucose metrics
    const glucoseValues = egvData.map((e: any) => e.value).filter(Boolean);
    const avgGlucose = glucoseValues.length > 0
      ? Math.round(glucoseValues.reduce((a: number, b: number) => a + b, 0) / glucoseValues.length)
      : 0;

    // Time in range (70-180 mg/dL)
    const inRange = glucoseValues.filter((v: number) => v >= 70 && v <= 180).length;
    const timeInRange = glucoseValues.length > 0
      ? Math.round((inRange / glucoseValues.length) * 100)
      : 0;

    // Store in dexcom_data
    const { error: dbError } = await supabase.from('dexcom_data').insert({
      user_email: email,
      timestamp: new Date().toISOString(),
      egv_data: egvData,
      analysis: {
        avgGlucose,
        timeInRange,
        readings: egvData.length,
      },
    });

    if (dbError) {
      console.error(`[Dexcom Sync] DB error for ${email}:`, dbError);
    }

    // Sync goal progress
    try {
      await syncGoalProgress(email);
    } catch (goalError) {
      console.warn(`[Dexcom Sync] Goal sync error for ${email}:`, goalError);
    }

    return { success: true, recordsAnalyzed: egvData.length };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Fetch Strava data for a single user
 */
async function fetchStravaDataForUser(email: string): Promise<{
  success: boolean;
  activitiesAnalyzed?: number;
  error?: string;
}> {
  try {
    const supabase = createAdminClient();

    // Get user code
    let userCode: string | null = null;
    const { data: forgeData } = await supabase
      .from('forge_onboarding_data')
      .select('form_data')
      .eq('email', email)
      .single();

    if (forgeData?.form_data?.uniqueCode) {
      userCode = forgeData.form_data.uniqueCode;
    }

    // Get token
    const { token, error: tokenError } = await getAccessToken(email, 'strava', userCode);

    if (!token || tokenError) {
      return { success: false, error: tokenError || 'No valid token' };
    }

    // Date range (30 days)
    const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const unixStart = Math.floor(startDate.getTime() / 1000);

    // Fetch activities
    const response = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?after=${unixStart}&per_page=50`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!response.ok) {
      return { success: false, error: `Strava API error: ${response.status}` };
    }

    const activities = await response.json();

    if (activities.length === 0) {
      return { success: true, activitiesAnalyzed: 0 };
    }

    // Process and store
    const processedWorkouts = activities.map((a: any) => ({
      id: a.id.toString(),
      type: a.type,
      startTime: a.start_date,
      duration: Math.round(a.moving_time / 60),
      distance: a.distance,
      avgHeartRate: a.average_heartrate,
      calories: a.calories,
    }));

    // Calculate weekly volume
    const totalMinutes = processedWorkouts.reduce((sum: number, w: any) => sum + w.duration, 0);
    const weeklyVolume = Math.round(totalMinutes / 4.3); // ~30 days / 7

    // Store in forge_training_data
    const { error: dbError } = await supabase.from('forge_training_data').upsert(
      {
        email,
        provider: 'strava',
        workouts: processedWorkouts,
        weekly_volume: weeklyVolume,
        data_period_start: startDate.toISOString().split('T')[0],
        data_period_end: new Date().toISOString().split('T')[0],
        data_points_analyzed: activities.length,
        sync_date: new Date().toISOString(),
      },
      { onConflict: 'email,provider' }
    );

    if (dbError) {
      console.error(`[Strava Sync] DB error for ${email}:`, dbError);
    }

    return { success: true, activitiesAnalyzed: activities.length };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Process Apple Health data for a user
 * Apple Health is push-based (from iOS app), so we process existing uploaded data
 */
async function processAppleHealthForUser(email: string): Promise<{
  success: boolean;
  metricsProcessed?: number;
  error?: string;
}> {
  try {
    const supabase = createAdminClient();

    // Get Apple Health data from sage_onboarding_data
    const { data: onboardingData } = await supabase
      .from('sage_onboarding_data')
      .select('apple_health_data, updated_at')
      .eq('email', email)
      .single();

    if (!onboardingData?.apple_health_data) {
      return { success: false, error: 'No Apple Health data' };
    }

    const healthData = onboardingData.apple_health_data;
    const updatedAt = new Date(onboardingData.updated_at);
    const hoursSinceUpdate = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60);

    // Skip if data is more than 48 hours old (stale)
    if (hoursSinceUpdate > 48) {
      return { success: false, error: 'Data stale (>48h)' };
    }

    // Extract metrics
    const steps = healthData.steps?.dailyAverage || 0;
    const sleepHours = parseFloat(healthData.sleep?.averageHours || '0');
    const restingHR = healthData.heartRate?.resting || 0;
    const activeCalories = healthData.activeEnergy?.dailyAverage || 0;

    // Store in oura_daily_data format for goal tracking compatibility
    const today = new Date().toISOString().split('T')[0];

    await supabase.from('oura_daily_data').upsert(
      {
        user_email: email,
        date: today,
        steps: steps,
        total_sleep_duration: sleepHours * 3600, // Convert to seconds
        active_calories: activeCalories,
        resting_heart_rate: restingHR,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_email,date' }
    );

    // Sync goal progress
    try {
      await syncGoalProgress(email);
    } catch (goalError) {
      console.warn(`[Apple Health Sync] Goal sync error for ${email}:`, goalError);
    }

    return { success: true, metricsProcessed: 4 };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Fetch Notion data for a single user
 */
async function fetchNotionDataForUser(email: string): Promise<{
  success: boolean;
  tasksAnalyzed?: number;
  error?: string;
}> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'https://moccet.ai'}/api/notion/fetch-data`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      }
    );

    if (!response.ok) {
      return { success: false, error: `API error: ${response.status}` };
    }

    const data = await response.json();
    return { success: true, tasksAnalyzed: data.tasks || 0 };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Fetch Linear data for a single user
 */
async function fetchLinearDataForUser(email: string): Promise<{
  success: boolean;
  issuesAnalyzed?: number;
  error?: string;
}> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'https://moccet.ai'}/api/linear/fetch-data`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      }
    );

    if (!response.ok) {
      return { success: false, error: `API error: ${response.status}` };
    }

    const data = await response.json();
    return { success: true, issuesAnalyzed: data.totalIssues || 0 };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Fetch Fitbit data for a single user
 */
async function fetchFitbitDataForUser(email: string): Promise<{
  success: boolean;
  stepsToday?: number;
  sleepHours?: number;
  error?: string;
}> {
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'https://moccet.ai'}/api/fitbit/fetch-data`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      }
    );

    if (!response.ok) {
      return { success: false, error: `API error: ${response.status}` };
    }

    const data = await response.json();
    return {
      success: true,
      stepsToday: data.metrics?.steps_today || 0,
      sleepHours: data.metrics?.sleep_duration_hours || 0,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * GET - Run Whoop + Oura + Dexcom + Strava + Apple Health + Fitbit + Notion + Linear sync for all users
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

    // Get all users with active Dexcom integrations
    const { data: dexcomUsers } = await supabase
      .from('integration_tokens')
      .select('user_email')
      .eq('provider', 'dexcom')
      .eq('is_active', true);

    // Get all users with active Strava integrations
    const { data: stravaUsers } = await supabase
      .from('integration_tokens')
      .select('user_email')
      .eq('provider', 'strava')
      .eq('is_active', true);

    // Get all users with active Fitbit integrations
    const { data: fitbitUsers } = await supabase
      .from('integration_tokens')
      .select('user_email')
      .eq('provider', 'fitbit')
      .eq('is_active', true);

    // Get users with Apple Health data (push-based, stored in sage_onboarding_data)
    const { data: appleHealthUsers } = await supabase
      .from('sage_onboarding_data')
      .select('email')
      .not('apple_health_data', 'is', null);

    // Get all users with active Notion integrations
    const { data: notionUsers } = await supabase
      .from('integration_tokens')
      .select('user_email')
      .eq('provider', 'notion')
      .eq('is_active', true);

    // Get all users with active Linear integrations
    const { data: linearUsers } = await supabase
      .from('integration_tokens')
      .select('user_email')
      .eq('provider', 'linear')
      .eq('is_active', true);

    const whoopEmails = [...new Set(whoopUsers?.map((u) => u.user_email).filter(Boolean))] as string[];
    const ouraEmails = [...new Set(ouraUsers?.map((u) => u.user_email).filter(Boolean))] as string[];
    const dexcomEmails = [...new Set(dexcomUsers?.map((u) => u.user_email).filter(Boolean))] as string[];
    const stravaEmails = [...new Set(stravaUsers?.map((u) => u.user_email).filter(Boolean))] as string[];
    const fitbitEmails = [...new Set(fitbitUsers?.map((u) => u.user_email).filter(Boolean))] as string[];
    const appleHealthEmails = [...new Set(appleHealthUsers?.map((u) => u.email).filter(Boolean))] as string[];
    const notionEmails = [...new Set(notionUsers?.map((u) => u.user_email).filter(Boolean))] as string[];
    const linearEmails = [...new Set(linearUsers?.map((u) => u.user_email).filter(Boolean))] as string[];

    console.log(`[Wearables Sync Cron] Found ${whoopEmails.length} Whoop, ${ouraEmails.length} Oura, ${dexcomEmails.length} Dexcom, ${stravaEmails.length} Strava, ${fitbitEmails.length} Fitbit, ${appleHealthEmails.length} Apple Health, ${notionEmails.length} Notion, ${linearEmails.length} Linear users`);

    const results = {
      whoop: { processed: 0, success: 0, failed: 0, errors: [] as string[] },
      oura: { processed: 0, success: 0, failed: 0, errors: [] as string[] },
      dexcom: { processed: 0, success: 0, failed: 0, errors: [] as string[] },
      strava: { processed: 0, success: 0, failed: 0, errors: [] as string[] },
      fitbit: { processed: 0, success: 0, failed: 0, errors: [] as string[] },
      appleHealth: { processed: 0, success: 0, failed: 0, errors: [] as string[] },
      notion: { processed: 0, success: 0, failed: 0, errors: [] as string[] },
      linear: { processed: 0, success: 0, failed: 0, errors: [] as string[] },
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

    // Process Dexcom users in batches
    for (let i = 0; i < dexcomEmails.length; i += BATCH_SIZE) {
      const batch = dexcomEmails.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.all(
        batch.map(async (email) => {
          const result = await fetchDexcomDataForUser(email);
          return { email, ...result };
        })
      );

      for (const result of batchResults) {
        results.dexcom.processed++;
        if (result.success) {
          results.dexcom.success++;
          console.log(`[Dexcom Sync] Synced ${result.email}: ${result.recordsAnalyzed} readings`);
        } else {
          results.dexcom.failed++;
          results.dexcom.errors.push(`${result.email}: ${result.error}`);
        }
      }

      if (i + BATCH_SIZE < dexcomEmails.length) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    // Process Strava users in batches
    for (let i = 0; i < stravaEmails.length; i += BATCH_SIZE) {
      const batch = stravaEmails.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.all(
        batch.map(async (email) => {
          const result = await fetchStravaDataForUser(email);
          return { email, ...result };
        })
      );

      for (const result of batchResults) {
        results.strava.processed++;
        if (result.success) {
          results.strava.success++;
          console.log(`[Strava Sync] Synced ${result.email}: ${result.activitiesAnalyzed} activities`);
        } else {
          results.strava.failed++;
          results.strava.errors.push(`${result.email}: ${result.error}`);
        }
      }

      if (i + BATCH_SIZE < stravaEmails.length) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    // Process Fitbit users in batches
    for (let i = 0; i < fitbitEmails.length; i += BATCH_SIZE) {
      const batch = fitbitEmails.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.all(
        batch.map(async (email) => {
          const result = await fetchFitbitDataForUser(email);
          return { email, ...result };
        })
      );

      for (const result of batchResults) {
        results.fitbit.processed++;
        if (result.success) {
          results.fitbit.success++;
          console.log(`[Fitbit Sync] Synced ${result.email}: ${result.stepsToday} steps, ${result.sleepHours}h sleep`);
        } else {
          results.fitbit.failed++;
          results.fitbit.errors.push(`${result.email}: ${result.error}`);
        }
      }

      if (i + BATCH_SIZE < fitbitEmails.length) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    // Process Apple Health users in batches
    for (let i = 0; i < appleHealthEmails.length; i += BATCH_SIZE) {
      const batch = appleHealthEmails.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.all(
        batch.map(async (email) => {
          const result = await processAppleHealthForUser(email);
          return { email, ...result };
        })
      );

      for (const result of batchResults) {
        results.appleHealth.processed++;
        if (result.success) {
          results.appleHealth.success++;
          console.log(`[Apple Health Sync] Processed ${result.email}: ${result.metricsProcessed} metrics`);
        } else {
          results.appleHealth.failed++;
          results.appleHealth.errors.push(`${result.email}: ${result.error}`);
        }
      }

      if (i + BATCH_SIZE < appleHealthEmails.length) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    // Process Notion users in batches
    for (let i = 0; i < notionEmails.length; i += BATCH_SIZE) {
      const batch = notionEmails.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.all(
        batch.map(async (email) => {
          const result = await fetchNotionDataForUser(email);
          return { email, ...result };
        })
      );

      for (const result of batchResults) {
        results.notion.processed++;
        if (result.success) {
          results.notion.success++;
          console.log(`[Notion Sync] Synced ${result.email}: ${result.tasksAnalyzed} tasks`);
        } else {
          results.notion.failed++;
          results.notion.errors.push(`${result.email}: ${result.error}`);
        }
      }

      if (i + BATCH_SIZE < notionEmails.length) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    // Process Linear users in batches
    for (let i = 0; i < linearEmails.length; i += BATCH_SIZE) {
      const batch = linearEmails.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.all(
        batch.map(async (email) => {
          const result = await fetchLinearDataForUser(email);
          return { email, ...result };
        })
      );

      for (const result of batchResults) {
        results.linear.processed++;
        if (result.success) {
          results.linear.success++;
          console.log(`[Linear Sync] Synced ${result.email}: ${result.issuesAnalyzed} issues`);
        } else {
          results.linear.failed++;
          results.linear.errors.push(`${result.email}: ${result.error}`);
        }
      }

      if (i + BATCH_SIZE < linearEmails.length) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    const duration = Date.now() - startTime;
    console.log(
      `[Wearables Sync Cron] Completed in ${duration}ms. Whoop: ${results.whoop.success}/${results.whoop.processed}, Oura: ${results.oura.success}/${results.oura.processed}, Dexcom: ${results.dexcom.success}/${results.dexcom.processed}, Strava: ${results.strava.success}/${results.strava.processed}, Fitbit: ${results.fitbit.success}/${results.fitbit.processed}, Apple Health: ${results.appleHealth.success}/${results.appleHealth.processed}, Notion: ${results.notion.success}/${results.notion.processed}, Linear: ${results.linear.success}/${results.linear.processed}`
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
      dexcom: {
        users_processed: results.dexcom.processed,
        successful: results.dexcom.success,
        failed: results.dexcom.failed,
        errors: results.dexcom.errors.length > 0 ? results.dexcom.errors.slice(0, 5) : undefined,
      },
      strava: {
        users_processed: results.strava.processed,
        successful: results.strava.success,
        failed: results.strava.failed,
        errors: results.strava.errors.length > 0 ? results.strava.errors.slice(0, 5) : undefined,
      },
      fitbit: {
        users_processed: results.fitbit.processed,
        successful: results.fitbit.success,
        failed: results.fitbit.failed,
        errors: results.fitbit.errors.length > 0 ? results.fitbit.errors.slice(0, 5) : undefined,
      },
      appleHealth: {
        users_processed: results.appleHealth.processed,
        successful: results.appleHealth.success,
        failed: results.appleHealth.failed,
        errors: results.appleHealth.errors.length > 0 ? results.appleHealth.errors.slice(0, 5) : undefined,
      },
      notion: {
        users_processed: results.notion.processed,
        successful: results.notion.success,
        failed: results.notion.failed,
        errors: results.notion.errors.length > 0 ? results.notion.errors.slice(0, 5) : undefined,
      },
      linear: {
        users_processed: results.linear.processed,
        successful: results.linear.success,
        failed: results.linear.failed,
        errors: results.linear.errors.length > 0 ? results.linear.errors.slice(0, 5) : undefined,
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
