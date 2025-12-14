/**
 * Insight Trigger Service
 *
 * Analyzes health data from connected providers, compares against user baselines,
 * and generates real-time insights when significant changes are detected.
 *
 * @module lib/services/insight-trigger-service
 */

import { createClient } from '@/lib/supabase/server';
import {
  fetchOuraData,
  fetchDexcomData,
  fetchWhoopData,
  fetchGmailPatterns,
  fetchSlackPatterns,
  OuraData,
  DexcomData,
  WhoopData,
  GmailPatterns,
  SlackPatterns,
} from './ecosystem-fetcher';
import { sendInsightNotification } from './fcm-service';

// ============================================================================
// TYPES
// ============================================================================

export type InsightType =
  | 'sleep_alert'
  | 'glucose_spike'
  | 'recovery_low'
  | 'recovery_high'
  | 'activity_anomaly'
  | 'stress_indicator'
  | 'biomarker_trend'
  | 'nutrition_reminder'
  | 'workout_recommendation'
  | 'workout_completed'
  | 'calendar_conflict'
  | 'email_overload'
  | 'deep_focus_window'
  | 'energy_prediction'
  | 'sleep_improvement'
  | 'general_health';

export type InsightSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface GeneratedInsight {
  insight_type: InsightType;
  title: string;
  message: string;
  severity: InsightSeverity;
  actionable_recommendation: string;
  source_provider: string;
  source_data_type: string;
  context_data: Record<string, unknown>;
}

export interface BaselineChange {
  metric_type: string;
  current_value: number;
  baseline_value: number;
  change_pct: number;
  direction: 'increase' | 'decrease' | 'unchanged';
  is_significant: boolean;
}

// Threshold configuration for each metric type
const INSIGHT_THRESHOLDS: Record<string, { threshold_pct: number; severity: InsightSeverity }> = {
  sleep_score: { threshold_pct: 15, severity: 'high' },
  recovery_score: { threshold_pct: 20, severity: 'high' },
  hrv_ms: { threshold_pct: 20, severity: 'high' },
  resting_hr: { threshold_pct: 10, severity: 'medium' },
  daily_steps: { threshold_pct: 50, severity: 'medium' },
  avg_glucose: { threshold_pct: 15, severity: 'high' },
  time_in_range_pct: { threshold_pct: 15, severity: 'high' },
  strain_score: { threshold_pct: 25, severity: 'medium' },
};

// ============================================================================
// BASELINE FUNCTIONS
// ============================================================================

/**
 * Get or create baseline for a metric
 */
async function getBaseline(
  email: string,
  metric_type: string
): Promise<{ baseline_value: number; sample_count: number } | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('user_health_baselines')
    .select('baseline_value, sample_count')
    .eq('email', email)
    .eq('metric_type', metric_type)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

/**
 * Update baseline with new value using rolling average
 */
async function updateBaseline(
  email: string,
  metric_type: string,
  new_value: number,
  window_days: number = 14
): Promise<void> {
  const supabase = await createClient();

  const existing = await getBaseline(email, metric_type);

  if (!existing) {
    // Create new baseline
    await supabase.from('user_health_baselines').insert({
      email,
      metric_type,
      baseline_value: new_value,
      sample_count: 1,
      window_days,
    });
  } else {
    // Calculate rolling average
    const new_sample_count = Math.min(existing.sample_count + 1, window_days);
    const new_baseline =
      (existing.baseline_value * (new_sample_count - 1) + new_value) / new_sample_count;

    await supabase
      .from('user_health_baselines')
      .update({
        baseline_value: new_baseline,
        sample_count: new_sample_count,
        last_updated: new Date().toISOString(),
      })
      .eq('email', email)
      .eq('metric_type', metric_type);
  }
}

/**
 * Check if a value is significantly different from baseline
 */
