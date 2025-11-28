/**
 * Pattern Analyzer Service
 *
 * Analyzes raw ecosystem data and generates actionable insights through
 * statistical analysis, correlation detection, and pattern recognition.
 *
 * Key functions:
 * - Cross-source correlation (e.g., glucose spikes + meeting stress)
 * - Trend detection (improving, declining, stable)
 * - Anomaly identification (outliers, concerning patterns)
 * - Causal relationship inference
 *
 * @module lib/services/pattern-analyzer
 */

import {
  OuraData,
  DexcomData,
  GmailPatterns,
  SlackPatterns,
  BloodBiomarkers,
  EcosystemFetchResult,
} from './ecosystem-fetcher';

// ============================================================================
// TYPES
// ============================================================================

export interface CrossSourceInsight {
  insight: string;
  sources: string[];
  confidence: number; // 0-1
  impact: 'critical' | 'high' | 'medium' | 'low';
  dataPoints: string[];
  recommendation?: string;
}

export interface AnalysisResult {
  glucosePatterns: GlucoseAnalysis;
  sleepPatterns: SleepAnalysis;
  workStressPatterns: WorkStressAnalysis;
  activityRecoveryPatterns: ActivityRecoveryAnalysis;
  crossSourceInsights: CrossSourceInsight[];
}

export interface GlucoseAnalysis {
  status: 'optimal' | 'needs_attention' | 'concerning';
  avgGlucose: number | null;
  variability: 'low' | 'moderate' | 'high' | null;
  spikeCorrelations: Array<{
    trigger: string;
    confidence: number;
    recommendation: string;
  }>;
  insights: string[];
}

export interface SleepAnalysis {
  status: 'optimal' | 'suboptimal' | 'poor';
  avgHours: number | null;
  qualityScore: number | null;
  hrvStatus: 'good' | 'fair' | 'poor' | null;
  sleepDebt: number | null; // hours
  insights: string[];
}

export interface WorkStressAnalysis {
  stressLevel: 'high' | 'moderate' | 'low' | 'unknown';
  workLifeBalance: 'good' | 'needs_improvement' | 'poor' | 'unknown';
  optimalMealWindows: string[];
  breakDeficiency: boolean;
  insights: string[];
}

export interface ActivityRecoveryAnalysis {
  recoveryStatus: 'good' | 'adequate' | 'poor' | 'unknown';
  trainingLoad: 'high' | 'moderate' | 'low' | 'unknown';
  overtrainingRisk: boolean;
  insights: string[];
}

// ============================================================================
// GLUCOSE PATTERN ANALYSIS
// ============================================================================

