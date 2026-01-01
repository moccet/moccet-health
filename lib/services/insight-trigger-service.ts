/**
 * Insight Trigger Service
 *
 * Analyzes health data from connected providers, compares against user baselines,
 * and generates real-time insights when significant changes are detected.
 *
 * @module lib/services/insight-trigger-service
 */

import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';
import {
  fetchOuraData,
  fetchDexcomData,
  fetchWhoopData,
  fetchGmailPatterns,
  fetchSlackPatterns,
  fetchSpotifyData,
  OuraData,
  DexcomData,
  WhoopData,
  GmailPatterns,
  SlackPatterns,
  SpotifyData,
} from './ecosystem-fetcher';
import { sendInsightNotification } from './onesignal-service';
import { getUserContext, UserContext, getUserSubscriptionTier } from './user-context-service';
import { getCompactedHistory, formatHistoryForPrompt } from './conversation-compactor';
import { formatSentimentForPrompt } from './content-sentiment-analyzer';
import { createLogger } from '@/lib/utils/logger';

const openai = new OpenAI();
const logger = createLogger('InsightTriggerService');

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
  | 'general_health'
  | 'mood_indicator'
  | 'communication_pattern'
  // Cross-source correlation types
  | 'cross_source_correlation'
  | 'work_sleep_impact'
  | 'stress_recovery_pattern'
  | 'lifestyle_health_connection'
  | 'exercise_sleep_benefit'
  // Weekly analysis types
  | 'weekly_summary'
  | 'weekly_sleep_trend'
  | 'weekly_activity_trend'
  | 'weekly_stress_trend'
  | 'weekly_recovery_trend'
  | 'weekly_glucose_trend'
  | 'weekly_work_life_balance'
  | 'weekly_improvement'
  | 'weekly_decline';

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

/**
 * Combined data from all connectors for cross-source analysis
 */
interface AllConnectorData {
  oura: OuraData | null;
  dexcom: DexcomData | null;
  whoop: WhoopData | null;
  gmail: GmailPatterns | null;
  slack: SlackPatterns | null;
  spotify: SpotifyData | null;
}

/**
 * Weekly metrics for trend analysis
 */
interface WeeklyMetrics {
  weekStart: Date;
  weekEnd: Date;
  // Sleep metrics
  avgSleepHours: number | null;
  avgSleepScore: number | null;
  avgHRV: number | null;
  sleepConsistency: number | null; // 0-100 how consistent bedtime/wake time
  // Activity metrics
  avgDailySteps: number | null;
  totalWorkouts: number | null;
  avgStrainScore: number | null;
  activeDays: number; // days with significant activity
  // Recovery metrics
  avgRecoveryScore: number | null;
  lowRecoveryDays: number; // days < 34%
  highRecoveryDays: number; // days > 67%
  // Stress metrics
  avgRestingHR: number | null;
  workStressScore: number | null; // derived from email/slack patterns
  afterHoursWorkDays: number;
  // Glucose metrics (if available)
  avgGlucose: number | null;
  timeInRange: number | null;
  spikeDays: number;
  // Work-life balance
  avgMeetingsPerDay: number | null;
  focusTimeHours: number | null;
  afterHoursEmailPct: number | null;
}

/**
 * Week-over-week comparison result
 */
