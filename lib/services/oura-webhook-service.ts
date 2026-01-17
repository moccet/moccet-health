/**
 * Oura Webhook Service
 *
 * Processes incoming Oura webhook events, analyzes health data,
 * generates insights, and sends push notifications.
 *
 * @module lib/services/oura-webhook-service
 */

import { createAdminClient } from '@/lib/supabase/server';
import { sendInsightNotification } from './onesignal-service';
import { createLogger } from '@/lib/utils/logger';
import {
  transformOuraSleep,
  transformOuraReadiness,
  transformOuraActivity,
  dualWriteUnifiedRecords,
  OuraSleepRecord,
  OuraReadinessRecord,
  OuraActivityRecord,
} from './unified-data';

const logger = createLogger('OuraWebhookService');

// Oura webhook event types
type OuraDataType =
  | 'daily_sleep'
  | 'daily_activity'
  | 'daily_readiness'
  | 'daily_spo2'
  | 'sleep'
  | 'workout'
  | 'session'
  | 'tag'
  | 'daily_stress';

interface OuraWebhookPayload {
  user_id: string;
  event_type: string;
  data_type: OuraDataType;
  data?: Record<string, unknown>;
}

interface ProcessingResult {
  insights_generated: number;
  notification_sent: boolean;
  insights: GeneratedInsight[];
}

interface GeneratedInsight {
  insight_type: string;
  title: string;
  message: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  actionable_recommendation: string;
  source_provider: string;
  source_data_type: string;
  context_data: Record<string, unknown>;
}

// Thresholds for generating insights
const THRESHOLDS = {
  sleep_score: { low: 60, veryLow: 50 },
  readiness_score: { low: 60, veryLow: 50 },
  hrv_drop_percent: 20, // Alert if HRV drops more than 20%
  sleep_efficiency: { low: 75, veryLow: 65 },
  deep_sleep_minutes: { low: 30 },
  rem_sleep_minutes: { low: 60 },
  activity_score: { low: 50 },
};

/**
 * Process an incoming Oura webhook event
 */
export async function processOuraWebhookEvent(
  email: string,
  payload: OuraWebhookPayload
): Promise<ProcessingResult> {
  logger.info('Processing Oura webhook event', {
    email,
    data_type: payload.data_type,
  });

  const insights: GeneratedInsight[] = [];

  try {
    // Fetch fresh data from Oura based on the event type
    const freshData = await fetchOuraDataForEvent(email, payload.data_type);

    if (!freshData) {
      logger.warn('No fresh data available', { email, data_type: payload.data_type });
      return { insights_generated: 0, notification_sent: false, insights: [] };
    }

    // Dual-write to unified health data table
    await writeOuraToUnified(email, freshData, payload.data_type);

    // Generate insights based on data type
    switch (payload.data_type) {
      case 'daily_sleep':
      case 'sleep':
        insights.push(...generateSleepInsights(email, freshData));
        break;

      case 'daily_readiness':
        insights.push(...generateReadinessInsights(email, freshData));
        break;

      case 'daily_activity':
        insights.push(...generateActivityInsights(email, freshData));
        break;

      case 'workout':
        insights.push(...generateWorkoutInsights(email, freshData));
        break;

      case 'daily_stress':
        insights.push(...generateStressInsights(email, freshData));
        break;

      default:
        logger.info('Unhandled data type', { data_type: payload.data_type });
    }

    // Store insights and send notifications
    let notificationSent = false;
    for (const insight of insights) {
      const insightId = await storeInsight(email, insight);

      if (insightId && shouldNotify(insight)) {
        const sentCount = await sendInsightNotification(email, {
          id: insightId,
          title: insight.title,
          message: insight.message,
          insight_type: insight.insight_type,
          severity: insight.severity,
        });

        if (sentCount > 0) {
          notificationSent = true;
          await markNotificationSent(insightId);
        }
      }
    }

    // Update baselines for trend tracking
    await updateBaselines(email, freshData, payload.data_type);

    return {
      insights_generated: insights.length,
      notification_sent: notificationSent,
      insights,
    };
  } catch (error) {
    logger.error('Error processing webhook event', error, { email });
    throw error;
  }
}

/**
 * Fetch fresh Oura data based on event type
 */
async function fetchOuraDataForEvent(
  email: string,
  dataType: OuraDataType
): Promise<Record<string, unknown> | null> {
  const supabase = createAdminClient();

  // Get the most recent Oura data sync
  const { data, error } = await supabase
    .from('oura_data')
    .select('*')
    .eq('email', email)
    .order('sync_date', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    logger.warn('No Oura data found', { email, error });
    return null;
  }

  // Return relevant data based on type
  switch (dataType) {
    case 'daily_sleep':
    case 'sleep':
      return { sleep: data.sleep_data, raw: data };
    case 'daily_readiness':
      return { readiness: data.readiness_data, raw: data };
    case 'daily_activity':
      return { activity: data.activity_data, raw: data };
    case 'workout':
      return { workout: data.workout_data, raw: data };
    default:
      return data;
  }
}