export function analyzeGlucosePatterns(
  dexcomData: DexcomData | null,
  gmailPatterns: GmailPatterns | null,
  slackPatterns: SlackPatterns | null
): GlucoseAnalysis {
  if (!dexcomData) {
    return {
      status: 'optimal',
      avgGlucose: null,
      variability: null,
      spikeCorrelations: [],
      insights: [],
    };
  }

  const insights: string[] = [];
  const spikeCorrelations: GlucoseAnalysis['spikeCorrelations'] = [];

  // Assess overall glucose status
  let status: GlucoseAnalysis['status'] = 'optimal';
  if (dexcomData.avgGlucose > 100) {
    status = 'needs_attention';
    insights.push(`Average glucose ${dexcomData.avgGlucose} mg/dL exceeds optimal range (<100 mg/dL)`);
  }
  if (dexcomData.avgGlucose > 115) {
    status = 'concerning';
    insights.push(`Elevated glucose levels suggest pre-diabetic risk`);
  }

  // Assess variability
  const variability = dexcomData.glucoseVariability < 20 ? 'low' :
    dexcomData.glucoseVariability < 35 ? 'moderate' : 'high';

  if (variability === 'high') {
    insights.push(`High glucose variability (SD ${dexcomData.glucoseVariability}) indicates unstable blood sugar`);
  }

  // Correlate spike times with meeting/work patterns
  if (gmailPatterns && dexcomData.spikeTimes.length > 0) {
    const meetingPeakHours = gmailPatterns.meetingDensity.peakHours;
    const spikePeakHours = dexcomData.spikeTimes;

    // Check for overlap
    const overlap = spikePeakHours.some(spikeTime => {
      const spikeHour = parseInt(spikeTime.split(':')[0]);
      return meetingPeakHours.some(meetingRange => {
        const [start] = meetingRange.split('-').map(t => parseInt(t.split(':')[0]));
        return Math.abs(spikeHour - start) <= 1; // Within 1 hour
      });
    });

    if (overlap) {
      spikeCorrelations.push({
        trigger: 'High-stress meetings',
        confidence: 0.75,
        recommendation: 'Avoid carb-heavy meals before meetings. Try protein + fat for stable glucose.',
      });
      insights.push('Glucose spikes correlate with meeting density - stress-induced cortisol may be elevating blood sugar');
    }
  }

  // Correlate with late-night work (evening spikes)
  if (slackPatterns && dexcomData.spikeTimes.some(t => parseInt(t.split(':')[0]) >= 19)) {
    if (slackPatterns.stressIndicators.lateNightMessages) {
      spikeCorrelations.push({
        trigger: 'Late-night work activity',
        confidence: 0.65,
        recommendation: 'Limit evening carbs. Consider earlier dinner to avoid late-night glucose elevation.',
      });
      insights.push('Evening glucose spikes align with late-night work activity');
    }
  }

  // Time in range assessment
  if (dexcomData.timeInRange < 70) {
    insights.push(`Time in range ${dexcomData.timeInRange}% is below target (>70%), indicating poor glucose control`);
  }

  return {
    status,
    avgGlucose: dexcomData.avgGlucose,
    variability,
    spikeCorrelations,
    insights,
  };
}

// ============================================================================
// SLEEP PATTERN ANALYSIS
// ============================================================================

export function analyzeSleepPatterns(
  ouraData: OuraData | null,
  workPatterns: { gmail: GmailPatterns | null; slack: SlackPatterns | null }
): SleepAnalysis {
  if (!ouraData) {
    return {
      status: 'optimal',
      avgHours: null,
      qualityScore: null,
      hrvStatus: null,
      sleepDebt: null,
      insights: [],
    };
  }

  const insights: string[] = [];

  // Sleep duration status
  let status: SleepAnalysis['status'] = 'optimal';
  const sleepDebt = Math.max(0, 7.5 - ouraData.avgSleepHours);

  if (ouraData.avgSleepHours < 7) {
    status = 'poor';
    insights.push(`Sleep duration ${ouraData.avgSleepHours}h is significantly below recommended 7-9h`);
    insights.push(`Estimated sleep debt: ${sleepDebt.toFixed(1)}h per night`);
  } else if (ouraData.avgSleepHours < 7.5) {
    status = 'suboptimal';
    insights.push(`Sleep duration ${ouraData.avgSleepHours}h is slightly below optimal range`);
  }

  // Readiness score
  if (ouraData.avgReadinessScore < 70) {
    status = 'poor';
    insights.push(`Low readiness score (${ouraData.avgReadinessScore}/100) indicates inadequate recovery`);
  } else if (ouraData.avgReadinessScore < 85) {
    if (status === 'optimal') status = 'suboptimal';
    insights.push(`Moderate readiness score (${ouraData.avgReadinessScore}/100) suggests room for improvement`);
  }

  // HRV assessment
  let hrvStatus: SleepAnalysis['hrvStatus'] = 'good';
  if (ouraData.avgHRV < 40) {
    hrvStatus = 'poor';
    insights.push(`Low HRV (${ouraData.avgHRV}ms) may indicate chronic stress or overtraining`);
  } else if (ouraData.avgHRV < 60) {
    hrvStatus = 'fair';
    insights.push(`Moderate HRV (${ouraData.avgHRV}ms) - consider stress management practices`);
  }

  // Correlate with work patterns
  if (workPatterns.gmail?.emailVolume.afterHoursPercentage > 20 ||
      workPatterns.slack?.messageVolume.afterHoursPercentage > 20) {
    insights.push('High after-hours work activity likely contributing to poor sleep quality');
  }

  if (workPatterns.gmail?.stressIndicators.frequentAfterHoursWork) {
    insights.push('Late-night email activity disrupting circadian rhythm - consider setting email boundaries');
  }

  return {
    status,
    avgHours: ouraData.avgSleepHours,
    qualityScore: ouraData.avgReadinessScore,
    hrvStatus,
    sleepDebt: sleepDebt > 0 ? sleepDebt : null,
    insights,
  };
}