interface WeekComparison {
  metric: string;
  currentValue: number;
  previousValue: number;
  changePercent: number;
  trend: 'improving' | 'declining' | 'stable';
  isSignificant: boolean;
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

/**
 * Generate Spotify mood insights from listening patterns
 */
async function generateSpotifyInsights(
  email: string,
  spotifyData: SpotifyData
): Promise<GeneratedInsight[]> {
  const insights: GeneratedInsight[] = [];

  // Low valence (sad/melancholy music)
  if (spotifyData.avgValence < 0.3) {
    insights.push({
      insight_type: 'mood_indicator',
      title: 'Music Reflects Lower Mood',
      message: `Your recent music choices show a preference for melancholy tracks (valence ${Math.round(spotifyData.avgValence * 100)}%). Music both reflects and influences emotional state.`,
      severity: 'medium',
      actionable_recommendation:
        'Consider creating a playlist with more uplifting music to positively influence mood.',
      source_provider: 'spotify',
      source_data_type: 'listening_history',
      context_data: {
        avgValence: spotifyData.avgValence,
        avgEnergy: spotifyData.avgEnergy,
        inferredMood: spotifyData.inferredMood,
        moodConfidence: spotifyData.moodConfidence,
      },
    });
  }

  // High emotional volatility
  if (spotifyData.emotionalVolatility === 'high') {
    insights.push({
      insight_type: 'mood_indicator',
      title: 'Varied Emotional Music Choices',
      message:
        'Your music selections show high emotional variability — this may reflect mood fluctuations or diverse listening contexts.',
      severity: 'low',
      actionable_recommendation:
        'If you notice mood swings, consider journaling alongside your music listening patterns.',
      source_provider: 'spotify',
      source_data_type: 'audio_features',
      context_data: {
        emotionalVolatility: spotifyData.emotionalVolatility,
        avgValence: spotifyData.avgValence,
      },
    });
  }

  // Late night listening
  if (spotifyData.lateNightListening) {
    insights.push({
      insight_type: 'sleep_alert',
      title: 'Late Night Music Activity',
      message:
        'Significant listening activity detected after 11pm — this may indicate difficulty sleeping or late-night stress.',
      severity: 'low',
      actionable_recommendation:
        'Try calming music 30 minutes before bed, then silence for optimal sleep onset.',
      source_provider: 'spotify',
      source_data_type: 'listening_history',
      context_data: {
        lateNightListening: true,
        listeningHours: spotifyData.listeningHours,
      },
    });
  }

  // Anxious mood (low valence + high energy)
  if (spotifyData.inferredMood === 'anxious' && spotifyData.moodConfidence > 0.6) {
    insights.push({
      insight_type: 'stress_indicator',
      title: 'Music Suggests Anxious State',
      message:
        'Your recent music has high energy but low positivity — a pattern often associated with stress or anxiety.',
      severity: 'medium',
      actionable_recommendation:
        'Consider trying calming ambient music or guided meditation tracks.',
      source_provider: 'spotify',
      source_data_type: 'audio_features',
      context_data: {
        inferredMood: spotifyData.inferredMood,
        avgEnergy: spotifyData.avgEnergy,
        avgValence: spotifyData.avgValence,
      },
    });
  }

  return insights;
}

/**
 * Generate cross-source insights by analyzing correlations between multiple data sources
 * This is the key function that provides unified context across all connectors
 */
async function generateCrossSourceInsights(
  email: string,
  data: AllConnectorData
): Promise<GeneratedInsight[]> {
  const insights: GeneratedInsight[] = [];

  // =========================================================================
  // Pattern 1: Work stress → Sleep impact (Gmail/Slack + Oura)
  // =========================================================================
  if (data.gmail && data.oura) {
    const hasAfterHoursWork = data.gmail.stressIndicators?.frequentAfterHoursWork;
    const hasHighMeetingLoad = data.gmail.meetingDensity?.avgMeetingsPerDay > 6;
    const poorSleep = data.oura.avgReadinessScore < 70;

    if ((hasAfterHoursWork || hasHighMeetingLoad) && poorSleep) {
      insights.push({
        insight_type: 'work_sleep_impact',
        title: 'Work Patterns Affecting Your Sleep',
        message: `Your ${hasAfterHoursWork ? 'after-hours work activity' : 'high meeting load'} appears to correlate with reduced sleep quality. Your readiness score of ${Math.round(data.oura.avgReadinessScore)} is below optimal.`,
        severity: data.oura.avgReadinessScore < 60 ? 'high' : 'medium',
        actionable_recommendation: hasAfterHoursWork
          ? 'Try setting a hard work cutoff 2 hours before bedtime. Your body needs time to wind down.'
          : 'Consider blocking focus time and reducing meeting density to protect your recovery.',
        source_provider: 'cross_source',
        source_data_type: 'work_sleep_correlation',
        context_data: {
          sources: ['gmail', 'oura'],
          afterHoursWork: hasAfterHoursWork,
          meetingsPerDay: data.gmail.meetingDensity?.avgMeetingsPerDay,
          readinessScore: data.oura.avgReadinessScore,
          sleepHours: data.oura.avgSleepHours,
          afterHoursEmailPct: data.gmail.emailVolume?.afterHoursPercentage,
        },
      });
    }
  }

  // Slack + Oura correlation
  if (data.slack && data.oura) {
    const lateSlack = data.slack.stressIndicators?.lateNightMessages;
    const poorSleep = data.oura.avgReadinessScore < 70;

    if (lateSlack && poorSleep) {
      insights.push({
        insight_type: 'work_sleep_impact',
        title: 'Late Slack Activity Impacting Sleep',
        message: `Late-night Slack messages are correlating with your reduced sleep quality (readiness: ${Math.round(data.oura.avgReadinessScore)}).`,
        severity: 'medium',
        actionable_recommendation: 'Set Slack to "Do Not Disturb" after 9pm. Your recovery metrics will thank you.',
        source_provider: 'cross_source',
        source_data_type: 'communication_sleep_correlation',
        context_data: {
          sources: ['slack', 'oura'],
          lateNightMessages: true,
          readinessScore: data.oura.avgReadinessScore,
          afterHoursPct: data.slack.messageVolume?.afterHoursPercentage,
        },
      });
    }
  }

  // =========================================================================
  // Pattern 2: Recovery + Glucose correlation (Whoop + Dexcom)
  // =========================================================================
  if (data.whoop && data.dexcom) {
    const lowRecovery = data.whoop.avgRecoveryScore < 50;
    const highGlucoseVariability = data.dexcom.glucoseVariability === 'high';
    const poorTimeInRange = data.dexcom.timeInRange < 70;

    if (lowRecovery && (highGlucoseVariability || poorTimeInRange)) {
      insights.push({
        insight_type: 'stress_recovery_pattern',
        title: 'Metabolic Stress Signal Detected',
        message: `Your low recovery score (${Math.round(data.whoop.avgRecoveryScore)}%) combined with ${highGlucoseVariability ? 'high glucose variability' : `only ${data.dexcom.timeInRange}% time in glucose range`} suggests your body is under systemic stress.`,
        severity: 'high',
        actionable_recommendation: 'Focus on recovery: prioritize sleep, reduce intense exercise for 1-2 days, and eat balanced meals with protein and fiber to stabilize glucose.',
        source_provider: 'cross_source',
        source_data_type: 'metabolic_recovery_correlation',
        context_data: {
          sources: ['whoop', 'dexcom'],
          recoveryScore: data.whoop.avgRecoveryScore,
          glucoseVariability: data.dexcom.glucoseVariability,
          timeInRange: data.dexcom.timeInRange,
          avgGlucose: data.dexcom.avgGlucose,
          hrvAvg: data.whoop.avgHRV,
        },
      });
    }
  }

  // =========================================================================
  // Pattern 3: Meetings → Energy (Gmail + Whoop)
  // =========================================================================
  if (data.gmail && data.whoop) {
    const highMeetingDensity = data.gmail.meetingDensity?.avgMeetingsPerDay > 5;
    const backToBackMeetings = data.gmail.meetingDensity?.backToBackPercentage > 50;
    const lowRecovery = data.whoop.avgRecoveryScore < 60;

    if ((highMeetingDensity || backToBackMeetings) && lowRecovery) {
      insights.push({
        insight_type: 'cross_source_correlation',
        title: 'Meeting Load Draining Your Energy',
        message: `Your calendar density (${data.gmail.meetingDensity?.avgMeetingsPerDay} meetings/day${backToBackMeetings ? ', 50%+ back-to-back' : ''}) correlates with your low recovery score of ${Math.round(data.whoop.avgRecoveryScore)}%.`,
        severity: 'medium',
        actionable_recommendation: 'Try adding 15-minute buffers between meetings. Consider declining non-essential meetings on low-recovery days.',
        source_provider: 'cross_source',
        source_data_type: 'calendar_energy_correlation',
        context_data: {
          sources: ['gmail', 'whoop'],
          meetingsPerDay: data.gmail.meetingDensity?.avgMeetingsPerDay,
          backToBackPct: data.gmail.meetingDensity?.backToBackPercentage,
          recoveryScore: data.whoop.avgRecoveryScore,
          strainScore: data.whoop.avgStrainScore,
        },
      });
    }
  }

  // =========================================================================
  // Pattern 4: Music → Physiology (Spotify + Oura/Whoop)
  // =========================================================================
  if (data.spotify && (data.oura || data.whoop)) {
    const anxiousMood = data.spotify.inferredMood === 'anxious';
    const lowMood = data.spotify.avgValence < 0.3;
    const lowReadiness = data.oura?.avgReadinessScore && data.oura.avgReadinessScore < 60;
    const lowRecovery = data.whoop?.avgRecoveryScore && data.whoop.avgRecoveryScore < 50;

    if ((anxiousMood || lowMood) && (lowReadiness || lowRecovery)) {
      insights.push({
        insight_type: 'cross_source_correlation',
        title: 'Music & Body Both Signal Stress',
        message: `Your music choices (${anxiousMood ? 'anxious patterns' : 'low valence/mood'}) align with your physiological markers${lowReadiness ? ` (readiness: ${Math.round(data.oura!.avgReadinessScore)})` : ''}${lowRecovery ? ` (recovery: ${Math.round(data.whoop!.avgRecoveryScore)}%)` : ''}. Both suggest elevated stress.`,
        severity: 'medium',
        actionable_recommendation: 'Consider creating a calming playlist. Music can influence mood - try uplifting or ambient tracks to help shift your state.',
        source_provider: 'cross_source',
        source_data_type: 'mood_physiology_correlation',
        context_data: {
          sources: ['spotify', data.oura ? 'oura' : 'whoop'],
          inferredMood: data.spotify.inferredMood,
          avgValence: data.spotify.avgValence,
          avgEnergy: data.spotify.avgEnergy,
          readinessScore: data.oura?.avgReadinessScore,
          recoveryScore: data.whoop?.avgRecoveryScore,
        },
      });
    }
  }

  // =========================================================================
  // Pattern 5: Late Activity → Next Day HRV (Slack/Gmail + Oura)
  // =========================================================================
  if ((data.slack || data.gmail) && data.oura) {
    const lateWork = data.slack?.stressIndicators?.lateNightMessages ||
      (data.gmail?.emailVolume?.afterHoursPercentage && data.gmail.emailVolume.afterHoursPercentage > 30);
    const lowHRV = data.oura.avgHRV && data.oura.hrvBaseline &&
      data.oura.avgHRV < data.oura.hrvBaseline * 0.85;

    if (lateWork && lowHRV) {
      const hrvDrop = data.oura.hrvBaseline
        ? Math.round((1 - data.oura.avgHRV / data.oura.hrvBaseline) * 100)
        : 0;

      insights.push({
        insight_type: 'lifestyle_health_connection',
        title: 'Late Work Reducing Your HRV',
        message: `Your late-night work activity correlates with a ${hrvDrop}% drop in HRV (${Math.round(data.oura.avgHRV)}ms vs baseline ${Math.round(data.oura.hrvBaseline || 0)}ms). This impacts your recovery capacity.`,
        severity: hrvDrop > 20 ? 'high' : 'medium',
        actionable_recommendation: 'Set a work cutoff time at least 2 hours before bed. Your nervous system needs time to downshift for quality sleep.',
        source_provider: 'cross_source',
        source_data_type: 'work_hrv_correlation',
        context_data: {
          sources: [data.slack ? 'slack' : 'gmail', 'oura'],
          lateNightWork: true,
          currentHRV: data.oura.avgHRV,
          baselineHRV: data.oura.hrvBaseline,
          hrvDropPct: hrvDrop,
          afterHoursEmailPct: data.gmail?.emailVolume?.afterHoursPercentage,
        },
      });
    }
  }

  // =========================================================================
  // Pattern 6: Exercise → Sleep benefit (Whoop + Oura) - POSITIVE correlation
  // =========================================================================
  if (data.whoop && data.oura) {
    const goodStrain = data.whoop.avgStrainScore >= 10 && data.whoop.avgStrainScore <= 18;
    const goodSleep = data.oura.avgReadinessScore >= 75;
    const goodDeepSleep = data.oura.sleepArchitecture?.deepSleepPercentage &&
      data.oura.sleepArchitecture.deepSleepPercentage > 15;

    if (goodStrain && (goodSleep || goodDeepSleep)) {
      insights.push({
        insight_type: 'exercise_sleep_benefit',
        title: 'Your Training is Boosting Sleep Quality',
        message: `Your balanced training load (strain: ${data.whoop.avgStrainScore.toFixed(1)}) is correlating with ${goodSleep ? `excellent readiness (${Math.round(data.oura.avgReadinessScore)})` : ''}${goodDeepSleep ? ` and great deep sleep (${data.oura.sleepArchitecture?.deepSleepPercentage}%)` : ''}.`,
        severity: 'info',
        actionable_recommendation: 'Keep this balance! Moderate training with adequate recovery is optimizing your sleep architecture.',
        source_provider: 'cross_source',
        source_data_type: 'exercise_sleep_correlation',
        context_data: {
          sources: ['whoop', 'oura'],
          strainScore: data.whoop.avgStrainScore,
          readinessScore: data.oura.avgReadinessScore,
          deepSleepPct: data.oura.sleepArchitecture?.deepSleepPercentage,
          sleepHours: data.oura.avgSleepHours,
        },
      });
    }
  }

  logger.info('Generated cross-source insights', { email, insightCount: insights.length });
  return insights;
}

// ============================================================================
// WEEKLY ANALYSIS FUNCTIONS
// ============================================================================

/**
 * Fetch weekly aggregated data from the database
 */
async function fetchWeeklyData(
  email: string,
  weekStart: Date,
  weekEnd: Date
): Promise<WeeklyMetrics> {
  const supabase = await createClient();
  const startStr = weekStart.toISOString();
  const endStr = weekEnd.toISOString();

  // Initialize metrics with defaults
  const metrics: WeeklyMetrics = {
    weekStart,
    weekEnd,
    avgSleepHours: null,
    avgSleepScore: null,
    avgHRV: null,
    sleepConsistency: null,
    avgDailySteps: null,
    totalWorkouts: null,
    avgStrainScore: null,
    activeDays: 0,
    avgRecoveryScore: null,
    lowRecoveryDays: 0,
    highRecoveryDays: 0,
    avgRestingHR: null,
    workStressScore: null,
    afterHoursWorkDays: 0,
    avgGlucose: null,
    timeInRange: null,
    spikeDays: 0,
    avgMeetingsPerDay: null,
    focusTimeHours: null,
    afterHoursEmailPct: null,
  };

  // Fetch Oura sleep data
  const { data: ouraData } = await supabase
    .from('oura_data')
    .select('*')
    .eq('email', email)
    .gte('date', startStr)
    .lte('date', endStr);

  if (ouraData && ouraData.length > 0) {
    const sleepScores = ouraData.map(d => d.readiness_score).filter(Boolean);
    const sleepHours = ouraData.map(d => d.total_sleep_duration / 3600).filter(Boolean);
    const hrvValues = ouraData.map(d => d.average_hrv).filter(Boolean);

    metrics.avgSleepScore = sleepScores.length > 0
      ? sleepScores.reduce((a, b) => a + b, 0) / sleepScores.length : null;
    metrics.avgSleepHours = sleepHours.length > 0
      ? sleepHours.reduce((a, b) => a + b, 0) / sleepHours.length : null;
    metrics.avgHRV = hrvValues.length > 0
      ? hrvValues.reduce((a, b) => a + b, 0) / hrvValues.length : null;
  }

  // Fetch Whoop recovery/strain data
  const { data: whoopData } = await supabase
    .from('whoop_data')
    .select('*')
    .eq('email', email)
    .gte('date', startStr)
    .lte('date', endStr);

  if (whoopData && whoopData.length > 0) {
    const recoveryScores = whoopData.map(d => d.recovery_score).filter(Boolean);
    const strainScores = whoopData.map(d => d.strain_score).filter(Boolean);
    const restingHRs = whoopData.map(d => d.resting_heart_rate).filter(Boolean);

    metrics.avgRecoveryScore = recoveryScores.length > 0
      ? recoveryScores.reduce((a, b) => a + b, 0) / recoveryScores.length : null;
    metrics.avgStrainScore = strainScores.length > 0
      ? strainScores.reduce((a, b) => a + b, 0) / strainScores.length : null;
    metrics.avgRestingHR = restingHRs.length > 0
      ? restingHRs.reduce((a, b) => a + b, 0) / restingHRs.length : null;

    metrics.lowRecoveryDays = recoveryScores.filter(s => s < 34).length;
    metrics.highRecoveryDays = recoveryScores.filter(s => s > 67).length;
    metrics.activeDays = strainScores.filter(s => s > 8).length;
    metrics.totalWorkouts = whoopData.filter(d => d.workout_count > 0).length;
  }

  // Fetch Dexcom glucose data
  const { data: dexcomData } = await supabase
    .from('dexcom_data')
    .select('*')
    .eq('email', email)
    .gte('timestamp', startStr)
    .lte('timestamp', endStr);

  if (dexcomData && dexcomData.length > 0) {
    const glucoseValues = dexcomData.map(d => d.glucose_value).filter(Boolean);
    const inRangeCount = glucoseValues.filter(g => g >= 70 && g <= 140).length;

    metrics.avgGlucose = glucoseValues.length > 0
      ? glucoseValues.reduce((a, b) => a + b, 0) / glucoseValues.length : null;
    metrics.timeInRange = glucoseValues.length > 0
      ? (inRangeCount / glucoseValues.length) * 100 : null;

    // Count spike days (days with readings > 180)
    const daysWithSpikes = new Set(
      dexcomData.filter(d => d.glucose_value > 180).map(d => d.timestamp?.split('T')[0])
    );
    metrics.spikeDays = daysWithSpikes.size;
  }

  // Fetch Gmail patterns for work metrics
  const { data: gmailData } = await supabase
    .from('gmail_patterns')
    .select('*')
    .eq('email', email)
    .gte('date', startStr)
    .lte('date', endStr);

  if (gmailData && gmailData.length > 0) {
    const meetingsPerDay = gmailData.map(d => d.meetings_count).filter(Boolean);
    const afterHoursPcts = gmailData.map(d => d.after_hours_percentage).filter(Boolean);

    metrics.avgMeetingsPerDay = meetingsPerDay.length > 0
      ? meetingsPerDay.reduce((a, b) => a + b, 0) / meetingsPerDay.length : null;
    metrics.afterHoursEmailPct = afterHoursPcts.length > 0
      ? afterHoursPcts.reduce((a, b) => a + b, 0) / afterHoursPcts.length : null;
    metrics.afterHoursWorkDays = afterHoursPcts.filter(p => p > 20).length;

    // Calculate work stress score (0-100)
    if (metrics.avgMeetingsPerDay !== null && metrics.afterHoursEmailPct !== null) {
      const meetingStress = Math.min((metrics.avgMeetingsPerDay / 8) * 50, 50);
      const afterHoursStress = Math.min((metrics.afterHoursEmailPct / 40) * 50, 50);
      metrics.workStressScore = meetingStress + afterHoursStress;
    }
  }

  return metrics;
}

/**
 * Compare two weeks of metrics and calculate trends
 */
function compareWeeks(
  currentWeek: WeeklyMetrics,
  previousWeek: WeeklyMetrics,
  metricKey: keyof WeeklyMetrics,
  higherIsBetter: boolean,
  significantThreshold: number = 10
): WeekComparison | null {
  const current = currentWeek[metricKey] as number | null;
  const previous = previousWeek[metricKey] as number | null;

  if (current === null || previous === null || previous === 0) {
    return null;
  }

  const changePercent = ((current - previous) / Math.abs(previous)) * 100;
  const isSignificant = Math.abs(changePercent) >= significantThreshold;

  let trend: 'improving' | 'declining' | 'stable';
  if (!isSignificant) {
    trend = 'stable';
  } else if (higherIsBetter) {
    trend = changePercent > 0 ? 'improving' : 'declining';
  } else {
    trend = changePercent < 0 ? 'improving' : 'declining';
  }

  return {
    metric: metricKey,
    currentValue: current,
    previousValue: previous,
    changePercent: Math.round(changePercent * 10) / 10,
    trend,
    isSignificant,
  };
}

/**
 * Generate comprehensive weekly analysis insights
 */
export async function generateWeeklyAnalysis(email: string): Promise<GeneratedInsight[]> {
  logger.info('Generating weekly analysis', { email });
  const insights: GeneratedInsight[] = [];

  // Calculate date ranges
  const now = new Date();
  const currentWeekEnd = new Date(now);
  const currentWeekStart = new Date(now);
  currentWeekStart.setDate(currentWeekStart.getDate() - 7);

  const previousWeekEnd = new Date(currentWeekStart);
  const previousWeekStart = new Date(currentWeekStart);
  previousWeekStart.setDate(previousWeekStart.getDate() - 7);

  // Fetch data for both weeks
  const currentWeek = await fetchWeeklyData(email, currentWeekStart, currentWeekEnd);
  const previousWeek = await fetchWeeklyData(email, previousWeekStart, previousWeekEnd);

  // Track all comparisons for the summary
  const comparisons: WeekComparison[] = [];
  const improvements: string[] = [];
  const declines: string[] = [];

  // =========================================================================
  // Sleep Trend Analysis
  // =========================================================================
  const sleepScoreComp = compareWeeks(currentWeek, previousWeek, 'avgSleepScore', true);
  const sleepHoursComp = compareWeeks(currentWeek, previousWeek, 'avgSleepHours', true, 5);
  const hrvComp = compareWeeks(currentWeek, previousWeek, 'avgHRV', true, 10);

  if (sleepScoreComp) comparisons.push(sleepScoreComp);
  if (sleepHoursComp) comparisons.push(sleepHoursComp);
  if (hrvComp) comparisons.push(hrvComp);

  if (sleepScoreComp?.isSignificant || sleepHoursComp?.isSignificant) {
    const sleepTrend = sleepScoreComp?.trend || sleepHoursComp?.trend || 'stable';

    if (sleepTrend === 'improving') {
      improvements.push('sleep quality');
      insights.push({
        insight_type: 'weekly_sleep_trend',
        title: 'Sleep Quality Improved This Week',
        message: `Your sleep metrics improved this week! ${sleepScoreComp ? `Sleep score up ${Math.abs(sleepScoreComp.changePercent)}% (${Math.round(sleepScoreComp.currentValue)} vs ${Math.round(sleepScoreComp.previousValue)}).` : ''} ${sleepHoursComp ? `Averaging ${currentWeek.avgSleepHours?.toFixed(1)} hours vs ${previousWeek.avgSleepHours?.toFixed(1)} last week.` : ''}`,
        severity: 'info',
        actionable_recommendation: 'Keep doing what worked! Note any changes to your routine that may have contributed.',
        source_provider: 'weekly_analysis',
        source_data_type: 'sleep_trend',
        context_data: {
          currentWeekAvgScore: currentWeek.avgSleepScore,
          previousWeekAvgScore: previousWeek.avgSleepScore,
          currentWeekAvgHours: currentWeek.avgSleepHours,
          previousWeekAvgHours: previousWeek.avgSleepHours,
          changePct: sleepScoreComp?.changePercent,
        },
      });
    } else if (sleepTrend === 'declining') {
      declines.push('sleep quality');
      insights.push({
        insight_type: 'weekly_sleep_trend',
        title: 'Sleep Quality Declined This Week',
        message: `Your sleep metrics dropped this week. ${sleepScoreComp ? `Sleep score down ${Math.abs(sleepScoreComp.changePercent)}% (${Math.round(sleepScoreComp.currentValue)} vs ${Math.round(sleepScoreComp.previousValue)}).` : ''} ${currentWeek.avgSleepHours ? `Averaging only ${currentWeek.avgSleepHours.toFixed(1)} hours.` : ''}`,
        severity: currentWeek.avgSleepScore && currentWeek.avgSleepScore < 60 ? 'high' : 'medium',
        actionable_recommendation: 'Review your bedtime routine, screen time, and stress levels. Aim for 7-8 hours consistently.',
        source_provider: 'weekly_analysis',
        source_data_type: 'sleep_trend',
        context_data: {
          currentWeekAvgScore: currentWeek.avgSleepScore,
          previousWeekAvgScore: previousWeek.avgSleepScore,
          changePct: sleepScoreComp?.changePercent,
        },
      });
    }
  }

  // =========================================================================
  // Activity & Exercise Trend Analysis
  // =========================================================================
  const strainComp = compareWeeks(currentWeek, previousWeek, 'avgStrainScore', true, 15);
  const activeDaysComp = compareWeeks(currentWeek, previousWeek, 'activeDays', true, 20);

  if (strainComp) comparisons.push(strainComp);

  if (strainComp?.isSignificant || (currentWeek.activeDays !== previousWeek.activeDays)) {
    const activityTrend = strainComp?.trend || (currentWeek.activeDays > previousWeek.activeDays ? 'improving' : 'declining');

    if (activityTrend === 'improving') {
      improvements.push('activity level');
      insights.push({
        insight_type: 'weekly_activity_trend',
        title: 'Activity Level Increased This Week',
        message: `Great work! You were more active this week. ${strainComp ? `Average strain up ${Math.abs(strainComp.changePercent)}%.` : ''} ${currentWeek.activeDays} active days vs ${previousWeek.activeDays} last week.${currentWeek.totalWorkouts ? ` ${currentWeek.totalWorkouts} workouts logged.` : ''}`,
        severity: 'info',
        actionable_recommendation: 'Nice momentum! Balance activity with recovery to maintain this progress.',
        source_provider: 'weekly_analysis',
        source_data_type: 'activity_trend',
        context_data: {
          currentWeekStrain: currentWeek.avgStrainScore,
          previousWeekStrain: previousWeek.avgStrainScore,
          currentActiveDays: currentWeek.activeDays,
          previousActiveDays: previousWeek.activeDays,
          totalWorkouts: currentWeek.totalWorkouts,
        },
      });
    } else if (activityTrend === 'declining' && currentWeek.activeDays < 3) {
      declines.push('activity level');
      insights.push({
        insight_type: 'weekly_activity_trend',
        title: 'Activity Level Dropped This Week',
        message: `Your activity decreased this week. Only ${currentWeek.activeDays} active days vs ${previousWeek.activeDays} last week.${strainComp ? ` Strain down ${Math.abs(strainComp.changePercent)}%.` : ''}`,
        severity: 'medium',
        actionable_recommendation: 'Even light movement helps. Try adding a 15-minute walk to your daily routine.',
        source_provider: 'weekly_analysis',
        source_data_type: 'activity_trend',
        context_data: {
          currentWeekStrain: currentWeek.avgStrainScore,
          previousWeekStrain: previousWeek.avgStrainScore,
          currentActiveDays: currentWeek.activeDays,
          previousActiveDays: previousWeek.activeDays,
        },
      });
    }
  }

  // =========================================================================
  // Recovery Trend Analysis
  // =========================================================================
  const recoveryComp = compareWeeks(currentWeek, previousWeek, 'avgRecoveryScore', true);
  if (recoveryComp) comparisons.push(recoveryComp);

  if (recoveryComp?.isSignificant) {
    if (recoveryComp.trend === 'improving') {
      improvements.push('recovery');
      insights.push({
        insight_type: 'weekly_recovery_trend',
        title: 'Recovery Improved This Week',
        message: `Your body is recovering better! Average recovery up ${Math.abs(recoveryComp.changePercent)}% (${Math.round(recoveryComp.currentValue)}% vs ${Math.round(recoveryComp.previousValue)}%). ${currentWeek.highRecoveryDays} green zone days this week.`,
        severity: 'info',
        actionable_recommendation: 'Your recovery practices are working. Consider pushing your training intensity slightly.',
        source_provider: 'weekly_analysis',
        source_data_type: 'recovery_trend',
        context_data: {
          currentWeekAvg: currentWeek.avgRecoveryScore,
          previousWeekAvg: previousWeek.avgRecoveryScore,
          highRecoveryDays: currentWeek.highRecoveryDays,
          lowRecoveryDays: currentWeek.lowRecoveryDays,
        },
      });
    } else if (recoveryComp.trend === 'declining') {
      declines.push('recovery');
      insights.push({
        insight_type: 'weekly_recovery_trend',
        title: 'Recovery Declined This Week',
        message: `Your recovery dropped ${Math.abs(recoveryComp.changePercent)}% (${Math.round(recoveryComp.currentValue)}% vs ${Math.round(recoveryComp.previousValue)}%). ${currentWeek.lowRecoveryDays} low recovery days this week.`,
        severity: currentWeek.lowRecoveryDays >= 4 ? 'high' : 'medium',
        actionable_recommendation: 'Prioritize sleep, reduce training intensity, and manage stress. Your body needs more recovery time.',
        source_provider: 'weekly_analysis',
        source_data_type: 'recovery_trend',
        context_data: {
          currentWeekAvg: currentWeek.avgRecoveryScore,
          previousWeekAvg: previousWeek.avgRecoveryScore,
          lowRecoveryDays: currentWeek.lowRecoveryDays,
        },
      });
    }
  }

  // =========================================================================
  // Stress & Work-Life Balance Trend
  // =========================================================================
  const workStressComp = compareWeeks(currentWeek, previousWeek, 'workStressScore', false); // lower is better
  const meetingsComp = compareWeeks(currentWeek, previousWeek, 'avgMeetingsPerDay', false);

  if (workStressComp) comparisons.push(workStressComp);

  if (workStressComp?.isSignificant || currentWeek.afterHoursWorkDays > 4) {
    if (workStressComp?.trend === 'declining') { // declining stress = improving
      improvements.push('work-life balance');
    } else if (workStressComp?.trend === 'improving' || currentWeek.afterHoursWorkDays > 4) {
      declines.push('work-life balance');
      insights.push({
        insight_type: 'weekly_work_life_balance',
        title: 'Work Stress Elevated This Week',
        message: `Your work patterns show elevated stress. ${currentWeek.afterHoursWorkDays}/7 days with after-hours work.${currentWeek.avgMeetingsPerDay ? ` Averaging ${currentWeek.avgMeetingsPerDay.toFixed(1)} meetings/day.` : ''}${currentWeek.afterHoursEmailPct ? ` ${Math.round(currentWeek.afterHoursEmailPct)}% emails sent outside work hours.` : ''}`,
        severity: currentWeek.afterHoursWorkDays >= 5 ? 'high' : 'medium',
        actionable_recommendation: 'Set boundaries: designate no-email hours, decline non-essential meetings, and protect your evening recovery time.',
        source_provider: 'weekly_analysis',
        source_data_type: 'work_stress_trend',
        context_data: {
          currentWorkStress: currentWeek.workStressScore,
          previousWorkStress: previousWeek.workStressScore,
          afterHoursWorkDays: currentWeek.afterHoursWorkDays,
          avgMeetingsPerDay: currentWeek.avgMeetingsPerDay,
          afterHoursEmailPct: currentWeek.afterHoursEmailPct,
        },
      });
    }
  }

  // =========================================================================
  // Glucose Trend Analysis (if available)
  // =========================================================================
  const glucoseComp = compareWeeks(currentWeek, previousWeek, 'avgGlucose', false); // lower is better
  const timeInRangeComp = compareWeeks(currentWeek, previousWeek, 'timeInRange', true);

  if (glucoseComp) comparisons.push(glucoseComp);
  if (timeInRangeComp) comparisons.push(timeInRangeComp);

  if ((glucoseComp?.isSignificant || timeInRangeComp?.isSignificant) && currentWeek.avgGlucose !== null) {
    const glucoseTrend = timeInRangeComp?.trend || (glucoseComp?.trend === 'improving' ? 'improving' : 'declining');

    if (glucoseTrend === 'improving') {
      improvements.push('glucose control');
      insights.push({
        insight_type: 'weekly_glucose_trend',
        title: 'Glucose Control Improved This Week',
        message: `Your glucose metrics improved! ${timeInRangeComp ? `Time in range up to ${Math.round(timeInRangeComp.currentValue)}% (from ${Math.round(timeInRangeComp.previousValue)}%).` : ''} ${glucoseComp ? `Average glucose ${Math.round(glucoseComp.currentValue)} mg/dL.` : ''} Only ${currentWeek.spikeDays} days with spikes.`,
        severity: 'info',
        actionable_recommendation: 'Your meal choices and timing are working well. Keep it up!',
        source_provider: 'weekly_analysis',
        source_data_type: 'glucose_trend',
        context_data: {
          currentAvgGlucose: currentWeek.avgGlucose,
          previousAvgGlucose: previousWeek.avgGlucose,
          currentTimeInRange: currentWeek.timeInRange,
          previousTimeInRange: previousWeek.timeInRange,
          spikeDays: currentWeek.spikeDays,
        },
      });
    } else if (glucoseTrend === 'declining') {
      declines.push('glucose control');
      insights.push({
        insight_type: 'weekly_glucose_trend',
        title: 'Glucose Control Needs Attention',
        message: `Your glucose metrics declined this week. ${timeInRangeComp ? `Time in range dropped to ${Math.round(timeInRangeComp.currentValue)}% (from ${Math.round(timeInRangeComp.previousValue)}%).` : ''} ${currentWeek.spikeDays} days with glucose spikes.`,
        severity: currentWeek.timeInRange && currentWeek.timeInRange < 60 ? 'high' : 'medium',
        actionable_recommendation: 'Review meal composition: add more protein, fiber, and healthy fats. Consider timing of carbs.',
        source_provider: 'weekly_analysis',
        source_data_type: 'glucose_trend',
        context_data: {
          currentAvgGlucose: currentWeek.avgGlucose,
          previousAvgGlucose: previousWeek.avgGlucose,
          currentTimeInRange: currentWeek.timeInRange,
          spikeDays: currentWeek.spikeDays,
        },
      });
    }
  }

  // =========================================================================
  // Overall Weekly Summary
  // =========================================================================
  if (comparisons.length > 0) {
    const significantImprovements = comparisons.filter(c => c.trend === 'improving' && c.isSignificant);
    const significantDeclines = comparisons.filter(c => c.trend === 'declining' && c.isSignificant);

    let overallTrend: 'improving' | 'declining' | 'mixed' | 'stable';
    if (significantImprovements.length > significantDeclines.length + 1) {
      overallTrend = 'improving';
    } else if (significantDeclines.length > significantImprovements.length + 1) {
      overallTrend = 'declining';
    } else if (significantImprovements.length > 0 && significantDeclines.length > 0) {
      overallTrend = 'mixed';
    } else {
      overallTrend = 'stable';
    }

    let summaryMessage = '';
    let severity: InsightSeverity = 'info';

    switch (overallTrend) {
      case 'improving':
        summaryMessage = `Great week! ${improvements.length} areas improved: ${improvements.join(', ')}.`;
        break;
      case 'declining':
        summaryMessage = `Challenging week. ${declines.length} areas declined: ${declines.join(', ')}. Focus on recovery.`;
        severity = 'medium';
        break;
      case 'mixed':
        summaryMessage = `Mixed week. Improved: ${improvements.join(', ') || 'none'}. Declined: ${declines.join(', ') || 'none'}.`;
        break;
      case 'stable':
        summaryMessage = 'Steady week with no major changes in your health metrics.';
        break;
    }

    insights.unshift({
      insight_type: 'weekly_summary',
      title: `Weekly Health Summary`,
      message: summaryMessage,
      severity,
      actionable_recommendation: overallTrend === 'declining'
        ? 'Focus on fundamentals: sleep 7-8 hours, move daily, manage stress, and eat balanced meals.'
        : overallTrend === 'improving'
        ? 'You\'re building positive momentum. Keep consistent with your healthy habits.'
        : 'Consistency is key. Small daily improvements compound over time.',
      source_provider: 'weekly_analysis',
      source_data_type: 'weekly_summary',
      context_data: {
        overallTrend,
        improvements,
        declines,
        comparisons: comparisons.map(c => ({
          metric: c.metric,
          change: c.changePercent,
          trend: c.trend,
        })),
        currentWeek: {
          sleepScore: currentWeek.avgSleepScore,
          recoveryScore: currentWeek.avgRecoveryScore,
          strainScore: currentWeek.avgStrainScore,
          activeDays: currentWeek.activeDays,
          workStress: currentWeek.workStressScore,
        },
      },
    });
  }

  logger.info('Generated weekly analysis insights', { email, insightCount: insights.length });
  return insights;
}

// ============================================================================
// AI-POWERED INSIGHT GENERATION
// ============================================================================

/**
 * Tier-based insight configuration
 */
interface InsightTierConfig {
  insightCount: number;
  includeDeepAnalysis: boolean;
  includeCorrelations: boolean;
  includePredictions: boolean;
  includeActionPlan: boolean;
  maxTokens: number;
  model: string;
}

const INSIGHT_TIER_CONFIG: Record<string, InsightTierConfig> = {
  free: {
    insightCount: 2,
    includeDeepAnalysis: false,
    includeCorrelations: false,
    includePredictions: false,
    includeActionPlan: false,
    maxTokens: 800,
    model: 'gpt-4o-mini',
  },
  pro: {
    insightCount: 4,
    includeDeepAnalysis: true,
    includeCorrelations: true,
    includePredictions: true,
    includeActionPlan: true,
    maxTokens: 2000,
    model: 'gpt-4o',
  },
  max: {
    insightCount: 6,
    includeDeepAnalysis: true,
    includeCorrelations: true,
    includePredictions: true,
    includeActionPlan: true,
    maxTokens: 4000,
    model: 'gpt-4o',
  },
};

/**
 * Generate AI-powered personalized insights using comprehensive user context
 *
 * This function uses GPT-4o with full user context including:
 * - User profile (goals, allergies, conditions)
 * - Conversation history (what they've discussed with Moccet Voice)
 * - Lab results / blood biomarkers
 * - Training & nutrition plans
 * - All ecosystem data (Oura, Dexcom, etc.)
 *
 * Pro and Max tiers get deeper, more complex insights with:
 * - Multi-source correlations
 * - Predictive analysis
 * - Detailed action plans
 * - Scientific explanations
 */
async function generateAIInsights(
  email: string,
  ecosystemData: AllConnectorData,
  userContext: UserContext | null,
  subscriptionTier: string = 'free'
): Promise<GeneratedInsight[]> {
  const tierConfig = INSIGHT_TIER_CONFIG[subscriptionTier] || INSIGHT_TIER_CONFIG.free;
  logger.info('Generating AI-powered insights', { email, tier: subscriptionTier, maxInsights: tierConfig.insightCount });

  // Skip if no meaningful data available
  const hasEcosystemData = Object.values(ecosystemData).some((d) => d !== null);
  if (!hasEcosystemData && !userContext?.labResults?.length) {
    logger.info('No data available, skipping AI insights', { email });
    return [];
  }

  try {
    // Build comprehensive context sections
    const contextSections: string[] = [];

    // User Profile - More detailed for Pro/Max
    if (userContext?.profile) {
      const profile = userContext.profile;
      const profileParts: string[] = [];
      if (profile.name) profileParts.push(`Name: ${profile.name}`);
      if (profile.goals?.length) profileParts.push(`Primary Goals: ${profile.goals.join(', ')}`);
      if (profile.allergies?.length) profileParts.push(`Allergies/Sensitivities: ${profile.allergies.join(', ')}`);
      if (profile.healthConditions?.length) profileParts.push(`Health Conditions: ${profile.healthConditions.join(', ')}`);
      if (profile.medications?.length) profileParts.push(`Current Medications: ${profile.medications.join(', ')}`);
      if (profile.dietaryPreferences?.length) profileParts.push(`Dietary Preferences: ${profile.dietaryPreferences.join(', ')}`);
      if (profileParts.length > 0) {
        contextSections.push(`## User Profile\n${profileParts.join('\n')}`);
      }
    }

    // Learned Facts - Things the user explicitly told us via insight feedback
    // CRITICAL: These should inform all insights (e.g., "works night shifts" means don't criticize late sleep)
    if (userContext?.learnedFacts && userContext.learnedFacts.length > 0) {
      const factParts: string[] = [];
      factParts.push('**IMPORTANT: The user has explicitly told us the following - DO NOT generate insights that conflict with these:**');

      // Group by category
      const factsByCategory: Record<string, string[]> = {};
      for (const fact of userContext.learnedFacts) {
        const cat = fact.category || 'other';
        if (!factsByCategory[cat]) factsByCategory[cat] = [];
        factsByCategory[cat].push(fact.value);
      }

      for (const [category, facts] of Object.entries(factsByCategory)) {
        const categoryLabel = category.charAt(0).toUpperCase() + category.slice(1);
        factParts.push(`\n**${categoryLabel}:**`);
        facts.forEach((f) => factParts.push(`- ${f}`));
      }

      contextSections.push(`## User-Provided Context\n${factParts.join('\n')}`);
    }

    // Conversation History - More for Pro/Max
    if (userContext?.conversationHistory) {
      const historyText = formatHistoryForPrompt(userContext.conversationHistory);
      if (historyText) {
        const maxHistoryLength = tierConfig.includeDeepAnalysis ? 3000 : 1000;
        contextSections.push(`## Recent Conversations with Moccet Voice\n${historyText.substring(0, maxHistoryLength)}`);
      }
    }

    // Lab Results - Full details for Pro/Max
    if (userContext?.labResults && userContext.labResults.length > 0) {
      const maxLabs = tierConfig.includeDeepAnalysis ? 30 : 10;
      const labsByCategory: Record<string, typeof userContext.labResults> = {};

      for (const lab of userContext.labResults.slice(0, maxLabs)) {
        const cat = lab.category || 'general';
        if (!labsByCategory[cat]) labsByCategory[cat] = [];
        labsByCategory[cat].push(lab);
      }

      const labParts: string[] = [];
      for (const [category, labs] of Object.entries(labsByCategory)) {
        labParts.push(`### ${category}`);
        for (const l of labs) {
          const statusIndicator = l.status === 'normal' ? '✓' : l.status === 'high' ? '↑' : l.status === 'low' ? '↓' : '•';
          labParts.push(`- ${l.biomarker}: ${l.value} ${l.unit} ${statusIndicator} ${l.referenceRange ? `(ref: ${l.referenceRange})` : ''}`);
        }
      }
      contextSections.push(`## Lab Results / Biomarkers\n${labParts.join('\n')}`);
    }

    // Training Plan - Full for Pro/Max
    if (userContext?.training) {
      const training = userContext.training;
      const trainingParts: string[] = [];

      if (training.profile) {
        if (training.profile.fitnessLevel) trainingParts.push(`Fitness Level: ${training.profile.fitnessLevel}`);
        if (training.profile.fitnessGoals?.length) trainingParts.push(`Fitness Goals: ${training.profile.fitnessGoals.join(', ')}`);
        if (training.profile.workoutFrequency) trainingParts.push(`Target Frequency: ${training.profile.workoutFrequency}`);
      }

      if (training.currentPlan) {
        const plan = training.currentPlan;
        const planSummary = typeof plan === 'string' ? plan : (plan.summary || JSON.stringify(plan).substring(0, tierConfig.includeDeepAnalysis ? 800 : 300));
        trainingParts.push(`Current Plan: ${planSummary}`);
      }

      if (trainingParts.length > 0) {
        contextSections.push(`## Training / Fitness\n${trainingParts.join('\n')}`);
      }
    }

    // Nutrition Plan - Full for Pro/Max
    if (userContext?.nutrition) {
      const nutrition = userContext.nutrition;
      const nutritionParts: string[] = [];

      if (nutrition.profile) {
        if (nutrition.profile.dietType) nutritionParts.push(`Diet Type: ${nutrition.profile.dietType}`);
        if (nutrition.profile.calorieTarget) nutritionParts.push(`Calorie Target: ${nutrition.profile.calorieTarget}`);
        if (nutrition.profile.macroTargets) nutritionParts.push(`Macro Targets: ${JSON.stringify(nutrition.profile.macroTargets)}`);
      }

      if (nutrition.currentPlan) {
        const plan = nutrition.currentPlan;
        const planSummary = typeof plan === 'string' ? plan : (plan.summary || JSON.stringify(plan).substring(0, tierConfig.includeDeepAnalysis ? 800 : 300));
        nutritionParts.push(`Current Plan: ${planSummary}`);
      }

      if (nutritionParts.length > 0) {
        contextSections.push(`## Nutrition\n${nutritionParts.join('\n')}`);
      }
    }

    // Sentiment Analysis - Communication patterns from Slack/Gmail content
    // Pro/Max feature: Detects stress, success, and boundary violations
    if (userContext?.sentimentAnalysis && tierConfig.includeDeepAnalysis) {
      const sentimentText = formatSentimentForPrompt(userContext.sentimentAnalysis);
      if (sentimentText) {
        contextSections.push(sentimentText);
      }
    }

    // Ecosystem Data - Comprehensive for Pro/Max
    const ecosystemParts: string[] = [];

    if (ecosystemData.oura) {
      const oura = ecosystemData.oura;
      ecosystemParts.push(`### Sleep & Recovery (Oura Ring)`);
      if (oura.avgSleepHours) ecosystemParts.push(`- Average Sleep: ${oura.avgSleepHours.toFixed(1)} hours`);
      if (oura.avgReadinessScore) ecosystemParts.push(`- Readiness Score: ${Math.round(oura.avgReadinessScore)}/100`);
      if (oura.avgHRV) ecosystemParts.push(`- HRV: ${Math.round(oura.avgHRV)}ms (trend: ${oura.hrvTrend || 'stable'})`);
      if (oura.sleepQuality) ecosystemParts.push(`- Sleep Quality: ${oura.sleepQuality}`);

      // Pro/Max get deeper Oura data
      if (tierConfig.includeDeepAnalysis) {
        if (oura.sleepArchitecture) {
          ecosystemParts.push(`- Deep Sleep: ${oura.sleepArchitecture.deepSleepPercent}% (${oura.sleepArchitecture.avgDeepSleepMins} min avg)`);
          ecosystemParts.push(`- REM Sleep: ${oura.sleepArchitecture.remSleepPercent}% (${oura.sleepArchitecture.avgRemSleepMins} min avg)`);
          ecosystemParts.push(`- Sleep Efficiency: ${oura.sleepArchitecture.sleepEfficiency}%`);
        }
        if (oura.sleepConsistency) {
          ecosystemParts.push(`- Bedtime: ${oura.sleepConsistency.avgBedtime} (variability: ${oura.sleepConsistency.bedtimeVariability} min)`);
          ecosystemParts.push(`- Wake Time: ${oura.sleepConsistency.avgWakeTime} (variability: ${oura.sleepConsistency.wakeTimeVariability} min)`);
          ecosystemParts.push(`- Consistency Score: ${oura.sleepConsistency.consistencyScore}`);
        }
        if (oura.hrvAnalysis) {
          ecosystemParts.push(`- HRV Baseline: ${oura.hrvAnalysis.baseline}ms, Current: ${oura.hrvAnalysis.currentAvg}ms`);
          ecosystemParts.push(`- Morning Readiness: ${oura.hrvAnalysis.morningReadiness}`);
        }
        if (oura.sleepDebt) {
          ecosystemParts.push(`- Sleep Debt: ${oura.sleepDebt.accumulatedHours.toFixed(1)} hours accumulated`);
          ecosystemParts.push(`- Weekly Deficit: ${oura.sleepDebt.weeklyDeficit.toFixed(1)} hours`);
          if (oura.sleepDebt.recoveryNeeded) ecosystemParts.push(`- Recovery Needed: ~${oura.sleepDebt.daysToRecover} days`);
        }
        if (oura.activityInsights) {
          ecosystemParts.push(`- Daily Steps: ${oura.activityInsights.avgDailySteps}`);
          ecosystemParts.push(`- Movement Consistency: ${oura.activityInsights.movementConsistency}`);
        }
      }

      if (oura.insights?.length) {
        ecosystemParts.push(`Oura Insights: ${oura.insights.slice(0, tierConfig.includeDeepAnalysis ? 5 : 2).join('; ')}`);
      }
    }

    if (ecosystemData.dexcom) {
      const dexcom = ecosystemData.dexcom;
      ecosystemParts.push(`### Glucose Monitoring (CGM)`);
      if (dexcom.avgGlucose) ecosystemParts.push(`- Average Glucose: ${Math.round(dexcom.avgGlucose)} mg/dL`);
      if (dexcom.avgFastingGlucose) ecosystemParts.push(`- Fasting Glucose: ${Math.round(dexcom.avgFastingGlucose)} mg/dL`);
      if (dexcom.timeInRange) ecosystemParts.push(`- Time in Range: ${Math.round(dexcom.timeInRange)}%`);
      if (dexcom.glucoseVariability) ecosystemParts.push(`- Glucose Variability: ${Math.round(dexcom.glucoseVariability)}%`);

      // Pro/Max get spike analysis
      if (tierConfig.includeDeepAnalysis && dexcom.spikeEvents?.length) {
        ecosystemParts.push(`- Spike Events: ${dexcom.spikeEvents.length}`);
        const recentSpikes = dexcom.spikeEvents.slice(0, 5);
        for (const spike of recentSpikes) {
          ecosystemParts.push(`  • ${spike.time}: ${spike.value} mg/dL ${spike.trigger ? `(trigger: ${spike.trigger})` : ''}`);
        }
      }

      if (dexcom.trends?.length) {
        ecosystemParts.push(`Glucose Trends: ${dexcom.trends.slice(0, 3).join('; ')}`);
      }
      if (dexcom.insights?.length) {
        ecosystemParts.push(`Glucose Insights: ${dexcom.insights.slice(0, tierConfig.includeDeepAnalysis ? 5 : 2).join('; ')}`);
      }
    }

    if (ecosystemData.whoop) {
      const whoop = ecosystemData.whoop;
      ecosystemParts.push(`### Recovery & Strain (Whoop)`);
      if (whoop.avgRecoveryScore) ecosystemParts.push(`- Recovery Score: ${Math.round(whoop.avgRecoveryScore)}%`);
      if (whoop.avgStrainScore) ecosystemParts.push(`- Strain Score: ${whoop.avgStrainScore.toFixed(1)}`);
      if (whoop.avgHRV) ecosystemParts.push(`- HRV: ${Math.round(whoop.avgHRV)}ms`);
      if (whoop.avgRestingHR) ecosystemParts.push(`- Resting HR: ${Math.round(whoop.avgRestingHR)} bpm`);

      // Pro/Max get deeper Whoop data
      if (tierConfig.includeDeepAnalysis) {
        if (whoop.recoveryZones) {
          ecosystemParts.push(`- Green Days: ${whoop.recoveryZones.greenDays} (${whoop.recoveryZones.greenPercentage}%)`);
          ecosystemParts.push(`- Yellow Days: ${whoop.recoveryZones.yellowDays}`);
          ecosystemParts.push(`- Red Days: ${whoop.recoveryZones.redDays}`);
        }
        if (whoop.strainRecoveryBalance) {
          ecosystemParts.push(`- Balance: ${whoop.strainRecoveryBalance.balanceScore}`);
          if (whoop.strainRecoveryBalance.overreachingDays > 0) {
            ecosystemParts.push(`- Overreaching Days: ${whoop.strainRecoveryBalance.overreachingDays}`);
          }
        }
        if (whoop.trainingLoad) {
          ecosystemParts.push(`- Weekly Strain: ${whoop.trainingLoad.weeklyStrain}`);
          ecosystemParts.push(`- Overtraining Risk: ${whoop.trainingLoad.overtrainingRisk}`);
        }
      }
    }

    if (ecosystemData.gmail) {
      const gmail = ecosystemData.gmail;
      ecosystemParts.push(`### Work Patterns (Email/Calendar)`);
      if (gmail.workHours) {
        ecosystemParts.push(`- Work Hours: ${gmail.workHours.start} - ${gmail.workHours.end}`);
        if (gmail.workHours.weekendActivity) ecosystemParts.push(`- Weekend Work: Yes`);
      }
      if (gmail.meetingDensity) {
        ecosystemParts.push(`- Meetings/Day: ${gmail.meetingDensity.avgMeetingsPerDay}`);
        if (gmail.meetingDensity.backToBackPercentage > 30) {
          ecosystemParts.push(`- Back-to-Back Meetings: ${gmail.meetingDensity.backToBackPercentage}%`);
        }
      }
      if (gmail.emailVolume?.afterHoursPercentage > 10) {
        ecosystemParts.push(`- After-Hours Email: ${gmail.emailVolume.afterHoursPercentage}%`);
      }

      // Pro/Max get stress analysis
      if (tierConfig.includeDeepAnalysis) {
        if (gmail.stressIndicators) {
          const stressors: string[] = [];
          if (gmail.stressIndicators.highEmailVolume) stressors.push('high email volume');
          if (gmail.stressIndicators.frequentAfterHoursWork) stressors.push('frequent late work');
          if (gmail.stressIndicators.shortMeetingBreaks) stressors.push('insufficient breaks');
          if (stressors.length) ecosystemParts.push(`- Stress Signals: ${stressors.join(', ')}`);
        }
        if (gmail.focusTime) {
          ecosystemParts.push(`- Focus Score: ${gmail.focusTime.focusScore}`);
          ecosystemParts.push(`- Avg Focus Blocks/Day: ${gmail.focusTime.avgFocusBlocksPerDay}`);
        }
        if (gmail.calendarHealth) {
          if (!gmail.calendarHealth.lunchProtected) ecosystemParts.push(`- Warning: Lunch not protected`);
          if (!gmail.calendarHealth.eveningsClear) ecosystemParts.push(`- Warning: Evening meetings scheduled`);
        }
      }
    }

    if (ecosystemData.slack) {
      const slack = ecosystemData.slack;
      ecosystemParts.push(`### Communication Patterns (Slack)`);
      if (slack.collaborationIntensity) ecosystemParts.push(`- Collaboration Intensity: ${slack.collaborationIntensity}`);
      if (slack.messageVolume?.afterHoursPercentage > 10) {
        ecosystemParts.push(`- After-Hours Messages: ${slack.messageVolume.afterHoursPercentage}%`);
      }

      if (tierConfig.includeDeepAnalysis) {
        if (slack.stressIndicators) {
          if (slack.stressIndicators.constantAvailability) ecosystemParts.push(`- Warning: Always-on pattern detected`);
          if (slack.stressIndicators.lateNightMessages) ecosystemParts.push(`- Warning: Late night messaging`);
        }
        if (slack.focusMetrics) {
          ecosystemParts.push(`- Context Switching: ${slack.focusMetrics.contextSwitchingScore}`);
          ecosystemParts.push(`- Deep Work Windows: ${slack.focusMetrics.deepWorkWindows}/day`);
        }
      }
    }

    if (ecosystemData.spotify) {
      const spotify = ecosystemData.spotify;
      ecosystemParts.push(`### Music & Mood (Spotify)`);
      if (spotify.inferredMood) ecosystemParts.push(`- Inferred Mood: ${spotify.inferredMood}`);
      if (spotify.avgValence) ecosystemParts.push(`- Music Valence: ${Math.round(spotify.avgValence * 100)}%`);
      if (spotify.avgEnergy) ecosystemParts.push(`- Music Energy: ${Math.round(spotify.avgEnergy * 100)}%`);
      if (spotify.lateNightListening) ecosystemParts.push(`- Late Night Listening: Yes`);
      if (spotify.emotionalVolatility === 'high') ecosystemParts.push(`- Emotional Volatility: High`);
    }

    if (ecosystemParts.length > 0) {
      contextSections.push(`## Current Health & Lifestyle Data\n${ecosystemParts.join('\n')}`);
    }

    const fullContext = contextSections.join('\n\n');

    // Build tier-specific system prompt
    const systemPrompt = buildTierSpecificPrompt(tierConfig, subscriptionTier);

    // Generate insights using appropriate model
    const response = await openai.chat.completions.create({
      model: tierConfig.model,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: `Generate ${tierConfig.insightCount} personalized health insights for this user:\n\n${fullContext}`,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: tierConfig.maxTokens,
      temperature: 0.7,
    });

    const responseText = response.choices[0]?.message?.content || '{}';
    let parsed: { insights?: any[] } = {};

    try {
      parsed = JSON.parse(responseText);
    } catch (parseError) {
      logger.error('Failed to parse AI response', parseError, { email });
      return [];
    }

    const aiInsights = Array.isArray(parsed) ? parsed : (parsed.insights || []);

    // Convert AI insights to GeneratedInsight format
    const insights: GeneratedInsight[] = aiInsights.map((ai: any) => ({
      insight_type: ai.insight_type || 'general_health',
      title: ai.title || 'Health Insight',
      message: ai.message || '',
      severity: ai.severity || 'info',
      actionable_recommendation: ai.recommendation || ai.action_plan || '',
      source_provider: 'ai_analysis',
      source_data_type: tierConfig.includeDeepAnalysis ? 'comprehensive_deep_analysis' : 'basic_analysis',
      context_data: {
        ai_generated: true,
        subscription_tier: subscriptionTier,
        analysis_depth: tierConfig.includeDeepAnalysis ? 'deep' : 'basic',
        sources_used: Object.keys(ecosystemData).filter((k) => ecosystemData[k as keyof AllConnectorData] !== null),
        has_user_context: !!userContext,
        has_conversation_history: !!userContext?.conversationHistory?.totalMessageCount,
        has_lab_results: (userContext?.labResults?.length || 0) > 0,
        has_sentiment_analysis: !!userContext?.sentimentAnalysis,
        sentiment_stress_score: userContext?.sentimentAnalysis?.avgStressScore,
        sentiment_success_score: userContext?.sentimentAnalysis?.avgSuccessScore,
        correlations: ai.correlations || [],
        scientific_basis: ai.scientific_basis || null,
        prediction: ai.prediction || null,
      },
    }));

    logger.info('Generated AI-powered insights', { email, tier: subscriptionTier, insightCount: insights.length });
    return insights;
  } catch (error) {
    logger.error('Error generating AI insights', error, { email, tier: subscriptionTier });
    return [];
  }
}

/**
 * Build tier-specific system prompt for insight generation
 */
function buildTierSpecificPrompt(config: InsightTierConfig, tier: string): string {
  if (tier === 'free') {
    return `You are a health insights analyst for Moccet Health. Generate ${config.insightCount} personalized health insights.

Your insights should be:
- Actionable and specific
- Personalized based on their data
- Easy to understand

Output as JSON:
{
  "insights": [
    {
      "title": "Short title",
      "message": "2-3 sentence insight",
      "severity": "info|low|medium|high|critical",
      "recommendation": "Simple actionable tip",
      "insight_type": "general_health"
    }
  ]
}`;
  }

  // Pro and Max get comprehensive prompts
  return `You are an expert health analyst for Moccet Health, providing deep, comprehensive insights for premium users.

Generate ${config.insightCount} highly sophisticated, personalized health insights that demonstrate the value of premium analysis.

## Analysis Requirements (Pro/Max Tier)

### 1. Multi-Source Correlations
- Connect data across ALL available sources (sleep + glucose + work stress + HRV + labs)
- Identify patterns the user wouldn't notice themselves
- Example: "Your glucose spikes correlate with days when you have >5 meetings AND slept <7 hours"

### 2. Root Cause Analysis
- Don't just report symptoms, identify underlying causes
- Connect lifestyle factors to physiological markers
- Reference their lab results when explaining patterns

### 3. Predictive Insights
- Based on current trends, predict what might happen
- Warn about concerning trajectories before they become problems
- Example: "If your HRV continues declining at this rate, you may hit burnout indicators within 2 weeks"

### 4. Scientific Depth
- Include brief scientific explanations (accessible but substantive)
- Reference the biological mechanisms at play
- Connect their data to research-backed findings

### 5. Personalized Action Plans
- Don't give generic advice - make it specific to THEIR data
- Reference their goals, conditions, and current plans
- Provide timing recommendations based on their schedule patterns

### 6. Goal Alignment
- Explicitly connect insights to their stated goals
- Show progress or obstacles toward their objectives
- Suggest optimizations specific to what they're trying to achieve

## Output Format
{
  "insights": [
    {
      "title": "Attention-grabbing title that hints at the insight",
      "message": "3-5 sentence comprehensive insight that connects multiple data sources, explains the 'why', and shows you understand their unique situation. Reference specific numbers from their data.",
      "severity": "info|low|medium|high|critical",
      "recommendation": "Detailed, personalized action plan with specific steps",
      "insight_type": "cross_source_correlation|lifestyle_health_connection|biomarker_trend|predictive_analysis|goal_alignment",
      "correlations": ["source1 + source2", "metric1 ↔ metric2"],
      "scientific_basis": "Brief explanation of the biological mechanism",
      "prediction": "What this trend suggests for the coming weeks (if applicable)"
    }
  ]
}

## Quality Standards
- Each insight should feel like it came from a personal health advisor who knows them deeply
- Avoid generic advice that could apply to anyone
- Make them feel the value of having all their data connected
- Be warm but authoritative - they're trusting you with their health data

Generate insights that make premium users feel like they're getting genuine value from their subscription.`;
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
    logger.error('Error storing insight', error, { email });
    return null;
  }

