/**
 * Fitbit Fetch Data API
 *
 * Fetches activity, sleep, and heart rate data from Fitbit API
 * Uses token manager for authentication (supports cron jobs)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getAccessToken } from '@/lib/services/token-manager';

// Helper to get user code from onboarding data
async function getUserCode(email: string): Promise<string | null> {
  const supabase = createAdminClient();

  const { data: forgeData } = await supabase
    .from('forge_onboarding_data')
    .select('form_data')
    .eq('email', email)
    .single();

  if (forgeData?.form_data?.uniqueCode) {
    return forgeData.form_data.uniqueCode;
  }

  const { data: sageData } = await supabase
    .from('sage_onboarding_data')
    .select('form_data')
    .eq('email', email)
    .single();

  return sageData?.form_data?.uniqueCode || null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    console.log(`[Fitbit Fetch] Starting data fetch for ${email}`);

    // Get user code for token lookup
    const userCode = await getUserCode(email);

    // Get access token using token manager (handles refresh automatically)
    const { token, error: tokenError } = await getAccessToken(email, 'fitbit', userCode || undefined);

    if (!token || tokenError) {
      console.error('[Fitbit Fetch] Token error:', tokenError);
      return NextResponse.json(
        { error: 'Not authenticated with Fitbit', details: tokenError },
        { status: 401 }
      );
    }

    const supabase = createAdminClient();
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Fetch multiple data types in parallel
    const [activityRes, sleepRes, heartRes, stepsRes] = await Promise.all([
      // Daily activity summary
      fetch(`https://api.fitbit.com/1/user/-/activities/date/${today}.json`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      // Sleep data for last 7 days
      fetch(`https://api.fitbit.com/1.2/user/-/sleep/date/${weekAgo}/${today}.json`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      // Heart rate for today
      fetch(`https://api.fitbit.com/1/user/-/activities/heart/date/${today}/1d.json`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      // Steps for last 7 days
      fetch(`https://api.fitbit.com/1/user/-/activities/steps/date/${weekAgo}/${today}.json`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);

    // Parse responses
    const activity = activityRes.ok ? await activityRes.json() : null;
    const sleep = sleepRes.ok ? await sleepRes.json() : null;
    const heart = heartRes.ok ? await heartRes.json() : null;
    const steps = stepsRes.ok ? await stepsRes.json() : null;

    if (!activity && !sleep && !heart && !steps) {
      return NextResponse.json(
        { error: 'Failed to fetch any Fitbit data' },
        { status: 500 }
      );
    }

    // Extract key metrics
    const metrics = {
      // Today's activity
      steps_today: activity?.summary?.steps || 0,
      calories_burned: activity?.summary?.caloriesOut || 0,
      active_minutes: (activity?.summary?.veryActiveMinutes || 0) +
                      (activity?.summary?.fairlyActiveMinutes || 0),
      distance_km: activity?.summary?.distances?.find((d: any) => d.activity === 'total')?.distance || 0,
      floors: activity?.summary?.floors || 0,

      // Heart rate
      resting_heart_rate: heart?.['activities-heart']?.[0]?.value?.restingHeartRate || null,
      heart_rate_zones: heart?.['activities-heart']?.[0]?.value?.heartRateZones || [],

      // Sleep (most recent)
      sleep_duration_hours: sleep?.sleep?.[0]?.duration ?
        Math.round(sleep.sleep[0].duration / 3600000 * 10) / 10 : null,
      sleep_efficiency: sleep?.sleep?.[0]?.efficiency || null,
      sleep_stages: sleep?.sleep?.[0]?.levels?.summary || null,

      // Weekly trends
      steps_weekly: steps?.['activities-steps']?.map((s: any) => ({
        date: s.dateTime,
        steps: parseInt(s.value),
      })) || [],
      sleep_weekly: sleep?.sleep?.map((s: any) => ({
        date: s.dateOfSleep,
        duration_hours: Math.round(s.duration / 3600000 * 10) / 10,
        efficiency: s.efficiency,
      })) || [],
    };

    // Generate insights from the data
    const insights: string[] = [];

    if (metrics.steps_today > 0) {
      if (metrics.steps_today >= 10000) {
        insights.push(`Great job! You've hit ${metrics.steps_today.toLocaleString()} steps today.`);
      } else if (metrics.steps_today >= 7500) {
        insights.push(`Good progress with ${metrics.steps_today.toLocaleString()} steps. ${(10000 - metrics.steps_today).toLocaleString()} more to hit 10k!`);
      } else {
        insights.push(`${metrics.steps_today.toLocaleString()} steps so far. A short walk could help you reach your goal.`);
      }
    }

    if (metrics.resting_heart_rate) {
      if (metrics.resting_heart_rate < 60) {
        insights.push(`Excellent resting heart rate of ${metrics.resting_heart_rate} bpm - sign of good cardiovascular fitness.`);
      } else if (metrics.resting_heart_rate > 80) {
        insights.push(`Resting heart rate is ${metrics.resting_heart_rate} bpm. Consider some relaxation or light cardio.`);
      }
    }

    if (metrics.sleep_duration_hours) {
      if (metrics.sleep_duration_hours < 6) {
        insights.push(`Only ${metrics.sleep_duration_hours}h of sleep last night. Prioritize rest tonight.`);
      } else if (metrics.sleep_duration_hours >= 7 && metrics.sleep_duration_hours <= 9) {
        insights.push(`Good sleep of ${metrics.sleep_duration_hours}h last night.`);
      }
    }

    // Store in behavioral_patterns table
    const { error: dbError } = await supabase
      .from('behavioral_patterns')
      .upsert({
        email,
        source: 'fitbit',
        pattern_data: {
          metrics,
          insights,
          raw: { activity, sleep, heart, steps },
        },
        sync_date: new Date().toISOString(),
      }, {
        onConflict: 'email,source',
      });

    if (dbError) {
      console.error('[Fitbit Fetch] DB error:', dbError);
    }

    // Also store in wearable_data for consistency
    await supabase
      .from('wearable_data')
      .upsert({
        user_email: email,
        provider: 'fitbit',
        data_type: 'daily_summary',
        data: metrics,
        recorded_at: new Date().toISOString(),
      }, {
        onConflict: 'user_email,provider,data_type',
      });

    console.log(`[Fitbit Fetch] Success for ${email}: ${metrics.steps_today} steps, ${metrics.sleep_duration_hours || 'N/A'}h sleep`);

    return NextResponse.json({
      success: true,
      email,
      metrics,
      insights,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Fitbit Fetch] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
