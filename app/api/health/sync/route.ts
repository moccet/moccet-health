/**
 * Health Data Sync API
 *
 * Receives health data from mobile app (Apple Health, Google Fit)
 * and syncs to user_health_baselines + updates goal progress.
 *
 * POST /api/health/sync
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createLogger } from '@/lib/utils/logger';
import { sendPushNotification } from '@/lib/services/onesignal-service';

const logger = createLogger('HealthSyncAPI');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface HealthSyncPayload {
  email: string;
  source: 'apple_health' | 'google_fit';
  metrics: {
    daily_steps?: number;
    avg_steps?: number;
    total_steps?: number;
    active_calories?: number;
    avg_active_minutes?: number;
    total_active_minutes?: number;
    heart_rate?: number;
    resting_hr?: number;
    hrv?: number;
    sleep_duration_hours?: number;
    deep_sleep_minutes?: number;
    rem_sleep_minutes?: number;
    distance_meters?: number;
    flights_climbed?: number;
    mindfulness_minutes?: number;
  };
  workouts?: Array<{
    type: string;
    duration: number;
    calories: number;
    distance: number;
    date: string;
  }>;
  deviceContext?: {
    timezone: string;
    timezoneOffset: number;
    localTime: string;
    utcTime: string;
    platform: string;
    locale: string;
  };
  periodDays?: number;
  syncedAt?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: HealthSyncPayload = await request.json();

    if (!body.email || !body.source || !body.metrics) {
      return NextResponse.json(
        { error: 'email, source, and metrics are required' },
        { status: 400 }
      );
    }

    logger.info('Health data sync received', {
      email: body.email,
      source: body.source,
      metricsCount: Object.keys(body.metrics).length,
    });

    // Update baselines for each metric
    const updates: { metric: string; value: number }[] = [];

    for (const [metric, value] of Object.entries(body.metrics)) {
      if (value !== undefined && value !== null) {
        updates.push({ metric, value: value as number });
      }
    }

    // Upsert each baseline
    for (const { metric, value } of updates) {
      const { error } = await supabase
        .from('user_health_baselines')
        .upsert(
          {
            email: body.email,
            metric_type: metric,
            baseline_value: value,
            last_updated: new Date().toISOString(),
            sample_count: 1,
            window_days: body.periodDays || 7,
          },
          {
            onConflict: 'email,metric_type',
          }
        );

      if (error) {
        logger.warn('Error upserting baseline', { metric, error: error.message });
      }
    }

    // Update goals that track these metrics
    await updateGoalProgress(body.email, body.metrics);

    // Check for real-time health achievements
    const achievementsEarned = await checkHealthAchievements(body.email, body.metrics);

    // Store workouts if provided
    let workoutsStored = 0;
    if (body.workouts && body.workouts.length > 0) {
      for (const workout of body.workouts) {
        const { error } = await supabase
          .from('user_workouts')
          .upsert({
            email: body.email,
            workout_type: workout.type,
            duration_minutes: workout.duration,
            calories_burned: workout.calories,
            distance_meters: workout.distance,
            workout_date: workout.date,
            source: body.source,
            synced_at: new Date().toISOString(),
          }, { onConflict: 'email,workout_date,workout_type' });

        if (!error) workoutsStored++;
      }
      logger.info('Workouts stored', { email: body.email, count: workoutsStored });
    }

    // Store device context and detect travel
    let travelDetected = false;
    if (body.deviceContext) {
      const { data: previousContext } = await supabase
        .from('user_device_context')
        .select('timezone, timezone_offset')
        .eq('email', body.email)
        .order('synced_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Detect timezone change (potential travel)
      if (previousContext && previousContext.timezone !== body.deviceContext.timezone) {
        travelDetected = true;
        logger.info('Travel detected via timezone change', {
          email: body.email,
          from: previousContext.timezone,
          to: body.deviceContext.timezone,
        });
      }

      // Store current device context
      await supabase.from('user_device_context').insert({
        email: body.email,
        timezone: body.deviceContext.timezone,
        timezone_offset: body.deviceContext.timezoneOffset,
        local_time: body.deviceContext.localTime,
        platform: body.deviceContext.platform,
        locale: body.deviceContext.locale,
        travel_detected: travelDetected,
        synced_at: new Date().toISOString(),
      });
    }

    logger.info('Health sync completed', {
      email: body.email,
      metricsUpdated: updates.length,
      workoutsStored,
      travelDetected,
      achievementsEarned: achievementsEarned.length,
    });

    return NextResponse.json({
      success: true,
      message: `Synced ${updates.length} health metrics`,
      metrics: updates.map(u => u.metric),
      workoutsStored,
      travelDetected,
      achievementsEarned,
    });
  } catch (error) {
    logger.error('Health sync failed', { error });
    return NextResponse.json(
      {
        error: 'Sync failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Update goal progress based on synced metrics
 */