async function checkSignificantChange(
  email: string,
  metric_type: string,
  new_value: number,
  custom_threshold_pct?: number
): Promise<BaselineChange> {
  const baseline = await getBaseline(email, metric_type);
  const threshold =
    custom_threshold_pct ?? INSIGHT_THRESHOLDS[metric_type]?.threshold_pct ?? 15;

  if (!baseline || baseline.sample_count < 3) {
    return {
      metric_type,
      current_value: new_value,
      baseline_value: new_value,
      change_pct: 0,
      direction: 'unchanged',
      is_significant: false,
    };
  }

  const change_pct =
    baseline.baseline_value !== 0
      ? ((new_value - baseline.baseline_value) / Math.abs(baseline.baseline_value)) * 100
      : 0;

  return {
    metric_type,
    current_value: new_value,
    baseline_value: baseline.baseline_value,
    change_pct: Math.round(change_pct * 10) / 10,
    direction: change_pct > 0 ? 'increase' : change_pct < 0 ? 'decrease' : 'unchanged',
    is_significant: Math.abs(change_pct) > threshold,
  };
}

// ============================================================================
// INSIGHT GENERATORS
// ============================================================================

/**
 * Generate sleep insights from Oura data
 */
async function generateSleepInsights(
  email: string,
  ouraData: OuraData
): Promise<GeneratedInsight[]> {
  const insights: GeneratedInsight[] = [];

  // Check sleep score
  if (ouraData.avgReadinessScore > 0) {
    const sleepChange = await checkSignificantChange(
      email,
      'sleep_score',
      ouraData.avgReadinessScore
    );
    await updateBaseline(email, 'sleep_score', ouraData.avgReadinessScore);

    if (sleepChange.is_significant && sleepChange.direction === 'decrease') {
      insights.push({
        insight_type: 'sleep_alert',
        title: 'Sleep Quality Below Your Normal',
        message: `Your readiness score of ${Math.round(ouraData.avgReadinessScore)} is ${Math.abs(Math.round(sleepChange.change_pct))}% below your usual ${Math.round(sleepChange.baseline_value)}.`,
        severity: ouraData.avgReadinessScore < 60 ? 'critical' : 'high',
        actionable_recommendation:
          ouraData.avgReadinessScore < 60
            ? 'Consider going to bed 30 minutes earlier tonight and avoiding screens before sleep.'
            : 'Try to maintain a consistent sleep schedule this week.',
        source_provider: 'oura',
        source_data_type: 'readiness',
        context_data: {
          currentValue: ouraData.avgReadinessScore,
          baselineValue: sleepChange.baseline_value,
          changePct: sleepChange.change_pct,
          sleepHours: ouraData.avgSleepHours,
        },
      });
    } else if (sleepChange.is_significant && sleepChange.direction === 'increase') {
      insights.push({
        insight_type: 'sleep_improvement',
        title: 'Excellent Sleep Last Night!',
        message: `Your readiness score of ${Math.round(ouraData.avgReadinessScore)} is ${Math.round(sleepChange.change_pct)}% above your usual ${Math.round(sleepChange.baseline_value)}!`,
        severity: 'info',
        actionable_recommendation:
          'Keep up whatever you did yesterday - your body responded well.',
        source_provider: 'oura',
        source_data_type: 'readiness',
        context_data: {
          currentValue: ouraData.avgReadinessScore,
          baselineValue: sleepChange.baseline_value,
          changePct: sleepChange.change_pct,
        },
      });
    }
  }

  // Check HRV
  if (ouraData.avgHRV > 0) {
    const hrvChange = await checkSignificantChange(email, 'hrv_ms', ouraData.avgHRV);
    await updateBaseline(email, 'hrv_ms', ouraData.avgHRV);

    if (hrvChange.is_significant && hrvChange.direction === 'decrease') {
      insights.push({
        insight_type: 'stress_indicator',
        title: 'HRV Indicates Elevated Stress',
        message: `Your HRV of ${Math.round(ouraData.avgHRV)}ms is ${Math.abs(Math.round(hrvChange.change_pct))}% below your baseline of ${Math.round(hrvChange.baseline_value)}ms.`,
        severity: 'high',
        actionable_recommendation:
          'Consider a recovery day with light activity and stress-reduction practices.',
        source_provider: 'oura',
        source_data_type: 'hrv',
        context_data: {
          currentValue: ouraData.avgHRV,
          baselineValue: hrvChange.baseline_value,
          changePct: hrvChange.change_pct,
          hrvTrend: ouraData.hrvTrend,
        },
      });
    }
  }

  // Check sleep debt
  if (ouraData.sleepDebt?.recoveryNeeded) {
    insights.push({
      insight_type: 'sleep_alert',
      title: 'Sleep Debt Accumulating',
      message: `You've accumulated ${ouraData.sleepDebt.weeklyDeficit} hours of sleep debt this week.`,
      severity: ouraData.sleepDebt.weeklyDeficit > 7 ? 'high' : 'medium',
      actionable_recommendation: `Add ${Math.ceil(ouraData.sleepDebt.weeklyDeficit / 3)} extra hours of sleep over the next few days to recover.`,
      source_provider: 'oura',
      source_data_type: 'sleep',
      context_data: {
        accumulatedDebt: ouraData.sleepDebt.accumulatedHours,
        weeklyDeficit: ouraData.sleepDebt.weeklyDeficit,
        daysToRecover: ouraData.sleepDebt.daysToRecover,
      },
    });
  }

  return insights;
}

