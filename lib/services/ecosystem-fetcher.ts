/**
 * Ecosystem Data Fetcher Service
 *
 * Unified service for fetching data from all connected ecosystem integrations.
 * Handles parallel data retrieval, error handling, and result normalization.
 *
 * Supported integrations:
 * - Oura Ring (sleep, readiness, HRV, activity)
 * - Dexcom/CGM (glucose readings, time in range, spikes)
 * - Vital (unified health data from multiple providers)
 * - Gmail (work patterns, meeting density, email volume)
 * - Slack (message timing, after-hours activity, stress indicators)
 * - Blood biomarkers (from lab file analysis)
 *
 * @module lib/services/ecosystem-fetcher
 */

import { createClient } from '@/lib/supabase/server';

// ============================================================================
// TYPES
// ============================================================================

export interface EcosystemDataSource {
  source: string;
  available: boolean;
  data: unknown | null;
  insights: string[];
  fetchedAt: string;
  error?: string;
  recordCount?: number;
  daysOfData?: number;
}

export interface OuraData {
  avgSleepHours: number;
  avgReadinessScore: number;
  avgHRV: number;
  sleepQuality: 'excellent' | 'good' | 'fair' | 'poor';
  hrvTrend: 'improving' | 'stable' | 'declining';
  activityLevel: 'high' | 'moderate' | 'low';
  // NEW: Sleep architecture
  sleepArchitecture?: {
    deepSleepPercent: number;
    remSleepPercent: number;
    lightSleepPercent: number;
    awakePercent: number;
    avgDeepSleepMins: number;
    avgRemSleepMins: number;
    sleepEfficiency: number; // percentage
  };
  // NEW: Sleep consistency
  sleepConsistency?: {
    avgBedtime: string; // "23:30"
    avgWakeTime: string; // "07:15"
    bedtimeVariability: number; // minutes standard deviation
    wakeTimeVariability: number;
    consistencyScore: 'excellent' | 'good' | 'fair' | 'poor';
    socialJetLag: number; // hours difference weekday vs weekend
  };
  // NEW: HRV analysis
  hrvAnalysis?: {
    baseline: number; // 7-day rolling avg
    currentAvg: number;
    trend: 'improving' | 'stable' | 'declining';
    lowestDay: string; // date
    highestDay: string;
    morningReadiness: 'optimal' | 'moderate' | 'low';
    variabilityScore: number; // coefficient of variation
  };
  // NEW: Sleep debt
  sleepDebt?: {
    accumulatedHours: number; // vs 8h target
    weeklyDeficit: number;
    recoveryNeeded: boolean;
    daysToRecover: number;
  };
  // NEW: Recovery patterns
  recoveryPatterns?: {
    avgRecoveryAfterHighStrain: number;
    avgRecoveryAfterLowStrain: number;
    optimalRecoveryDays: string[]; // day names
    worstRecoveryDays: string[];
  };
  // NEW: Activity insights
  activityInsights?: {
    avgDailySteps: number;
    avgActiveCalories: number;
    movementConsistency: 'excellent' | 'good' | 'fair' | 'poor';
    sedentaryHoursPerDay: number;
  };
  insights: string[];
  rawData: unknown;
}

export interface DexcomData {
  avgGlucose: number;
  avgFastingGlucose: number | null;
  glucoseVariability: number;
  timeInRange: number; // percentage
  spikeTimes: string[]; // times when spikes occur
  spikeEvents: Array<{ time: string; value: number; trigger?: string }>;
  trends: string[];
  insights: string[];
  rawData: unknown;
}

export interface VitalData {
  connectedProviders: string[];
  sleepData: unknown | null;
  activityData: unknown | null;
  bodyData: unknown | null;
  glucoseData: unknown | null;
  workoutsData: unknown | null;
  insights: string[];
  rawData: unknown;
}

export interface GmailPatterns {
  meetingDensity: {
    peakHours: string[];
    avgMeetingsPerDay: number;
    backToBackPercentage: number;
  };
  emailVolume: {
    avgPerDay: number;
    peakHours: string[];
    afterHoursPercentage: number;
  };
  workHours: {
    start: string;
    end: string;
    weekendActivity: boolean;
  };
  optimalMealWindows: string[];
  stressIndicators: {
    highEmailVolume: boolean;
    frequentAfterHoursWork: boolean;
    shortMeetingBreaks: boolean;
  };
  // NEW: Meeting types analysis
  meetingTypes?: {
    oneOnOnes: number;
    groupMeetings: number;
    largeAllHands: number; // 10+ attendees
    avgAttendeesPerMeeting: number;
  };
  // NEW: Focus time analysis
  focusTime?: {
    avgFocusBlocksPerDay: number; // 2+ hour uninterrupted periods
    longestFocusBlock: number; // minutes
    meetingFreeDays: number; // days with no meetings in period
    focusScore: 'excellent' | 'good' | 'limited' | 'fragmented';
  };
  // NEW: Recurring meeting burden
  recurringMeetings?: {
    weeklyRecurring: number;
    totalRecurringHours: number; // hours per week
    standupsPerWeek: number;
  };
  // NEW: Email patterns
  emailPatterns?: {
    sentVsReceived: number; // ratio
    avgResponseTime: number | null; // minutes, if calculable
    threadDepth: number; // avg replies per thread
  };
  // NEW: Calendar health
  calendarHealth?: {
    bufferBetweenMeetings: number; // avg minutes
    lunchProtected: boolean; // meetings avoid 12-1pm
    eveningsClear: boolean; // meetings avoid after 6pm
  };
  insights: string[];
}

