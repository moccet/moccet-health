/**
 * Health Pattern Analyzer
 *
 * Analyzes health data from Oura, Whoop, and Apple Health to detect:
 * 1. Health trends (HRV, sleep, recovery, activity)
 * 2. Correlations with life events (from Gmail/Slack)
 *
 * Pro/Max tier feature.
 */

import { createClient } from '@/lib/supabase/server';
import type { LifeContextAnalysis } from './content-sentiment-analyzer';
import { getLifeContext } from './content-sentiment-analyzer';

// ============================================================================
// TYPES
// ============================================================================

export interface HealthPattern {
  type: 'hrv_trend' | 'sleep_trend' | 'recovery_trend' | 'activity_trend' | 'sleep_efficiency_trend';
  direction: 'improving' | 'stable' | 'declining';
  change: number; // percentage change
  period: string; // "7 days", "14 days"
  significance: 'minor' | 'notable' | 'significant';
  summary: string;
  currentValue?: number;
  previousValue?: number;
}

export interface HealthCorrelation {
  healthMetric: string; // "HRV", "Sleep efficiency"
  lifeEvent: string; // "NYC trip", "Interview period"
  lifeEventSource: 'gmail' | 'slack' | 'outlook' | 'calendar';
  correlation: 'positive' | 'negative' | 'neutral';
  confidence: number; // 0-1
  changePercentage?: number;
  insight: string;
}

export interface HealthAnalysis {
  patterns: HealthPattern[];
  correlations: HealthCorrelation[];
  summary: string;
  sourcesAnalyzed: string[];
  analyzedAt: string;
}

// Types for health data from ecosystem-fetcher
interface OuraData {
  avgSleepHours?: number;
  avgReadiness?: number;
  avgHRV?: number;
  sleepArchitecture?: {
    deepSleepPercent: number;
    remSleepPercent: number;
    lightSleepPercent: number;
    efficiency: number;
  };
  sleepData?: Array<{
    day?: string;
    total_sleep_duration?: number;
    efficiency?: number;
    sleep_score?: number;
  }>;
  readinessData?: Array<{
    day?: string;
    score?: number;
  }>;
  hrvData?: Array<{
    day?: string;
    average_hrv?: number;
  }>;
}

interface WhoopData {
  avgRecovery?: number;
  avgStrain?: number;
  avgSleepPerformance?: number;
  avgHRV?: number;
  recoveryData?: Array<{
    date?: string;
    recovery_score?: number;
    hrv_rmssd_milli?: number;
  }>;
  sleepData?: Array<{
    date?: string;
    quality_duration_ms?: number;
    sleep_performance_percentage?: number;
  }>;
}

// ============================================================================
// PATTERN DETECTION
// ============================================================================

/**
 * Analyze health data for trends and patterns
 */
export async function analyzeHealthPatterns(
  ouraData: OuraData | null,
  whoopData: WhoopData | null,
  appleHealthData: any | null
): Promise<HealthPattern[]> {
  const patterns: HealthPattern[] = [];

  // Analyze Oura data
  if (ouraData) {
    // HRV trend
    if (ouraData.hrvData && ouraData.hrvData.length >= 7) {
      const hrvPattern = analyzeHrvTrend(ouraData.hrvData);
      if (hrvPattern) patterns.push(hrvPattern);
    }

    // Sleep efficiency trend
    if (ouraData.sleepData && ouraData.sleepData.length >= 7) {
      const sleepPattern = analyzeSleepTrend(ouraData.sleepData);
      if (sleepPattern) patterns.push(sleepPattern);
    }

    // Readiness/Recovery trend
    if (ouraData.readinessData && ouraData.readinessData.length >= 7) {
      const readinessPattern = analyzeReadinessTrend(ouraData.readinessData);
      if (readinessPattern) patterns.push(readinessPattern);
    }
  }

  // Analyze Whoop data
  if (whoopData) {
    // Recovery trend
    if (whoopData.recoveryData && whoopData.recoveryData.length >= 7) {
      const recoveryPattern = analyzeWhoopRecoveryTrend(whoopData.recoveryData);
      if (recoveryPattern) patterns.push(recoveryPattern);
    }

    // Sleep performance trend
    if (whoopData.sleepData && whoopData.sleepData.length >= 7) {
      const sleepPattern = analyzeWhoopSleepTrend(whoopData.sleepData);
      if (sleepPattern) patterns.push(sleepPattern);
    }
  }

  // Analyze Apple Health data
  if (appleHealthData?.dailyMetrics && appleHealthData.dailyMetrics.length >= 7) {
    const activityPattern = analyzeActivityTrend(appleHealthData.dailyMetrics);
    if (activityPattern) patterns.push(activityPattern);
  }

  return patterns;
}