async function updateGoalProgress(
  email: string,
  metrics: HealthSyncPayload['metrics']
): Promise<void> {
  try {
    // Get active goals for this user
    const { data: goals, error } = await supabase
      .from('user_health_goals')
      .select('id, tracked_metric, target_value, direction')
      .eq('email', email)
      .eq('status', 'active')
      .not('tracked_metric', 'is', null);

    if (error || !goals) {
      logger.warn('Could not fetch goals for progress update', { error });
      return;
    }

    // Map tracked metrics to our metric names
    const metricMapping: Record<string, keyof typeof metrics> = {
      'daily_steps': 'daily_steps',
      'avg_steps': 'avg_steps',
      'active_calories': 'active_calories',
      'resting_hr': 'resting_hr',
      'sleep_duration_hours': 'sleep_duration_hours',
      'deep_sleep_minutes': 'deep_sleep_minutes',
      'rem_sleep_minutes': 'rem_sleep_minutes',
    };

    for (const goal of goals) {
      const metricKey = metricMapping[goal.tracked_metric];
      if (!metricKey) continue;

      const currentValue = metrics[metricKey];
      if (currentValue === undefined) continue;

      // Use the compute_goal_progress function
      const { error: updateError } = await supabase.rpc('compute_goal_progress', {
        p_goal_id: goal.id,
        p_new_current_value: currentValue,
      });

      if (updateError) {
        logger.warn('Error updating goal progress', {
          goalId: goal.id,
          error: updateError.message,
        });
      } else {
        logger.info('Updated goal progress', {
          goalId: goal.id,
          metric: goal.tracked_metric,
          currentValue,
        });
      }
    }
  } catch (e) {
    logger.error('Error updating goal progress', { error: e });
  }
}

/**
 * GET /api/health/sync
 * Get current synced health data for a user
 */
// Health achievement definitions (real-time checks)
const REAL_TIME_ACHIEVEMENTS = {
  steps_5k: { title: 'First 5K Steps', emoji: '👟', description: 'Walked 5,000 steps in a day', threshold: 5000 },
  steps_10k: { title: '10K Steps Day', emoji: '🚶', description: 'Hit 10,000 steps in a day', threshold: 10000 },
  steps_15k: { title: 'Step Master', emoji: '🏃', description: 'Crushed 15,000 steps in a day', threshold: 15000 },
  steps_20k: { title: 'Marathon Walker', emoji: '🏅', description: 'Epic 20,000 steps in a day', threshold: 20000 },
  sleep_7hrs: { title: 'Good Night', emoji: '😴', description: 'Got 7+ hours of sleep', threshold: 7 },
  recovery_80: { title: 'Well Recovered', emoji: '💚', description: 'Achieved 80+ recovery score', threshold: 80 },
  recovery_90: { title: 'Peak Recovery', emoji: '🎯', description: 'Achieved 90+ recovery score', threshold: 90 },
};

/**
 * Check and grant real-time health achievements based on synced metrics
 */
