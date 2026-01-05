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
    sleep_duration_hours?: number;
    deep_sleep_minutes?: number;
    rem_sleep_minutes?: number;
    distance_meters?: number;
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

    logger.info('Health sync completed', {
      email: body.email,
      metricsUpdated: updates.length,
    });

    return NextResponse.json({
      success: true,
      message: `Synced ${updates.length} health metrics`,
      metrics: updates.map(u => u.metric),
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
