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
  insights: string[];
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
    const sleepData = ouraRecord.sleep_data as Array<{sleep_score?: number; total_sleep_duration?: number}> || [];
    const readinessData = ouraRecord.readiness_data as Array<{score?: number}> || [];
    const hrvData = ouraRecord.heart_rate_data as Array<{average_hrv?: number}> || [];

    // Calculate averages
    const avgSleepHours = sleepData.length > 0
      ? sleepData.reduce((sum, day) => sum + ((day.total_sleep_duration || 0) / 3600), 0) / sleepData.length
      : 0;

    const avgReadiness = readinessData.length > 0
      ? readinessData.reduce((sum, day) => sum + (day.score || 0), 0) / readinessData.length
      : 0;

    const avgHRV = hrvData.length > 0
      ? hrvData.reduce((sum, day) => sum + (day.average_hrv || 0), 0) / hrvData.length
      : 0;

    const processedData: OuraData = {
      avgSleepHours: Math.round(avgSleepHours * 10) / 10,
      avgReadinessScore: Math.round(avgReadiness),
      avgHRV: Math.round(avgHRV),
      sleepQuality: avgReadiness >= 85 ? 'excellent' : avgReadiness >= 70 ? 'good' : avgReadiness >= 55 ? 'fair' : 'poor',
      hrvTrend: 'stable', // Would need historical comparison
      activityLevel: 'moderate',
      insights: [],
      rawData: ouraRecord,
    };

    // Generate insights
    const insights: string[] = [];
    if (avgSleepHours < 7) {
      insights.push(`Sleep duration averaging ${processedData.avgSleepHours}h (below 7-8h optimal range)`);
    }
    if (avgReadiness < 70) {
      insights.push(`Low readiness score (${processedData.avgReadinessScore}/100) suggests inadequate recovery`);
    }
    if (avgHRV > 0 && avgHRV < 50) {
      insights.push(`Low HRV (${processedData.avgHRV}ms) may indicate stress or overtraining`);
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
  const [bloodBiomarkers, oura, dexcom, vital, gmail, slack] = await Promise.all([
    fetchBloodBiomarkers(email, planType),
    fetchOuraData(email, options?.startDate, options?.endDate),
    fetchDexcomData(email, options?.startDate, options?.endDate),
    fetchVitalData(email, options?.startDate, options?.endDate),
    fetchGmailPatterns(email),
    fetchSlackPatterns(email),
  ]);

  const result: EcosystemFetchResult = {
    bloodBiomarkers,
    oura,
    dexcom,
    vital,
    gmail,
    slack,
    fetchTimestamp: new Date().toISOString(),
    successCount: [bloodBiomarkers, oura, dexcom, vital, gmail, slack].filter(s => s.available).length,
    totalSources: 6,
  };

  const duration = Date.now() - startTime;
  console.log(`[Ecosystem Fetcher] Completed in ${duration}ms. Success: ${result.successCount}/${result.totalSources} sources`);

  return result;
}