/**
 * Generate glucose insights from Dexcom data
 */
async function generateGlucoseInsights(
  email: string,
  dexcomData: DexcomData
): Promise<GeneratedInsight[]> {
  const insights: GeneratedInsight[] = [];

  // Check average glucose
  if (dexcomData.avgGlucose > 0) {
    const glucoseChange = await checkSignificantChange(
      email,
      'avg_glucose',
      dexcomData.avgGlucose
    );
    await updateBaseline(email, 'avg_glucose', dexcomData.avgGlucose);

    // High glucose alert
    if (dexcomData.avgGlucose > 140) {
      insights.push({
        insight_type: 'glucose_spike',
        title: 'Elevated Glucose Levels',
        message: `Your average glucose of ${dexcomData.avgGlucose} mg/dL is above the optimal range (70-110 mg/dL).`,
        severity: dexcomData.avgGlucose > 180 ? 'critical' : 'high',
        actionable_recommendation:
          'Consider reducing refined carbs and adding a short walk after meals.',
        source_provider: 'dexcom',
        source_data_type: 'glucose',
        context_data: {
          avgGlucose: dexcomData.avgGlucose,
          timeInRange: dexcomData.timeInRange,
          variability: dexcomData.glucoseVariability,
        },
      });
    }

    // Spike patterns
    if (dexcomData.spikeTimes.length > 0) {
      insights.push({
        insight_type: 'glucose_spike',
        title: 'Glucose Spike Pattern Detected',
        message: `Your glucose tends to spike around ${dexcomData.spikeTimes.join(', ')}. This may be related to meal timing.`,
        severity: 'medium',
        actionable_recommendation:
          'Try pairing carbs with protein or fat during these times to blunt the spike.',
        source_provider: 'dexcom',
        source_data_type: 'glucose',
        context_data: {
          spikeTimes: dexcomData.spikeTimes,
          spikeCount: dexcomData.spikeEvents.length,
        },
      });
    }
  }

  // Time in range
  if (dexcomData.timeInRange > 0 && dexcomData.timeInRange < 70) {
    await updateBaseline(email, 'time_in_range_pct', dexcomData.timeInRange);

    insights.push({
      insight_type: 'glucose_spike',
      title: 'Time in Range Below Target',
      message: `Your glucose is in the healthy range only ${dexcomData.timeInRange}% of the time (target: 70%+).`,
      severity: dexcomData.timeInRange < 50 ? 'high' : 'medium',
      actionable_recommendation:
        'Focus on balanced meals with fiber, protein, and healthy fats.',
      source_provider: 'dexcom',
      source_data_type: 'glucose',
      context_data: {
        timeInRange: dexcomData.timeInRange,
        target: 70,
      },
    });
  }

  return insights;
}