/**
 * Analyze HRV trend from Oura data
 */
function analyzeHrvTrend(hrvData: OuraData['hrvData']): HealthPattern | null {
  if (!hrvData || hrvData.length < 7) return null;

  const validData = hrvData.filter(d => d.average_hrv && d.average_hrv > 0);
  if (validData.length < 7) return null;

  // Split into first half and second half
  const midpoint = Math.floor(validData.length / 2);
  const firstHalf = validData.slice(0, midpoint);
  const secondHalf = validData.slice(midpoint);

  const firstAvg = firstHalf.reduce((sum, d) => sum + (d.average_hrv || 0), 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, d) => sum + (d.average_hrv || 0), 0) / secondHalf.length;

  const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;

  let direction: 'improving' | 'stable' | 'declining';
  let significance: 'minor' | 'notable' | 'significant';

  if (Math.abs(changePercent) < 5) {
    direction = 'stable';
    significance = 'minor';
  } else if (changePercent > 0) {
    direction = 'improving';
    significance = changePercent > 15 ? 'significant' : changePercent > 8 ? 'notable' : 'minor';
  } else {
    direction = 'declining';
    significance = Math.abs(changePercent) > 15 ? 'significant' : Math.abs(changePercent) > 8 ? 'notable' : 'minor';
  }

  // Only report notable or significant changes
  if (significance === 'minor' && direction === 'stable') return null;

  return {
    type: 'hrv_trend',
    direction,
    change: Math.round(changePercent * 10) / 10,
    period: `${validData.length} days`,
    significance,
    summary: `HRV ${direction} by ${Math.abs(Math.round(changePercent))}% (${Math.round(firstAvg)}ms → ${Math.round(secondAvg)}ms)`,
    currentValue: Math.round(secondAvg),
    previousValue: Math.round(firstAvg),
  };
}

/**
 * Analyze sleep trend from Oura data
 */
function analyzeSleepTrend(sleepData: OuraData['sleepData']): HealthPattern | null {
  if (!sleepData || sleepData.length < 7) return null;

  const validData = sleepData.filter(d => d.efficiency && d.efficiency > 0);
  if (validData.length < 7) return null;

  const midpoint = Math.floor(validData.length / 2);
  const firstHalf = validData.slice(0, midpoint);
  const secondHalf = validData.slice(midpoint);

  const firstAvg = firstHalf.reduce((sum, d) => sum + (d.efficiency || 0), 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, d) => sum + (d.efficiency || 0), 0) / secondHalf.length;

  const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;

  let direction: 'improving' | 'stable' | 'declining';
  let significance: 'minor' | 'notable' | 'significant';

  if (Math.abs(changePercent) < 3) {
    direction = 'stable';
    significance = 'minor';
  } else if (changePercent > 0) {
    direction = 'improving';
    significance = changePercent > 10 ? 'significant' : changePercent > 5 ? 'notable' : 'minor';
  } else {
    direction = 'declining';
    significance = Math.abs(changePercent) > 10 ? 'significant' : Math.abs(changePercent) > 5 ? 'notable' : 'minor';
  }

  if (significance === 'minor' && direction === 'stable') return null;

  return {
    type: 'sleep_efficiency_trend',
    direction,
    change: Math.round(changePercent * 10) / 10,
    period: `${validData.length} days`,
    significance,
    summary: `Sleep efficiency ${direction} by ${Math.abs(Math.round(changePercent))}% (${Math.round(firstAvg)}% → ${Math.round(secondAvg)}%)`,
    currentValue: Math.round(secondAvg),
    previousValue: Math.round(firstAvg),
  };
}

