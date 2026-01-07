/**
 * Goal Progress Sync Service
 *
 * Automatically tracks goal progress by fetching current health metrics
 * from connected data sources and updating goal progress.
 *
 * Supports metrics from:
 * - Whoop: recovery_score, hrv_ms, resting_hr, strain_score
 * - Oura: sleep_score, sleep_duration_hours, deep_sleep_minutes, rem_sleep_minutes, daily_steps
 * - Dexcom: avg_glucose, time_in_range_pct, glucose_variability
 */

import { createClient } from '@supabase/supabase-js';

// Simple logger to avoid module issues
const logger = {
  info: (data: object, msg: string) => console.log(`[GoalProgressSync] ${msg}`, JSON.stringify(data)),
  warn: (data: object, msg: string) => console.warn(`[GoalProgressSync] ${msg}`, JSON.stringify(data)),
  error: (data: object, msg: string) => console.error(`[GoalProgressSync] ${msg}`, JSON.stringify(data)),
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================================================
// TYPES
// ============================================================================

interface GoalWithMetric {
  id: string;
  email: string;
  tracked_metric: string;
  target_value: number;
  baseline_value: number | null;
  current_value: number | null;
  direction: 'increase' | 'decrease' | 'maintain';
  category: string;
}

interface MetricValue {
  value: number;
  source: string;
  timestamp: string;
}

interface SyncResult {
  goalId: string;
  metric: string;
  previousValue: number | null;
  currentValue: number;
  previousProgress: number;
  newProgress: number;
  updated: boolean;
}

// ============================================================================
// METRIC FETCHERS
// ============================================================================

/**
 * Fetch current value for a specific metric
 */
async function fetchMetricValue(
  email: string,
  metric: string
): Promise<MetricValue | null> {
  switch (metric) {
    // Whoop metrics
    case 'recovery_score':
      return fetchWhoopRecoveryScore(email);
    case 'hrv_ms':
      return fetchWhoopHRV(email);
    case 'resting_hr':
      return fetchWhoopRestingHR(email);
    case 'strain_score':
      return fetchWhoopStrain(email);

    // Oura/Sleep metrics
    case 'sleep_score':
      return fetchSleepScore(email);
    case 'sleep_duration_hours':
      return fetchSleepDuration(email);
    case 'deep_sleep_minutes':
      return fetchDeepSleep(email);
    case 'rem_sleep_minutes':
      return fetchRemSleep(email);
    case 'sleep_efficiency':
      return fetchSleepEfficiency(email);

    // Activity metrics
    case 'daily_steps':
      return fetchDailySteps(email);
    case 'active_calories':
      return fetchActiveCalories(email);

    // Glucose metrics
    case 'avg_glucose':
      return fetchAvgGlucose(email);
    case 'time_in_range_pct':
      return fetchTimeInRange(email);
    case 'glucose_variability':
      return fetchGlucoseVariability(email);

    default:
      logger.warn({ metric }, 'Unknown metric type');
      return null;
  }
}

// Whoop fetchers
async function fetchWhoopRecoveryScore(email: string): Promise<MetricValue | null> {
  const { data } = await supabase
    .from('forge_training_data')
    .select('recovery_score, sync_date')
    .eq('email', email)
    .eq('provider', 'whoop')
    .order('sync_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data?.recovery_score?.avgRecoveryScore) {
    return {
      value: data.recovery_score.avgRecoveryScore,
      source: 'whoop',
      timestamp: data.sync_date,
    };
  }
  return null;
}

async function fetchWhoopHRV(email: string): Promise<MetricValue | null> {
  const { data } = await supabase
    .from('forge_training_data')
    .select('hrv_trends, sync_date')
    .eq('email', email)
    .eq('provider', 'whoop')
    .order('sync_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data?.hrv_trends?.avgHRV) {
    return {
      value: data.hrv_trends.avgHRV,
      source: 'whoop',
      timestamp: data.sync_date,
    };
  }
  return null;
}

async function fetchWhoopRestingHR(email: string): Promise<MetricValue | null> {
  const { data } = await supabase
    .from('forge_training_data')
    .select('resting_hr_trends, sync_date')
    .eq('email', email)
    .eq('provider', 'whoop')
    .order('sync_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data?.resting_hr_trends?.avg) {
    return {
      value: data.resting_hr_trends.avg,
      source: 'whoop',
      timestamp: data.sync_date,
    };
  }
  return null;
}

async function fetchWhoopStrain(email: string): Promise<MetricValue | null> {
  const { data } = await supabase
    .from('forge_training_data')
    .select('recovery_score, sync_date')
    .eq('email', email)
    .eq('provider', 'whoop')
    .order('sync_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data?.recovery_score?.avgDailyStrain) {
    return {
      value: data.recovery_score.avgDailyStrain,
      source: 'whoop',
      timestamp: data.sync_date,
    };
  }
  return null;
}

// Sleep fetchers (try Oura first, then Whoop recovery as proxy)
async function fetchSleepScore(email: string): Promise<MetricValue | null> {
  // Try Oura first
  const { data: ouraData } = await supabase
    .from('oura_daily_data')
    .select('sleep_score, date')
    .eq('user_email', email)
    .order('date', { ascending: false })
    .limit(7);

  if (ouraData && ouraData.length > 0) {
    const scores = ouraData.map(d => d.sleep_score).filter(Boolean);
    if (scores.length > 0) {
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      return {
        value: Math.round(avgScore),
        source: 'oura',
        timestamp: ouraData[0].date,
      };
    }
  }

  // Fallback: Use Whoop recovery score as sleep proxy
  // Whoop recovery is heavily influenced by sleep quality
  const recoveryValue = await fetchWhoopRecoveryScore(email);
  if (recoveryValue) {
    return {
      value: recoveryValue.value,
      source: 'whoop_recovery',
      timestamp: recoveryValue.timestamp,
    };
  }

  return null;
}

async function fetchSleepDuration(email: string): Promise<MetricValue | null> {
  const { data } = await supabase
    .from('oura_daily_data')
    .select('total_sleep_duration, date')
    .eq('user_email', email)
    .order('date', { ascending: false })
    .limit(7);

  if (data && data.length > 0) {
    const durations = data.map(d => d.total_sleep_duration).filter(Boolean);
    if (durations.length > 0) {
      // Convert seconds to hours
      const avgHours = durations.reduce((a, b) => a + b, 0) / durations.length / 3600;
      return {
        value: Math.round(avgHours * 10) / 10,
        source: 'oura',
        timestamp: data[0].date,
      };
    }
  }
  return null;
}

async function fetchDeepSleep(email: string): Promise<MetricValue | null> {
  const { data } = await supabase
    .from('oura_daily_data')
    .select('deep_sleep_duration, date')
    .eq('user_email', email)
    .order('date', { ascending: false })
    .limit(7);

  if (data && data.length > 0) {
    const durations = data.map(d => d.deep_sleep_duration).filter(Boolean);
    if (durations.length > 0) {
      const avgMinutes = durations.reduce((a, b) => a + b, 0) / durations.length / 60;
      return {
        value: Math.round(avgMinutes),
        source: 'oura',
        timestamp: data[0].date,
      };
    }
  }
  return null;
}

async function fetchRemSleep(email: string): Promise<MetricValue | null> {
  const { data } = await supabase
    .from('oura_daily_data')
    .select('rem_sleep_duration, date')
    .eq('user_email', email)
    .order('date', { ascending: false })
    .limit(7);

  if (data && data.length > 0) {
    const durations = data.map(d => d.rem_sleep_duration).filter(Boolean);
    if (durations.length > 0) {
      const avgMinutes = durations.reduce((a, b) => a + b, 0) / durations.length / 60;
      return {
        value: Math.round(avgMinutes),
        source: 'oura',
        timestamp: data[0].date,
      };
    }
  }
  return null;
}

async function fetchSleepEfficiency(email: string): Promise<MetricValue | null> {
  const { data } = await supabase
    .from('oura_daily_data')
    .select('sleep_efficiency, date')
    .eq('user_email', email)
    .order('date', { ascending: false })
    .limit(7);

  if (data && data.length > 0) {
    const efficiencies = data.map(d => d.sleep_efficiency).filter(Boolean);
    if (efficiencies.length > 0) {
      const avgEfficiency = efficiencies.reduce((a, b) => a + b, 0) / efficiencies.length;
      return {
        value: Math.round(avgEfficiency),
        source: 'oura',
        timestamp: data[0].date,
      };
    }
  }
  return null;
}

// Activity fetchers
async function fetchDailySteps(email: string): Promise<MetricValue | null> {
  const { data } = await supabase
    .from('oura_daily_data')
    .select('steps, date')
    .eq('user_email', email)
    .order('date', { ascending: false })
    .limit(7);

  if (data && data.length > 0) {
    const steps = data.map(d => d.steps).filter(Boolean);
    if (steps.length > 0) {
      const avgSteps = steps.reduce((a, b) => a + b, 0) / steps.length;
      return {
        value: Math.round(avgSteps),
        source: 'oura',
        timestamp: data[0].date,
      };
    }
  }
  return null;
}

async function fetchActiveCalories(email: string): Promise<MetricValue | null> {
  const { data } = await supabase
    .from('oura_daily_data')
    .select('active_calories, date')
    .eq('user_email', email)
    .order('date', { ascending: false })
    .limit(7);

  if (data && data.length > 0) {
    const calories = data.map(d => d.active_calories).filter(Boolean);
    if (calories.length > 0) {
      const avgCalories = calories.reduce((a, b) => a + b, 0) / calories.length;
      return {
        value: Math.round(avgCalories),
        source: 'oura',
        timestamp: data[0].date,
      };
    }
  }
  return null;
}

// Glucose fetchers
async function fetchAvgGlucose(email: string): Promise<MetricValue | null> {
  const { data } = await supabase
    .from('dexcom_data')
    .select('analysis, timestamp')
    .eq('user_email', email)
    .order('timestamp', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data?.analysis?.avgGlucose) {
    return {
      value: data.analysis.avgGlucose,
      source: 'dexcom',
      timestamp: data.timestamp,
    };
  }
  return null;
}

async function fetchTimeInRange(email: string): Promise<MetricValue | null> {
  const { data } = await supabase
    .from('dexcom_data')
    .select('analysis, timestamp')
    .eq('user_email', email)
    .order('timestamp', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data?.analysis?.timeInRange) {
    return {
      value: data.analysis.timeInRange,
      source: 'dexcom',
      timestamp: data.timestamp,
    };
  }
  return null;
}

async function fetchGlucoseVariability(email: string): Promise<MetricValue | null> {
  const { data } = await supabase
    .from('dexcom_data')
    .select('analysis, timestamp')
    .eq('user_email', email)
    .order('timestamp', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data?.analysis?.variability) {
    return {
      value: data.analysis.variability,
      source: 'dexcom',
      timestamp: data.timestamp,
    };
  }
  return null;
}

// ============================================================================
// PROGRESS CALCULATION
// ============================================================================

/**
 * Calculate progress percentage based on baseline, current, target, and direction
 */
function calculateProgress(
  baseline: number | null,
  current: number,
  target: number,
  direction: 'increase' | 'decrease' | 'maintain'
): number {
  // If no baseline, use 0 for increase goals, target for decrease goals
  const effectiveBaseline = baseline ?? (direction === 'decrease' ? target * 1.5 : 0);

  if (direction === 'increase') {
    // For increase goals: progress = (current - baseline) / (target - baseline)
    const range = target - effectiveBaseline;
    if (range <= 0) return current >= target ? 100 : 0;
    const progress = ((current - effectiveBaseline) / range) * 100;
    return Math.max(0, Math.min(100, progress));
  } else if (direction === 'decrease') {
    // For decrease goals: progress = (baseline - current) / (baseline - target)
    const range = effectiveBaseline - target;
    if (range <= 0) return current <= target ? 100 : 0;
    const progress = ((effectiveBaseline - current) / range) * 100;
    return Math.max(0, Math.min(100, progress));
  } else {
    // For maintain goals: check if within 10% of target
    const tolerance = target * 0.1;
    if (Math.abs(current - target) <= tolerance) return 100;
    return Math.max(0, 100 - (Math.abs(current - target) / target) * 100);
  }
}

// ============================================================================
// SYNC FUNCTION
// ============================================================================

/**
 * Sync progress for all active goals for a user
 */
export async function syncGoalProgress(email: string): Promise<SyncResult[]> {
  logger.info({ email }, 'Starting goal progress sync');
  const results: SyncResult[] = [];

  // Get all active goals with tracked metrics
  const { data: goals, error } = await supabase
    .from('user_health_goals')
    .select('id, email, tracked_metric, target_value, baseline_value, current_value, direction, category, progress_pct')
    .eq('email', email)
    .eq('status', 'active')
    .not('tracked_metric', 'is', null);

  if (error) {
    logger.error({ email, error }, 'Error fetching goals');
    return [];
  }

  if (!goals || goals.length === 0) {
    logger.info({ email }, 'No active goals to sync');
    return [];
  }

  logger.info({ email, goalCount: goals.length }, 'Found active goals to sync');

  // Sync each goal
  for (const goal of goals) {
    const metric = goal.tracked_metric;
    if (!metric) continue;

    // Fetch current metric value
    const metricValue = await fetchMetricValue(email, metric);

    if (!metricValue) {
      logger.warn({ email, goalId: goal.id, metric }, 'Could not fetch metric value');
      results.push({
        goalId: goal.id,
        metric,
        previousValue: goal.current_value,
        currentValue: goal.current_value || 0,
        previousProgress: goal.progress_pct || 0,
        newProgress: goal.progress_pct || 0,
        updated: false,
      });
      continue;
    }

    // Calculate new progress
    const newProgress = calculateProgress(
      goal.baseline_value,
      metricValue.value,
      goal.target_value,
      goal.direction
    );

    // Only update if value changed
    if (metricValue.value !== goal.current_value || Math.abs(newProgress - (goal.progress_pct || 0)) > 0.1) {
      const { error: updateError } = await supabase
        .from('user_health_goals')
        .update({
          current_value: metricValue.value,
          progress_pct: newProgress,
          updated_at: new Date().toISOString(),
        })
        .eq('id', goal.id);

      if (updateError) {
        logger.error({ goalId: goal.id, error: updateError }, 'Error updating goal');
      } else {
        logger.info(
          { goalId: goal.id, metric, current: metricValue.value, progress: newProgress },
          'Updated goal progress'
        );
      }

      results.push({
        goalId: goal.id,
        metric,
        previousValue: goal.current_value,
        currentValue: metricValue.value,
        previousProgress: goal.progress_pct || 0,
        newProgress,
        updated: !updateError,
      });
    } else {
      results.push({
        goalId: goal.id,
        metric,
        previousValue: goal.current_value,
        currentValue: metricValue.value,
        previousProgress: goal.progress_pct || 0,
        newProgress,
        updated: false,
      });
    }
  }

  logger.info(
    { email, synced: results.filter(r => r.updated).length, total: results.length },
    'Goal progress sync complete'
  );

  return results;
}

/**
 * Get current metric values for a user (without updating goals)
 */
export async function getCurrentMetrics(email: string): Promise<Record<string, MetricValue | null>> {
  const metrics = [
    'recovery_score',
    'hrv_ms',
    'resting_hr',
    'strain_score',
    'sleep_score',
    'sleep_duration_hours',
    'deep_sleep_minutes',
    'daily_steps',
    'avg_glucose',
    'time_in_range_pct',
  ];

  const results: Record<string, MetricValue | null> = {};

  for (const metric of metrics) {
    results[metric] = await fetchMetricValue(email, metric);
  }

  return results;
}