/**
 * Generate recovery insights from Whoop data
 */
async function generateRecoveryInsights(
  email: string,
  whoopData: WhoopData
): Promise<GeneratedInsight[]> {
  const insights: GeneratedInsight[] = [];

  // Check recovery score
  if (whoopData.avgRecoveryScore > 0) {
    const recoveryChange = await checkSignificantChange(
      email,
      'recovery_score',
      whoopData.avgRecoveryScore
    );
    await updateBaseline(email, 'recovery_score', whoopData.avgRecoveryScore);

    // Low recovery (red zone < 34)
    if (whoopData.avgRecoveryScore < 34) {
      insights.push({
        insight_type: 'recovery_low',
        title: 'Recovery in Red Zone',
        message: `Your recovery score of ${Math.round(whoopData.avgRecoveryScore)}% puts you in the red zone. Your body needs rest.`,
        severity: 'high',
        actionable_recommendation:
          'Consider a light recovery day instead of intense training. Prioritize sleep tonight.',
        source_provider: 'whoop',
        source_data_type: 'recovery',
        context_data: {
          recoveryScore: whoopData.avgRecoveryScore,
          hrvAvg: whoopData.avgHRV,
          restingHR: whoopData.avgRestingHR,
        },
      });
    } else if (whoopData.avgRecoveryScore >= 67) {
      // High recovery (green zone)
      insights.push({
        insight_type: 'recovery_high',
        title: 'Recovery in Green Zone!',
        message: `Your recovery score of ${Math.round(whoopData.avgRecoveryScore)}% means you're primed for performance.`,
        severity: 'info',
        actionable_recommendation:
          'Great day for a challenging workout or intense cognitive work.',
        source_provider: 'whoop',
        source_data_type: 'recovery',
        context_data: {
          recoveryScore: whoopData.avgRecoveryScore,
          hrvAvg: whoopData.avgHRV,
        },
      });
    }

    // Significant drop from baseline
    if (recoveryChange.is_significant && recoveryChange.direction === 'decrease') {
      insights.push({
        insight_type: 'recovery_low',
        title: 'Recovery Below Your Normal',
        message: `Your recovery is ${Math.abs(Math.round(recoveryChange.change_pct))}% below your baseline of ${Math.round(recoveryChange.baseline_value)}%.`,
        severity: 'high',
        actionable_recommendation:
          'Something may be impacting your recovery. Review sleep, stress, and nutrition.',
        source_provider: 'whoop',
        source_data_type: 'recovery',
        context_data: {
          currentValue: whoopData.avgRecoveryScore,
          baselineValue: recoveryChange.baseline_value,
          changePct: recoveryChange.change_pct,
        },
      });
    }
  }

  // Strain update
  if (whoopData.avgStrainScore > 0) {
    await updateBaseline(email, 'strain_score', whoopData.avgStrainScore);
  }

  // Overtraining risk
  if (whoopData.trainingLoad?.overtrainingRisk === 'high') {
    insights.push({
      insight_type: 'activity_anomaly',
      title: 'Overtraining Risk Elevated',
      message: `Your training load exceeds your recovery capacity. Consider ${whoopData.trainingLoad.recommendedRestDays} rest day(s).`,
      severity: 'high',
      actionable_recommendation:
        'Reduce training intensity for the next few days to allow adaptation.',
      source_provider: 'whoop',
      source_data_type: 'strain',
      context_data: {
        weeklyStrain: whoopData.trainingLoad.weeklyStrain,
        overtrainingRisk: whoopData.trainingLoad.overtrainingRisk,
        recommendedRestDays: whoopData.trainingLoad.recommendedRestDays,
      },
    });
  }

  return insights;
}

/**
 * Generate calendar/email insights from Gmail patterns
 */