/**
 * Analyze readiness trend from Oura data
 */
function analyzeReadinessTrend(readinessData: OuraData['readinessData']): HealthPattern | null {
  if (!readinessData || readinessData.length < 7) return null;

  const validData = readinessData.filter(d => d.score && d.score > 0);
  if (validData.length < 7) return null;

  const midpoint = Math.floor(validData.length / 2);
  const firstHalf = validData.slice(0, midpoint);
  const secondHalf = validData.slice(midpoint);

  const firstAvg = firstHalf.reduce((sum, d) => sum + (d.score || 0), 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, d) => sum + (d.score || 0), 0) / secondHalf.length;

  const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;

  let direction: 'improving' | 'stable' | 'declining';
  let significance: 'minor' | 'notable' | 'significant';

  if (Math.abs(changePercent) < 5) {
    direction = 'stable';
    significance = 'minor';
  } else if (changePercent > 0) {
    direction = 'improving';
    significance = changePercent > 15 ? 'significant' : changePercent > 8 ? 'notable' : 'minor';
  } else {
    direction = 'declining';
    significance = Math.abs(changePercent) > 15 ? 'significant' : Math.abs(changePercent) > 8 ? 'notable' : 'minor';
  }

  if (significance === 'minor' && direction === 'stable') return null;

  return {
    type: 'recovery_trend',
    direction,
    change: Math.round(changePercent * 10) / 10,
    period: `${validData.length} days`,
    significance,
    summary: `Readiness ${direction} by ${Math.abs(Math.round(changePercent))}% (${Math.round(firstAvg)} → ${Math.round(secondAvg)})`,
    currentValue: Math.round(secondAvg),
    previousValue: Math.round(firstAvg),
  };
}

/**
 * Analyze recovery trend from Whoop data
 */
function analyzeWhoopRecoveryTrend(recoveryData: WhoopData['recoveryData']): HealthPattern | null {
  if (!recoveryData || recoveryData.length < 7) return null;

  const validData = recoveryData.filter(d => d.recovery_score && d.recovery_score > 0);
  if (validData.length < 7) return null;

  const midpoint = Math.floor(validData.length / 2);
  const firstHalf = validData.slice(0, midpoint);
  const secondHalf = validData.slice(midpoint);

  const firstAvg = firstHalf.reduce((sum, d) => sum + (d.recovery_score || 0), 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, d) => sum + (d.recovery_score || 0), 0) / secondHalf.length;

  const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;

  let direction: 'improving' | 'stable' | 'declining';
  let significance: 'minor' | 'notable' | 'significant';

  if (Math.abs(changePercent) < 5) {
    direction = 'stable';
    significance = 'minor';
  } else if (changePercent > 0) {
    direction = 'improving';
    significance = changePercent > 15 ? 'significant' : changePercent > 8 ? 'notable' : 'minor';
  } else {
    direction = 'declining';
    significance = Math.abs(changePercent) > 15 ? 'significant' : Math.abs(changePercent) > 8 ? 'notable' : 'minor';
  }

  if (significance === 'minor' && direction === 'stable') return null;

  return {
    type: 'recovery_trend',
    direction,
    change: Math.round(changePercent * 10) / 10,
    period: `${validData.length} days`,
    significance,
    summary: `Whoop recovery ${direction} by ${Math.abs(Math.round(changePercent))}% (${Math.round(firstAvg)}% → ${Math.round(secondAvg)}%)`,
    currentValue: Math.round(secondAvg),
    previousValue: Math.round(firstAvg),
  };
}

/**
 * Analyze sleep performance trend from Whoop data
 */
