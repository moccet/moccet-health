/**
 * Whoop Webhook Service
 *
 * Processes incoming Whoop webhook events and generates real-time insights.
 * Sends push notifications for significant health events.
 *
 * @module lib/services/whoop-webhook-service
 */

import { createAdminClient } from '@/lib/supabase/server';
import { getAccessToken } from '@/lib/services/token-manager';
import { sendInsightNotification } from '@/lib/services/onesignal-service';
import { createLogger } from '@/lib/utils/logger';
import {
  transformWhoopRecovery,
  transformWhoopSleep,
  transformWhoopWorkout,
  dualWriteUnifiedRecords,
  WhoopRecoveryRecord,
  WhoopSleepRecord,
  WhoopWorkoutRecord,
  UnifiedHealthRecord,
} from './unified-data';

const logger = createLogger('WhoopWebhookService');

interface WhoopWebhookEvent {
  type: string; // 'recovery.updated', 'sleep.updated', 'workout.updated', 'cycle.updated'
  user_id: number;
  id?: number; // ID of the specific record
  created_at?: string;
}

interface ProcessResult {
  data_fetched: boolean;
  insights_generated: number;
  notification_sent: boolean;
  insight_ids: string[];
}

/**
 * Debug function to fetch and return raw Whoop data using v2 API
 */
export async function fetchWhoopDataForDebug(
  email: string,
  event: WhoopWebhookEvent
): Promise<Record<string, unknown> | null> {
  try {
    const { token } = await getAccessToken(email, 'whoop');
    if (!token) return null;

    const endDate = new Date();
    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Fetch from v2 recovery endpoint
    const recoveryEndpoint = `/recovery?start=${startDate.toISOString()}&end=${endDate.toISOString()}`;

    const response = await fetch(`https://api.prod.whoop.com/developer/v2${recoveryEndpoint}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { error: `API error ${response.status}`, details: errorText, endpoint: recoveryEndpoint };
    }

    const data = await response.json();
    const records = data.records || data || [];

    const latestRecord = records[0];

    return {
      api_version: 'v2',
      endpoint: recoveryEndpoint,
      total_records: records.length,
      latest_record: latestRecord ? {
        cycle_id: latestRecord.cycle_id,
        sleep_id: latestRecord.sleep_id,
        score_state: latestRecord.score_state,
        score: latestRecord.score,
        all_keys: Object.keys(latestRecord),
      } : null,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Process an incoming Whoop webhook event
 */
export async function processWhoopWebhookEvent(
  email: string,
  event: WhoopWebhookEvent
): Promise<ProcessResult> {
  const result: ProcessResult = {
    data_fetched: false,
    insights_generated: 0,
    notification_sent: false,
    insight_ids: [],
  };

  try {
    logger.info('Processing Whoop webhook event', { email, type: event.type });

    // Get access token
    const { token, error: tokenError } = await getAccessToken(email, 'whoop');

    if (!token) {
      logger.error('Failed to get Whoop access token', { email, error: tokenError });
      return result;
    }

    // Fetch the relevant data based on event type
    const eventData = await fetchEventData(token, event);
    result.data_fetched = !!eventData;

    if (!eventData) {
      logger.warn('No data fetched for event', { email, type: event.type });
      return result;
    }

    // Dual-write to unified health data table
    await writeWhoopToUnified(email, eventData);

    // Generate insights based on the data
    const insights = await generateInsights(email, event.type, eventData);
    result.insights_generated = insights.length;
    result.insight_ids = insights.map(i => i.id);

    // Send push notification for significant insights
    if (insights.length > 0) {
      const significantInsight = insights.find(
        i => i.severity === 'high' || i.severity === 'critical' || i.severity === 'medium'
      );

      if (significantInsight) {
        const sentCount = await sendInsightNotification(email, significantInsight);
        result.notification_sent = sentCount > 0;
      }
    }

    return result;
  } catch (error) {
    logger.error('Error processing Whoop webhook', error, { email, type: event.type });
    return result;
  }
}

/**
 * Fetch the specific data related to the webhook event
 * Uses Whoop API v2 endpoints
 */
async function fetchEventData(
  accessToken: string,
  event: WhoopWebhookEvent
): Promise<Record<string, unknown> | null> {
  const baseUrl = 'https://api.prod.whoop.com/developer/v2';

  try {
    let endpoint = '';
    const eventType = event.type;

    const endDate = new Date();
    const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Last 7 days

    if (eventType === 'recovery.updated' || eventType === 'recovery.created') {
      // v2 has separate recovery endpoint
      endpoint = `/recovery?start=${startDate.toISOString()}&end=${endDate.toISOString()}`;
    } else if (eventType === 'cycle.updated' || eventType === 'cycle.created') {
      // Cycle data (strain)
      endpoint = `/cycle?start=${startDate.toISOString()}&end=${endDate.toISOString()}`;
    } else if (eventType === 'sleep.updated' || eventType === 'sleep.created') {
      // Sleep data
      endpoint = `/activity/sleep?start=${startDate.toISOString()}&end=${endDate.toISOString()}`;
    } else if (eventType === 'workout.updated' || eventType === 'workout.created') {
      // Workout data
      endpoint = `/activity/workout?start=${startDate.toISOString()}&end=${endDate.toISOString()}`;
    } else {
      logger.warn('Unknown event type', { type: eventType });
      return null;
    }

    logger.info('Fetching from Whoop v2 API', { endpoint });

    const response = await fetch(`${baseUrl}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Whoop API error', { status: response.status, error: errorText, endpoint });
      return null;
    }

    const data = await response.json();
    // Whoop API returns { records: [...] }
    const records = data.records || data || [];

    if (records.length === 0) {
      logger.info('No records returned from Whoop API', { endpoint });
      return null;
    }

    logger.info('Whoop API returned data', { endpoint, record_count: records.length });

    // Return the most recent record
    return { type: eventType, record: records[0], all_records: records };
  } catch (error) {
    logger.error('Error fetching Whoop data', error);
    return null;
  }
}