async function generateWorkPatternInsights(
  email: string,
  gmailData: GmailPatterns
): Promise<GeneratedInsight[]> {
  const insights: GeneratedInsight[] = [];

  // Meeting overload
  if (gmailData.meetingDensity.avgMeetingsPerDay > 6) {
    insights.push({
      insight_type: 'calendar_conflict',
      title: 'High Meeting Load Detected',
      message: `You average ${gmailData.meetingDensity.avgMeetingsPerDay} meetings per day. This may impact focus time and energy.`,
      severity: 'medium',
      actionable_recommendation:
        'Consider blocking 2 hours of focus time on your calendar each day.',
      source_provider: 'gmail',
      source_data_type: 'calendar',
      context_data: {
        avgMeetings: gmailData.meetingDensity.avgMeetingsPerDay,
        backToBackPct: gmailData.meetingDensity.backToBackPercentage,
        peakHours: gmailData.meetingDensity.peakHours,
      },
    });
  }

  // Back-to-back meetings
  if (gmailData.meetingDensity.backToBackPercentage > 50) {
    insights.push({
      insight_type: 'calendar_conflict',
      title: 'Too Many Back-to-Back Meetings',
      message: `${gmailData.meetingDensity.backToBackPercentage}% of your meetings are back-to-back, leaving no recovery time.`,
      severity: 'medium',
      actionable_recommendation:
        'Try adding 15-minute buffers between meetings for mental recovery.',
      source_provider: 'gmail',
      source_data_type: 'calendar',
      context_data: {
        backToBackPct: gmailData.meetingDensity.backToBackPercentage,
      },
    });
  }

  // After-hours email
  if (gmailData.emailVolume.afterHoursPercentage > 30) {
    insights.push({
      insight_type: 'email_overload',
      title: 'High After-Hours Email Activity',
      message: `${gmailData.emailVolume.afterHoursPercentage}% of your emails are sent outside work hours. This may impact sleep and recovery.`,
      severity: 'medium',
      actionable_recommendation:
        'Try setting a hard cutoff for email at least 2 hours before bedtime.',
      source_provider: 'gmail',
      source_data_type: 'email',
      context_data: {
        afterHoursPct: gmailData.emailVolume.afterHoursPercentage,
        avgDailyEmails: gmailData.emailVolume.avgPerDay,
      },
    });
  }

  // Stress indicators
  if (
    gmailData.stressIndicators.highEmailVolume &&
    gmailData.stressIndicators.frequentAfterHoursWork
  ) {
    insights.push({
      insight_type: 'stress_indicator',
      title: 'Work Stress Patterns Detected',
      message:
        'High email volume combined with frequent after-hours work suggests elevated work stress.',
      severity: 'high',
      actionable_recommendation:
        'This workload pattern is correlated with burnout. Consider discussing workload with your manager.',
      source_provider: 'gmail',
      source_data_type: 'work_patterns',
      context_data: {
        highEmailVolume: gmailData.stressIndicators.highEmailVolume,
        afterHoursWork: gmailData.stressIndicators.frequentAfterHoursWork,
        shortBreaks: gmailData.stressIndicators.shortMeetingBreaks,
      },
    });
  }

  // Deep focus windows
  if (gmailData.focusTime && gmailData.focusTime.focusScore === 'excellent') {
    insights.push({
      insight_type: 'deep_focus_window',
      title: 'Good Focus Time Available',
      message: `You have ${gmailData.focusTime.avgFocusBlocksPerDay} focus blocks averaging ${Math.round(gmailData.focusTime.longestFocusBlock / 60)} hours each day.`,
      severity: 'info',
      actionable_recommendation:
        'Great! Use these blocks for your most cognitively demanding work.',
      source_provider: 'gmail',
      source_data_type: 'calendar',
      context_data: {
        focusBlocks: gmailData.focusTime.avgFocusBlocksPerDay,
        longestBlock: gmailData.focusTime.longestFocusBlock,
      },
    });
  }

  return insights;
}

/**
 * Generate Slack communication insights
 */