function analyzeWhoopSleepTrend(sleepData: WhoopData['sleepData']): HealthPattern | null {
  if (!sleepData || sleepData.length < 7) return null;

  const validData = sleepData.filter(d => d.sleep_performance_percentage && d.sleep_performance_percentage > 0);
  if (validData.length < 7) return null;

  const midpoint = Math.floor(validData.length / 2);
  const firstHalf = validData.slice(0, midpoint);
  const secondHalf = validData.slice(midpoint);

  const firstAvg = firstHalf.reduce((sum, d) => sum + (d.sleep_performance_percentage || 0), 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, d) => sum + (d.sleep_performance_percentage || 0), 0) / secondHalf.length;

  const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;

  let direction: 'improving' | 'stable' | 'declining';
  let significance: 'minor' | 'notable' | 'significant';

  if (Math.abs(changePercent) < 3) {
    direction = 'stable';
    significance = 'minor';
  } else if (changePercent > 0) {
    direction = 'improving';
    significance = changePercent > 10 ? 'significant' : changePercent > 5 ? 'notable' : 'minor';
  } else {
    direction = 'declining';
    significance = Math.abs(changePercent) > 10 ? 'significant' : Math.abs(changePercent) > 5 ? 'notable' : 'minor';
  }

  if (significance === 'minor' && direction === 'stable') return null;

  return {
    type: 'sleep_trend',
    direction,
    change: Math.round(changePercent * 10) / 10,
    period: `${validData.length} days`,
    significance,
    summary: `Sleep performance ${direction} by ${Math.abs(Math.round(changePercent))}% (${Math.round(firstAvg)}% → ${Math.round(secondAvg)}%)`,
    currentValue: Math.round(secondAvg),
    previousValue: Math.round(firstAvg),
  };
}

/**
 * Analyze activity trend from Apple Health data
 */
function analyzeActivityTrend(dailyMetrics: any[]): HealthPattern | null {
  if (!dailyMetrics || dailyMetrics.length < 7) return null;

  const validData = dailyMetrics.filter(d => d.steps && d.steps > 0);
  if (validData.length < 7) return null;

  const midpoint = Math.floor(validData.length / 2);
  const firstHalf = validData.slice(0, midpoint);
  const secondHalf = validData.slice(midpoint);

  const firstAvg = firstHalf.reduce((sum, d) => sum + (d.steps || 0), 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, d) => sum + (d.steps || 0), 0) / secondHalf.length;

  const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;

  let direction: 'improving' | 'stable' | 'declining';
  let significance: 'minor' | 'notable' | 'significant';

  if (Math.abs(changePercent) < 10) {
    direction = 'stable';
    significance = 'minor';
  } else if (changePercent > 0) {
    direction = 'improving';
    significance = changePercent > 30 ? 'significant' : changePercent > 15 ? 'notable' : 'minor';
  } else {
    direction = 'declining';
    significance = Math.abs(changePercent) > 30 ? 'significant' : Math.abs(changePercent) > 15 ? 'notable' : 'minor';
  }

  if (significance === 'minor' && direction === 'stable') return null;

  return {
    type: 'activity_trend',
    direction,
    change: Math.round(changePercent * 10) / 10,
    period: `${validData.length} days`,
    significance,
    summary: `Activity ${direction} by ${Math.abs(Math.round(changePercent))}% (${Math.round(firstAvg).toLocaleString()} → ${Math.round(secondAvg).toLocaleString()} steps/day)`,
    currentValue: Math.round(secondAvg),
    previousValue: Math.round(firstAvg),
  };
}

// ============================================================================
// CORRELATION DETECTION
// ============================================================================

/**
 * Correlate health patterns with life events
 */
