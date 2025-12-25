/**
 * Context Builder Service
 * Builds rich health context for alerts and caregiver dashboards
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { HealthContext, MedicationStatus, ContextEvent, BaselineComparison } from './alert-routing-service';
import { MetricType, TrendDirection, ShareBaseline } from './anomaly-detection-service';

// =============================================================================
// TYPES
// =============================================================================

export interface HealthTimeline {
  events: TimelineEvent[];
  dateRange: { start: string; end: string };
}

export interface TimelineEvent {
  id: string;
  type: 'sleep' | 'activity' | 'glucose' | 'medication' | 'alert' | 'vital' | 'nutrition';
  timestamp: string;
  title: string;
  description: string;
  value?: number;
  unit?: string;
  severity?: 'good' | 'attention' | 'concern';
  metadata?: Record<string, unknown>;
}

export interface TrendAnalysis {
  metric: string;
  direction: TrendDirection;
  changePercent: number;
  periodDays: number;
  significance: 'significant' | 'moderate' | 'minimal';
  interpretation: string;
}

export interface DailySummary {
  date: string;
  sleepScore: number | null;
  sleepHours: number | null;
  recoveryScore: number | null;
  steps: number | null;
  activeCalories: number | null;
  glucoseAvg: number | null;
  timeInRange: number | null;
  medicationCompliance: number | null;
  overallStatus: 'good' | 'attention' | 'concern';
  highlights: string[];
  concerns: string[];
}

export interface CaregiverReport {
  sharerEmail: string;
  sharerName: string;
  reportDate: string;
  periodDays: number;
  summary: string;
  dailySummaries: DailySummary[];
  trends: TrendAnalysis[];
  alerts: { count: number; critical: number; high: number; resolved: number };
  recommendations: string[];
}

export interface ClinicalReport {
  patientEmail: string;
  patientName: string;
  reportDate: string;
  periodDays: number;
  executiveSummary: string;
  vitalsOverview: Record<string, { avg: number; min: number; max: number; trend: string }>;
  medicationCompliance: {
    overallRate: number;
    missedDoses: { medication: string; count: number }[];
  };
  concerningPatterns: string[];
  recommendations: string[];
  dataQuality: { completeness: number; lastSync: string };
}

// =============================================================================
// SERVICE
// =============================================================================

export class ContextBuilderService {
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
  // ALERT CONTEXT
  // ---------------------------------------------------------------------------

  /**
   * Build full health context for an alert
   */
  async buildAlertContext(userEmail: string, alertType: string): Promise<HealthContext> {
    const [
      recentMetrics,
      trends,
      medications,
      recentEvents,
      baselineComparisons,
    ] = await Promise.all([
      this.getRecentMetrics(userEmail),
      this.getMetricTrends(userEmail),
      this.getMedicationStatus(userEmail),
      this.getRecentEvents(userEmail, 3),
      this.getBaselineComparisons(userEmail),
    ]);

    return {
      snapshot: null, // Will be filled by anomaly detection
      recentMetrics,
      trends,
      medications,
      recentEvents,
      baselineComparisons,
    };
  }

  /**
   * Get recent metrics for context
   */
  async getRecentMetrics(userEmail: string): Promise<Record<string, number>> {
    const metrics: Record<string, number> = {};

    // Get latest sleep data
    const { data: sleep } = await this.supabase
      .from('oura_sleep')
      .select('sleep_score, total_sleep_duration, deep_sleep_duration, rem_sleep_duration')
      .eq('user_email', userEmail)
      .order('sleep_date', { ascending: false })
      .limit(1);

    if (sleep?.[0]) {
      metrics.sleep_score = sleep[0].sleep_score;
      metrics.sleep_hours = Math.round((sleep[0].total_sleep_duration || 0) / 3600 * 10) / 10;
      if (sleep[0].total_sleep_duration > 0) {
        metrics.deep_sleep_pct = Math.round((sleep[0].deep_sleep_duration / sleep[0].total_sleep_duration) * 100);
        metrics.rem_sleep_pct = Math.round((sleep[0].rem_sleep_duration / sleep[0].total_sleep_duration) * 100);
      }
    }

    // Get latest activity data
    const { data: activity } = await this.supabase
      .from('oura_activity')
      .select('steps, active_calories, score')
      .eq('user_email', userEmail)
      .order('activity_date', { ascending: false })
      .limit(1);

    if (activity?.[0]) {
      metrics.steps = activity[0].steps;
      metrics.active_calories = activity[0].active_calories;
      metrics.activity_score = activity[0].score;
    }

    // Get latest readiness/HRV data
    const { data: readiness } = await this.supabase
      .from('oura_readiness')
      .select('score, hrv_balance, resting_heart_rate')
      .eq('user_email', userEmail)
      .order('readiness_date', { ascending: false })
      .limit(1);

    if (readiness?.[0]) {
      metrics.recovery_score = readiness[0].score;
      metrics.hrv = readiness[0].hrv_balance;
      metrics.resting_hr = readiness[0].resting_heart_rate;
    }

    // Get latest glucose data
    const { data: glucose } = await this.supabase
      .from('glucose_readings')
      .select('glucose_value')
      .eq('user_email', userEmail)
      .gte('reading_time', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('reading_time', { ascending: false });

    if (glucose && glucose.length > 0) {
      const values = glucose.map(g => g.glucose_value);
      metrics.glucose_avg = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
      metrics.glucose_latest = values[0];
      const inRange = values.filter(v => v >= 70 && v <= 140).length;
      metrics.time_in_range = Math.round((inRange / values.length) * 100);
    }

    return metrics;
  }

  /**
   * Get metric trends for context
   */
  async getMetricTrends(userEmail: string): Promise<Record<string, string>> {
    const trends: Record<string, string> = {};

    // Get baselines with trend info
    const { data: baselines } = await this.supabase
      .from('share_baselines')
      .select('metric_type, trend_direction, trend_duration_days')
      .eq('user_email', userEmail);

    if (baselines) {
      for (const baseline of baselines) {
        if (baseline.trend_duration_days >= 3) {
          trends[baseline.metric_type] = baseline.trend_direction;
        }
      }
    }

    return trends;
  }

  /**
   * Get medication status
   */
  async getMedicationStatus(userEmail: string): Promise<MedicationStatus[]> {
    const { data: medications } = await this.supabase
      .from('medications')
      .select('id, name, dosage, frequency, schedule_times')
      .eq('user_email', userEmail)
      .eq('is_active', true);

    if (!medications) return [];

    const statuses: MedicationStatus[] = [];

    for (const med of medications) {
      // Get recent logs for this medication
      const { data: logs } = await this.supabase
        .from('medication_logs')
        .select('taken_at, scheduled_time')
        .eq('medication_id', med.id)
        .gte('scheduled_time', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('scheduled_time', { ascending: false });

      const totalDoses = logs?.length || 0;
      const takenDoses = logs?.filter(l => l.taken_at !== null).length || 0;
      const missedDoses = totalDoses - takenDoses;
      const compliance = totalDoses > 0 ? Math.round((takenDoses / totalDoses) * 100) : 100;

      // Find last taken time
      const lastTaken = logs?.find(l => l.taken_at !== null)?.taken_at || null;

      // Find next scheduled (first untaken scheduled time in future)
      const now = new Date();
      const nextDue = logs?.find(l =>
        l.taken_at === null &&
        new Date(l.scheduled_time) > now
      )?.scheduled_time || null;

      statuses.push({
        name: med.name,
        lastTaken,
        nextDue,
        compliance24h: compliance,
        missedDoses,
      });
    }

    return statuses;
  }

  /**
   * Get recent health events
   */
  async getRecentEvents(userEmail: string, days: number): Promise<ContextEvent[]> {
    const events: ContextEvent[] = [];
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // Get recent alerts
    const { data: alerts } = await this.supabase
      .from('share_alerts')
      .select('alert_type, severity, title, created_at')
      .eq('sharer_email', userEmail)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(5);

    if (alerts) {
      for (const alert of alerts) {
        events.push({
          type: 'alert',
          description: alert.title,
          timestamp: alert.created_at,
          severity: alert.severity,
        });
      }
    }

    // Get notable sleep events (very low scores)
    const { data: sleepEvents } = await this.supabase
      .from('oura_sleep')
      .select('sleep_date, sleep_score')
      .eq('user_email', userEmail)
      .gte('sleep_date', since.split('T')[0])
      .lt('sleep_score', 60)
      .order('sleep_date', { ascending: false });

    if (sleepEvents) {
      for (const sleep of sleepEvents) {
        events.push({
          type: 'sleep_disruption',
          description: `Low sleep score: ${sleep.sleep_score}`,
          timestamp: sleep.sleep_date,
          severity: sleep.sleep_score < 50 ? 'high' : 'medium',
        });
      }
    }

    // Get missed medications
    const { data: missedMeds } = await this.supabase
      .from('medication_logs')
      .select('scheduled_time, medications(name)')
      .eq('user_email', userEmail)
      .gte('scheduled_time', since)
      .is('taken_at', null)
      .lt('scheduled_time', new Date().toISOString());

    if (missedMeds) {
      for (const missed of missedMeds) {
        const medName = (missed.medications as { name: string })?.name || 'Medication';
        events.push({
          type: 'medication_missed',
          description: `${medName} dose not confirmed`,
          timestamp: missed.scheduled_time,
          severity: 'medium',
        });
      }
    }

    // Sort by timestamp
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return events.slice(0, 10);
  }

  /**
   * Get baseline comparisons
   */
  async getBaselineComparisons(userEmail: string): Promise<BaselineComparison[]> {
    const comparisons: BaselineComparison[] = [];
    const metrics = await this.getRecentMetrics(userEmail);

    const { data: baselines } = await this.supabase
      .from('share_baselines')
      .select('*')
      .eq('user_email', userEmail);

    if (!baselines) return comparisons;

    for (const baseline of baselines) {
      const current = metrics[baseline.metric_type];
      if (current === undefined) continue;

      const deviationPct = Math.round(
        Math.abs((current - baseline.baseline_value) / baseline.baseline_value) * 100
      );

      comparisons.push({
        metric: baseline.metric_type,
        current,
        baseline: Math.round(baseline.baseline_value * 10) / 10,
        deviationPct,
        trend: baseline.trend_direction,
      });
    }

    return comparisons;
  }

  // ---------------------------------------------------------------------------
  // TIMELINE
  // ---------------------------------------------------------------------------

  /**
   * Build health timeline for caregiver view
   */
  async buildHealthTimeline(
    userEmail: string,
    days: number = 7
  ): Promise<HealthTimeline> {
    const events: TimelineEvent[] = [];
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const endDate = new Date();

    // Get sleep events
    const { data: sleepData } = await this.supabase
      .from('oura_sleep')
      .select('*')
      .eq('user_email', userEmail)
      .gte('sleep_date', startDate.toISOString().split('T')[0])
      .order('sleep_date', { ascending: false });

    if (sleepData) {
      for (const sleep of sleepData) {
        const sleepHours = Math.round((sleep.total_sleep_duration || 0) / 3600 * 10) / 10;
        events.push({
          id: `sleep-${sleep.id}`,
          type: 'sleep',
          timestamp: sleep.sleep_date,
          title: `Sleep Score: ${sleep.sleep_score}`,
          description: `${sleepHours} hours of sleep`,
          value: sleep.sleep_score,
          severity: sleep.sleep_score >= 70 ? 'good' : sleep.sleep_score >= 50 ? 'attention' : 'concern',
          metadata: {
            deepSleep: sleep.deep_sleep_duration,
            remSleep: sleep.rem_sleep_duration,
            efficiency: sleep.efficiency,
          },
        });
      }
    }

    // Get activity events
    const { data: activityData } = await this.supabase
      .from('oura_activity')
      .select('*')
      .eq('user_email', userEmail)
      .gte('activity_date', startDate.toISOString().split('T')[0])
      .order('activity_date', { ascending: false });

    if (activityData) {
      for (const activity of activityData) {
        events.push({
          id: `activity-${activity.id}`,
          type: 'activity',
          timestamp: activity.activity_date,
          title: `${activity.steps?.toLocaleString() || 0} steps`,
          description: `${activity.active_calories || 0} active calories`,
          value: activity.steps,
          unit: 'steps',
          severity: (activity.steps || 0) >= 5000 ? 'good' : (activity.steps || 0) >= 2000 ? 'attention' : 'concern',
        });
      }
    }

    // Get alerts
    const { data: alertData } = await this.supabase
      .from('share_alerts')
      .select('*')
      .eq('sharer_email', userEmail)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });

    if (alertData) {
      for (const alert of alertData) {
        events.push({
          id: `alert-${alert.id}`,
          type: 'alert',
          timestamp: alert.created_at,
          title: alert.title,
          description: alert.message,
          severity: alert.severity === 'critical' || alert.severity === 'high' ? 'concern' : 'attention',
          metadata: {
            alertType: alert.alert_type,
            status: alert.status,
            severity: alert.severity,
          },
        });
      }
    }

    // Sort by timestamp
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return {
      events,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // REPORTS
  // ---------------------------------------------------------------------------

  /**
   * Generate daily summary
   */
  async getDailySummary(userEmail: string, date: string): Promise<DailySummary> {
    const highlights: string[] = [];
    const concerns: string[] = [];

    // Get sleep for this date
    const { data: sleep } = await this.supabase
      .from('oura_sleep')
      .select('*')
      .eq('user_email', userEmail)
      .eq('sleep_date', date)
      .single();

    // Get activity for this date
    const { data: activity } = await this.supabase
      .from('oura_activity')
      .select('*')
      .eq('user_email', userEmail)
      .eq('activity_date', date)
      .single();

    // Get readiness for this date
    const { data: readiness } = await this.supabase
      .from('oura_readiness')
      .select('*')
      .eq('user_email', userEmail)
      .eq('readiness_date', date)
      .single();

    // Calculate medication compliance
    const { data: medLogs } = await this.supabase
      .from('medication_logs')
      .select('taken_at')
      .eq('user_email', userEmail)
      .gte('scheduled_time', `${date}T00:00:00`)
      .lt('scheduled_time', `${date}T23:59:59`);

    const medTotal = medLogs?.length || 0;
    const medTaken = medLogs?.filter(l => l.taken_at !== null).length || 0;
    const medCompliance = medTotal > 0 ? Math.round((medTaken / medTotal) * 100) : null;

    // Generate highlights and concerns
    if (sleep?.sleep_score >= 80) highlights.push('Excellent sleep quality');
    else if (sleep?.sleep_score < 50) concerns.push('Poor sleep quality');

    if ((activity?.steps || 0) >= 8000) highlights.push('Great activity level');
    else if ((activity?.steps || 0) < 2000) concerns.push('Very low activity');

    if (medCompliance === 100) highlights.push('All medications taken');
    else if (medCompliance !== null && medCompliance < 80) concerns.push('Missed medication doses');

    // Determine overall status
    let overallStatus: 'good' | 'attention' | 'concern' = 'good';
    if (concerns.length > 0) overallStatus = 'concern';
    else if (highlights.length === 0) overallStatus = 'attention';

    return {
      date,
      sleepScore: sleep?.sleep_score || null,
      sleepHours: sleep ? Math.round((sleep.total_sleep_duration || 0) / 3600 * 10) / 10 : null,
      recoveryScore: readiness?.score || null,
      steps: activity?.steps || null,
      activeCalories: activity?.active_calories || null,
      glucoseAvg: null, // TODO: Add glucose summary
      timeInRange: null,
      medicationCompliance: medCompliance,
      overallStatus,
      highlights,
      concerns,
    };
  }

  /**
   * Generate caregiver report
   */
  async generateCaregiverReport(
    sharerEmail: string,
    caregiverEmail: string,
    periodDays: number = 7
  ): Promise<CaregiverReport> {
    // Get sharer's name
    const { data: sharerProfile } = await this.supabase
      .from('profiles')
      .select('display_name, email')
      .eq('email', sharerEmail)
      .single();

    const sharerName = sharerProfile?.display_name || sharerEmail.split('@')[0];

    // Get daily summaries
    const dailySummaries: DailySummary[] = [];
    for (let i = 0; i < periodDays; i++) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const summary = await this.getDailySummary(sharerEmail, date);
      dailySummaries.push(summary);
    }

    // Get trends
    const trends = await this.analyzeTrends(sharerEmail, periodDays);

    // Get alert counts
    const { data: alertStats } = await this.supabase
      .from('share_alerts')
      .select('severity, status')
      .eq('sharer_email', sharerEmail)
      .gte('created_at', new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString());

    const alertCounts = {
      count: alertStats?.length || 0,
      critical: alertStats?.filter(a => a.severity === 'critical').length || 0,
      high: alertStats?.filter(a => a.severity === 'high').length || 0,
      resolved: alertStats?.filter(a => a.status === 'resolved').length || 0,
    };

    // Generate summary
    const goodDays = dailySummaries.filter(d => d.overallStatus === 'good').length;
    const concernDays = dailySummaries.filter(d => d.overallStatus === 'concern').length;

    let summary = `Over the past ${periodDays} days, ${sharerName} had ${goodDays} good days`;
    if (concernDays > 0) {
      summary += ` and ${concernDays} days that needed attention`;
    }
    summary += '.';

    // Generate recommendations
    const recommendations: string[] = [];
    const avgSteps = dailySummaries
      .filter(d => d.steps !== null)
      .reduce((sum, d) => sum + (d.steps || 0), 0) / periodDays;

    if (avgSteps < 3000) {
      recommendations.push('Consider encouraging gentle daily walks to increase activity');
    }

    const avgSleep = dailySummaries
      .filter(d => d.sleepHours !== null)
      .reduce((sum, d) => sum + (d.sleepHours || 0), 0) / periodDays;

    if (avgSleep < 6) {
      recommendations.push('Sleep duration is below recommended levels. Consider earlier bedtime routine');
    }

    return {
      sharerEmail,
      sharerName,
      reportDate: new Date().toISOString(),
      periodDays,
      summary,
      dailySummaries,
      trends,
      alerts: alertCounts,
      recommendations,
    };
  }

  /**
   * Analyze trends over period
   */
  private async analyzeTrends(userEmail: string, periodDays: number): Promise<TrendAnalysis[]> {
    const trends: TrendAnalysis[] = [];
    const { data: baselines } = await this.supabase
      .from('share_baselines')
      .select('*')
      .eq('user_email', userEmail)
      .gte('trend_duration_days', 3);

    if (!baselines) return trends;

    const metricLabels: Record<string, string> = {
      sleep_score: 'Sleep quality',
      steps: 'Daily activity',
      hrv: 'Heart rate variability',
      recovery_score: 'Recovery',
      glucose_avg: 'Average glucose',
    };

    for (const baseline of baselines) {
      const label = metricLabels[baseline.metric_type] || baseline.metric_type;

      let interpretation = '';
      if (baseline.trend_direction === 'improving') {
        interpretation = `${label} has been improving over the past ${baseline.trend_duration_days} days`;
      } else if (baseline.trend_direction === 'declining') {
        interpretation = `${label} shows a declining trend that may need attention`;
      } else {
        interpretation = `${label} has been stable`;
      }

      trends.push({
        metric: baseline.metric_type,
        direction: baseline.trend_direction,
        changePercent: 0, // TODO: Calculate actual change
        periodDays: baseline.trend_duration_days,
        significance: baseline.trend_duration_days >= 7 ? 'significant' : 'moderate',
        interpretation,
      });
    }

    return trends;
  }

  /**
   * Format context for caregiver notification (brief)
   */
  formatContextForNotification(context: HealthContext): string {
    const parts: string[] = [];

    // Recent metrics summary
    if (context.recentMetrics.sleep_score) {
      parts.push(`Sleep: ${context.recentMetrics.sleep_score}`);
    }
    if (context.recentMetrics.steps) {
      parts.push(`Steps: ${context.recentMetrics.steps.toLocaleString()}`);
    }
    if (context.recentMetrics.recovery_score) {
      parts.push(`Recovery: ${context.recentMetrics.recovery_score}`);
    }

    // Medication status
    const missedMeds = context.medications.filter(m => m.missedDoses > 0);
    if (missedMeds.length > 0) {
      parts.push(`Missed meds: ${missedMeds.length}`);
    }

    return parts.join(' • ');
  }

  /**
   * Format context for clinical report (detailed)
   */
  formatContextForClinical(context: HealthContext): string {
    const sections: string[] = [];

    // Metrics section
    sections.push('## Current Metrics');
    for (const [metric, value] of Object.entries(context.recentMetrics)) {
      const comparison = context.baselineComparisons.find(b => b.metric === metric);
      let line = `- ${metric}: ${value}`;
      if (comparison) {
        line += ` (baseline: ${comparison.baseline}, ${comparison.deviationPct}% deviation)`;
      }
      sections.push(line);
    }

    // Medications section
    sections.push('\n## Medication Compliance');
    for (const med of context.medications) {
      sections.push(`- ${med.name}: ${med.compliance24h}% (${med.missedDoses} missed in 24h)`);
    }

    // Recent events section
    if (context.recentEvents.length > 0) {
      sections.push('\n## Recent Events');
      for (const event of context.recentEvents) {
        sections.push(`- [${event.severity || 'info'}] ${event.description} (${event.timestamp})`);
      }
    }

    return sections.join('\n');
  }
}

// Lazy singleton pattern to avoid build-time initialization errors
let _contextBuilderServiceInstance: ContextBuilderService | null = null;

export const contextBuilderService = {
  get instance() {
    if (!_contextBuilderServiceInstance) {
      _contextBuilderServiceInstance = new ContextBuilderService();
    }
    return _contextBuilderServiceInstance;
  },
  buildAlertContext: (...args: Parameters<ContextBuilderService['buildAlertContext']>) =>
    contextBuilderService.instance.buildAlertContext(...args),
  getRecentMetrics: (...args: Parameters<ContextBuilderService['getRecentMetrics']>) =>
    contextBuilderService.instance.getRecentMetrics(...args),
  buildWeeklySummary: (...args: Parameters<ContextBuilderService['buildWeeklySummary']>) =>
    contextBuilderService.instance.buildWeeklySummary(...args),
};