  const insightId = data?.id;

  // Send push notification via OneSignal
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
    } catch (pushError) {
      logger.error('Error sending push notification', pushError, { email, insightId });
      // Don't fail the whole operation if push notification fails
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
  logger.info('Processing all providers', { email });

  const allInsights: GeneratedInsight[] = [];
  const errors: string[] = [];

  // Get user's subscription tier first (determines insight depth)
  const subscriptionTier = await getUserSubscriptionTier(email);
  logger.info('User subscription tier determined', { email, tier: subscriptionTier });

  // Fetch data from all providers AND user context in parallel
  const [ouraResult, dexcomResult, whoopResult, gmailResult, slackResult, spotifyResult, userContext] = await Promise.all([
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
    fetchSpotifyData(email).catch((e) => {
      errors.push(`Spotify: ${e.message}`);
      return null;
    }),
    // NEW: Fetch comprehensive user context (profile, labs, conversation history, plans)
    getUserContext(email, 'generate health insights', {
      subscriptionTier: 'max', // Use max context for insight generation
      includeConversation: true,
      useAISelection: false, // Fetch all sources for comprehensive insights
    }).catch((e) => {
      logger.error('Error fetching user context', e, { email });
      return null;
    }),
  ]);

  logger.debug('User context fetched', { email, hasContext: !!userContext });
  if (userContext) {
    logger.debug('Context details', {
      email,
      labCount: userContext.labResults?.length || 0,
      messageCount: userContext.conversationHistory?.totalMessageCount || 0,
    });
  }

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

  if (spotifyResult?.available && spotifyResult.data) {
    const spotifyInsights = await generateSpotifyInsights(
      email,
      spotifyResult.data as SpotifyData
    );
    allInsights.push(...spotifyInsights);
  }

  // Generate cross-source insights using ALL connector data together
  // This is the key function that provides unified context across all connectors
  const ecosystemData: AllConnectorData = {
    oura: (ouraResult?.available && ouraResult.data) ? ouraResult.data as OuraData : null,
    dexcom: (dexcomResult?.available && dexcomResult.data) ? dexcomResult.data as DexcomData : null,
    whoop: (whoopResult?.available && whoopResult.data) ? whoopResult.data as WhoopData : null,
    gmail: (gmailResult?.available && gmailResult.data) ? gmailResult.data as GmailPatterns : null,
    slack: (slackResult?.available && slackResult.data) ? slackResult.data as SlackPatterns : null,
    spotify: (spotifyResult?.available && spotifyResult.data) ? spotifyResult.data as SpotifyData : null,
  };

  const crossSourceInsights = await generateCrossSourceInsights(email, ecosystemData);
  allInsights.push(...crossSourceInsights);

  // NEW: Generate AI-powered personalized insights using comprehensive user context
  // This uses GPT-4o with full context: profile, labs, conversation history, plans, and ecosystem data
  // Pro and Max tiers get deeper, more complex insights
  const aiInsights = await generateAIInsights(email, ecosystemData, userContext, subscriptionTier);
  allInsights.push(...aiInsights);

  // Store all generated insights
  let stored_count = 0;
  for (const insight of allInsights) {
    const id = await storeInsight(email, insight);
    if (id) stored_count++;
  }

  logger.info('Insights generated and stored', {
    email,
    generated: allInsights.length,
    stored: stored_count,
  });

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
  logger.info('Processing Vital event', { email, eventType });

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
    logger.error('Error fetching users', error);
    return [];
  }

  // Get unique emails
  const emails = [...new Set(data?.map((row) => row.user_email).filter(Boolean) as string[])];
  return emails;
}