export async function correlateHealthWithLifeContext(
  email: string,
  healthPatterns: HealthPattern[],
  lifeContext?: LifeContextAnalysis | null
): Promise<HealthCorrelation[]> {
  const correlations: HealthCorrelation[] = [];

  // Get life context if not provided
  const context = lifeContext || await getLifeContext(email);
  if (!context) return correlations;

  // Look for correlations between declining health and stress-related events
  const decliningPatterns = healthPatterns.filter(p => p.direction === 'declining' && p.significance !== 'minor');

  for (const pattern of decliningPatterns) {
    // Check for travel events (often disrupt sleep/recovery)
    const travelEvents = context.upcomingEvents.filter(e => e.type === 'travel');
    for (const travel of travelEvents) {
      if (pattern.type === 'sleep_trend' || pattern.type === 'sleep_efficiency_trend' || pattern.type === 'hrv_trend') {
        correlations.push({
          healthMetric: pattern.type === 'hrv_trend' ? 'HRV' : 'Sleep',
          lifeEvent: travel.summary,
          lifeEventSource: 'gmail',
          correlation: 'negative',
          confidence: 0.7,
          changePercentage: pattern.change,
          insight: `${pattern.type === 'hrv_trend' ? 'HRV' : 'Sleep quality'} decline may be related to ${travel.summary}`,
        });
      }
    }

    // Check for work stress patterns
    const stressPatterns = context.activePatterns.filter(p =>
      p.type.includes('crunch') || p.type.includes('busy') || p.type.includes('deadline')
    );
    for (const stress of stressPatterns) {
      if (pattern.type === 'hrv_trend' || pattern.type === 'recovery_trend') {
        correlations.push({
          healthMetric: pattern.type === 'hrv_trend' ? 'HRV' : 'Recovery',
          lifeEvent: stress.description,
          lifeEventSource: 'slack',
          correlation: 'negative',
          confidence: 0.75,
          changePercentage: pattern.change,
          insight: `${pattern.type === 'hrv_trend' ? 'HRV' : 'Recovery'} decline correlates with "${stress.type}" pattern from work communications`,
        });
      }
    }

    // Check for interview/job search stress
    const interviewPatterns = context.activePatterns.filter(p =>
      p.type.includes('job') || p.type.includes('interview') || p.type.includes('recruitment')
    );
    for (const interview of interviewPatterns) {
      correlations.push({
        healthMetric: pattern.type.includes('hrv') ? 'HRV' : pattern.type.includes('sleep') ? 'Sleep' : 'Recovery',
        lifeEvent: interview.description,
        lifeEventSource: 'gmail',
        correlation: 'negative',
        confidence: 0.8,
        changePercentage: pattern.change,
        insight: `Health metrics declining during active interview period - interview stress is a known HRV suppressor`,
      });
    }
  }

  // Look for positive correlations (improving health with positive events)
  const improvingPatterns = healthPatterns.filter(p => p.direction === 'improving' && p.significance !== 'minor');

  for (const pattern of improvingPatterns) {
    // Check for vacation/PTO
    const vacationEvents = context.upcomingEvents.filter(e =>
      e.summary.toLowerCase().includes('vacation') ||
      e.summary.toLowerCase().includes('pto') ||
      e.summary.toLowerCase().includes('off')
    );
    for (const vacation of vacationEvents) {
      correlations.push({
        healthMetric: pattern.type.includes('hrv') ? 'HRV' : pattern.type.includes('sleep') ? 'Sleep' : 'Recovery',
        lifeEvent: vacation.summary,
        lifeEventSource: 'gmail',
        correlation: 'positive',
        confidence: 0.7,
        changePercentage: pattern.change,
        insight: `Health metrics improving - may be related to rest period`,
      });
    }

    // Check for reduced work stress
    const celebrationPatterns = context.activePatterns.filter(p =>
      p.type.includes('celebration') || p.type.includes('success')
    );
    for (const celebration of celebrationPatterns) {
      correlations.push({
        healthMetric: pattern.type.includes('hrv') ? 'HRV' : 'Recovery',
        lifeEvent: celebration.description,
        lifeEventSource: 'slack',
        correlation: 'positive',
        confidence: 0.65,
        changePercentage: pattern.change,
        insight: `Health metrics improving alongside positive work events`,
      });
    }
  }

  return correlations;
}

// ============================================================================
// STORAGE FUNCTIONS
// ============================================================================

/**
 * Store health analysis results
 */
