/**
 * Anomaly Detection Service
 * Analyzes health metrics against personalized baselines to detect anomalies
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// =============================================================================
// TYPES
// =============================================================================

export type MetricType =
  | 'sleep_score'
  | 'sleep_hours'
  | 'deep_sleep_pct'
  | 'rem_sleep_pct'
  | 'hrv'
  | 'resting_hr'
  | 'recovery_score'
  | 'steps'
  | 'active_calories'
  | 'activity_score'
  | 'glucose_avg'
  | 'glucose_variability'
  | 'time_in_range'
  | 'hydration'
  | 'protein_intake'
  | 'calorie_intake';

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type AlertType =
  | 'anomaly_detected'
  | 'activity_drop'
  | 'sleep_disruption'
  | 'glucose_concern'
  | 'medication_missed'
  | 'fall_detected'
  | 'no_data_received'
  | 'isolation_risk'
  | 'clinical_notified'
  | 'pattern_break'
  | 'trend_decline'
  | 'vital_concern';

export type TrendDirection = 'improving' | 'stable' | 'declining';

export interface ShareBaseline {
  id: string;
  user_email: string;
  metric_type: MetricType;
  baseline_value: number;
  baseline_std_dev: number;
  sample_count: number;
  window_days: number;
  alert_threshold_pct: number;
  critical_threshold_pct: number;
  normal_range_min: number | null;
  normal_range_max: number | null;
  trend_direction: TrendDirection;
  trend_duration_days: number;
  last_updated: string;
}

export interface AnomalyResult {
  isAnomaly: boolean;
  severity: AlertSeverity | null;
  deviationPct: number;
  message: string | null;
  recommendation: string | null;
  baseline: ShareBaseline | null;
}

export interface PatternBreak {
  patternType: string;
  description: string;
  severity: AlertSeverity;
  lastOccurrence: string | null;
  daysMissed: number;
}

export interface MetricAnalysis {
  metric: MetricType;
  currentValue: number;
  baseline: number;
  stdDev: number;
  deviationPct: number;
  zScore: number;
  isAnomaly: boolean;
  severity: AlertSeverity | null;
  trend: TrendDirection;
}

export interface HealthSnapshot {
  userEmail: string;
  timestamp: string;
  metrics: Record<MetricType, number>;
  anomalies: AnomalyResult[];
  patternBreaks: PatternBreak[];
  overallHealth: 'good' | 'attention' | 'concern' | 'critical';
}

// =============================================================================
// DEFAULT THRESHOLDS
// =============================================================================

const DEFAULT_THRESHOLDS: Record<MetricType, { alert: number; critical: number; min?: number; max?: number }> = {
  sleep_score: { alert: 20, critical: 35, min: 0, max: 100 },
  sleep_hours: { alert: 25, critical: 40, min: 4, max: 12 },
  deep_sleep_pct: { alert: 30, critical: 50, min: 10, max: 25 },
  rem_sleep_pct: { alert: 30, critical: 50, min: 15, max: 30 },
  hrv: { alert: 20, critical: 35, min: 10, max: 200 },
  resting_hr: { alert: 15, critical: 25, min: 40, max: 100 },
  recovery_score: { alert: 25, critical: 40, min: 0, max: 100 },
  steps: { alert: 40, critical: 60, min: 0, max: 30000 },
  active_calories: { alert: 35, critical: 55, min: 0, max: 3000 },
  activity_score: { alert: 30, critical: 50, min: 0, max: 100 },
  glucose_avg: { alert: 15, critical: 25, min: 70, max: 250 },
  glucose_variability: { alert: 20, critical: 35, min: 0, max: 50 },
  time_in_range: { alert: 15, critical: 25, min: 0, max: 100 },
  hydration: { alert: 25, critical: 40, min: 0, max: 5000 },
  protein_intake: { alert: 25, critical: 40, min: 0, max: 300 },
  calorie_intake: { alert: 20, critical: 35, min: 500, max: 5000 },
};

// =============================================================================
// SERVICE
// =============================================================================

export class AnomalyDetectionService {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  // ---------------------------------------------------------------------------
  // BASELINE MANAGEMENT
  // ---------------------------------------------------------------------------

  /**
   * Get or create baseline for a user's metric
   */
  async getBaseline(userEmail: string, metricType: MetricType): Promise<ShareBaseline | null> {
    const { data, error } = await this.supabase
      .from('share_baselines')
      .select('*')
      .eq('user_email', userEmail)
      .eq('metric_type', metricType)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching baseline:', error);
      return null;
    }

    return data as ShareBaseline | null;
  }

  /**
   * Update baseline with new data point (rolling average)
   */
  async updateBaseline(
    userEmail: string,
    metricType: MetricType,
    value: number,
    windowDays: number = 14
  ): Promise<ShareBaseline> {
    const existing = await this.getBaseline(userEmail, metricType);
    const thresholds = DEFAULT_THRESHOLDS[metricType] || { alert: 20, critical: 35 };

    if (!existing) {
      // Create new baseline
      const { data, error } = await this.supabase
        .from('share_baselines')
        .insert({
          user_email: userEmail,
          metric_type: metricType,
          baseline_value: value,
          baseline_std_dev: 0,
          sample_count: 1,
          window_days: windowDays,
          alert_threshold_pct: thresholds.alert,
          critical_threshold_pct: thresholds.critical,
          normal_range_min: thresholds.min || null,
          normal_range_max: thresholds.max || null,
          trend_direction: 'stable',
          trend_duration_days: 0,
        })
        .select()
        .single();

      if (error) throw new Error(`Failed to create baseline: ${error.message}`);
      return data as ShareBaseline;
    }

    // Update existing baseline with rolling average
    const oldMean = existing.baseline_value;
    const oldStd = existing.baseline_std_dev || 1;
    const n = Math.min(existing.sample_count, windowDays * 2); // Cap at 2x window

    // Welford's online algorithm for mean and variance
    const newN = n + 1;
    const delta = value - oldMean;
    const newMean = oldMean + delta / newN;

    // Update standard deviation (simplified rolling)
    const newVariance = ((n - 1) * oldStd * oldStd + delta * (value - newMean)) / n;
    const newStd = Math.sqrt(Math.max(0, newVariance));

    // Detect trend
    const trendDirection = this.calculateTrend(existing, value);
    const trendDays = trendDirection === existing.trend_direction
      ? existing.trend_duration_days + 1
      : 1;

    const { data, error } = await this.supabase
      .from('share_baselines')
      .update({
        baseline_value: newMean,
        baseline_std_dev: newStd,
        sample_count: newN,
        trend_direction: trendDirection,
        trend_duration_days: trendDays,
        last_updated: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw new Error(`Failed to update baseline: ${error.message}`);
    return data as ShareBaseline;
  }

  /**
   * Calculate trend direction based on recent values
   */
  private calculateTrend(baseline: ShareBaseline, newValue: number): TrendDirection {
    const diff = newValue - baseline.baseline_value;
    const threshold = baseline.baseline_std_dev * 0.5;

    if (diff > threshold) {
      // For metrics where higher is better
      const positiveMetrics: MetricType[] = [
        'sleep_score', 'sleep_hours', 'deep_sleep_pct', 'rem_sleep_pct',
        'hrv', 'recovery_score', 'steps', 'active_calories', 'activity_score',
        'time_in_range', 'hydration', 'protein_intake'
      ];
      return positiveMetrics.includes(baseline.metric_type as MetricType)
        ? 'improving'
        : 'declining';
    } else if (diff < -threshold) {
      const positiveMetrics: MetricType[] = [
        'sleep_score', 'sleep_hours', 'deep_sleep_pct', 'rem_sleep_pct',
        'hrv', 'recovery_score', 'steps', 'active_calories', 'activity_score',
        'time_in_range', 'hydration', 'protein_intake'
      ];
      return positiveMetrics.includes(baseline.metric_type as MetricType)
        ? 'declining'
        : 'improving';
    }

    return 'stable';
  }

  // ---------------------------------------------------------------------------
  // ANOMALY DETECTION
  // ---------------------------------------------------------------------------

  /**
   * Analyze a single metric value against baseline
   */
  async analyzeMetric(
    userEmail: string,
    metricType: MetricType,
    value: number
  ): Promise<AnomalyResult> {
    const baseline = await this.getBaseline(userEmail, metricType);
    const thresholds = DEFAULT_THRESHOLDS[metricType] || { alert: 20, critical: 35 };

    if (!baseline || baseline.sample_count < 5) {
      // Not enough data for reliable detection
      return {
        isAnomaly: false,
        severity: null,
        deviationPct: 0,
        message: null,
        recommendation: null,
        baseline: null,
      };
    }

    // Calculate deviation percentage
    const deviationPct = Math.abs((value - baseline.baseline_value) / baseline.baseline_value) * 100;

    // Calculate z-score
    const zScore = baseline.baseline_std_dev > 0
      ? (value - baseline.baseline_value) / baseline.baseline_std_dev
      : 0;

    // Check if outside normal range
    const outOfRange = (baseline.normal_range_min !== null && value < baseline.normal_range_min) ||
      (baseline.normal_range_max !== null && value > baseline.normal_range_max);

    // Determine severity
    let severity: AlertSeverity | null = null;
    let isAnomaly = false;

    if (deviationPct >= (baseline.critical_threshold_pct || thresholds.critical) || Math.abs(zScore) >= 3) {
      severity = 'critical';
      isAnomaly = true;
    } else if (deviationPct >= (baseline.alert_threshold_pct || thresholds.alert) || Math.abs(zScore) >= 2) {
      severity = 'high';
      isAnomaly = true;
    } else if (deviationPct >= (baseline.alert_threshold_pct || thresholds.alert) * 0.7 || Math.abs(zScore) >= 1.5) {
      severity = 'medium';
      isAnomaly = true;
    } else if (outOfRange) {
      severity = 'low';
      isAnomaly = true;
    }

    // Generate message and recommendation
    let message: string | null = null;
    let recommendation: string | null = null;

    if (isAnomaly) {
      message = this.generateAnomalyMessage(metricType, value, baseline, deviationPct);
      recommendation = this.generateRecommendation(metricType, value, baseline);
    }

    return {
      isAnomaly,
      severity,
      deviationPct,
      message,
      recommendation,
      baseline,
    };
  }

  /**
   * Analyze all metrics for a user
   */
  async analyzeAllMetrics(userEmail: string): Promise<MetricAnalysis[]> {
    // Get latest health data for user
    const healthData = await this.getLatestHealthData(userEmail);
    const results: MetricAnalysis[] = [];

    for (const [metric, value] of Object.entries(healthData)) {
      if (value === null || value === undefined) continue;

      const baseline = await this.getBaseline(userEmail, metric as MetricType);
      if (!baseline || baseline.sample_count < 5) continue;

      const deviationPct = Math.abs((value - baseline.baseline_value) / baseline.baseline_value) * 100;
      const zScore = baseline.baseline_std_dev > 0
        ? (value - baseline.baseline_value) / baseline.baseline_std_dev
        : 0;

      const analysis = await this.analyzeMetric(userEmail, metric as MetricType, value);

      results.push({
        metric: metric as MetricType,
        currentValue: value,
        baseline: baseline.baseline_value,
        stdDev: baseline.baseline_std_dev,
        deviationPct,
        zScore,
        isAnomaly: analysis.isAnomaly,
        severity: analysis.severity,
        trend: baseline.trend_direction,
      });
    }

    return results;
  }

  /**
   * Detect pattern breaks (missed routines, unusual behavior)
   */
  async detectPatternBreaks(userEmail: string): Promise<PatternBreak[]> {
    const patterns: PatternBreak[] = [];

    // Check for activity pattern breaks
    const activityBreak = await this.checkActivityPatternBreak(userEmail);
    if (activityBreak) patterns.push(activityBreak);

    // Check for sleep pattern breaks
    const sleepBreak = await this.checkSleepPatternBreak(userEmail);
    if (sleepBreak) patterns.push(sleepBreak);

    // Check for medication pattern breaks
    const medicationBreak = await this.checkMedicationPatternBreak(userEmail);
    if (medicationBreak) patterns.push(medicationBreak);

    // Check for data gaps (device not synced)
    const dataGap = await this.checkDataGap(userEmail);
    if (dataGap) patterns.push(dataGap);

    return patterns;
  }

  /**
   * Build comprehensive health snapshot
   */
  async buildHealthSnapshot(userEmail: string): Promise<HealthSnapshot> {
    const metrics = await this.getLatestHealthData(userEmail);
    const anomalies: AnomalyResult[] = [];

    // Analyze each metric
    for (const [metric, value] of Object.entries(metrics)) {
      if (value === null || value === undefined) continue;
      const analysis = await this.analyzeMetric(userEmail, metric as MetricType, value);
      if (analysis.isAnomaly) {
        anomalies.push(analysis);
      }
    }

    // Detect pattern breaks
    const patternBreaks = await this.detectPatternBreaks(userEmail);

    // Determine overall health status
    const overallHealth = this.calculateOverallHealth(anomalies, patternBreaks);

    return {
      userEmail,
      timestamp: new Date().toISOString(),
      metrics: metrics as Record<MetricType, number>,
      anomalies,
      patternBreaks,
      overallHealth,
    };
  }

  // ---------------------------------------------------------------------------
  // HELPER METHODS
  // ---------------------------------------------------------------------------

  private async getLatestHealthData(userEmail: string): Promise<Record<string, number>> {
    // Get from health_baselines table (existing infrastructure)
    const { data: baselines } = await this.supabase
      .from('user_health_baselines')
      .select('*')
      .eq('user_email', userEmail)
      .single();

    if (!baselines) return {};

    return {
      sleep_score: baselines.avg_sleep_score,
      sleep_hours: baselines.avg_sleep_duration,
      deep_sleep_pct: baselines.avg_deep_sleep_pct,
      rem_sleep_pct: baselines.avg_rem_sleep_pct,
      hrv: baselines.avg_hrv,
      resting_hr: baselines.avg_resting_hr,
      recovery_score: baselines.avg_recovery_score,
      steps: baselines.avg_steps,
      active_calories: baselines.avg_active_calories,
    };
  }

  private async checkActivityPatternBreak(userEmail: string): Promise<PatternBreak | null> {
    // Check if user typically has activity at this time but hasn't today
    const now = new Date();
    const hour = now.getHours();

    // Only check during typical active hours (7am - 9pm)
    if (hour < 7 || hour > 21) return null;

    const { data: recentActivity } = await this.supabase
      .from('oura_activity')
      .select('steps, active_calories')
      .eq('user_email', userEmail)
      .gte('activity_date', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('activity_date', { ascending: false })
      .limit(1);

    if (!recentActivity || recentActivity.length === 0) {
      return {
        patternType: 'no_activity_data',
        description: 'No activity data recorded today',
        severity: 'medium',
        lastOccurrence: null,
        daysMissed: 1,
      };
    }

    const baseline = await this.getBaseline(userEmail, 'steps');
    if (baseline && baseline.sample_count >= 7) {
      const todaySteps = recentActivity[0].steps || 0;
      const expectedByNow = (baseline.baseline_value / 24) * hour;

      if (todaySteps < expectedByNow * 0.3) {
        return {
          patternType: 'low_activity',
          description: `Activity significantly below typical pattern (${todaySteps} steps vs ~${Math.round(expectedByNow)} expected)`,
          severity: 'high',
          lastOccurrence: new Date().toISOString(),
          daysMissed: 0,
        };
      }
    }

    return null;
  }

  private async checkSleepPatternBreak(userEmail: string): Promise<PatternBreak | null> {
    const { data: recentSleep } = await this.supabase
      .from('oura_sleep')
      .select('sleep_score, total_sleep_duration')
      .eq('user_email', userEmail)
      .gte('sleep_date', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('sleep_date', { ascending: false })
      .limit(1);

    if (!recentSleep || recentSleep.length === 0) {
      return {
        patternType: 'no_sleep_data',
        description: 'No sleep data recorded in past 48 hours',
        severity: 'medium',
        lastOccurrence: null,
        daysMissed: 2,
      };
    }

    return null;
  }

  private async checkMedicationPatternBreak(userEmail: string): Promise<PatternBreak | null> {
    // Check medication compliance
    const { data: medications } = await this.supabase
      .from('medications')
      .select('id, name')
      .eq('user_email', userEmail)
      .eq('is_active', true);

    if (!medications || medications.length === 0) return null;

    const { data: recentLogs } = await this.supabase
      .from('medication_logs')
      .select('medication_id, taken_at')
      .eq('user_email', userEmail)
      .gte('scheduled_time', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .is('taken_at', null);

    if (recentLogs && recentLogs.length > 0) {
      return {
        patternType: 'medication_missed',
        description: `${recentLogs.length} medication dose(s) not confirmed in past 24 hours`,
        severity: recentLogs.length >= 2 ? 'high' : 'medium',
        lastOccurrence: new Date().toISOString(),
        daysMissed: 0,
      };
    }

    return null;
  }

  private async checkDataGap(userEmail: string): Promise<PatternBreak | null> {
    // Check when we last received any health data
    const { data: lastSync } = await this.supabase
      .from('oura_daily_data')
      .select('created_at')
      .eq('user_email', userEmail)
      .order('created_at', { ascending: false })
      .limit(1);

    if (!lastSync || lastSync.length === 0) {
      return {
        patternType: 'no_data',
        description: 'No health data ever synced',
        severity: 'info',
        lastOccurrence: null,
        daysMissed: 999,
      };
    }

    const lastSyncDate = new Date(lastSync[0].created_at);
    const hoursSinceSync = (Date.now() - lastSyncDate.getTime()) / (1000 * 60 * 60);

    if (hoursSinceSync >= 48) {
      return {
        patternType: 'sync_gap',
        description: `No data sync in ${Math.round(hoursSinceSync)} hours`,
        severity: hoursSinceSync >= 72 ? 'critical' : 'high',
        lastOccurrence: lastSync[0].created_at,
        daysMissed: Math.floor(hoursSinceSync / 24),
      };
    }

    return null;
  }

  private generateAnomalyMessage(
    metricType: MetricType,
    value: number,
    baseline: ShareBaseline,
    deviationPct: number
  ): string {
    const direction = value > baseline.baseline_value ? 'higher' : 'lower';
    const metricLabels: Record<MetricType, string> = {
      sleep_score: 'Sleep score',
      sleep_hours: 'Sleep duration',
      deep_sleep_pct: 'Deep sleep',
      rem_sleep_pct: 'REM sleep',
      hrv: 'Heart rate variability',
      resting_hr: 'Resting heart rate',
      recovery_score: 'Recovery score',
      steps: 'Step count',
      active_calories: 'Active calories',
      activity_score: 'Activity score',
      glucose_avg: 'Average glucose',
      glucose_variability: 'Glucose variability',
      time_in_range: 'Time in range',
      hydration: 'Hydration',
      protein_intake: 'Protein intake',
      calorie_intake: 'Calorie intake',
    };

    const label = metricLabels[metricType] || metricType;
    return `${label} is ${Math.round(deviationPct)}% ${direction} than usual (${Math.round(value)} vs typical ${Math.round(baseline.baseline_value)})`;
  }

  private generateRecommendation(
    metricType: MetricType,
    value: number,
    baseline: ShareBaseline
  ): string {
    const isLow = value < baseline.baseline_value;

    const recommendations: Record<MetricType, { low: string; high: string }> = {
      sleep_score: {
        low: 'Check in to see if sleep environment has changed. Consider earlier bedtime.',
        high: 'Great sleep! No action needed.',
      },
      sleep_hours: {
        low: 'Insufficient sleep detected. May need earlier bedtime or check for sleep disruptions.',
        high: 'Extended sleep may indicate fatigue or illness. Monitor energy levels.',
      },
      deep_sleep_pct: {
        low: 'Low deep sleep affects recovery. Consider limiting caffeine and screen time before bed.',
        high: 'Excellent deep sleep for recovery.',
      },
      rem_sleep_pct: {
        low: 'Low REM affects cognitive function. Consider stress management.',
        high: 'Good REM sleep for mental restoration.',
      },
      hrv: {
        low: 'Low HRV may indicate stress or fatigue. Consider rest and recovery activities.',
        high: 'Elevated HRV indicates good recovery.',
      },
      resting_hr: {
        low: 'Unusually low heart rate. If symptomatic, contact healthcare provider.',
        high: 'Elevated heart rate may indicate stress, illness, or dehydration.',
      },
      recovery_score: {
        low: 'Low recovery suggests need for rest. Consider lighter activity today.',
        high: 'Excellent recovery. Good day for more active pursuits.',
      },
      steps: {
        low: 'Activity is lower than usual. Gentle movement can help.',
        high: 'More active than usual. Ensure adequate rest and hydration.',
      },
      active_calories: {
        low: 'Lower energy expenditure. Consider a short walk if feeling up to it.',
        high: 'High activity day. Ensure proper nutrition and rest.',
      },
      activity_score: {
        low: 'Activity is below baseline. Even light movement helps.',
        high: 'Very active day. Balance with recovery.',
      },
      glucose_avg: {
        low: 'Blood sugar trending lower. Consider a balanced snack.',
        high: 'Blood sugar elevated. Review recent meals and activity.',
      },
      glucose_variability: {
        low: 'Stable glucose levels. Keep up the good work.',
        high: 'High glucose variability. Focus on consistent meal timing.',
      },
      time_in_range: {
        low: 'More time outside target range. Review meal patterns.',
        high: 'Excellent glucose control.',
      },
      hydration: {
        low: 'Below typical hydration. Increase water intake.',
        high: 'Well hydrated.',
      },
      protein_intake: {
        low: 'Protein intake lower than usual. Add protein-rich foods.',
        high: 'Good protein intake.',
      },
      calorie_intake: {
        low: 'Eating less than usual. Ensure adequate nutrition.',
        high: 'Higher calorie intake. Balance with activity.',
      },
    };

    const rec = recommendations[metricType];
    return rec ? (isLow ? rec.low : rec.high) : 'Monitor this metric and consult healthcare provider if concerned.';
  }

  private calculateOverallHealth(
    anomalies: AnomalyResult[],
    patternBreaks: PatternBreak[]
  ): 'good' | 'attention' | 'concern' | 'critical' {
    const hasCritical = anomalies.some(a => a.severity === 'critical') ||
      patternBreaks.some(p => p.severity === 'critical');
    const hasHigh = anomalies.some(a => a.severity === 'high') ||
      patternBreaks.some(p => p.severity === 'high');
    const hasMedium = anomalies.some(a => a.severity === 'medium') ||
      patternBreaks.some(p => p.severity === 'medium');

    if (hasCritical) return 'critical';
    if (hasHigh) return 'concern';
    if (hasMedium) return 'attention';
    return 'good';
  }
}

// Lazy singleton pattern to avoid build-time initialization errors
let _anomalyDetectionServiceInstance: AnomalyDetectionService | null = null;

export const anomalyDetectionService = {
  get instance() {
    if (!_anomalyDetectionServiceInstance) {
      _anomalyDetectionServiceInstance = new AnomalyDetectionService();
    }
    return _anomalyDetectionServiceInstance;
  },
  buildHealthSnapshot: (...args: Parameters<AnomalyDetectionService['buildHealthSnapshot']>) =>
    anomalyDetectionService.instance.buildHealthSnapshot(...args),
  updateBaseline: (...args: Parameters<AnomalyDetectionService['updateBaseline']>) =>
    anomalyDetectionService.instance.updateBaseline(...args),
  detectAnomalies: (...args: Parameters<AnomalyDetectionService['detectAnomalies']>) =>
    anomalyDetectionService.instance.detectAnomalies(...args),
};