async function generateSlackInsights(
  email: string,
  slackData: SlackPatterns
): Promise<GeneratedInsight[]> {
  const insights: GeneratedInsight[] = [];

  // Constant availability stress
  if (slackData.stressIndicators.constantAvailability) {
    insights.push({
      insight_type: 'stress_indicator',
      title: 'Always-On Communication Pattern',
      message:
        'Your Slack activity shows constant availability, which can lead to decision fatigue and burnout.',
      severity: 'medium',
      actionable_recommendation:
        'Consider setting "Do Not Disturb" hours in Slack to protect focus time.',
      source_provider: 'slack',
      source_data_type: 'messages',
      context_data: {
        constantAvailability: true,
        lateNightMessages: slackData.stressIndicators.lateNightMessages,
      },
    });
  }

  // Late night messages
  if (slackData.stressIndicators.lateNightMessages) {
    insights.push({
      insight_type: 'email_overload',
      title: 'Late Night Slack Activity',
      message:
        'Frequent late-night Slack messages may be impacting your sleep quality and recovery.',
      severity: 'medium',
      actionable_recommendation:
        'Try to finish work communication by 9pm to improve sleep onset.',
      source_provider: 'slack',
      source_data_type: 'messages',
      context_data: {
        afterHoursPct: slackData.messageVolume.afterHoursPercentage,
      },
    });
  }

  return insights;
}

// ============================================================================
// MAIN TRIGGER FUNCTIONS
// ============================================================================

/**
 * Store a generated insight in the database and send push notification
 */
async function storeInsight(email: string, insight: GeneratedInsight): Promise<string | null> {
  const supabase = await createClient();

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
    console.error('[Insight Trigger] Error storing insight:', error);
    return null;
  }

  const insightId = data?.id;

  // Send push notification via FCM
  if (insightId) {
    try {
      const sentCount = await sendInsightNotification(email, {
        id: insightId,
        title: insight.title,
        message: insight.message,
        insight_type: insight.insight_type,
        severity: insight.severity,
      });

      // Mark notification as sent if successful
      if (sentCount > 0) {
        await supabase
          .from('real_time_insights')
          .update({
            notification_sent: true,
            notification_sent_at: new Date().toISOString(),
            notification_channel: 'push',
          })
          .eq('id', insightId);
      }
    } catch (fcmError) {
      console.error('[Insight Trigger] Error sending push notification:', fcmError);
      // Don't fail the whole operation if FCM fails
    }
  }

  return insightId || null;
}

/**
 * Process all providers for a user and generate insights
 */
export async function processAllProviders(email: string): Promise<{
  insights_generated: number;
  insights: GeneratedInsight[];
  errors: string[];
}> {
  console.log(`[Insight Trigger] Processing all providers for ${email}`);

  const allInsights: GeneratedInsight[] = [];
  const errors: string[] = [];

  // Fetch data from all providers in parallel
  const [ouraResult, dexcomResult, whoopResult, gmailResult, slackResult] = await Promise.all([
    fetchOuraData(email).catch((e) => {
      errors.push(`Oura: ${e.message}`);
      return null;
    }),
    fetchDexcomData(email).catch((e) => {
      errors.push(`Dexcom: ${e.message}`);
      return null;
    }),
    fetchWhoopData(email).catch((e) => {
      errors.push(`Whoop: ${e.message}`);
      return null;
    }),
    fetchGmailPatterns(email).catch((e) => {
      errors.push(`Gmail: ${e.message}`);
      return null;
    }),
    fetchSlackPatterns(email).catch((e) => {
      errors.push(`Slack: ${e.message}`);
      return null;
    }),
  ]);

  // Generate insights from each available provider
  if (ouraResult?.available && ouraResult.data) {
    const ouraInsights = await generateSleepInsights(email, ouraResult.data as OuraData);
    allInsights.push(...ouraInsights);
  }

  if (dexcomResult?.available && dexcomResult.data) {
    const dexcomInsights = await generateGlucoseInsights(
      email,
      dexcomResult.data as DexcomData
    );
    allInsights.push(...dexcomInsights);
  }

  if (whoopResult?.available && whoopResult.data) {
    const whoopInsights = await generateRecoveryInsights(email, whoopResult.data as WhoopData);
    allInsights.push(...whoopInsights);
  }

  if (gmailResult?.available && gmailResult.data) {
    const gmailInsights = await generateWorkPatternInsights(
      email,
      gmailResult.data as GmailPatterns
    );
    allInsights.push(...gmailInsights);
  }

  if (slackResult?.available && slackResult.data) {
    const slackInsights = await generateSlackInsights(
      email,
      slackResult.data as SlackPatterns
    );
    allInsights.push(...slackInsights);
  }

  // Store all generated insights
  let stored_count = 0;
  for (const insight of allInsights) {
    const id = await storeInsight(email, insight);
    if (id) stored_count++;
  }

  console.log(
    `[Insight Trigger] Generated ${allInsights.length} insights, stored ${stored_count} for ${email}`
  );

  return {
    insights_generated: stored_count,
    insights: allInsights,
    errors,
  };
}