// ============================================================================
// WORK STRESS PATTERN ANALYSIS
// ============================================================================

export function analyzeWorkStressPatterns(
  gmailPatterns: GmailPatterns | null,
  slackPatterns: SlackPatterns | null
): WorkStressAnalysis {
  if (!gmailPatterns && !slackPatterns) {
    return {
      stressLevel: 'unknown',
      workLifeBalance: 'unknown',
      optimalMealWindows: [],
      breakDeficiency: false,
      insights: [],
    };
  }

  const insights: string[] = [];
  let stressScore = 0; // 0-10 scale

  // Gmail stress indicators
  if (gmailPatterns) {
    if (gmailPatterns.stressIndicators.highEmailVolume) {
      stressScore += 2;
      insights.push(`High email volume (${gmailPatterns.emailVolume.avgPerDay}/day) indicates heavy workload`);
    }
    if (gmailPatterns.stressIndicators.frequentAfterHoursWork) {
      stressScore += 2;
      insights.push(`${gmailPatterns.emailVolume.afterHoursPercentage}% of emails after hours - work-life boundaries need strengthening`);
    }
    if (gmailPatterns.stressIndicators.shortMeetingBreaks) {
      stressScore += 3;
      insights.push(`${gmailPatterns.meetingDensity.backToBackPercentage}% back-to-back meetings - insufficient break time`);
    }
  }

  // Slack stress indicators
  if (slackPatterns) {
    if (slackPatterns.stressIndicators.constantAvailability) {
      stressScore += 2;
      insights.push('Constant Slack activity suggests always-on culture');
    }
    if (slackPatterns.stressIndicators.lateNightMessages) {
      stressScore += 2;
      insights.push('Late-night Slack messages disrupting evening recovery time');
    }
    if (slackPatterns.stressIndicators.noBreakPeriods) {
      stressScore += 1;
      insights.push('No clear break periods detected in messaging patterns');
    }
  }

  // Determine stress level
  const stressLevel: WorkStressAnalysis['stressLevel'] =
    stressScore >= 7 ? 'high' : stressScore >= 4 ? 'moderate' : 'low';

  // Work-life balance assessment
  const afterHoursActivity = Math.max(
    gmailPatterns?.emailVolume.afterHoursPercentage || 0,
    slackPatterns?.messageVolume.afterHoursPercentage || 0
  );

  const workLifeBalance: WorkStressAnalysis['workLifeBalance'] =
    afterHoursActivity > 30 ? 'poor' :
    afterHoursActivity > 15 ? 'needs_improvement' : 'good';

  // Optimal meal windows (avoiding meeting peaks)
  const optimalMealWindows: string[] = gmailPatterns?.optimalMealWindows || [];

  // Break deficiency
  const breakDeficiency = gmailPatterns?.stressIndicators.shortMeetingBreaks ||
    slackPatterns?.stressIndicators.noBreakPeriods || false;

  if (breakDeficiency) {
    insights.push('Insufficient breaks between work sessions - recommend scheduled meal/movement breaks');
  }

  return {
    stressLevel,
    workLifeBalance,
    optimalMealWindows,
    breakDeficiency,
    insights,
  };
}