async function checkHealthAchievements(
  email: string,
  metrics: HealthSyncPayload['metrics']
): Promise<Array<{ type: string; title: string; emoji: string }>> {
  const earned: Array<{ type: string; title: string; emoji: string }> = [];

  try {
    // Get user's existing achievements
    const { data: existing } = await supabase
      .from('health_achievements')
      .select('achievement_type')
      .eq('user_email', email);

    const alreadyEarned = new Set(existing?.map(a => a.achievement_type) || []);

    // Check step achievements
    const steps = metrics.daily_steps || metrics.avg_steps || 0;
    for (const [type, def] of Object.entries(REAL_TIME_ACHIEVEMENTS)) {
      if (type.startsWith('steps_') && steps >= def.threshold && !alreadyEarned.has(type)) {
        const result = await grantAchievement(email, type, def);
        if (result.success) {
          earned.push({ type, title: def.title, emoji: def.emoji });
        }
      }
    }

    // Check sleep achievement
    const sleepHours = metrics.sleep_duration_hours || 0;
    if (sleepHours >= 7 && !alreadyEarned.has('sleep_7hrs')) {
      const def = REAL_TIME_ACHIEVEMENTS.sleep_7hrs;
      const result = await grantAchievement(email, 'sleep_7hrs', def);
      if (result.success) {
        earned.push({ type: 'sleep_7hrs', title: def.title, emoji: def.emoji });
      }
    }

    // Check recovery achievements (if we have HRV data, estimate recovery)
    // This is a simplified check - real recovery scores come from wearables
    const hrv = metrics.hrv || 0;
    const restingHr = metrics.resting_hr || 0;

    // Simple recovery score estimation based on HRV (higher = better)
    // Real recovery would come from Oura/Whoop directly
    if (hrv > 0) {
      // Higher HRV generally indicates better recovery
      // Average adult HRV is 20-100ms, optimal often 50-100ms
      const estimatedRecovery = Math.min(100, Math.round((hrv / 80) * 100));

      if (estimatedRecovery >= 80 && !alreadyEarned.has('recovery_80')) {
        const def = REAL_TIME_ACHIEVEMENTS.recovery_80;
        const result = await grantAchievement(email, 'recovery_80', def);
        if (result.success) {
          earned.push({ type: 'recovery_80', title: def.title, emoji: def.emoji });
        }
      }
      if (estimatedRecovery >= 90 && !alreadyEarned.has('recovery_90')) {
        const def = REAL_TIME_ACHIEVEMENTS.recovery_90;
        const result = await grantAchievement(email, 'recovery_90', def);
        if (result.success) {
          earned.push({ type: 'recovery_90', title: def.title, emoji: def.emoji });
        }
      }
    }

    if (earned.length > 0) {
      logger.info('Real-time achievements earned', { email, achievements: earned.map(e => e.type) });
    }
  } catch (e) {
    logger.error('Error checking health achievements', { error: e });
  }

  return earned;
}

/**
 * Grant achievement and notify user
 */
async function grantAchievement(
  email: string,
  type: string,
  def: { title: string; emoji: string; description: string }
): Promise<{ success: boolean }> {
  try {
    // Insert achievement (trigger will auto-generate feed items for friends)
    const { error } = await supabase.from('health_achievements').insert({
      user_email: email,
      achievement_type: type,
      title: def.title,
      description: def.description,
      emoji: def.emoji,
      earned_at: new Date().toISOString(),
    });

    if (error) {
      // Likely duplicate, that's fine
      if (error.code !== '23505') {
        logger.warn('Error granting achievement', { type, error: error.message });
      }
      return { success: false };
    }

    // Send push notification
    await sendPushNotification(email, {
      title: `Achievement Unlocked! ${def.emoji}`,
      body: def.title,
      data: {
        type: 'achievement',
        achievement_type: type,
      },
    });

    return { success: true };
  } catch (e) {
    logger.error('Error granting achievement', { error: e });
    return { success: false };
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'email is required' },
        { status: 400 }
      );
    }

    // Get all baselines for user
    const { data: baselines, error } = await supabase
      .from('user_health_baselines')
      .select('metric_type, baseline_value, last_updated, window_days')
      .eq('email', email)
      .order('last_updated', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch health data' },
        { status: 500 }
      );
    }

    // Transform to a more usable format
    const metrics: Record<string, { value: number; lastUpdated: string; windowDays: number }> = {};
    for (const b of baselines || []) {
      metrics[b.metric_type] = {
        value: b.baseline_value,
        lastUpdated: b.last_updated,
        windowDays: b.window_days,
      };
    }

    return NextResponse.json({
      success: true,
      email,
      metrics,
      count: Object.keys(metrics).length,
    });
  } catch (error) {
    logger.error('Error fetching health data', { error });
    return NextResponse.json(
      { error: 'Failed to fetch health data' },
      { status: 500 }
    );
  }
}