/**
 * Write Whoop data to unified health data table (dual-write)
 */
async function writeWhoopToUnified(
  email: string,
  eventData: Record<string, unknown>
): Promise<void> {
  try {
    const eventType = eventData.type as string;
    const allRecords = (eventData.all_records as unknown[]) || [];
    const unifiedRecords: UnifiedHealthRecord[] = [];

    if (eventType === 'recovery.updated' || eventType === 'recovery.created') {
      for (const record of allRecords.slice(0, 7)) { // Last 7 records
        unifiedRecords.push(
          transformWhoopRecovery(email, record as WhoopRecoveryRecord)
        );
      }
    } else if (eventType === 'sleep.updated' || eventType === 'sleep.created') {
      for (const record of allRecords.slice(0, 7)) {
        unifiedRecords.push(
          transformWhoopSleep(email, record as WhoopSleepRecord)
        );
      }
    } else if (eventType === 'workout.updated' || eventType === 'workout.created') {
      for (const record of allRecords.slice(0, 7)) {
        unifiedRecords.push(
          transformWhoopWorkout(email, record as WhoopWorkoutRecord)
        );
      }
    }

    if (unifiedRecords.length > 0) {
      const result = await dualWriteUnifiedRecords(unifiedRecords, {
        skipOnError: true,
        logPrefix: 'WhoopWebhook',
      });

      logger.debug('Whoop dual-write complete', {
        email,
        eventType,
        written: result.written,
        failed: result.failed,
      });
    }
  } catch (error) {
    // Log but don't fail the main webhook processing
    logger.warn('Whoop dual-write error', {
      email,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Generate insights based on the webhook data
 */
async function generateInsights(
  email: string,
  eventType: string,
  data: Record<string, unknown>
): Promise<Array<{
  id: string;
  title: string;
  message: string;
  insight_type: string;
  severity: string;
}>> {
  const insights: Array<{
    id: string;
    title: string;
    message: string;
    insight_type: string;
    severity: string;
  }> = [];

  const supabase = createAdminClient();
  const record = data.record as Record<string, unknown>;

  try {
    if (eventType === 'recovery.updated' || eventType === 'recovery.created') {
      const recoveryInsights = await generateRecoveryInsights(email, record, supabase);
      insights.push(...recoveryInsights);
    } else if (eventType === 'sleep.updated' || eventType === 'sleep.created') {
      const sleepInsights = await generateSleepInsights(email, record, supabase);
      insights.push(...sleepInsights);
    } else if (eventType === 'workout.updated' || eventType === 'workout.created') {
      const workoutInsights = await generateWorkoutInsights(email, record, supabase);
      insights.push(...workoutInsights);
    }

    return insights;
  } catch (error) {
    logger.error('Error generating insights', error);
    return insights;
  }
}

/**
 * Generate recovery-specific insights
 * Handles both cycle data (recovery nested) and direct recovery data
 */
async function generateRecoveryInsights(
  email: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  record: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<Array<{
  id: string;
  title: string;
  message: string;
  insight_type: string;
  severity: string;
}>> {
  const insights: Array<{
    id: string;
    title: string;
    message: string;
    insight_type: string;
    severity: string;
  }> = [];

  // v2 API: recovery record has score object with recovery_score, hrv_rmssd_milli, etc.
  // Structure: { score: { recovery_score, hrv_rmssd_milli, resting_heart_rate, ... } }
  const scoreObj = record.score || record;
  const score = scoreObj.recovery_score;
  const hrv = scoreObj.hrv_rmssd_milli;
  const restingHR = scoreObj.resting_heart_rate;

  logger.info('Parsing recovery data', { score, hrv, restingHR, raw_score_obj: scoreObj });

  if (score === undefined) return insights;

  // Get user's baseline for comparison
  const { data: baseline } = await supabase
    .from('user_health_baselines')
    .select('recovery_score_avg, hrv_avg')
    .eq('email', email)
    .single();

  const baselineRecovery = baseline?.recovery_score_avg || 65;
  const baselineHRV = baseline?.hrv_avg || 50;

  // Always generate recovery insight with optimization recommendations
  let insightToCreate = null;

  if (score <= 33) {
    // Red recovery - significant concern
    insightToCreate = {
      title: 'Low Recovery Alert',
      message: `Your recovery score is ${score}% (red zone). Your body needs rest to recover properly.`,
      insight_type: 'recovery_alert',
      severity: 'high',
      actionable_recommendation: 'Skip intense training today. Focus on light stretching, hydration (3L water), and aim for 8+ hours of sleep. Consider magnesium before bed.',
    };
  } else if (score <= 50) {
    // Yellow-low recovery
    insightToCreate = {
      title: 'Recovery Needs Attention',
      message: `Your recovery is ${score}% (yellow zone). You can train but consider moderating intensity.`,
      insight_type: 'recovery_moderate',
      severity: 'medium',
      actionable_recommendation: 'Opt for moderate intensity today (60-70% effort). Prioritize protein intake, stay hydrated, and aim for bed 30 min earlier than usual.',
    };
  } else if (score <= 66) {
    // Yellow-moderate recovery
    insightToCreate = {
      title: 'Moderate Recovery',
      message: `Recovery at ${score}%. You're in the yellow zone - balanced training is optimal today.`,
      insight_type: 'recovery_insight',
      severity: 'low',
      actionable_recommendation: 'Good day for steady-state cardio or skill work. To boost tomorrow\'s recovery: cold shower post-workout, avoid alcohol, and get quality sleep.',
    };
  } else if (score <= 84) {
    // Green-moderate recovery
    insightToCreate = {
      title: 'Good Recovery',
      message: `Nice! Recovery at ${score}% (green zone). Your body is ready for a solid training session.`,
      insight_type: 'recovery_good',
      severity: 'low',
      actionable_recommendation: 'Great day for strength training or intervals. Push yourself today. Refuel with protein within 2 hours post-workout.',
    };
  } else {
    // Excellent recovery (85+)
    insightToCreate = {
      title: 'Excellent Recovery',
      message: `Peak performance day! Recovery at ${score}%. You're fully recovered and primed for high intensity.`,
      insight_type: 'recovery_excellent',
      severity: 'low',
      actionable_recommendation: 'Ideal day for your hardest workout of the week. Go for a PR, HIIT session, or competition. Your body can handle max effort.',
    };
  }

  // Override with HRV alert if significant drop detected
  if (hrv && baselineHRV && hrv < baselineHRV * 0.8) {
    insightToCreate = {
      title: 'HRV Drop Detected',
      message: `Your HRV of ${Math.round(hrv)}ms is ${Math.round((1 - hrv/baselineHRV) * 100)}% below your baseline. This often signals stress, poor sleep, or oncoming illness.`,
      insight_type: 'hrv_alert',
      severity: 'medium',
      actionable_recommendation: 'Listen to your body today. Consider box breathing (4-4-4-4), limit caffeine, and prioritize 8+ hours of sleep. If feeling unwell, rest completely.',
    };
  }

  if (insightToCreate) {
    // Store insight in database
    const { data: insertedInsight, error } = await supabase
      .from('real_time_insights')
      .insert({
        email,
        ...insightToCreate,
        source_provider: 'whoop',
        source_data_type: 'recovery',
        context_data: { recovery_score: score, hrv, resting_hr: restingHR },
        notification_sent: false,
      })
      .select('id')
      .single();

    if (!error && insertedInsight) {
      insights.push({
        id: insertedInsight.id,
        title: insightToCreate.title,
        message: insightToCreate.message,
        insight_type: insightToCreate.insight_type,
        severity: insightToCreate.severity,
      });
    }
  }

  // Update baseline with new data
  await updateBaselines(email, { recovery_score: score, hrv }, supabase);

  return insights;
}

/**
 * Generate sleep-specific insights
 */
async function generateSleepInsights(
  email: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  record: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<Array<{
  id: string;
  title: string;
  message: string;
  insight_type: string;
  severity: string;
}>> {
  const insights: Array<{
    id: string;
    title: string;
    message: string;
    insight_type: string;
    severity: string;
  }> = [];

  const score = record.score?.sleep_performance_percentage;
  const durationMs = record.score?.total_in_bed_time_milli;
  const durationHours = durationMs ? durationMs / (1000 * 60 * 60) : null;
  const efficiency = record.score?.sleep_efficiency_percentage;

  if (!score && !durationHours) return insights;

  let insightToCreate = null;

  // Check for poor sleep
  if (score && score < 50) {
    insightToCreate = {
      title: 'Poor Sleep Quality',
      message: `Your sleep performance was ${score}%. Poor sleep affects recovery, cognitive function, and workout performance.`,
      insight_type: 'sleep_alert',
      severity: 'high',
      actionable_recommendation: 'Prioritize sleep tonight. Avoid screens before bed, keep your room cool and dark.',
    };
  } else if (durationHours && durationHours < 6) {
    insightToCreate = {
      title: 'Insufficient Sleep',
      message: `You only slept ${durationHours.toFixed(1)} hours. Most adults need 7-9 hours for optimal recovery.`,
      insight_type: 'sleep_duration',
      severity: 'medium',
      actionable_recommendation: 'Try to get to bed earlier tonight. Consider a short nap today if possible.',
    };
  } else if (efficiency && efficiency < 70) {
    insightToCreate = {
      title: 'Low Sleep Efficiency',
      message: `Your sleep efficiency was ${efficiency}%. You may be spending too much time awake in bed.`,
      insight_type: 'sleep_efficiency',
      severity: 'medium',
      actionable_recommendation: 'Avoid lying in bed awake. If you can\'t sleep after 20 minutes, get up and do something relaxing.',
    };
  } else if (score && score >= 85 && durationHours && durationHours >= 7) {
    insightToCreate = {
      title: 'Great Sleep',
      message: `Excellent sleep! Performance: ${score}%, Duration: ${durationHours.toFixed(1)} hours. You should feel refreshed.`,
      insight_type: 'sleep_positive',
      severity: 'low',
      actionable_recommendation: 'Keep up the good sleep habits. Your body and mind will thank you.',
    };
  }

  if (insightToCreate) {
    const { data: insertedInsight, error } = await supabase
      .from('real_time_insights')
      .insert({
        email,
        ...insightToCreate,
        source_provider: 'whoop',
        source_data_type: 'sleep',
        context_data: { sleep_score: score, duration_hours: durationHours, efficiency },
        notification_sent: false,
      })
      .select('id')
      .single();

    if (!error && insertedInsight) {
      insights.push({
        id: insertedInsight.id,
        title: insightToCreate.title,
        message: insightToCreate.message,
        insight_type: insightToCreate.insight_type,
        severity: insightToCreate.severity,
      });
    }
  }

  return insights;
}

/**
 * Generate workout-specific insights
 */
async function generateWorkoutInsights(
  email: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  record: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<Array<{
  id: string;
  title: string;
  message: string;
  insight_type: string;
  severity: string;
}>> {
  const insights: Array<{
    id: string;
    title: string;
    message: string;
    insight_type: string;
    severity: string;
  }> = [];

  const strain = record.score?.strain;
  const avgHR = record.score?.average_heart_rate;
  const maxHR = record.score?.max_heart_rate;
  const calories = record.score?.kilojoule ? Math.round(record.score.kilojoule * 0.239) : null; // Convert kJ to kcal

  if (!strain) return insights;

  // Get today's recovery to contextualize strain
  const { data: todayRecovery } = await supabase
    .from('whoop_webhook_events')
    .select('payload')
    .eq('email', email)
    .eq('event_type', 'recovery.updated')
    .order('received_at', { ascending: false })
    .limit(1)
    .single();

  const recoveryScore = todayRecovery?.payload?.score?.recovery_score;

  let insightToCreate = null;

  // High strain on low recovery = concern
  if (strain > 15 && recoveryScore && recoveryScore < 50) {
    insightToCreate = {
      title: 'High Strain on Low Recovery',
      message: `Your workout strain was ${strain.toFixed(1)} but your recovery was only ${recoveryScore}%. This may lead to overtraining.`,
      insight_type: 'overtraining_risk',
      severity: 'high',
      actionable_recommendation: 'Consider reducing training intensity tomorrow. Focus on active recovery and sleep.',
    };
  } else if (strain > 18) {
    // Very high strain workout
    insightToCreate = {
      title: 'Intense Workout Logged',
      message: `Great effort! You logged a strain of ${strain.toFixed(1)}${calories ? ` and burned ~${calories} calories` : ''}. Make sure to prioritize recovery.`,
      insight_type: 'workout_completed',
      severity: 'low',
      actionable_recommendation: 'Refuel with protein and carbs within 2 hours. Aim for quality sleep tonight.',
    };
  } else if (maxHR && avgHR && maxHR > avgHR * 1.4) {
    // High peak HR vs average - interval/sprint workout
    insightToCreate = {
      title: 'High-Intensity Intervals Detected',
      message: `Your workout included high-intensity intervals (max HR ${maxHR} vs avg ${avgHR}). Great for building fitness!`,
      insight_type: 'workout_analysis',
      severity: 'low',
      actionable_recommendation: 'Allow 48 hours before your next high-intensity session for optimal adaptation.',
    };
  }

  if (insightToCreate) {
    const { data: insertedInsight, error } = await supabase
      .from('real_time_insights')
      .insert({
        email,
        ...insightToCreate,
        source_provider: 'whoop',
        source_data_type: 'workout',
        context_data: { strain, avg_hr: avgHR, max_hr: maxHR, calories, recovery_score: recoveryScore },
        notification_sent: false,
      })
      .select('id')
      .single();

    if (!error && insertedInsight) {
      insights.push({
        id: insertedInsight.id,
        title: insightToCreate.title,
        message: insightToCreate.message,
        insight_type: insightToCreate.insight_type,
        severity: insightToCreate.severity,
      });
    }
  }

  return insights;
}

/**
 * Update user's health baselines with new data
 */
async function updateBaselines(
  email: string,
  data: { recovery_score?: number; hrv?: number },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
) {
  try {
    // Get existing baseline
    const { data: existing } = await supabase
      .from('user_health_baselines')
      .select('*')
      .eq('email', email)
      .single();

    if (existing) {
      // Update with weighted average (90% old, 10% new)
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

      if (data.recovery_score !== undefined) {
        updates.recovery_score_avg = existing.recovery_score_avg * 0.9 + data.recovery_score * 0.1;
      }
      if (data.hrv !== undefined) {
        updates.hrv_avg = existing.hrv_avg * 0.9 + data.hrv * 0.1;
      }

      await supabase
        .from('user_health_baselines')
        .update(updates)
        .eq('email', email);
    } else {
      // Create initial baseline
      await supabase.from('user_health_baselines').insert({
        email,
        recovery_score_avg: data.recovery_score || 65,
        hrv_avg: data.hrv || 50,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  } catch (error) {
    logger.error('Error updating baselines', error);
  }
}