/**
 * Process a specific Vital webhook event
 */
export async function processVitalEvent(
  email: string,
  eventType: string,
  eventData: Record<string, unknown>
): Promise<GeneratedInsight[]> {
  console.log(`[Insight Trigger] Processing Vital event ${eventType} for ${email}`);

  const insights: GeneratedInsight[] = [];

  // Map Vital event types to data processing
  switch (eventType) {
    case 'daily.data.sleep.created': {
      const ouraResult = await fetchOuraData(email);
      if (ouraResult?.available && ouraResult.data) {
        const sleepInsights = await generateSleepInsights(email, ouraResult.data as OuraData);
        insights.push(...sleepInsights);
      }
      break;
    }

    case 'daily.data.activity.created': {
      // Activity insights
      const whoopResult = await fetchWhoopData(email);
      if (whoopResult?.available && whoopResult.data) {
        const whoopData = whoopResult.data as WhoopData;
        // Generate activity-specific insight
        if (whoopData.activityInsights?.avgDailySteps) {
          await updateBaseline(email, 'daily_steps', whoopData.activityInsights.avgDailySteps);

          if (whoopData.activityInsights.avgDailySteps < 5000) {
            insights.push({
              insight_type: 'activity_anomaly',
              title: 'Low Activity Day',
              message: `Only ${whoopData.activityInsights.avgDailySteps} steps today. Movement supports recovery and energy.`,
              severity: 'low',
              actionable_recommendation: 'Try a 10-minute walk to boost energy and metabolism.',
              source_provider: 'whoop',
              source_data_type: 'activity',
              context_data: {
                steps: whoopData.activityInsights.avgDailySteps,
              },
            });
          }
        }
      }
      break;
    }

    case 'daily.data.workout.created': {
      // Workout completion notification
      insights.push({
        insight_type: 'workout_completed',
        title: 'Workout Completed!',
        message: 'Great job completing your workout. Recovery starts now.',
        severity: 'info',
        actionable_recommendation:
          'Have protein within 30 minutes to maximize muscle repair.',
        source_provider: 'vital',
        source_data_type: 'workout',
        context_data: eventData,
      });
      break;
    }

    case 'daily.data.body.created': {
      // Body measurement insights (weight, body fat, etc.)
      // Could be expanded based on data structure
      break;
    }
  }

  // Store all insights
  for (const insight of insights) {
    await storeInsight(email, insight);
  }

  return insights;
}

/**
 * Get users with active integrations for batch processing
 */
export async function getUsersWithIntegrations(): Promise<string[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('integration_tokens')
    .select('user_email')
    .eq('is_active', true);

  if (error) {
    console.error('[Insight Trigger] Error fetching users:', error);
    return [];
  }

  // Get unique emails
  const emails = [...new Set(data?.map((row) => row.user_email).filter(Boolean) as string[])];
  return emails;
}