/**
 * Write Oura data to unified health data table (dual-write)
 */
async function writeOuraToUnified(
  email: string,
  freshData: Record<string, unknown>,
  dataType: OuraDataType
): Promise<void> {
  try {
    const unifiedRecords = [];

    switch (dataType) {
      case 'daily_sleep':
      case 'sleep': {
        const sleepData = (freshData.sleep as OuraSleepRecord[]) || [];
        for (const record of sleepData.slice(-7)) { // Last 7 records
          unifiedRecords.push(transformOuraSleep(email, record));
        }
        break;
      }

      case 'daily_readiness': {
        const readinessData = (freshData.readiness as OuraReadinessRecord[]) || [];
        for (const record of readinessData.slice(-7)) {
          unifiedRecords.push(transformOuraReadiness(email, record));
        }
        break;
      }

      case 'daily_activity': {
        const activityData = (freshData.activity as OuraActivityRecord[]) || [];
        for (const record of activityData.slice(-7)) {
          unifiedRecords.push(transformOuraActivity(email, record));
        }
        break;
      }

      default:
        logger.debug('No unified transform for data type', { dataType });
        return;
    }

    if (unifiedRecords.length > 0) {
      const result = await dualWriteUnifiedRecords(unifiedRecords, {
        skipOnError: true,
        logPrefix: 'OuraWebhook',
      });

      logger.debug('Oura dual-write complete', {
        email,
        dataType,
        written: result.written,
        failed: result.failed,
      });
    }
  } catch (error) {
    // Log but don't fail the main webhook processing
    logger.warn('Oura dual-write error', {
      email,
      dataType,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Generate sleep-related insights
 */
function generateSleepInsights(
  email: string,
  data: Record<string, unknown>
): GeneratedInsight[] {
  const insights: GeneratedInsight[] = [];
  const sleepData = (data.sleep as unknown[]) || [];

  if (sleepData.length === 0) return insights;

  // Get most recent sleep record
  const latestSleep = sleepData[sleepData.length - 1] as Record<string, unknown>;

  const sleepScore = latestSleep.score as number;
  const efficiency = latestSleep.efficiency as number;
  const deepSleep = (latestSleep.deep_sleep_duration as number) / 60; // Convert to minutes
  const remSleep = (latestSleep.rem_sleep_duration as number) / 60;
  const totalSleep = (latestSleep.total_sleep_duration as number) / 3600; // Convert to hours

  // Critical: Very low sleep score
  if (sleepScore && sleepScore < THRESHOLDS.sleep_score.veryLow) {
    insights.push({
      insight_type: 'sleep_alert',
      title: 'Poor Sleep Quality Detected',
      message: `Your sleep score of ${sleepScore} is significantly below optimal. This may affect your energy and cognitive function today.`,
      severity: 'high',
      actionable_recommendation: 'Consider a short nap (20-30 min) if possible. Avoid caffeine after 2pm and prioritize an earlier bedtime tonight.',
      source_provider: 'oura',
      source_data_type: 'sleep',
      context_data: {
        sleep_score: sleepScore,
        efficiency,
        total_sleep_hours: totalSleep.toFixed(1),
        threshold: THRESHOLDS.sleep_score.veryLow,
      },
    });
  }
  // Warning: Low sleep score
  else if (sleepScore && sleepScore < THRESHOLDS.sleep_score.low) {
    insights.push({
      insight_type: 'sleep_warning',
      title: 'Sleep Quality Below Average',
      message: `Your sleep score of ${sleepScore} suggests room for improvement. You got ${totalSleep.toFixed(1)} hours of sleep.`,
      severity: 'medium',
      actionable_recommendation: 'Try to maintain a consistent sleep schedule. Avoid screens 1 hour before bed.',
      source_provider: 'oura',
      source_data_type: 'sleep',
      context_data: {
        sleep_score: sleepScore,
        efficiency,
        total_sleep_hours: totalSleep.toFixed(1),
      },
    });
  }

  // Low deep sleep
  if (deepSleep && deepSleep < THRESHOLDS.deep_sleep_minutes.low) {
    insights.push({
      insight_type: 'deep_sleep_low',
      title: 'Low Deep Sleep',
      message: `Only ${Math.round(deepSleep)} minutes of deep sleep last night. Deep sleep is crucial for physical recovery.`,
      severity: 'medium',
      actionable_recommendation: 'Keep your bedroom cool (65-68°F), avoid alcohol before bed, and consider magnesium supplementation.',
      source_provider: 'oura',
      source_data_type: 'sleep',
      context_data: {
        deep_sleep_minutes: Math.round(deepSleep),
        threshold: THRESHOLDS.deep_sleep_minutes.low,
      },
    });
  }

  // Low REM sleep
  if (remSleep && remSleep < THRESHOLDS.rem_sleep_minutes.low) {
    insights.push({
      insight_type: 'rem_sleep_low',
      title: 'Low REM Sleep',
      message: `Only ${Math.round(remSleep)} minutes of REM sleep. REM is important for cognitive function and memory consolidation.`,
      severity: 'low',
      actionable_recommendation: 'Avoid alcohol and maintain consistent wake times to improve REM sleep.',
      source_provider: 'oura',
      source_data_type: 'sleep',
      context_data: {
        rem_sleep_minutes: Math.round(remSleep),
        threshold: THRESHOLDS.rem_sleep_minutes.low,
      },
    });
  }

  // Good sleep - positive reinforcement
  if (sleepScore && sleepScore >= 85) {
    insights.push({
      insight_type: 'sleep_optimal',
      title: 'Excellent Sleep!',
      message: `Great job! Your sleep score of ${sleepScore} indicates quality rest. You're set up for a productive day.`,
      severity: 'info',
      actionable_recommendation: 'Keep up your current sleep routine. Consider noting what worked well.',
      source_provider: 'oura',
      source_data_type: 'sleep',
      context_data: {
        sleep_score: sleepScore,
        total_sleep_hours: totalSleep.toFixed(1),
      },
    });
  }

  return insights;
}

/**
 * Generate readiness-related insights
 */
function generateReadinessInsights(
  email: string,
  data: Record<string, unknown>
): GeneratedInsight[] {
  const insights: GeneratedInsight[] = [];
  const readinessData = (data.readiness as unknown[]) || [];

  if (readinessData.length === 0) return insights;

  const latestReadiness = readinessData[readinessData.length - 1] as Record<string, unknown>;
  const readinessScore = latestReadiness.score as number;
  const hrvBalance = latestReadiness.contributors?.hrv_balance as number;

  // Critical: Very low readiness
  if (readinessScore && readinessScore < THRESHOLDS.readiness_score.veryLow) {
    insights.push({
      insight_type: 'readiness_critical',
      title: 'Recovery Needed',
      message: `Your readiness score of ${readinessScore} indicates your body needs recovery. Consider taking it easy today.`,
      severity: 'high',
      actionable_recommendation: 'Prioritize rest today. Light stretching or a short walk is fine, but avoid intense exercise.',
      source_provider: 'oura',
      source_data_type: 'readiness',
      context_data: {
        readiness_score: readinessScore,
        hrv_balance: hrvBalance,
      },
    });
  }
  // Warning: Low readiness
  else if (readinessScore && readinessScore < THRESHOLDS.readiness_score.low) {
    insights.push({
      insight_type: 'readiness_low',
      title: 'Below Average Readiness',
      message: `Readiness score of ${readinessScore}. Your body may not be fully recovered.`,
      severity: 'medium',
      actionable_recommendation: 'Consider a lighter workout today or focus on recovery activities like yoga or stretching.',
      source_provider: 'oura',
      source_data_type: 'readiness',
      context_data: {
        readiness_score: readinessScore,
      },
    });
  }

  // Optimal readiness
  if (readinessScore && readinessScore >= 85) {
    insights.push({
      insight_type: 'readiness_optimal',
      title: 'High Readiness!',
      message: `Readiness score of ${readinessScore} - you're primed for peak performance today.`,
      severity: 'info',
      actionable_recommendation: 'Great day for challenging workouts or important tasks requiring focus.',
      source_provider: 'oura',
      source_data_type: 'readiness',
      context_data: {
        readiness_score: readinessScore,
      },
    });
  }

  return insights;
}

/**
 * Generate activity-related insights
 */
function generateActivityInsights(
  email: string,
  data: Record<string, unknown>
): GeneratedInsight[] {
  const insights: GeneratedInsight[] = [];
  const activityData = (data.activity as unknown[]) || [];

  if (activityData.length === 0) return insights;

  const latestActivity = activityData[activityData.length - 1] as Record<string, unknown>;
  const activityScore = latestActivity.score as number;
  const steps = latestActivity.steps as number;
  const activeCalories = latestActivity.active_calories as number;
  const inactivityAlerts = latestActivity.inactivity_alerts as number;

  // Low activity warning
  if (activityScore && activityScore < THRESHOLDS.activity_score.low) {
    insights.push({
      insight_type: 'activity_low',
      title: 'Low Activity Day',
      message: `Activity score of ${activityScore}. You've been less active than usual.`,
      severity: 'low',
      actionable_recommendation: 'Try a 10-minute walk or some light stretching to boost your activity level.',
      source_provider: 'oura',
      source_data_type: 'activity',
      context_data: {
        activity_score: activityScore,
        steps,
        active_calories: activeCalories,
      },
    });
  }

  // High inactivity alerts
  if (inactivityAlerts && inactivityAlerts >= 3) {
    insights.push({
      insight_type: 'inactivity_alert',
      title: 'Time to Move!',
      message: `You've had ${inactivityAlerts} inactivity alerts today. Regular movement is important for health.`,
      severity: 'low',
      actionable_recommendation: 'Set a timer to stand and stretch every 45-60 minutes.',
      source_provider: 'oura',
      source_data_type: 'activity',
      context_data: {
        inactivity_alerts: inactivityAlerts,
      },
    });
  }

  return insights;
}

/**
 * Generate workout-related insights
 */
function generateWorkoutInsights(
  email: string,
  data: Record<string, unknown>
): GeneratedInsight[] {
  const insights: GeneratedInsight[] = [];
  const workoutData = (data.workout as unknown[]) || [];

  if (workoutData.length === 0) return insights;

  const latestWorkout = workoutData[workoutData.length - 1] as Record<string, unknown>;
  const activityType = latestWorkout.activity as string;
  const calories = latestWorkout.calories as number;
  const duration = (latestWorkout.duration as number) / 60; // Convert to minutes

  insights.push({
    insight_type: 'workout_completed',
    title: 'Workout Complete!',
    message: `Great ${activityType || 'workout'}! ${Math.round(duration)} minutes, ${calories || 0} calories burned.`,
    severity: 'info',
    actionable_recommendation: 'Have protein within 30-60 minutes to maximize recovery.',
    source_provider: 'oura',
    source_data_type: 'workout',
    context_data: {
      activity_type: activityType,
      duration_minutes: Math.round(duration),
      calories,
    },
  });

  return insights;
}

/**
 * Generate stress-related insights
 */
function generateStressInsights(
  email: string,
  data: Record<string, unknown>
): GeneratedInsight[] {
  const insights: GeneratedInsight[] = [];
  // Oura stress data processing would go here
  // This is a newer Oura feature
  return insights;
}

/**
 * Store insight in database
 */
async function storeInsight(
  email: string,
  insight: GeneratedInsight
): Promise<string | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('real_time_insights')
    .insert({
      email,
      insight_type: insight.insight_type,
      title: insight.title,
      message: insight.message,
      severity: insight.severity,
      actionable_recommendation: insight.actionable_recommendation,
      source_provider: insight.source_provider,
      source_data_type: insight.source_data_type,
      context_data: insight.context_data,
      notification_sent: false,
    })
    .select('id')
    .single();

  if (error) {
    logger.error('Error storing insight', error, { email, insight_type: insight.insight_type });
    return null;
  }

  return data?.id || null;
}

/**
 * Determine if an insight should trigger a notification
 */
function shouldNotify(insight: GeneratedInsight): boolean {
  // Only notify for medium, high, and critical severity
  // Info level is stored but not pushed
  return ['medium', 'high', 'critical'].includes(insight.severity);
}

/**
 * Mark notification as sent in database
 */
async function markNotificationSent(insightId: string): Promise<void> {
  const supabase = createAdminClient();

  await supabase
    .from('real_time_insights')
    .update({
      notification_sent: true,
      notification_sent_at: new Date().toISOString(),
      notification_channel: 'push',
    })
    .eq('id', insightId);
}

/**
 * Update user baselines for trend tracking
 */
async function updateBaselines(
  email: string,
  data: Record<string, unknown>,
  dataType: OuraDataType
): Promise<void> {
  const supabase = createAdminClient();

  const baselines: { metric: string; value: number }[] = [];

  if (dataType === 'daily_sleep' || dataType === 'sleep') {
    const sleepData = (data.sleep as unknown[]) || [];
    if (sleepData.length > 0) {
      const latest = sleepData[sleepData.length - 1] as Record<string, unknown>;
      if (latest.score) baselines.push({ metric: 'sleep_score', value: latest.score as number });
      if (latest.efficiency) baselines.push({ metric: 'sleep_efficiency', value: latest.efficiency as number });
    }
  }

  if (dataType === 'daily_readiness') {
    const readinessData = (data.readiness as unknown[]) || [];
    if (readinessData.length > 0) {
      const latest = readinessData[readinessData.length - 1] as Record<string, unknown>;
      if (latest.score) baselines.push({ metric: 'readiness_score', value: latest.score as number });
    }
  }

  // Upsert baselines
  for (const baseline of baselines) {
    await supabase.from('user_health_baselines').upsert({
      email,
      metric_name: baseline.metric,
      baseline_value: baseline.value,
      sample_count: 1, // Will be incremented by trigger
      last_updated: new Date().toISOString(),
    }, {
      onConflict: 'email,metric_name',
    });
  }
}
