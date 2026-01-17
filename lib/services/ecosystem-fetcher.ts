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
 * - Outlook (email + calendar patterns)
 * - Teams (chat message patterns)
 * - Whoop (recovery, strain, HRV)
 * - Spotify (music mood, listening patterns)
 * - Notion (tasks, databases, project tracking)
 * - Linear (issues, projects, priorities)
 * - Blood biomarkers (from lab file analysis)
 *
 * @module lib/services/ecosystem-fetcher
 */

import { createClient, createAdminClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/utils/logger';
import { cacheService, CACHE_KEYS } from './cache-service';
import { getUnifiedHealthData, groupByProvider, UnifiedHealthRecord } from './unified-data';

const logger = createLogger('EcosystemFetcher');

/** Cache TTL for ecosystem data in seconds (15 minutes) */
const ECOSYSTEM_CACHE_TTL = 900;

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

export interface SpotifyData {
  // Recent listening
  recentTracks: Array<{
    id: string;
    name: string;
    artist: string;
    playedAt: string;
    durationMs: number;
  }>;
  // Audio features averages (from recent tracks)
  avgEnergy: number;      // 0-1, higher = more energetic
  avgValence: number;     // 0-1, higher = more positive/happy
  avgTempo: number;       // BPM
  avgDanceability: number; // 0-1
  // Mood inference
  inferredMood: 'happy' | 'calm' | 'energetic' | 'melancholy' | 'focused' | 'anxious' | 'mixed';
  moodConfidence: number; // 0-1
  // Listening patterns
  listeningHours: string[]; // Peak hours
  avgTracksPerDay: number;
  topGenres: string[];
  // Stress/wellness indicators
  moodTrend: 'improving' | 'stable' | 'declining';
  lateNightListening: boolean; // Listening after 11pm
  emotionalVolatility: 'low' | 'medium' | 'high'; // variance in valence
  insights: string[];
  rawData: unknown;
}

export interface NotionData {
  workspaceName: string;
  totalDatabases: number;
  totalTasks: number;
  openTasks: number;
  overdueTasks: number;
  tasksDueSoon: number; // Due in next 3 days
  tasksByStatus: Record<string, number>;
  tasksByPriority: Record<string, number>;
  recentActivity: Array<{
    title: string;
    status?: string;
    dueDate?: string;
    lastEdited: string;
  }>;
  insights: string[];
  rawData: unknown;
}

export interface LinearData {
  organizationName: string;
  totalIssues: number;
  openIssues: number;
  urgentIssues: number;
  highPriorityIssues: number;
  overdueIssues: number;
  issuesDueSoon: number;
  issuesByState: Record<string, number>;
  issuesByPriority: Record<string, number>;
  projectSummary: Array<{
    name: string;
    issueCount: number;
    progress?: number;
  }>;
  recentActivity: Array<{
    identifier: string;
    title: string;
    state: string;
    priority: string;
    updatedAt: string;
  }>;
  insights: string[];
  rawData: unknown;
}

/** Deep content analysis data from Slack/Gmail messages */
export interface DeepContentData {
  slack: {
    pendingTasks: Array<{
      description: string;
      requester: string;
      urgency: 'high' | 'medium' | 'low';
      deadline?: string;
    }>;
    responseDebt: {
      count: number;
      messages: Array<{ from: string; summary: string; daysOld: number }>;
    };
    keyPeople: Array<{ name: string; mentionCount: number; context: string }>;
    urgentMessages: Array<{ from: string; summary: string; channel?: string }>;
  } | null;
  gmail: {
    pendingTasks: Array<{
      description: string;
      requester: string;
      urgency: 'high' | 'medium' | 'low';
      deadline?: string;
    }>;
    responseDebt: {
      count: number;
      messages: Array<{ from: string; subject: string; daysOld: number }>;
    };
    keyPeople: Array<{ name: string; emailCount: number; context: string }>;
    urgentMessages: Array<{ from: string; subject: string; snippet?: string }>;
  } | null;
  available: boolean;
  lastAnalyzed?: string;
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
  spotify: EcosystemDataSource;
  notion: EcosystemDataSource;
  linear: EcosystemDataSource;
  appleHealth: EcosystemDataSource;
  /** Deep content analysis from Slack/Gmail (tasks, response debt, key people) */
  deepContent?: DeepContentData;
  fetchTimestamp: string;
  successCount: number;
  totalSources: number;
  /** Sources that failed to fetch (rejected promises) */
  failedSources?: string[];
  /** Whether some sources failed but others succeeded (partial data) */
  partial?: boolean;
  /** Whether this result was retrieved from cache */
  fromCache?: boolean;
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
    const supabase = createAdminClient();

    // First look up user_id from email (user_connectors uses user_id, not email)
    const adminClient = createAdminClient();
    const { data: users } = await adminClient
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    // Check if user has Oura connected via multiple methods:
    // 1. user_connectors (Vital integration)
    // 2. integration_tokens (Direct OAuth)
    let isConnected = false;

    // Method 1: Check user_connectors (Vital) by user_id
    if (users?.id) {
      const { data } = await adminClient
        .from('user_connectors')
        .select('is_connected')
        .eq('user_id', users.id)
        .eq('connector_name', 'Oura Ring')
        .eq('is_connected', true)
        .maybeSingle();
      if (data) isConnected = true;
    }

    // Method 2: Check user_connectors by user_email (fallback)
    if (!isConnected) {
      const { data } = await adminClient
        .from('user_connectors')
        .select('is_connected')
        .eq('user_email', email)
        .eq('connector_name', 'Oura Ring')
        .eq('is_connected', true)
        .maybeSingle();
      if (data) isConnected = true;
    }

    // Method 3: Check integration_tokens for direct OAuth connection
    if (!isConnected) {
      const { data } = await adminClient
        .from('integration_tokens')
        .select('is_active')
        .eq('user_email', email)
        .eq('provider', 'oura')
        .eq('is_active', true)
        .maybeSingle();
      if (data) isConnected = true;
    }

    if (!isConnected) {
      return {
        source: 'oura',
        available: false,
        data: null,
        insights: [],
        fetchedAt: new Date().toISOString(),
        error: 'Oura Ring not connected',
      };
    }

    const end = endDate || new Date();
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    // Query for data that OVERLAPS with our date range (not contained within)
    // Overlap condition: data.end_date >= query.start AND data.start_date <= query.end
    const { data, error } = await supabase
      .from('oura_data')
      .select('*')
      .eq('email', email)
      .gte('end_date', start.toISOString().split('T')[0])    // data ends after our start
      .lte('start_date', end.toISOString().split('T')[0])    // data starts before our end
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
    logger.error('Error fetching Oura data', error, { email });
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
    const supabase = createAdminClient();

    // First look up user_id from email (user_connectors uses user_id, not email)
    const adminClient = createAdminClient();
    const { data: users } = await adminClient
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    // Check if user has Dexcom connected - try by user_id first, then by user_email fallback
    let connector = null;
    if (users?.id) {
      const { data } = await adminClient
        .from('user_connectors')
        .select('is_connected')
        .eq('user_id', users.id)
        .eq('connector_name', 'Dexcom')
        .eq('is_connected', true)
        .maybeSingle();
      connector = data;
    }

    // Fallback: check by user_email (some callbacks store this)
    if (!connector) {
      const { data } = await adminClient
        .from('user_connectors')
        .select('is_connected')
        .eq('user_email', email)
        .eq('connector_name', 'Dexcom')
        .eq('is_connected', true)
        .maybeSingle();
      connector = data;
    }

    if (!connector) {
      return {
        source: 'dexcom',
        available: false,
        data: null,
        insights: [],
        fetchedAt: new Date().toISOString(),
        error: 'Dexcom not connected',
      };
    }

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
    logger.error('Error fetching Dexcom data', error, { email });
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
    const supabase = createAdminClient();
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
    logger.error('Error fetching Vital data', error, { email });
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
    const supabase = createAdminClient();

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
    logger.error('Error fetching Gmail patterns', error, { email });
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
    const supabase = createAdminClient();

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
    logger.error('Error fetching Slack patterns', error, { email });
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
    const supabase = createAdminClient();

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
    logger.error('Error fetching Outlook patterns', error, { email });
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
    const supabase = createAdminClient();

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
    logger.error('Error fetching Teams patterns', error, { email });
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
    const supabase = createAdminClient();

    // First look up user_id from email (user_connectors uses user_id, not email)
    const adminClient = createAdminClient();
    const { data: users } = await adminClient
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    // Check if user has Whoop connected - try by user_id first, then by user_email fallback
    let connector = null;
    if (users?.id) {
      const { data } = await adminClient
        .from('user_connectors')
        .select('is_connected')
        .eq('user_id', users.id)
        .eq('connector_name', 'Whoop')
        .eq('is_connected', true)
        .maybeSingle();
      connector = data;
    }

    // Fallback: check by user_email (some callbacks store this)
    if (!connector) {
      const { data } = await adminClient
        .from('user_connectors')
        .select('is_connected')
        .eq('user_email', email)
        .eq('connector_name', 'Whoop')
        .eq('is_connected', true)
        .maybeSingle();
      connector = data;
    }

    // Final fallback: check integration_tokens table (newer storage)
    if (!connector) {
      const { data } = await adminClient
        .from('integration_tokens')
        .select('is_active')
        .eq('user_email', email)
        .eq('provider', 'whoop')
        .eq('is_active', true)
        .maybeSingle();
      if (data) {
        connector = { is_connected: true };
      }
    }

    if (!connector) {
      return {
        source: 'whoop',
        available: false,
        data: null,
        insights: [],
        fetchedAt: new Date().toISOString(),
        error: 'Whoop not connected',
      };
    }

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
    logger.error('Error fetching Whoop data', error, { email });
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
    const supabase = createAdminClient();
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
    logger.error('Error fetching blood biomarkers', error, { email });
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
// SPOTIFY DATA
// ============================================================================

/**
 * Fetch Apple Health data from user_health_baselines
 * This data is synced from the Flutter app via /api/health/sync
 */
export async function fetchAppleHealthData(email: string): Promise<EcosystemDataSource> {
  try {
    const supabase = createAdminClient();

    // Fetch all health baselines for this user
    const { data: baselines, error } = await supabase
      .from('user_health_baselines')
      .select('metric_type, baseline_value, last_updated, window_days')
      .eq('email', email)
      .order('last_updated', { ascending: false });

    if (error || !baselines || baselines.length === 0) {
      return {
        source: 'appleHealth',
        available: false,
        data: null,
        insights: [],
        fetchedAt: new Date().toISOString(),
        error: error?.message || 'No Apple Health data found',
      };
    }

    // Check if data is recent (within 7 days)
    const mostRecent = new Date(baselines[0].last_updated);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    if (mostRecent < sevenDaysAgo) {
      return {
        source: 'appleHealth',
        available: false,
        data: null,
        insights: [],
        fetchedAt: new Date().toISOString(),
        error: `Apple Health data is stale (last synced: ${mostRecent.toISOString().split('T')[0]})`,
      };
    }

    // Transform to usable format
    const metrics: Record<string, number> = {};
    for (const b of baselines) {
      metrics[b.metric_type] = b.baseline_value;
    }

    const appleHealthData = {
      dailySteps: metrics.daily_steps || metrics.avg_steps || 0,
      activeCalories: metrics.active_calories || 0,
      restingHeartRate: metrics.resting_hr || 0,
      hrv: metrics.hrv || 0,
      sleepHours: metrics.sleep_duration_hours || 0,
      deepSleepMinutes: metrics.deep_sleep_minutes || 0,
      remSleepMinutes: metrics.rem_sleep_minutes || 0,
      strainScore: metrics.strain_score || 0,
      lastSynced: baselines[0].last_updated,
    };

    // Generate insights from the data
    const insights: string[] = [];

    if (appleHealthData.dailySteps > 0) {
      if (appleHealthData.dailySteps >= 10000) {
        insights.push(`Excellent step count: ${appleHealthData.dailySteps.toLocaleString()} steps/day average.`);
      } else if (appleHealthData.dailySteps >= 7500) {
        insights.push(`Good activity level: ${appleHealthData.dailySteps.toLocaleString()} steps/day. ${(10000 - appleHealthData.dailySteps).toLocaleString()} more to hit 10k.`);
      } else {
        insights.push(`Step count is ${appleHealthData.dailySteps.toLocaleString()}/day. Consider adding a short walk.`);
      }
    }

    if (appleHealthData.restingHeartRate > 0) {
      if (appleHealthData.restingHeartRate < 60) {
        insights.push(`Excellent resting heart rate: ${Math.round(appleHealthData.restingHeartRate)} bpm indicates good cardiovascular fitness.`);
      } else if (appleHealthData.restingHeartRate > 80) {
        insights.push(`Resting heart rate is elevated at ${Math.round(appleHealthData.restingHeartRate)} bpm. Consider relaxation techniques.`);
      }
    }

    if (appleHealthData.sleepHours > 0) {
      if (appleHealthData.sleepHours < 6) {
        insights.push(`Sleep duration (${appleHealthData.sleepHours.toFixed(1)}h) is below recommended. Aim for 7-9 hours.`);
      } else if (appleHealthData.sleepHours >= 7 && appleHealthData.sleepHours <= 9) {
        insights.push(`Sleep duration (${appleHealthData.sleepHours.toFixed(1)}h) is in the optimal range.`);
      }
    }

    return {
      source: 'appleHealth',
      available: true,
      data: appleHealthData,
      insights,
      fetchedAt: new Date().toISOString(),
      recordCount: baselines.length,
    };
  } catch (error) {
    logger.error('Error fetching Apple Health data', error, { email });
    return {
      source: 'appleHealth',
      available: false,
      data: null,
      insights: [],
      fetchedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Fetch deep content analysis data from Slack and Gmail
 * This includes pending tasks, response debt, key people, and urgent messages
 */
export async function fetchDeepContentData(email: string): Promise<DeepContentData> {
  try {
    const supabase = createAdminClient();

    // Fetch both Slack and Gmail deep content analysis in parallel
    const { data: analyses, error } = await supabase
      .from('deep_content_analysis')
      .select('*')
      .eq('user_email', email)
      .in('source', ['slack', 'gmail'])
      .order('analyzed_at', { ascending: false });

    if (error) {
      logger.error('Error fetching deep content analysis', error, { email });
      return { slack: null, gmail: null, available: false };
    }

    if (!analyses || analyses.length === 0) {
      logger.debug('No deep content analysis found', { email });
      return { slack: null, gmail: null, available: false };
    }

    let slackData = null;
    let gmailData = null;
    let lastAnalyzed: string | undefined;

    for (const analysis of analyses) {
      const data = {
        pendingTasks: (analysis.pending_tasks || []).map((t: any) => ({
          description: t.description,
          requester: t.requester || t.requesterName || 'Unknown',
          urgency: t.urgency || 'medium',
          deadline: t.deadline,
        })),
        responseDebt: {
          count: analysis.response_debt?.count || 0,
          messages: (analysis.response_debt?.messages || []).slice(0, 5).map((m: any) => ({
            from: m.from || m.sender || 'Unknown',
            summary: m.summary || m.subject || '',
            subject: m.subject,
            daysOld: m.daysOld || 0,
          })),
        },
        keyPeople: (analysis.key_people || []).slice(0, 5).map((p: any) => ({
          name: p.name || 'Unknown',
          mentionCount: p.mentionCount || p.count || 0,
          emailCount: p.emailCount || p.count || 0,
          context: p.context || p.role || '',
        })),
        urgentMessages: (analysis.urgent_messages || []).slice(0, 5).map((m: any) => ({
          from: m.from || m.sender || 'Unknown',
          summary: m.summary || m.text || '',
          subject: m.subject,
          channel: m.channel || m.channelName,
          snippet: m.snippet,
        })),
      };

      if (analysis.source === 'slack') {
        slackData = data;
      } else if (analysis.source === 'gmail') {
        gmailData = data;
      }

      if (!lastAnalyzed || analysis.analyzed_at > lastAnalyzed) {
        lastAnalyzed = analysis.analyzed_at;
      }
    }

    const available = !!(slackData || gmailData);
    logger.debug('Deep content analysis fetched', {
      email,
      hasSlack: !!slackData,
      hasGmail: !!gmailData,
      slackTasks: slackData?.pendingTasks?.length || 0,
      gmailTasks: gmailData?.pendingTasks?.length || 0,
    });

    return {
      slack: slackData,
      gmail: gmailData,
      available,
      lastAnalyzed,
    };
  } catch (error) {
    logger.error('Error in fetchDeepContentData', error, { email });
    return { slack: null, gmail: null, available: false };
  }
}

/**
 * Fetch Spotify listening data and analyze mood from audio features
 */
export async function fetchSpotifyData(email: string): Promise<EcosystemDataSource> {
  try {
    // Use token manager to get valid access token (handles refresh automatically)
    const { getAccessToken } = await import('./token-manager');
    const { token: accessToken, error: tokenError } = await getAccessToken(email, 'spotify');

    if (!accessToken) {
      return {
        source: 'spotify',
        available: false,
        data: null,
        insights: [],
        fetchedAt: new Date().toISOString(),
        error: tokenError || 'Spotify not connected or token expired - please reconnect',
      };
    }

    // Fetch recently played tracks
    const recentlyPlayedResponse = await fetch(
      'https://api.spotify.com/v1/me/player/recently-played?limit=50',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!recentlyPlayedResponse.ok) {
      throw new Error(`Spotify API error: ${recentlyPlayedResponse.status}`);
    }

    const recentlyPlayed = await recentlyPlayedResponse.json();
    const items = recentlyPlayed.items || [];

    if (items.length === 0) {
      return {
        source: 'spotify',
        available: false,
        data: null,
        insights: [],
        fetchedAt: new Date().toISOString(),
        error: 'No recent listening history',
      };
    }

    // Extract track IDs for audio features
    const trackIds = items.map((item: any) => item.track.id).join(',');

    // Fetch audio features for tracks
    const audioFeaturesResponse = await fetch(
      `https://api.spotify.com/v1/audio-features?ids=${trackIds}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const audioFeaturesData = await audioFeaturesResponse.json();
    const audioFeatures = audioFeaturesData.audio_features?.filter((f: any) => f) || [];

    // Calculate averages
    const avgEnergy = audioFeatures.length > 0
      ? audioFeatures.reduce((sum: number, f: any) => sum + (f.energy || 0), 0) / audioFeatures.length
      : 0.5;
    const avgValence = audioFeatures.length > 0
      ? audioFeatures.reduce((sum: number, f: any) => sum + (f.valence || 0), 0) / audioFeatures.length
      : 0.5;
    const avgTempo = audioFeatures.length > 0
      ? audioFeatures.reduce((sum: number, f: any) => sum + (f.tempo || 0), 0) / audioFeatures.length
      : 120;
    const avgDanceability = audioFeatures.length > 0
      ? audioFeatures.reduce((sum: number, f: any) => sum + (f.danceability || 0), 0) / audioFeatures.length
      : 0.5;

    // Calculate valence variance for emotional volatility
    const valenceValues = audioFeatures.map((f: any) => f.valence || 0.5);
    const valenceVariance = valenceValues.length > 1
      ? valenceValues.reduce((sum: number, v: number) => sum + Math.pow(v - avgValence, 2), 0) / valenceValues.length
      : 0;
    const emotionalVolatility: 'low' | 'medium' | 'high' =
      valenceVariance < 0.02 ? 'low' : valenceVariance < 0.05 ? 'medium' : 'high';

    // Infer mood from audio features
    let inferredMood: SpotifyData['inferredMood'] = 'mixed';
    let moodConfidence = 0.5;

    if (avgValence > 0.6 && avgEnergy > 0.6) {
      inferredMood = 'happy';
      moodConfidence = Math.min(avgValence, avgEnergy);
    } else if (avgValence > 0.6 && avgEnergy < 0.4) {
      inferredMood = 'calm';
      moodConfidence = avgValence * (1 - avgEnergy);
    } else if (avgValence < 0.4 && avgEnergy > 0.6) {
      inferredMood = 'anxious';
      moodConfidence = (1 - avgValence) * avgEnergy;
    } else if (avgValence < 0.4 && avgEnergy < 0.4) {
      inferredMood = 'melancholy';
      moodConfidence = (1 - avgValence) * (1 - avgEnergy);
    } else if (avgEnergy > 0.7) {
      inferredMood = 'energetic';
      moodConfidence = avgEnergy;
    } else if (avgValence > 0.4 && avgValence < 0.6 && avgEnergy > 0.4 && avgEnergy < 0.7) {
      inferredMood = 'focused';
      moodConfidence = 0.6;
    }

    // Analyze listening patterns
    const playedHours = items.map((item: any) => {
      const date = new Date(item.played_at);
      return date.getHours();
    });

    const hourCounts: Record<number, number> = {};
    playedHours.forEach((hour: number) => {
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    const sortedHours = Object.entries(hourCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([hour]) => `${hour}:00`);

    // Check for late night listening (after 11pm)
    const lateNightCount = playedHours.filter((h: number) => h >= 23 || h < 5).length;
    const lateNightListening = lateNightCount > items.length * 0.2;

    // Build recent tracks array
    const recentTracks = items.slice(0, 20).map((item: any) => ({
      id: item.track.id,
      name: item.track.name,
      artist: item.track.artists.map((a: any) => a.name).join(', '),
      playedAt: item.played_at,
      durationMs: item.track.duration_ms,
    }));

    // Generate insights
    const insights: string[] = [];

    if (avgValence < 0.3) {
      insights.push(`Recent music choices reflect lower mood (valence ${Math.round(avgValence * 100)}%) — music can influence and reflect emotional state`);
    } else if (avgValence > 0.7) {
      insights.push(`High-valence music selections (${Math.round(avgValence * 100)}%) suggest positive emotional state`);
    }

    if (lateNightListening) {
      insights.push('Significant late-night listening activity detected — may indicate sleep difficulties or stress');
    }

    if (emotionalVolatility === 'high') {
      insights.push('High variability in music mood — could reflect emotional fluctuations');
    }

    if (avgEnergy > 0.8) {
      insights.push(`High-energy music preference (${Math.round(avgEnergy * 100)}%) — great for motivation, but consider calming music before sleep`);
    }

    const processedData: SpotifyData = {
      recentTracks,
      avgEnergy: Math.round(avgEnergy * 100) / 100,
      avgValence: Math.round(avgValence * 100) / 100,
      avgTempo: Math.round(avgTempo),
      avgDanceability: Math.round(avgDanceability * 100) / 100,
      inferredMood,
      moodConfidence: Math.round(moodConfidence * 100) / 100,
      listeningHours: sortedHours,
      avgTracksPerDay: Math.round(items.length / 7), // Approximate
      topGenres: [], // Would need additional API call
      moodTrend: 'stable', // Would need historical comparison
      lateNightListening,
      emotionalVolatility,
      insights,
      rawData: { recentlyPlayed, audioFeatures },
    };

    return {
      source: 'spotify',
      available: true,
      data: processedData,
      insights,
      fetchedAt: new Date().toISOString(),
      recordCount: items.length,
    };
  } catch (error) {
    logger.error('Error fetching Spotify data', error, { email });
    return {
      source: 'spotify',
      available: false,
      data: null,
      insights: [],
      fetchedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Fetch Notion data from behavioral_patterns table
 */
export async function fetchNotionData(email: string): Promise<EcosystemDataSource> {
  try {
    const supabase = createAdminClient();

    // Check if user has Notion connected
    const adminClient = createAdminClient();
    const { data: token } = await adminClient
      .from('integration_tokens')
      .select('id')
      .eq('user_email', email)
      .eq('provider', 'notion')
      .eq('is_active', true)
      .maybeSingle();

    if (!token) {
      return {
        source: 'notion',
        available: false,
        data: null,
        insights: [],
        fetchedAt: new Date().toISOString(),
      };
    }

    // Fetch from behavioral_patterns
    const { data: patterns } = await adminClient
      .from('behavioral_patterns')
      .select('data, updated_at')
      .eq('user_email', email)
      .eq('source', 'notion')
      .maybeSingle();

    if (!patterns?.data) {
      return {
        source: 'notion',
        available: true,
        data: null,
        insights: ['Notion connected but no data synced yet'],
        fetchedAt: new Date().toISOString(),
      };
    }

    const notionOverview = patterns.data.notion_overview || {};
    const notionTasks = patterns.data.notion_tasks || [];

    // Generate insights
    const insights: string[] = [];

    if (notionOverview.overdue_tasks > 0) {
      insights.push(`You have ${notionOverview.overdue_tasks} overdue task${notionOverview.overdue_tasks > 1 ? 's' : ''} in Notion`);
    }

    if (notionOverview.tasks_due_soon > 0) {
      insights.push(`${notionOverview.tasks_due_soon} task${notionOverview.tasks_due_soon > 1 ? 's' : ''} due in the next 3 days`);
    }

    if (notionOverview.open_tasks > 20) {
      insights.push(`High task load: ${notionOverview.open_tasks} open tasks — consider prioritizing or delegating`);
    }

    // Group by status
    const tasksByStatus: Record<string, number> = {};
    const tasksByPriority: Record<string, number> = {};
    for (const task of notionTasks) {
      const status = task.status || 'Unknown';
      const priority = task.priority || 'None';
      tasksByStatus[status] = (tasksByStatus[status] || 0) + 1;
      tasksByPriority[priority] = (tasksByPriority[priority] || 0) + 1;
    }

    const notionData: NotionData = {
      workspaceName: notionOverview.workspace || 'Notion',
      totalDatabases: notionOverview.total_databases || 0,
      totalTasks: notionOverview.total_tasks || 0,
      openTasks: notionOverview.open_tasks || 0,
      overdueTasks: notionOverview.overdue_tasks || 0,
      tasksDueSoon: notionOverview.tasks_due_soon || 0,
      tasksByStatus,
      tasksByPriority,
      recentActivity: notionTasks.slice(0, 10).map((t: any) => ({
        title: t.title,
        status: t.status,
        dueDate: t.dueDate,
        lastEdited: t.lastEdited,
      })),
      insights,
      rawData: patterns.data,
    };

    return {
      source: 'notion',
      available: true,
      data: notionData,
      insights,
      fetchedAt: new Date().toISOString(),
      recordCount: notionOverview.total_tasks || 0,
    };
  } catch (error) {
    logger.error('Error fetching Notion data', error, { email });
    return {
      source: 'notion',
      available: false,
      data: null,
      insights: [],
      fetchedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Fetch Linear data from behavioral_patterns table
 */
export async function fetchLinearData(email: string): Promise<EcosystemDataSource> {
  try {
    const supabase = createAdminClient();

    // Check if user has Linear connected
    const adminClient = createAdminClient();
    const { data: token } = await adminClient
      .from('integration_tokens')
      .select('id')
      .eq('user_email', email)
      .eq('provider', 'linear')
      .eq('is_active', true)
      .maybeSingle();

    if (!token) {
      return {
        source: 'linear',
        available: false,
        data: null,
        insights: [],
        fetchedAt: new Date().toISOString(),
      };
    }

    // Fetch from behavioral_patterns
    const { data: patterns } = await adminClient
      .from('behavioral_patterns')
      .select('data, updated_at')
      .eq('user_email', email)
      .eq('source', 'linear')
      .maybeSingle();

    if (!patterns?.data) {
      return {
        source: 'linear',
        available: true,
        data: null,
        insights: ['Linear connected but no data synced yet'],
        fetchedAt: new Date().toISOString(),
      };
    }

    const linearOverview = patterns.data.linear_overview || {};
    const linearIssues = patterns.data.linear_issues || [];
    const linearProjects = patterns.data.linear_projects || [];
    const urgencyBreakdown = patterns.data.linear_urgency_breakdown || {};

    // Generate insights
    const insights: string[] = [];

    if (linearOverview.urgent_issues > 0) {
      insights.push(`${linearOverview.urgent_issues} urgent issue${linearOverview.urgent_issues > 1 ? 's' : ''} need immediate attention`);
    }

    if (linearOverview.overdue_issues > 0) {
      insights.push(`${linearOverview.overdue_issues} overdue issue${linearOverview.overdue_issues > 1 ? 's' : ''} in Linear`);
    }

    if (linearOverview.open_issues > 30) {
      insights.push(`High issue backlog: ${linearOverview.open_issues} open issues — review and prioritize`);
    }

    if (linearOverview.due_soon_issues > 5) {
      insights.push(`${linearOverview.due_soon_issues} issues due in the next 3 days`);
    }

    // Group by state
    const issuesByState: Record<string, number> = {};
    for (const issue of linearIssues) {
      const state = issue.state || 'Unknown';
      issuesByState[state] = (issuesByState[state] || 0) + 1;
    }

    const linearData: LinearData = {
      organizationName: linearOverview.organization || 'Linear',
      totalIssues: linearOverview.total_issues || 0,
      openIssues: linearOverview.open_issues || 0,
      urgentIssues: linearOverview.urgent_issues || 0,
      highPriorityIssues: linearOverview.high_priority_issues || 0,
      overdueIssues: linearOverview.overdue_issues || 0,
      issuesDueSoon: linearOverview.due_soon_issues || 0,
      issuesByState,
      issuesByPriority: {
        urgent: urgencyBreakdown.urgent || 0,
        high: urgencyBreakdown.high || 0,
        medium: urgencyBreakdown.medium || 0,
        low: urgencyBreakdown.low || 0,
        none: urgencyBreakdown.none || 0,
      },
      projectSummary: linearProjects.slice(0, 10).map((p: any) => ({
        name: p.name,
        issueCount: 0, // Would need to count from issues
        progress: p.progress,
      })),
      recentActivity: linearIssues.slice(0, 10).map((i: any) => ({
        identifier: i.identifier,
        title: i.title,
        state: i.state,
        priority: i.priority,
        updatedAt: i.updatedAt,
      })),
      insights,
      rawData: patterns.data,
    };

    return {
      source: 'linear',
      available: true,
      data: linearData,
      insights,
      fetchedAt: new Date().toISOString(),
      recordCount: linearOverview.total_issues || 0,
    };
  } catch (error) {
    logger.error('Error fetching Linear data', error, { email });
    return {
      source: 'linear',
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
 * Fetch ecosystem data for a user (alias for fetchAllEcosystemData)
 * Used by inference enhancers
 */
export async function fetchEcosystemData(
  email: string,
  planType: 'sage' | 'forge' = 'sage'
): Promise<EcosystemFetchResult> {
  return fetchAllEcosystemData(email, planType);
}

/**
 * Fetch ecosystem data from unified_health_data table (single query)
 * This is a more efficient alternative to fetching from multiple legacy tables
 */
async function fetchFromUnifiedTable(
  email: string,
  startDate?: Date,
  endDate?: Date
): Promise<EcosystemFetchResult> {
  const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
  const end = endDate || new Date();

  logger.info('Fetching from unified health data table', { email, startDate: start, endDate: end });

  try {
    const unifiedRecords = await getUnifiedHealthData(email, { startDate: start, endDate: end });

    if (!unifiedRecords || unifiedRecords.length === 0) {
      logger.info('No unified health data found, returning empty result', { email });
      return createEmptyResult();
    }

    // Group records by provider
    const groupedData = groupByProvider(unifiedRecords);
    const providers = Object.keys(groupedData);

    logger.info('Unified data grouped by provider', { email, providers, totalRecords: unifiedRecords.length });

    // Transform unified data back to EcosystemFetchResult format
    const result: EcosystemFetchResult = {
      bloodBiomarkers: createEmptySource('bloodBiomarkers'),
      oura: transformUnifiedToOura(groupedData['oura'] || []),
      dexcom: transformUnifiedToDexcom(groupedData['dexcom'] || []),
      vital: createEmptySource('vital'),
      gmail: transformUnifiedToGmail(groupedData['gmail'] || []),
      slack: transformUnifiedToSlack(groupedData['slack'] || []),
      outlook: transformUnifiedToGmail(groupedData['outlook'] || []), // Same structure as Gmail
      teams: transformUnifiedToSlack(groupedData['teams'] || []), // Same structure as Slack
      whoop: transformUnifiedToWhoop(groupedData['whoop'] || []),
      spotify: transformUnifiedToSpotify(groupedData['spotify'] || []),
      notion: transformUnifiedToNotion(groupedData['notion'] || []),
      linear: transformUnifiedToLinear(groupedData['linear'] || []),
      appleHealth: transformUnifiedToAppleHealth(groupedData['apple_health'] || []),
      fetchTimestamp: new Date().toISOString(),
      successCount: providers.length,
      totalSources: 13,
    };

    logger.info('Unified fetch completed', {
      email,
      successCount: result.successCount,
      providers,
    });

    return result;
  } catch (error) {
    logger.error('Error fetching unified data', { email, error });
    return createEmptyResult();
  }
}

/**
 * Create an empty EcosystemFetchResult
 */
function createEmptyResult(): EcosystemFetchResult {
  return {
    bloodBiomarkers: createEmptySource('bloodBiomarkers'),
    oura: createEmptySource('oura'),
    dexcom: createEmptySource('dexcom'),
    vital: createEmptySource('vital'),
    gmail: createEmptySource('gmail'),
    slack: createEmptySource('slack'),
    outlook: createEmptySource('outlook'),
    teams: createEmptySource('teams'),
    whoop: createEmptySource('whoop'),
    spotify: createEmptySource('spotify'),
    notion: createEmptySource('notion'),
    linear: createEmptySource('linear'),
    appleHealth: createEmptySource('appleHealth'),
    fetchTimestamp: new Date().toISOString(),
    successCount: 0,
    totalSources: 13,
  };
}

/**
 * Create an empty data source
 */
function createEmptySource(source: string): EcosystemDataSource {
  return {
    source,
    available: false,
    data: null,
    insights: [],
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Transform unified Oura records to OuraData format
 */
function transformUnifiedToOura(records: UnifiedHealthRecord[]): EcosystemDataSource {
  if (records.length === 0) return createEmptySource('oura');

  const avgSleepHours = records
    .filter(r => r.sleep_hours != null)
    .reduce((sum, r, _, arr) => sum + (r.sleep_hours || 0) / arr.length, 0);

  const avgReadinessScore = records
    .filter(r => r.readiness_score != null)
    .reduce((sum, r, _, arr) => sum + (r.readiness_score || 0) / arr.length, 0);

  const avgHRV = records
    .filter(r => r.hrv_avg != null)
    .reduce((sum, r, _, arr) => sum + (r.hrv_avg || 0) / arr.length, 0);

  return {
    source: 'oura',
    available: true,
    data: {
      avgSleepHours,
      avgReadinessScore,
      avgHRV,
      sleepQuality: avgReadinessScore >= 80 ? 'excellent' : avgReadinessScore >= 60 ? 'good' : avgReadinessScore >= 40 ? 'fair' : 'poor',
      hrvTrend: 'stable',
      activityLevel: 'moderate',
      insights: [],
      rawData: records,
    },
    insights: [],
    fetchedAt: new Date().toISOString(),
    recordCount: records.length,
    daysOfData: records.length,
  };
}

/**
 * Transform unified Whoop records to WhoopData format
 */
function transformUnifiedToWhoop(records: UnifiedHealthRecord[]): EcosystemDataSource {
  if (records.length === 0) return createEmptySource('whoop');

  const avgRecoveryScore = records
    .filter(r => r.recovery_score != null)
    .reduce((sum, r, _, arr) => sum + (r.recovery_score || 0) / arr.length, 0);

  const avgStrainScore = records
    .filter(r => r.strain_score != null)
    .reduce((sum, r, _, arr) => sum + (r.strain_score || 0) / arr.length, 0);

  const avgHRV = records
    .filter(r => r.hrv_avg != null)
    .reduce((sum, r, _, arr) => sum + (r.hrv_avg || 0) / arr.length, 0);

  const avgRestingHR = records
    .filter(r => r.resting_hr != null)
    .reduce((sum, r, _, arr) => sum + (r.resting_hr || 0) / arr.length, 0);

  return {
    source: 'whoop',
    available: true,
    data: {
      avgRecoveryScore,
      avgStrainScore,
      avgHRV,
      avgRestingHR,
      recoveryTrend: 'stable',
      strainTrend: 'moderate',
      sleepPerformance: 80,
      cyclesAnalyzed: records.length,
      insights: [],
      rawData: records,
    },
    insights: [],
    fetchedAt: new Date().toISOString(),
    recordCount: records.length,
    daysOfData: records.length,
  };
}

/**
 * Transform unified Dexcom records to DexcomData format
 */
function transformUnifiedToDexcom(records: UnifiedHealthRecord[]): EcosystemDataSource {
  if (records.length === 0) return createEmptySource('dexcom');

  const avgGlucose = records
    .filter(r => r.glucose_avg != null)
    .reduce((sum, r, _, arr) => sum + (r.glucose_avg || 0) / arr.length, 0);

  const timeInRange = records
    .filter(r => r.time_in_range != null)
    .reduce((sum, r, _, arr) => sum + (r.time_in_range || 0) / arr.length, 0);

  return {
    source: 'dexcom',
    available: true,
    data: {
      avgGlucose: Math.round(avgGlucose),
      avgFastingGlucose: null,
      glucoseVariability: 0,
      timeInRange,
      spikeTimes: [],
      spikeEvents: [],
      trends: [],
      insights: [],
      rawData: records,
    },
    insights: [],
    fetchedAt: new Date().toISOString(),
    recordCount: records.length,
    daysOfData: records.length,
  };
}

/**
 * Transform unified Gmail/Outlook records to GmailPatterns format
 */
function transformUnifiedToGmail(records: UnifiedHealthRecord[]): EcosystemDataSource {
  if (records.length === 0) return createEmptySource('gmail');

  const avgStressScore = records
    .filter(r => r.stress_score != null)
    .reduce((sum, r, _, arr) => sum + (r.stress_score || 0) / arr.length, 0);

  const avgMeetings = records
    .filter(r => r.meeting_count != null)
    .reduce((sum, r, _, arr) => sum + (r.meeting_count || 0) / arr.length, 0);

  return {
    source: 'gmail',
    available: true,
    data: {
      meetingDensity: {
        peakHours: [],
        avgMeetingsPerDay: avgMeetings,
        backToBackPercentage: 0,
      },
      emailVolume: {
        avgPerDay: 0,
        peakHours: [],
        afterHoursPercentage: 0,
      },
      workHours: {
        start: '09:00',
        end: '17:00',
        weekendActivity: false,
      },
      optimalMealWindows: [],
      stressIndicators: {
        highEmailVolume: avgStressScore > 60,
        frequentAfterHoursWork: false,
        shortMeetingBreaks: false,
      },
      insights: [],
    },
    insights: [],
    fetchedAt: new Date().toISOString(),
    recordCount: records.length,
    daysOfData: records.length,
  };
}

/**
 * Transform unified Slack/Teams records to SlackPatterns format
 */
function transformUnifiedToSlack(records: UnifiedHealthRecord[]): EcosystemDataSource {
  if (records.length === 0) return createEmptySource('slack');

  const avgStressScore = records
    .filter(r => r.stress_score != null)
    .reduce((sum, r, _, arr) => sum + (r.stress_score || 0) / arr.length, 0);

  return {
    source: 'slack',
    available: true,
    data: {
      messageVolume: {
        avgPerDay: 0,
        peakHours: [],
        afterHoursPercentage: 0,
      },
      workHours: {
        start: '09:00',
        end: '17:00',
        weekendActivity: false,
      },
      collaborationIntensity: avgStressScore > 60 ? 'high' : avgStressScore > 30 ? 'moderate' : 'low',
      stressIndicators: {
        constantAvailability: false,
        lateNightMessages: false,
        noBreakPeriods: false,
      },
      insights: [],
    },
    insights: [],
    fetchedAt: new Date().toISOString(),
    recordCount: records.length,
    daysOfData: records.length,
  };
}

/**
 * Transform unified Spotify records
 */
function transformUnifiedToSpotify(records: UnifiedHealthRecord[]): EcosystemDataSource {
  if (records.length === 0) return createEmptySource('spotify');

  const avgMoodScore = records
    .filter(r => r.mood_score != null)
    .reduce((sum, r, _, arr) => sum + (r.mood_score || 0) / arr.length, 0);

  return {
    source: 'spotify',
    available: true,
    data: {
      recentTracks: [],
      avgEnergy: 0.5,
      avgValence: avgMoodScore / 100, // Convert 0-100 to 0-1
      avgTempo: 120,
      avgDanceability: 0.5,
      inferredMood: avgMoodScore >= 70 ? 'happy' : avgMoodScore >= 40 ? 'calm' : 'melancholy',
      moodConfidence: 0.5,
      listeningHours: [],
      avgTracksPerDay: 0,
      topGenres: [],
      moodTrend: 'stable',
      lateNightListening: false,
      emotionalVolatility: 'low',
      insights: [],
      rawData: records,
    },
    insights: [],
    fetchedAt: new Date().toISOString(),
    recordCount: records.length,
    daysOfData: records.length,
  };
}

/**
 * Transform unified Notion records
 */
function transformUnifiedToNotion(records: UnifiedHealthRecord[]): EcosystemDataSource {
  if (records.length === 0) return createEmptySource('notion');

  const avgProductivityScore = records
    .filter(r => r.productivity_score != null)
    .reduce((sum, r, _, arr) => sum + (r.productivity_score || 0) / arr.length, 0);

  return {
    source: 'notion',
    available: true,
    data: {
      workspaceName: '',
      totalDatabases: 0,
      totalTasks: 0,
      openTasks: 0,
      overdueTasks: 0,
      tasksDueSoon: 0,
      tasksByStatus: {},
      tasksByPriority: {},
      recentActivity: [],
      insights: [`Average productivity score: ${Math.round(avgProductivityScore)}`],
      rawData: records,
    },
    insights: [],
    fetchedAt: new Date().toISOString(),
    recordCount: records.length,
    daysOfData: records.length,
  };
}

/**
 * Transform unified Linear records
 */
function transformUnifiedToLinear(records: UnifiedHealthRecord[]): EcosystemDataSource {
  if (records.length === 0) return createEmptySource('linear');

  const avgProductivityScore = records
    .filter(r => r.productivity_score != null)
    .reduce((sum, r, _, arr) => sum + (r.productivity_score || 0) / arr.length, 0);

  return {
    source: 'linear',
    available: true,
    data: {
      organizationName: '',
      totalIssues: 0,
      openIssues: 0,
      urgentIssues: 0,
      highPriorityIssues: 0,
      overdueIssues: 0,
      issuesDueSoon: 0,
      issuesByState: {},
      issuesByPriority: {},
      projectSummary: [],
      recentActivity: [],
      insights: [`Average productivity score: ${Math.round(avgProductivityScore)}`],
      rawData: records,
    },
    insights: [],
    fetchedAt: new Date().toISOString(),
    recordCount: records.length,
    daysOfData: records.length,
  };
}

/**
 * Transform unified Apple Health records
 */
function transformUnifiedToAppleHealth(records: UnifiedHealthRecord[]): EcosystemDataSource {
  if (records.length === 0) return createEmptySource('appleHealth');

  const avgSteps = records
    .filter(r => r.steps != null)
    .reduce((sum, r, _, arr) => sum + (r.steps || 0) / arr.length, 0);

  const avgActiveCalories = records
    .filter(r => r.active_calories != null)
    .reduce((sum, r, _, arr) => sum + (r.active_calories || 0) / arr.length, 0);

  return {
    source: 'appleHealth',
    available: true,
    data: {
      dailySteps: Math.round(avgSteps),
      activeCalories: Math.round(avgActiveCalories),
      restingHeartRate: 0,
      hrv: 0,
      sleepHours: 0,
      deepSleepMinutes: 0,
      remSleepMinutes: 0,
      strainScore: 0,
      lastSynced: new Date().toISOString(),
    },
    insights: [],
    fetchedAt: new Date().toISOString(),
    recordCount: records.length,
    daysOfData: records.length,
  };
}

/**
 * Fetch all available ecosystem data for a user
 * Runs all fetches in parallel for optimal performance
 * Uses L1+L2 caching to avoid redundant API calls
 */
export async function fetchAllEcosystemData(
  email: string,
  planType: 'sage' | 'forge' = 'sage',
  options?: {
    startDate?: Date;
    endDate?: Date;
    forceRefresh?: boolean;
    useUnified?: boolean; // Use unified_health_data table instead of legacy tables
  }
): Promise<EcosystemFetchResult> {
  // =====================================================
  // USE UNIFIED DATA IF REQUESTED
  // =====================================================
  if (options?.useUnified) {
    return fetchFromUnifiedTable(email, options.startDate, options.endDate);
  }

  const cacheKey = `ecosystem:${email}:${planType}`;

  // Check cache first (unless forceRefresh is true)
  if (!options?.forceRefresh) {
    try {
      const cached = await cacheService.get<EcosystemFetchResult>(cacheKey);
      if (cached) {
        logger.info('Ecosystem data cache hit', { email, planType });
        return { ...cached, fromCache: true };
      }
    } catch (error) {
      logger.warn('Cache read error, fetching fresh data', { email, error });
    }
  }

  logger.info('Fetching all ecosystem data', { email });

  const startTime = Date.now();

  // Helper to create a failed source object when a promise rejects
  const createFailedSource = (source: string, error: unknown): EcosystemDataSource => ({
    source,
    available: false,
    data: null,
    insights: [],
    fetchedAt: new Date().toISOString(),
    error: error instanceof Error ? error.message : 'Unknown error - promise rejected',
  });

  // Source names for tracking failures
  const sourceNames = ['bloodBiomarkers', 'oura', 'dexcom', 'vital', 'gmail', 'slack', 'outlook', 'teams', 'whoop', 'spotify', 'notion', 'linear', 'appleHealth'];

  // Fetch all data sources in parallel using Promise.allSettled for graceful degradation
  // Also fetch deep content analysis separately (different return type)
  const [results, deepContentResult] = await Promise.all([
    Promise.allSettled([
      fetchBloodBiomarkers(email, planType),
      fetchOuraData(email, options?.startDate, options?.endDate),
      fetchDexcomData(email, options?.startDate, options?.endDate),
      fetchVitalData(email, options?.startDate, options?.endDate),
      fetchGmailPatterns(email),
      fetchSlackPatterns(email),
      fetchOutlookPatterns(email),
      fetchTeamsPatterns(email),
      fetchWhoopData(email),
      fetchSpotifyData(email),
      fetchNotionData(email),
      fetchLinearData(email),
      fetchAppleHealthData(email),
    ]),
    fetchDeepContentData(email).catch((e) => {
      logger.warn('Failed to fetch deep content', { email, error: e });
      return { slack: null, gmail: null, available: false } as DeepContentData;
    }),
  ]);

  // Extract values from settled results, creating failed sources for rejected promises
  const failedSources: string[] = [];
  const extractResult = (result: PromiseSettledResult<EcosystemDataSource>, index: number): EcosystemDataSource => {
    if (result.status === 'fulfilled') {
      return result.value;
    }
    // Promise was rejected - log and return a failed source
    const sourceName = sourceNames[index];
    failedSources.push(sourceName);
    logger.error(`Promise rejected for ${sourceName}`, result.reason, { email, source: sourceName });
    return createFailedSource(sourceName, result.reason);
  };

  const [bloodBiomarkers, oura, dexcom, vital, gmail, slack, outlook, teams, whoop, spotify, notion, linear, appleHealth] = results.map(extractResult);

  const allSources = [bloodBiomarkers, oura, dexcom, vital, gmail, slack, outlook, teams, whoop, spotify, notion, linear, appleHealth];

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
    spotify,
    notion,
    linear,
    appleHealth,
    deepContent: deepContentResult.available ? deepContentResult : undefined,
    fetchTimestamp: new Date().toISOString(),
    successCount: allSources.filter(s => s.available).length,
    totalSources: 13,
    failedSources: failedSources.length > 0 ? failedSources : undefined,
    partial: failedSources.length > 0 && failedSources.length < 13,
  };

  const duration = Date.now() - startTime;
  if (failedSources.length > 0) {
    logger.warn('Ecosystem fetch completed with failures', {
      email,
      duration,
      failedSources,
      successCount: result.successCount,
      totalSources: result.totalSources,
    });
  } else {
    logger.info('Ecosystem fetch completed', {
      email,
      duration,
      successCount: result.successCount,
      totalSources: result.totalSources,
    });
  }

  // Cache the result for faster subsequent requests (15 min TTL)
  // Only cache if we got at least some data
  if (result.successCount > 0) {
    try {
      await cacheService.set(cacheKey, result, ECOSYSTEM_CACHE_TTL);
      logger.debug('Ecosystem data cached', { email, planType, ttl: ECOSYSTEM_CACHE_TTL });
    } catch (error) {
      logger.warn('Failed to cache ecosystem data', { email, error });
    }
  }

  return result;
}