// ============================================================================
// ACTIVITY & RECOVERY ANALYSIS
// ============================================================================

export function analyzeActivityRecovery(
  ouraData: OuraData | null,
  vitalData: unknown | null
): ActivityRecoveryAnalysis {
  if (!ouraData) {
    return {
      recoveryStatus: 'unknown',
      trainingLoad: 'unknown',
      overtrainingRisk: false,
      insights: [],
    };
  }

  const insights: string[] = [];

  // Recovery status based on readiness + HRV
  let recoveryStatus: ActivityRecoveryAnalysis['recoveryStatus'] = 'good';
  if (ouraData.avgReadinessScore < 60 || ouraData.avgHRV < 40) {
    recoveryStatus = 'poor';
    insights.push('Poor recovery metrics suggest need for deload week or active recovery');
  } else if (ouraData.avgReadinessScore < 75 || ouraData.avgHRV < 55) {
    recoveryStatus = 'adequate';
    insights.push('Moderate recovery - maintain current training volume, avoid increases');
  }

  // Training load inference
  const trainingLoad: ActivityRecoveryAnalysis['trainingLoad'] =
    ouraData.activityLevel === 'high' ? 'high' :
    ouraData.activityLevel === 'moderate' ? 'moderate' : 'low';

  // Overtraining risk detection
  const overtrainingRisk = (
    ouraData.avgReadinessScore < 60 &&
    ouraData.avgHRV < 45 &&
    ouraData.avgSleepHours < 7 &&
    ouraData.hrvTrend === 'declining'
  );

  if (overtrainingRisk) {
    insights.push('⚠️ OVERTRAINING RISK: Low readiness + declining HRV + sleep deficit = need immediate recovery focus');
  }

  return {
    recoveryStatus,
    trainingLoad,
    overtrainingRisk,
    insights,
  };
}

// ============================================================================
// CROSS-SOURCE INSIGHT GENERATION
// ============================================================================