export async function storeHealthAnalysis(
  email: string,
  analysis: HealthAnalysis
): Promise<void> {
  const supabase = await createClient();

  // Upsert main analysis record
  const { error } = await supabase
    .from('health_pattern_analysis')
    .upsert(
      {
        user_email: email,
        patterns: analysis.patterns,
        correlations: analysis.correlations,
        summary: analysis.summary,
        sources_analyzed: analysis.sourcesAnalyzed,
        analysis_date: new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_email,analysis_date' }
    );

  if (error) {
    console.error('[Health Analyzer] Error storing analysis:', error);
  }

  // Store individual correlations in history
  for (const corr of analysis.correlations) {
    await supabase
      .from('health_correlations_history')
      .upsert(
        {
          user_email: email,
          health_metric: corr.healthMetric,
          life_event: corr.lifeEvent,
          life_event_source: corr.lifeEventSource,
          correlation_type: corr.correlation,
          confidence: corr.confidence,
          change_percentage: corr.changePercentage,
          insight: corr.insight,
          event_date: new Date().toISOString().split('T')[0],
          detected_at: new Date().toISOString(),
        },
        { onConflict: 'user_email,health_metric,life_event,event_date' }
      );
  }
}

/**
 * Get health analysis for a user
 */
export async function getHealthAnalysis(email: string): Promise<HealthAnalysis | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('health_pattern_analysis')
    .select('*')
    .eq('user_email', email)
    .order('analysis_date', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    patterns: data.patterns || [],
    correlations: data.correlations || [],
    summary: data.summary || '',
    sourcesAnalyzed: data.sources_analyzed || [],
    analyzedAt: data.updated_at,
  };
}

// ============================================================================
// FORMATTING FOR AI CONTEXT
// ============================================================================

/**
 * Format health analysis for AI prompts
 */
export function formatHealthAnalysisForPrompt(analysis: HealthAnalysis | null): string {
  if (!analysis || (analysis.patterns.length === 0 && analysis.correlations.length === 0)) {
    return '';
  }

  const parts: string[] = [];
  parts.push('## Health Pattern Analysis');
  parts.push('');

  // Patterns
  if (analysis.patterns.length > 0) {
    parts.push('### Health Trends');
    for (const pattern of analysis.patterns) {
      const icon = pattern.direction === 'improving' ? '↑' : pattern.direction === 'declining' ? '↓' : '→';
      const sigMarker = pattern.significance === 'significant' ? '⚠️' : '';
      parts.push(`- ${icon} ${sigMarker}${pattern.summary}`);
    }
    parts.push('');
  }

  // Correlations
  if (analysis.correlations.length > 0) {
    parts.push('### Health-Life Correlations');
    for (const corr of analysis.correlations) {
      parts.push(`- **${corr.healthMetric}** ${corr.correlation === 'negative' ? '↓' : '↑'} linked to "${corr.lifeEvent}"`);
      parts.push(`  ${corr.insight}`);
    }
    parts.push('');
  }

  return parts.join('\n');
}

/**
 * Run full health analysis for a user
 */
export async function runHealthAnalysis(
  email: string,
  ouraData: OuraData | null,
  whoopData: WhoopData | null,
  appleHealthData: any | null
): Promise<HealthAnalysis> {
  // Detect patterns
  const patterns = await analyzeHealthPatterns(ouraData, whoopData, appleHealthData);

  // Get correlations with life context
  const correlations = await correlateHealthWithLifeContext(email, patterns);

  // Build summary
  const summaryParts: string[] = [];
  const significantPatterns = patterns.filter(p => p.significance !== 'minor');
  if (significantPatterns.length > 0) {
    summaryParts.push(`${significantPatterns.length} notable health trends detected.`);
  }
  if (correlations.length > 0) {
    summaryParts.push(`${correlations.length} correlations with life events found.`);
  }

  // Track which sources were analyzed
  const sourcesAnalyzed: string[] = [];
  if (ouraData) sourcesAnalyzed.push('oura');
  if (whoopData) sourcesAnalyzed.push('whoop');
  if (appleHealthData) sourcesAnalyzed.push('apple_health');

  const analysis: HealthAnalysis = {
    patterns,
    correlations,
    summary: summaryParts.join(' ') || 'No significant patterns detected.',
    sourcesAnalyzed,
    analyzedAt: new Date().toISOString(),
  };

  // Store the analysis
  await storeHealthAnalysis(email, analysis);

  return analysis;
}