export interface SlackPatterns {
  messageVolume: {
    avgPerDay: number;
    peakHours: string[];
    afterHoursPercentage: number;
  };
  workHours: {
    start: string;
    end: string;
    weekendActivity: boolean;
  };
  collaborationIntensity: 'high' | 'moderate' | 'low';
  stressIndicators: {
    constantAvailability: boolean;
    lateNightMessages: boolean;
    noBreakPeriods: boolean;
  };
  // NEW: Thread behavior
  threadPatterns?: {
    threadsStarted: number;
    threadsParticipatedIn: number;
    topLevelVsThreadedRatio: number; // broadcasting vs focused discussion
  };
  // NEW: Communication network
  collaborationNetwork?: {
    topCollaborators: Array<{ name: string; mentionCount: number }>;
    uniquePeopleMentioned: number;
    mentionsReceived: number;
  };
  // NEW: Channel behavior
  channelBehavior?: {
    totalChannels: number;
    activeChannels: number;
    channelOverloadScore: number; // >50 = overload warning
    mostActiveChannels: Array<{ name: string; messageCount: number }>;
  };
  // NEW: Response patterns
  responseBehavior?: {
    avgResponseTimeMinutes: number | null;
    fastResponseRate: number; // % <5min responses
    alwaysOnPressure: boolean;
  };
  // NEW: Focus metrics
  focusMetrics?: {
    deepWorkWindows: number; // periods >2h without messages
    longestFocusPeriod: number; // minutes
    contextSwitchingScore: 'high' | 'moderate' | 'low';
  };
  // NEW: Engagement
  engagementMetrics?: {
    reactionsGiven: number;
    reactionsReceived: number;
    avgReactionsPerMessage: number;
  };
  insights: string[];
}

// OutlookPatterns reuses GmailPatterns structure (email + calendar data)
export type OutlookPatterns = GmailPatterns;

// TeamsPatterns reuses SlackPatterns structure (chat message data)
export type TeamsPatterns = SlackPatterns;

export interface WhoopData {
  avgRecoveryScore: number;
  avgStrainScore: number;
  avgHRV: number;
  avgRestingHR: number;
  recoveryTrend: 'improving' | 'stable' | 'declining';
  strainTrend: 'high' | 'moderate' | 'low';
  sleepPerformance: number;
  cyclesAnalyzed: number;
  // NEW: Recovery zone distribution
  recoveryZones?: {
    greenDays: number; // 67-100%
    yellowDays: number; // 34-66%
    redDays: number; // 0-33%
    greenPercentage: number;
    avgGreenRecovery: number;
    avgRedRecovery: number;
  };
  // NEW: Strain-recovery balance
  strainRecoveryBalance?: {
    avgStrainOnGreenDays: number;
    avgStrainOnRedDays: number;
    optimalStrainRange: [number, number];
    overreachingDays: number; // strain > 18
    undertrainingDays: number; // strain < 8 on green days
    balanceScore: 'optimal' | 'overreaching' | 'undertraining' | 'mismatched';
  };
  // NEW: HRV patterns
  hrvPatterns?: {
    baseline: number;
    currentWeekAvg: number;
    trend: 'improving' | 'stable' | 'declining';
    lowestValue: number;
    highestValue: number;
    morningAvg: number;
    variabilityPercent: number; // CV%
  };
  // NEW: Resting heart rate analysis
  restingHRAnalysis?: {
    baseline: number;
    currentAvg: number;
    trend: 'improving' | 'stable' | 'elevated';
    elevatedDays: number; // days > baseline + 5bpm
  };
  // NEW: Training load
  trainingLoad?: {
    weeklyStrain: number;
    weeklyStrainTrend: 'increasing' | 'stable' | 'decreasing';
    acuteChronicRatio: number; // last 7 days vs last 28 days
    overtrainingRisk: 'low' | 'moderate' | 'high';
    recommendedRestDays: number;
  };
  // NEW: Sleep from Whoop
  whoopSleep?: {
    avgSleepHours: number;
    avgSleepPerformance: number;
    avgSleepEfficiency: number;
    avgRespiratoryRate: number;
    sleepDebtHours: number;
  };
  // NEW: Workout patterns
  workoutPatterns?: {
    totalWorkouts: number;
    avgWorkoutStrain: number;
    avgWorkoutDuration: number; // minutes
    avgWorkoutCalories: number;
    mostCommonActivity: string;
    peakPerformanceDay: string;
  };
  insights: string[];
  rawData: unknown;
}

export interface BloodBiomarkers {
  biomarkers: Array<{
    name: string;
    value: string;
    status: string;
    implications: string;
  }>;
  concerns: string[];
  positives: string[];
  recommendations: {
    lifestyle: string[];
    dietary: string[];
    supplements: string[];
  };
  lastUpdated: string;
  insights: string[];
}

export interface EcosystemFetchResult {
  bloodBiomarkers: EcosystemDataSource;
  oura: EcosystemDataSource;
  dexcom: EcosystemDataSource;
  vital: EcosystemDataSource;
  gmail: EcosystemDataSource;
  slack: EcosystemDataSource;
  outlook: EcosystemDataSource;
  teams: EcosystemDataSource;
  whoop: EcosystemDataSource;
  fetchTimestamp: string;
  successCount: number;
  totalSources: number;
}

// ============================================================================
// FETCH FUNCTIONS
// ============================================================================

/**
 * Fetch Oura Ring data from database
 */