export function generateCrossSourceInsights(
  ecosystemData: EcosystemFetchResult
): CrossSourceInsight[] {
  const insights: CrossSourceInsight[] = [];

  const ouraData = ecosystemData.oura.data as OuraData | null;
  const dexcomData = ecosystemData.dexcom.data as DexcomData | null;
  const gmailPatterns = ecosystemData.gmail.data as GmailPatterns | null;
  const slackPatterns = ecosystemData.slack.data as SlackPatterns | null;
  const biomarkers = ecosystemData.bloodBiomarkers.data as BloodBiomarkers | null;

  // Insight 1: Glucose spikes + Meeting stress
  if (dexcomData && gmailPatterns && dexcomData.avgGlucose > 105) {
    const meetingStress = gmailPatterns.meetingDensity.backToBackPercentage > 50;
    if (meetingStress) {
      insights.push({
        insight: `Glucose spikes at ${dexcomData.spikeTimes.join(', ')} correlate with back-to-back meetings (${gmailPatterns.meetingDensity.backToBackPercentage}%)`,
        sources: ['dexcom', 'gmail'],
        confidence: 0.82,
        impact: 'high',
        dataPoints: [
          `Average glucose: ${dexcomData.avgGlucose} mg/dL`,
          `Back-to-back meetings: ${gmailPatterns.meetingDensity.backToBackPercentage}%`,
          `Peak meeting hours: ${gmailPatterns.meetingDensity.peakHours.join(', ')}`,
        ],
        recommendation: 'Schedule meal breaks before high-meeting periods. Prioritize protein + healthy fats to stabilize glucose during stress.',
      });
    }
  }

  // Insight 2: Poor sleep + Overtraining
  if (ouraData && (ouraData.avgSleepHours < 7 || ouraData.avgReadinessScore < 65)) {
    const lowRecovery = ouraData.avgReadinessScore < 65;
    const lowHRV = ouraData.avgHRV < 50;

    if (lowRecovery && lowHRV) {
      insights.push({
        insight: `Low Oura readiness (${ouraData.avgReadinessScore}/100) + insufficient sleep (${ouraData.avgSleepHours}h) indicates overtraining or chronic stress`,
        sources: ['oura'],
        confidence: 0.88,
        impact: 'critical',
        dataPoints: [
          `Sleep: ${ouraData.avgSleepHours}h average`,
          `Readiness: ${ouraData.avgReadinessScore}/100`,
          `HRV: ${ouraData.avgHRV}ms`,
        ],
        recommendation: 'Implement deload week: reduce training volume by 50%, prioritize sleep (target 8h), add stress management practices.',
      });
    }
  }

  // Insight 3: Biomarker concerns + Poor recovery
  if (biomarkers && ouraData) {
    const hasConcerns = biomarkers.concerns && biomarkers.concerns.length > 0;
    const poorRecovery = ouraData.avgReadinessScore < 70;

    if (hasConcerns && poorRecovery) {
      insights.push({
        insight: `Biomarker concerns (${biomarkers.concerns.join(', ')}) combined with poor recovery metrics suggest systemic stress`,
        sources: ['bloodBiomarkers', 'oura'],
        confidence: 0.75,
        impact: 'high',
        dataPoints: [
          `Biomarker concerns: ${biomarkers.concerns.slice(0, 3).join(', ')}`,
          `Oura readiness: ${ouraData.avgReadinessScore}/100`,
          `Sleep quality: ${ouraData.sleepQuality}`,
        ],
        recommendation: 'Address biomarker issues through targeted nutrition and supplementation. Prioritize recovery protocols.',
      });
    }
  }

  // Insight 4: Work stress + Sleep issues
  if ((gmailPatterns || slackPatterns) && ouraData && ouraData.avgSleepHours < 7) {
    const afterHoursWork = gmailPatterns?.emailVolume.afterHoursPercentage || slackPatterns?.messageVolume.afterHoursPercentage || 0;

    if (afterHoursWork > 20) {
      insights.push({
        insight: `${afterHoursWork}% after-hours work activity correlates with insufficient sleep (${ouraData.avgSleepHours}h average)`,
        sources: gmailPatterns ? ['gmail', 'oura'] : ['slack', 'oura'],
        confidence: 0.79,
        impact: 'high',
        dataPoints: [
          `After-hours activity: ${afterHoursWork}%`,
          `Sleep duration: ${ouraData.avgSleepHours}h`,
          `Sleep quality: ${ouraData.sleepQuality}`,
        ],
        recommendation: 'Set digital boundaries: no work communications after 8pm. Implement 1-hour pre-bed wind-down routine.',
      });
    }
  }

  return insights;
}

// ============================================================================
// MASTER ANALYSIS FUNCTION
// ============================================================================

export function analyzeEcosystemPatterns(ecosystemData: EcosystemFetchResult): AnalysisResult {
  const ouraData = ecosystemData.oura.data as OuraData | null;
  const dexcomData = ecosystemData.dexcom.data as DexcomData | null;
  const gmailPatterns = ecosystemData.gmail.data as GmailPatterns | null;
  const slackPatterns = ecosystemData.slack.data as SlackPatterns | null;

  return {
    glucosePatterns: analyzeGlucosePatterns(dexcomData, gmailPatterns, slackPatterns),
    sleepPatterns: analyzeSleepPatterns(ouraData, { gmail: gmailPatterns, slack: slackPatterns }),
    workStressPatterns: analyzeWorkStressPatterns(gmailPatterns, slackPatterns),
    activityRecoveryPatterns: analyzeActivityRecovery(ouraData, null),
    crossSourceInsights: generateCrossSourceInsights(ecosystemData),
  };
}