export async function fetchOuraData(
  email: string,
  startDate?: Date,
  endDate?: Date
): Promise<EcosystemDataSource> {
  try {
    const supabase = await createClient();
    const end = endDate || new Date();
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    const { data, error } = await supabase
      .from('oura_data')
      .select('*')
      .eq('email', email)
      .gte('start_date', start.toISOString().split('T')[0])
      .lte('end_date', end.toISOString().split('T')[0])
      .order('sync_date', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) {
      return {
        source: 'oura',
        available: false,
        data: null,
        insights: [],
        fetchedAt: new Date().toISOString(),
        error: error?.message || 'No Oura data found',
      };
    }

    const ouraRecord = data[0];

    // Type definitions for Oura data structures
    interface OuraSleepRecord {
      day?: string;
      bedtime_start?: string;
      bedtime_end?: string;
      total_sleep_duration?: number;
      deep_sleep_duration?: number;
      rem_sleep_duration?: number;
      light_sleep_duration?: number;
      awake_time?: number;
      efficiency?: number;
      sleep_score?: number;
    }

    interface OuraReadinessRecord {
      day?: string;
      score?: number;
    }

    interface OuraActivityRecord {
      day?: string;
      steps?: number;
      active_calories?: number;
      sedentary_time?: number;
      score?: number;
    }

    interface OuraHRVRecord {
      day?: string;
      average_hrv?: number;
      timestamp?: string;
    }

    const sleepData = (ouraRecord.sleep_data as OuraSleepRecord[]) || [];
    const readinessData = (ouraRecord.readiness_data as OuraReadinessRecord[]) || [];
    const activityData = (ouraRecord.activity_data as OuraActivityRecord[]) || [];
    const hrvData = (ouraRecord.heart_rate_data as OuraHRVRecord[]) || [];

    // ========== BASIC AVERAGES ==========
    const avgSleepHours = sleepData.length > 0
      ? sleepData.reduce((sum, day) => sum + ((day.total_sleep_duration || 0) / 3600), 0) / sleepData.length
      : 0;

    const avgReadiness = readinessData.length > 0
      ? readinessData.reduce((sum, day) => sum + (day.score || 0), 0) / readinessData.length
      : 0;

    const hrvValues = hrvData.filter(d => d.average_hrv).map(d => d.average_hrv!);
    const avgHRV = hrvValues.length > 0
      ? hrvValues.reduce((sum, v) => sum + v, 0) / hrvValues.length
      : 0;

    // ========== SLEEP ARCHITECTURE ==========
    let sleepArchitecture: OuraData['sleepArchitecture'] = undefined;
    if (sleepData.length > 0) {
      const totalDeep = sleepData.reduce((sum, d) => sum + (d.deep_sleep_duration || 0), 0);
      const totalRem = sleepData.reduce((sum, d) => sum + (d.rem_sleep_duration || 0), 0);
      const totalLight = sleepData.reduce((sum, d) => sum + (d.light_sleep_duration || 0), 0);
      const totalAwake = sleepData.reduce((sum, d) => sum + (d.awake_time || 0), 0);
      const totalSleep = totalDeep + totalRem + totalLight + totalAwake;
      const avgEfficiency = sleepData.reduce((sum, d) => sum + (d.efficiency || 0), 0) / sleepData.length;

      if (totalSleep > 0) {
        sleepArchitecture = {
          deepSleepPercent: Math.round((totalDeep / totalSleep) * 100),
          remSleepPercent: Math.round((totalRem / totalSleep) * 100),
          lightSleepPercent: Math.round((totalLight / totalSleep) * 100),
          awakePercent: Math.round((totalAwake / totalSleep) * 100),
          avgDeepSleepMins: Math.round((totalDeep / sleepData.length) / 60),
          avgRemSleepMins: Math.round((totalRem / sleepData.length) / 60),
          sleepEfficiency: Math.round(avgEfficiency),
        };
      }
    }

    // ========== SLEEP CONSISTENCY ==========
    let sleepConsistency: OuraData['sleepConsistency'] = undefined;
    if (sleepData.length >= 7) {
      const bedtimes = sleepData
        .filter(d => d.bedtime_start)
        .map(d => {
          const date = new Date(d.bedtime_start!);
          return date.getHours() * 60 + date.getMinutes();
        });

      const wakeTimes = sleepData
        .filter(d => d.bedtime_end)
        .map(d => {
          const date = new Date(d.bedtime_end!);
          return date.getHours() * 60 + date.getMinutes();
        });

      if (bedtimes.length > 0 && wakeTimes.length > 0) {
        const avgBedtimeMins = bedtimes.reduce((a, b) => a + b, 0) / bedtimes.length;
        const avgWakeMins = wakeTimes.reduce((a, b) => a + b, 0) / wakeTimes.length;

        // Calculate standard deviation
        const bedtimeVariance = bedtimes.reduce((sum, t) => sum + Math.pow(t - avgBedtimeMins, 2), 0) / bedtimes.length;
        const wakeVariance = wakeTimes.reduce((sum, t) => sum + Math.pow(t - avgWakeMins, 2), 0) / wakeTimes.length;

        const bedtimeStdDev = Math.sqrt(bedtimeVariance);
        const wakeStdDev = Math.sqrt(wakeVariance);

        // Format times
        const formatTime = (mins: number) => {
          const h = Math.floor(mins / 60) % 24;
          const m = Math.round(mins % 60);
          return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        };

        // Consistency score based on variability
        let consistencyScore: 'excellent' | 'good' | 'fair' | 'poor' = 'poor';
        const avgVariability = (bedtimeStdDev + wakeStdDev) / 2;
        if (avgVariability < 30) consistencyScore = 'excellent';
        else if (avgVariability < 45) consistencyScore = 'good';
        else if (avgVariability < 60) consistencyScore = 'fair';

        sleepConsistency = {
          avgBedtime: formatTime(avgBedtimeMins),
          avgWakeTime: formatTime(avgWakeMins),
          bedtimeVariability: Math.round(bedtimeStdDev),
          wakeTimeVariability: Math.round(wakeStdDev),
          consistencyScore,
          socialJetLag: 0, // Would need weekday/weekend separation
        };
      }
    }

    // ========== HRV ANALYSIS ==========
    let hrvAnalysis: OuraData['hrvAnalysis'] = undefined;
    if (hrvValues.length >= 7) {
      const baseline = hrvValues.slice(0, 7).reduce((a, b) => a + b, 0) / 7;
      const currentAvg = hrvValues.slice(-7).reduce((a, b) => a + b, 0) / Math.min(7, hrvValues.length);

      // Find highest and lowest days
      const hrvWithDays = hrvData.filter(d => d.average_hrv && d.day);
      const sorted = [...hrvWithDays].sort((a, b) => (a.average_hrv || 0) - (b.average_hrv || 0));

      // Trend detection
      let trend: 'improving' | 'stable' | 'declining' = 'stable';
      if (currentAvg > baseline + 5) trend = 'improving';
      else if (currentAvg < baseline - 5) trend = 'declining';

      // Coefficient of variation
      const mean = hrvValues.reduce((a, b) => a + b, 0) / hrvValues.length;
      const variance = hrvValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / hrvValues.length;
      const cv = (Math.sqrt(variance) / mean) * 100;

      hrvAnalysis = {
        baseline: Math.round(baseline),
        currentAvg: Math.round(currentAvg),
        trend,
        lowestDay: sorted[0]?.day || 'N/A',
        highestDay: sorted[sorted.length - 1]?.day || 'N/A',
        morningReadiness: currentAvg >= baseline ? 'optimal' : currentAvg >= baseline * 0.85 ? 'moderate' : 'low',
        variabilityScore: Math.round(cv),
      };
    }

    // ========== SLEEP DEBT ==========
    let sleepDebt: OuraData['sleepDebt'] = undefined;
    if (sleepData.length > 0) {
      const targetHours = 8;
      const deficits = sleepData.map(d => targetHours - ((d.total_sleep_duration || 0) / 3600));
      const weeklyDeficit = deficits.slice(-7).reduce((a, b) => a + Math.max(0, b), 0);
      const accumulatedHours = deficits.reduce((a, b) => a + Math.max(0, b), 0);

      sleepDebt = {
        accumulatedHours: Math.round(accumulatedHours * 10) / 10,
        weeklyDeficit: Math.round(weeklyDeficit * 10) / 10,
        recoveryNeeded: weeklyDeficit > 5,
        daysToRecover: Math.ceil(weeklyDeficit / 1.5), // ~1.5h extra per night to recover
      };
    }

    // ========== ACTIVITY INSIGHTS ==========
    let activityInsights: OuraData['activityInsights'] = undefined;
    if (activityData.length > 0) {
      const avgSteps = activityData.reduce((sum, d) => sum + (d.steps || 0), 0) / activityData.length;
      const avgCalories = activityData.reduce((sum, d) => sum + (d.active_calories || 0), 0) / activityData.length;
      const avgSedentary = activityData.reduce((sum, d) => sum + (d.sedentary_time || 0), 0) / activityData.length;

      // Movement consistency based on step count variance
      const stepCounts = activityData.map(d => d.steps || 0);
      const stepMean = stepCounts.reduce((a, b) => a + b, 0) / stepCounts.length;
      const stepVariance = stepCounts.reduce((sum, s) => sum + Math.pow(s - stepMean, 2), 0) / stepCounts.length;
      const stepCV = stepMean > 0 ? (Math.sqrt(stepVariance) / stepMean) * 100 : 100;

      let movementConsistency: 'excellent' | 'good' | 'fair' | 'poor' = 'poor';
      if (stepCV < 20) movementConsistency = 'excellent';
      else if (stepCV < 35) movementConsistency = 'good';
      else if (stepCV < 50) movementConsistency = 'fair';

      activityInsights = {
        avgDailySteps: Math.round(avgSteps),
        avgActiveCalories: Math.round(avgCalories),
        movementConsistency,
        sedentaryHoursPerDay: Math.round((avgSedentary / 3600) * 10) / 10,
      };
    }

    // ========== BUILD PROCESSED DATA ==========
    const processedData: OuraData = {
      avgSleepHours: Math.round(avgSleepHours * 10) / 10,
      avgReadinessScore: Math.round(avgReadiness),
      avgHRV: Math.round(avgHRV),
      sleepQuality: avgReadiness >= 85 ? 'excellent' : avgReadiness >= 70 ? 'good' : avgReadiness >= 55 ? 'fair' : 'poor',
      hrvTrend: hrvAnalysis?.trend || 'stable',
      activityLevel: activityInsights?.avgDailySteps
        ? (activityInsights.avgDailySteps >= 10000 ? 'high' : activityInsights.avgDailySteps >= 6000 ? 'moderate' : 'low')
        : 'moderate',
      sleepArchitecture,
      sleepConsistency,
      hrvAnalysis,
      sleepDebt,
      activityInsights,
      insights: [],
      rawData: ouraRecord,
    };

    // ========== GENERATE RICH INSIGHTS ==========
    const insights: string[] = [];

    // Sleep architecture insights
    if (sleepArchitecture) {
      if (sleepArchitecture.deepSleepPercent < 15) {
        insights.push(`Deep sleep comprises only ${sleepArchitecture.deepSleepPercent}% of your night — physical recovery may be compromised`);
      }
      if (sleepArchitecture.remSleepPercent < 20) {
        insights.push(`REM sleep at ${sleepArchitecture.remSleepPercent}% falls below optimal — cognitive restoration needs attention`);
      }
      if (sleepArchitecture.sleepEfficiency < 85) {
        insights.push(`Sleep efficiency of ${sleepArchitecture.sleepEfficiency}% suggests time in bed isn't translating to quality rest`);
      }
    }

    // Sleep consistency insights
    if (sleepConsistency) {
      if (sleepConsistency.consistencyScore === 'poor') {
        insights.push(`Bedtime varies by ${sleepConsistency.bedtimeVariability} minutes — your circadian rhythm craves regularity`);
      }
      if (sleepConsistency.consistencyScore === 'excellent') {
        insights.push(`Consistent sleep schedule (±${sleepConsistency.bedtimeVariability}min) supports strong circadian alignment`);
      }
    }

    // HRV insights
    if (hrvAnalysis) {
      if (hrvAnalysis.trend === 'declining') {
        insights.push(`HRV trending downward from ${hrvAnalysis.baseline}ms baseline — your nervous system signals accumulated strain`);
      }
      if (hrvAnalysis.morningReadiness === 'low') {
        insights.push(`Morning HRV at ${hrvAnalysis.currentAvg}ms (below your ${hrvAnalysis.baseline}ms baseline) suggests incomplete recovery`);
      }
      if (hrvAnalysis.trend === 'improving') {
        insights.push(`HRV climbing toward ${hrvAnalysis.currentAvg}ms — recovery protocols are working`);
      }
    }

    // Sleep debt insights
    if (sleepDebt && sleepDebt.recoveryNeeded) {
      insights.push(`${sleepDebt.weeklyDeficit}h sleep debt accumulated this week — ${sleepDebt.daysToRecover} nights of extended rest recommended`);
    }

    // Activity insights
    if (activityInsights) {
      if (activityInsights.sedentaryHoursPerDay > 10) {
        insights.push(`${activityInsights.sedentaryHoursPerDay}h sedentary daily — movement breaks every 90 minutes would benefit recovery`);
      }
      if (activityInsights.movementConsistency === 'poor') {
        insights.push('Activity levels fluctuate significantly day-to-day — consistency supports better adaptation');
      }
    }

    // Basic fallback insights
    if (avgSleepHours < 7 && insights.length === 0) {
      insights.push(`Sleep averaging ${processedData.avgSleepHours}h falls short of the 7-8h your body requires for full restoration`);
    }

    if (insights.length === 0) {
      insights.push('Recovery metrics within healthy ranges — maintain current sleep and activity patterns');
    }

    return {
      source: 'oura',
      available: true,
      data: processedData,
      insights,
      fetchedAt: new Date().toISOString(),
      recordCount: sleepData.length,
      daysOfData: sleepData.length,
    };
  } catch (error) {
    console.error('[Ecosystem Fetcher] Error fetching Oura data:', error);
    return {
      source: 'oura',
      available: false,
      data: null,
      insights: [],
      fetchedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Fetch Dexcom CGM data from database
 */
export async function fetchDexcomData(
  email: string,
  startDate?: Date,
  endDate?: Date
): Promise<EcosystemDataSource> {
  try {
    const supabase = await createClient();
    const end = endDate || new Date();
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    const { data, error } = await supabase
      .from('dexcom_data')
      .select('*')
      .eq('email', email)
      .gte('start_date', start.toISOString())
      .lte('end_date', end.toISOString())
      .order('sync_date', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) {
      return {
        source: 'dexcom',
        available: false,
        data: null,
        insights: [],
        fetchedAt: new Date().toISOString(),
        error: error?.message || 'No Dexcom data found',
      };
    }

    const dexcomRecord = data[0];
    const egvData = dexcomRecord.egv_data as Array<{value?: number; systemTime?: string}> || [];
    const eventsData = dexcomRecord.events_data as Array<{eventType?: string; eventTime?: string}> || [];
    const statsData = dexcomRecord.statistics_data as {timeInRange?: number; averageGlucose?: number} | null;

    // Calculate metrics
    const glucoseValues = egvData.map(reading => reading.value || 0).filter(v => v > 0);
    const avgGlucose = glucoseValues.length > 0
      ? glucoseValues.reduce((sum, val) => sum + val, 0) / glucoseValues.length
      : 0;

    // Detect spikes (>140 mg/dL)
    const spikes = egvData.filter(reading => (reading.value || 0) > 140);
    const spikesByHour = spikes.reduce((acc, spike) => {
      if (spike.systemTime) {
        const hour = new Date(spike.systemTime).getHours();
        const hourKey = `${hour}:00`;
        acc[hourKey] = (acc[hourKey] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const spikeTimes = Object.entries(spikesByHour)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([time]) => time);

    const processedData: DexcomData = {
      avgGlucose: Math.round(avgGlucose),
      avgFastingGlucose: null, // Would need to identify fasting periods
      glucoseVariability: Math.round(Math.sqrt(glucoseValues.reduce((sum, val) => sum + Math.pow(val - avgGlucose, 2), 0) / glucoseValues.length)),
      timeInRange: statsData?.timeInRange || 0,
      spikeTimes,
      spikeEvents: spikes.slice(0, 10).map(s => ({
        time: s.systemTime || '',
        value: s.value || 0,
      })),
      trends: [],
      insights: [],
      rawData: dexcomRecord,
    };

    // Generate insights
    const insights: string[] = [];
    if (avgGlucose > 110) {
      insights.push(`Elevated average glucose (${processedData.avgGlucose} mg/dL, optimal <100 mg/dL)`);
    }
    if (spikeTimes.length > 0) {
      insights.push(`Frequent glucose spikes detected at ${spikeTimes.join(', ')}`);
    }
    if (processedData.timeInRange < 70) {
      insights.push(`Low time in range (${processedData.timeInRange}%, target >70%)`);
    }

    return {
      source: 'dexcom',
      available: true,
      data: processedData,
      insights,
      fetchedAt: new Date().toISOString(),
      recordCount: egvData.length,
      daysOfData: Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)),
    };
  } catch (error) {
    console.error('[Ecosystem Fetcher] Error fetching Dexcom data:', error);
    return {
      source: 'dexcom',
      available: false,
      data: null,
      insights: [],
      fetchedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Fetch Vital unified health data from database
 */
export async function fetchVitalData(
  email: string,
  startDate?: Date,
  endDate?: Date
): Promise<EcosystemDataSource> {
  try {
    const supabase = await createClient();
    const end = endDate || new Date();
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const { data, error } = await supabase
      .from('vital_data')
      .select('*')
      .eq('email', email)
      .gte('start_date', start.toISOString().split('T')[0])
      .lte('end_date', end.toISOString().split('T')[0])
      .order('sync_date', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) {
      return {
        source: 'vital',
        available: false,
        data: null,
        insights: [],
        fetchedAt: new Date().toISOString(),
        error: error?.message || 'No Vital data found',
      };
    }

    const vitalRecord = data[0];
    const processedData: VitalData = {
      connectedProviders: (vitalRecord.connected_providers as string[]) || [],
      sleepData: vitalRecord.sleep_data,
      activityData: vitalRecord.activity_data,
      bodyData: vitalRecord.body_data,
      glucoseData: vitalRecord.glucose_data,
      workoutsData: vitalRecord.workouts_data,
      insights: [],
      rawData: vitalRecord,
    };

    const insights: string[] = [];
    insights.push(`Connected providers: ${processedData.connectedProviders.join(', ')}`);

    return {
      source: 'vital',
      available: true,
      data: processedData,
      insights,
      fetchedAt: new Date().toISOString(),
      recordCount: processedData.connectedProviders.length,
    };
  } catch (error) {
    console.error('[Ecosystem Fetcher] Error fetching Vital data:', error);
    return {
      source: 'vital',
      available: false,
      data: null,
      insights: [],
      fetchedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Fetch Gmail patterns from behavioral_patterns table
 */
export async function fetchGmailPatterns(email: string): Promise<EcosystemDataSource> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('behavioral_patterns')
      .select('*')
      .eq('email', email)
      .eq('source', 'gmail')
      .order('sync_date', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) {
      return {
        source: 'gmail',
        available: false,
        data: null,
        insights: [],
        fetchedAt: new Date().toISOString(),
        error: error?.message || 'No Gmail pattern data found',
      };
    }

    const gmailRecord = data[0];
    const patterns = gmailRecord.patterns as GmailPatterns;

    return {
      source: 'gmail',
      available: true,
      data: patterns,
      insights: patterns.insights || [],
      fetchedAt: new Date().toISOString(),
      recordCount: gmailRecord.data_points_analyzed || 0,
    };
  } catch (error) {
    console.error('[Ecosystem Fetcher] Error fetching Gmail patterns:', error);
    return {
      source: 'gmail',
      available: false,
      data: null,
      insights: [],
      fetchedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Fetch Slack patterns from behavioral_patterns table
 */
export async function fetchSlackPatterns(email: string): Promise<EcosystemDataSource> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('behavioral_patterns')
      .select('*')
      .eq('email', email)
      .eq('source', 'slack')
      .order('sync_date', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) {
      return {
        source: 'slack',
        available: false,
        data: null,
        insights: [],
        fetchedAt: new Date().toISOString(),
        error: error?.message || 'No Slack pattern data found',
      };
    }

    const slackRecord = data[0];
    const patterns = slackRecord.patterns as SlackPatterns;

    return {
      source: 'slack',
      available: true,
      data: patterns,
      insights: patterns.insights || [],
      fetchedAt: new Date().toISOString(),
      recordCount: slackRecord.data_points_analyzed || 0,
    };
  } catch (error) {
    console.error('[Ecosystem Fetcher] Error fetching Slack patterns:', error);
    return {
      source: 'slack',
      available: false,
      data: null,
      insights: [],
      fetchedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Fetch Outlook patterns from behavioral_patterns table
 */
export async function fetchOutlookPatterns(email: string): Promise<EcosystemDataSource> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('behavioral_patterns')
      .select('*')
      .eq('email', email)
      .eq('source', 'outlook')
      .order('sync_date', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) {
      return {
        source: 'outlook',
        available: false,
        data: null,
        insights: [],
        fetchedAt: new Date().toISOString(),
        error: error?.message || 'No Outlook pattern data found',
      };
    }

    const outlookRecord = data[0];
    const patterns = outlookRecord.patterns as OutlookPatterns;

    return {
      source: 'outlook',
      available: true,
      data: patterns,
      insights: patterns.insights || [],
      fetchedAt: new Date().toISOString(),
      recordCount: outlookRecord.data_points_analyzed || 0,
    };
  } catch (error) {
    console.error('[Ecosystem Fetcher] Error fetching Outlook patterns:', error);
    return {
      source: 'outlook',
      available: false,
      data: null,
      insights: [],
      fetchedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Fetch Teams patterns from behavioral_patterns table
 */
export async function fetchTeamsPatterns(email: string): Promise<EcosystemDataSource> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('behavioral_patterns')
      .select('*')
      .eq('email', email)
      .eq('source', 'teams')
      .order('sync_date', { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) {
      return {
        source: 'teams',
        available: false,
        data: null,
        insights: [],
        fetchedAt: new Date().toISOString(),
        error: error?.message || 'No Teams pattern data found',
      };
    }

    const teamsRecord = data[0];
    const patterns = teamsRecord.patterns as TeamsPatterns;

    return {
      source: 'teams',
      available: true,
      data: patterns,
      insights: patterns.insights || [],
      fetchedAt: new Date().toISOString(),
      recordCount: teamsRecord.data_points_analyzed || 0,
    };
  } catch (error) {
    console.error('[Ecosystem Fetcher] Error fetching Teams patterns:', error);
    return {
      source: 'teams',
      available: false,
      data: null,
      insights: [],
      fetchedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Fetch Whoop data from forge_training_data table
 */
export async function fetchWhoopData(email: string): Promise<EcosystemDataSource> {
  try {
    const supabase = await createClient();

    // Fetch from both training data and workout patterns for complete picture
    const [trainingResult, patternsResult] = await Promise.all([
      supabase
        .from('forge_training_data')
        .select('*')
        .eq('email', email)
        .eq('provider', 'whoop')
        .order('created_at', { ascending: false })
        .limit(1),
      supabase
        .from('forge_workout_patterns')
        .select('*')
        .eq('email', email)
        .eq('source', 'whoop')
        .order('sync_date', { ascending: false })
        .limit(1)
    ]);

    const trainingData = trainingResult.data?.[0];
    const patternsData = patternsResult.data?.[0];

    if (!trainingData && !patternsData) {
      return {
        source: 'whoop',
        available: false,
        data: null,
        insights: [],
        fetchedAt: new Date().toISOString(),
        error: 'No Whoop data found',
      };
    }

    // Extract data from stored records
    const recoveryScore = (trainingData?.recovery_score || patternsData?.patterns?.recovery) as Record<string, unknown> || {};
    const hrvTrends = (trainingData?.hrv_trends || patternsData?.patterns?.hrvTrends) as Record<string, unknown> || {};
    const restingHrTrends = (trainingData?.resting_hr_trends || patternsData?.patterns?.restingHR) as Record<string, unknown> || {};
    const strainData = patternsData?.patterns?.strain as Record<string, unknown> || {};
    const recommendations = patternsData?.patterns?.recommendations as Record<string, unknown> || {};

    // ========== RECOVERY ZONES ==========
    const greenDays = (recoveryScore.greenDays as number) || 0;
    const yellowDays = (recoveryScore.yellowDays as number) || 0;
    const redDays = (recoveryScore.redDays as number) || 0;
    const totalDays = greenDays + yellowDays + redDays;

    const recoveryZones: WhoopData['recoveryZones'] = totalDays > 0 ? {
      greenDays,
      yellowDays,
      redDays,
      greenPercentage: Math.round((greenDays / totalDays) * 100),
      avgGreenRecovery: 75, // Would need raw data to calculate
      avgRedRecovery: 25,
    } : undefined;

    // ========== STRAIN-RECOVERY BALANCE ==========
    const avgStrain = (strainData.avgDailyStrain as number) || 0;
    const overreachingDays = (strainData.overreachingDays as number) || 0;
    const optimalRange = (strainData.optimalStrainRange as [number, number]) || [10, 15];

    let balanceScore: 'optimal' | 'overreaching' | 'undertraining' | 'mismatched' = 'optimal';
    if (overreachingDays > 5) balanceScore = 'overreaching';
    else if (avgStrain < 8) balanceScore = 'undertraining';
    else if (redDays > 5 && avgStrain > 14) balanceScore = 'mismatched';

    const strainRecoveryBalance: WhoopData['strainRecoveryBalance'] = {
      avgStrainOnGreenDays: avgStrain * 1.1, // Estimate
      avgStrainOnRedDays: avgStrain * 0.7,
      optimalStrainRange: optimalRange,
      overreachingDays,
      undertrainingDays: avgStrain < 8 ? totalDays : 0,
      balanceScore,
    };

    // ========== HRV PATTERNS ==========
    const avgHRV = (hrvTrends.avgHRV as number) || (hrvTrends.avg as number) || 0;
    const hrvBaseline = (hrvTrends.baseline as number) || avgHRV;
    const hrvTrend = (hrvTrends.trend as 'improving' | 'stable' | 'declining') || 'stable';

    const hrvPatterns: WhoopData['hrvPatterns'] = avgHRV > 0 ? {
      baseline: Math.round(hrvBaseline),
      currentWeekAvg: Math.round(avgHRV),
      trend: hrvTrend,
      lowestValue: Math.round(avgHRV * 0.7),
      highestValue: Math.round(avgHRV * 1.3),
      morningAvg: Math.round(avgHRV),
      variabilityPercent: 15, // Default CV
    } : undefined;

    // ========== RESTING HR ANALYSIS ==========
    const avgRestingHR = (restingHrTrends.avg as number) || 0;
    const restingHRAnalysis: WhoopData['restingHRAnalysis'] = avgRestingHR > 0 ? {
      baseline: Math.round(avgRestingHR),
      currentAvg: Math.round(avgRestingHR),
      trend: avgRestingHR < 60 ? 'improving' : avgRestingHR > 70 ? 'elevated' : 'stable',
      elevatedDays: avgRestingHR > 65 ? Math.round(totalDays * 0.3) : 0,
    } : undefined;

    // ========== TRAINING LOAD ==========
    const weeklyStrain = avgStrain * 7;
    const acuteChronicRatio = 1.0; // Would need historical data

    let overtrainingRisk: 'low' | 'moderate' | 'high' = 'low';
    if (redDays > 5 || overreachingDays > 3) overtrainingRisk = 'high';
    else if (redDays > 3 || avgStrain > 16) overtrainingRisk = 'moderate';

    const trainingLoad: WhoopData['trainingLoad'] = {
      weeklyStrain: Math.round(weeklyStrain * 10) / 10,
      weeklyStrainTrend: avgStrain > 14 ? 'increasing' : avgStrain < 10 ? 'decreasing' : 'stable',
      acuteChronicRatio,
      overtrainingRisk,
      recommendedRestDays: (recommendations.restDaysNeeded as number) || (overtrainingRisk === 'high' ? 2 : 1),
    };

    // ========== BUILD PROCESSED DATA ==========
    const avgRecoveryScore = (recoveryScore.avgRecoveryScore as number) || (recoveryScore.avg as number) || 0;

    const processedData: WhoopData = {
      avgRecoveryScore: Math.round(avgRecoveryScore),
      avgStrainScore: Math.round(avgStrain * 10) / 10,
      avgHRV: Math.round(avgHRV),
      avgRestingHR: Math.round(avgRestingHR),
      recoveryTrend: (recoveryScore.trend as 'improving' | 'stable' | 'declining') || 'stable',
      strainTrend: avgStrain > 14 ? 'high' : avgStrain > 10 ? 'moderate' : 'low',
      sleepPerformance: 0,
      cyclesAnalyzed: trainingData?.data_points_analyzed || patternsData?.data_points_analyzed || 0,
      recoveryZones,
      strainRecoveryBalance,
      hrvPatterns,
      restingHRAnalysis,
      trainingLoad,
      insights: [],
      rawData: { trainingData, patternsData },
    };

    // ========== GENERATE RICH INSIGHTS ==========
    const insights: string[] = [];

    // Recovery zone insights
    if (recoveryZones) {
      if (recoveryZones.greenPercentage >= 60) {
        insights.push(`${recoveryZones.greenPercentage}% of days in green recovery — your body is adapting well to training demands`);
      } else if (recoveryZones.greenPercentage < 40) {
        insights.push(`Only ${recoveryZones.greenPercentage}% green days suggests recovery isn't keeping pace with strain — consider deloading`);
      }
      if (redDays >= 5) {
        insights.push(`${redDays} red recovery days this month signals accumulated fatigue — prioritize rest and sleep quality`);
      }
    }

    // Strain-recovery balance insights
    if (strainRecoveryBalance) {
      if (strainRecoveryBalance.balanceScore === 'overreaching') {
        insights.push(`Training intensity exceeds recovery capacity — ${strainRecoveryBalance.overreachingDays} days with strain above 18`);
      } else if (strainRecoveryBalance.balanceScore === 'mismatched') {
        insights.push('High strain on low recovery days creates adaptation debt — align intensity with readiness');
      } else if (strainRecoveryBalance.balanceScore === 'optimal') {
        insights.push('Training load aligns well with recovery capacity — maintain current approach');
      }
    }

    // HRV insights
    if (hrvPatterns) {
      if (hrvPatterns.trend === 'declining') {
        insights.push(`HRV trending downward from ${hrvPatterns.baseline}ms — accumulated stress requiring attention`);
      } else if (hrvPatterns.trend === 'improving') {
        insights.push(`HRV rising toward ${hrvPatterns.currentWeekAvg}ms indicates positive adaptation to training`);
      }
      if (hrvPatterns.currentWeekAvg < 40) {
        insights.push(`HRV at ${hrvPatterns.currentWeekAvg}ms falls below healthy thresholds — prioritize parasympathetic activation`);
      }
    }

    // Resting HR insights
    if (restingHRAnalysis) {
      if (restingHRAnalysis.trend === 'elevated') {
        insights.push(`Elevated resting heart rate (${restingHRAnalysis.currentAvg}bpm) may indicate incomplete recovery or illness onset`);
      } else if (restingHRAnalysis.currentAvg < 55) {
        insights.push(`Resting heart rate of ${restingHRAnalysis.currentAvg}bpm reflects strong cardiovascular conditioning`);
      }
    }

    // Training load insights
    if (trainingLoad) {
      if (trainingLoad.overtrainingRisk === 'high') {
        insights.push(`Overtraining risk elevated — ${trainingLoad.recommendedRestDays} rest days recommended before next high-intensity session`);
      }
      if (trainingLoad.weeklyStrain > 100) {
        insights.push(`Weekly strain of ${trainingLoad.weeklyStrain} places significant demands on recovery systems`);
      }
    }

    // Fallback insight
    if (insights.length === 0) {
      insights.push('Recovery and training metrics within normal ranges — continue current protocols');
    }

    processedData.insights = insights;

    return {
      source: 'whoop',
      available: true,
      data: processedData,
      insights,
      fetchedAt: new Date().toISOString(),
      recordCount: processedData.cyclesAnalyzed,
    };
  } catch (error) {
    console.error('[Ecosystem Fetcher] Error fetching Whoop data:', error);
    return {
      source: 'whoop',
      available: false,
      data: null,
      insights: [],
      fetchedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Fetch blood biomarkers from onboarding data
 */
export async function fetchBloodBiomarkers(
  email: string,
  planType: 'sage' | 'forge' = 'sage'
): Promise<EcosystemDataSource> {
  try {
    const supabase = await createClient();
    const tableName = planType === 'sage' ? 'sage_onboarding_data' : 'forge_onboarding_data';

    const { data, error } = await supabase
      .from(tableName)
      .select('lab_file_analysis')
      .eq('email', email)
      .single();

    if (error || !data || !data.lab_file_analysis) {
      return {
        source: 'bloodBiomarkers',
        available: false,
        data: null,
        insights: [],
        fetchedAt: new Date().toISOString(),
        error: error?.message || 'No blood biomarker data found',
      };
    }

    const biomarkerData = data.lab_file_analysis as BloodBiomarkers;

    return {
      source: 'bloodBiomarkers',
      available: true,
      data: biomarkerData,
      insights: biomarkerData.concerns || [],
      fetchedAt: new Date().toISOString(),
      recordCount: biomarkerData.biomarkers?.length || 0,
    };
  } catch (error) {
    console.error('[Ecosystem Fetcher] Error fetching blood biomarkers:', error);
    return {
      source: 'bloodBiomarkers',
      available: false,
      data: null,
      insights: [],
      fetchedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// MAIN FETCH FUNCTION
// ============================================================================

/**
 * Fetch all available ecosystem data for a user
 * Runs all fetches in parallel for optimal performance
 */
export async function fetchAllEcosystemData(
  email: string,
  planType: 'sage' | 'forge' = 'sage',
  options?: {
    startDate?: Date;
    endDate?: Date;
  }
): Promise<EcosystemFetchResult> {
  console.log(`[Ecosystem Fetcher] Fetching all ecosystem data for ${email}`);

  const startTime = Date.now();

  // Fetch all data sources in parallel
  const [bloodBiomarkers, oura, dexcom, vital, gmail, slack, outlook, teams, whoop] = await Promise.all([
    fetchBloodBiomarkers(email, planType),
    fetchOuraData(email, options?.startDate, options?.endDate),
    fetchDexcomData(email, options?.startDate, options?.endDate),
    fetchVitalData(email, options?.startDate, options?.endDate),
    fetchGmailPatterns(email),
    fetchSlackPatterns(email),
    fetchOutlookPatterns(email),
    fetchTeamsPatterns(email),
    fetchWhoopData(email),
  ]);

  const result: EcosystemFetchResult = {
    bloodBiomarkers,
    oura,
    dexcom,
    vital,
    gmail,
    slack,
    outlook,
    teams,
    whoop,
    fetchTimestamp: new Date().toISOString(),
    successCount: [bloodBiomarkers, oura, dexcom, vital, gmail, slack, outlook, teams, whoop].filter(s => s.available).length,
    totalSources: 9,
  };

  const duration = Date.now() - startTime;
  console.log(`[Ecosystem Fetcher] Completed in ${duration}ms. Success: ${result.successCount}/${result.totalSources} sources`);

  return result;
}
