/**
 * Health Context Aggregator
 * Fetches and unifies health data from all connected sources
 * for workout plan generation
 */

import { getServiceClient } from '@/lib/supabase/server';
import type {
  UnifiedHealthContext,
  BloodBiomarkersContext,
  RecoveryContext,
  SleepContext,
  GlucoseContext,
  ActivityContext,
} from './types';

// ==================== MAIN AGGREGATOR ====================

/**
 * Aggregate health context from all available sources
 */
export async function aggregateHealthContext(
  userEmail: string
): Promise<UnifiedHealthContext> {
  const supabase = getServiceClient();

  // Fetch all health data sources in parallel
  const [
    bloodBiomarkers,
    ouraData,
    whoopData,
    dexcomData,
    healthBaselines,
  ] = await Promise.all([
    fetchBloodBiomarkers(userEmail, supabase),
    fetchOuraData(userEmail, supabase),
    fetchWhoopData(userEmail),
    fetchDexcomData(userEmail, supabase),
    fetchHealthBaselines(userEmail, supabase),
  ]);

  // Build unified context, prioritizing most recent/reliable data
  return {
    bloodBiomarkers,
    recovery: buildRecoveryContext(ouraData, whoopData, healthBaselines),
    sleep: buildSleepContext(ouraData, healthBaselines),
    glucose: dexcomData,
    activity: buildActivityContext(healthBaselines),
  };
}

// ==================== BLOOD BIOMARKERS ====================

async function fetchBloodBiomarkers(
  userEmail: string,
  supabase: ReturnType<typeof getServiceClient>
): Promise<BloodBiomarkersContext | undefined> {
  try {
    // Try blood_analysis table first (most detailed)
    const { data: bloodAnalysis } = await supabase
      .from('blood_analysis')
      .select('analysis_result, created_at')
      .eq('user_id', userEmail)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (bloodAnalysis?.analysis_result) {
      const result = bloodAnalysis.analysis_result as Record<string, unknown>;
      const biomarkers = extractBiomarkersFromAnalysis(result);

      if (biomarkers.length > 0) {
        return {
          available: true,
          lastTestDate: bloodAnalysis.created_at,
          biomarkers,
        };
      }
    }

    // Fallback to sage_onboarding_data
    const { data: sageData } = await supabase
      .from('sage_onboarding_data')
      .select('lab_file_analysis, created_at')
      .eq('email', userEmail)
      .maybeSingle();

    if (sageData?.lab_file_analysis) {
      const labAnalysis = sageData.lab_file_analysis as Record<string, unknown>;
      const biomarkers = extractBiomarkersFromAnalysis(labAnalysis);

      if (biomarkers.length > 0) {
        return {
          available: true,
          lastTestDate: sageData.created_at,
          biomarkers,
        };
      }
    }

    // Try forge_onboarding_data
    const { data: forgeData } = await supabase
      .from('forge_onboarding_data')
      .select('lab_file_analysis, created_at')
      .eq('email', userEmail)
      .maybeSingle();

    if (forgeData?.lab_file_analysis) {
      const labAnalysis = forgeData.lab_file_analysis as Record<string, unknown>;
      const biomarkers = extractBiomarkersFromAnalysis(labAnalysis);

      if (biomarkers.length > 0) {
        return {
          available: true,
          lastTestDate: forgeData.created_at,
          biomarkers,
        };
      }
    }

    return { available: false };
  } catch (error) {
    console.error('[HealthContextAggregator] Error fetching blood biomarkers:', error);
    return { available: false };
  }
}

function extractBiomarkersFromAnalysis(
  analysis: Record<string, unknown>
): BloodBiomarkersContext['biomarkers'] {
  const biomarkers: BloodBiomarkersContext['biomarkers'] = [];

  // Common biomarker paths in analysis results
  const biomarkerData = (analysis.biomarkers || analysis.results || analysis.markers) as Array<{
    name?: string;
    value?: number;
    unit?: string;
    status?: string;
    referenceRange?: string;
  }> | undefined;

  if (Array.isArray(biomarkerData)) {
    for (const marker of biomarkerData) {
      if (marker.name && marker.value !== undefined) {
        biomarkers.push({
          name: marker.name,
          value: marker.value,
          unit: marker.unit || '',
          status: normalizeStatus(marker.status),
          referenceRange: marker.referenceRange,
        });
      }
    }
  }

  return biomarkers;
}

function normalizeStatus(status?: string): 'normal' | 'low' | 'high' | 'critical' {
  if (!status) return 'normal';
  const lower = status.toLowerCase();
  if (lower.includes('critical') || lower.includes('severe')) return 'critical';
  if (lower.includes('low') || lower.includes('deficient')) return 'low';
  if (lower.includes('high') || lower.includes('elevated')) return 'high';
  return 'normal';
}

// ==================== OURA DATA ====================

interface OuraDataRow {
  date: string;
  sleep_score?: number;
  readiness_score?: number;
  hrv?: number;
  resting_hr?: number;
  total_sleep_duration?: number;
  deep_sleep_duration?: number;
  rem_sleep_duration?: number;
}

async function fetchOuraData(
  userEmail: string,
  supabase: ReturnType<typeof getServiceClient>
): Promise<OuraDataRow[] | null> {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data, error } = await supabase
      .from('oura_data')
      .select('date, sleep_score, readiness_score, hrv, resting_hr, total_sleep_duration, deep_sleep_duration, rem_sleep_duration')
      .eq('user_id', userEmail)
      .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
      .order('date', { ascending: false });

    if (error) {
      console.error('[HealthContextAggregator] Oura query error:', error);
      return null;
    }

    return data as OuraDataRow[];
  } catch (error) {
    console.error('[HealthContextAggregator] Error fetching Oura data:', error);
    return null;
  }
}

// ==================== WHOOP DATA ====================

interface WhoopData {
  recovery?: number;
  strain?: number;
  hrv?: number;
  restingHR?: number;
  sleepHours?: number;
}

async function fetchWhoopData(userEmail: string): Promise<WhoopData | null> {
  try {
    // Whoop data is fetched via backend API
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/whoop/fetch-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userEmail }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.whoop || null;
  } catch (error) {
    console.error('[HealthContextAggregator] Error fetching Whoop data:', error);
    return null;
  }
}

// ==================== DEXCOM DATA ====================

async function fetchDexcomData(
  userEmail: string,
  supabase: ReturnType<typeof getServiceClient>
): Promise<GlucoseContext | undefined> {
  try {
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const { data, error } = await supabase
      .from('dexcom_data')
      .select('timestamp, egv')
      .eq('user_id', userEmail)
      .gte('timestamp', oneDayAgo.toISOString())
      .order('timestamp', { ascending: false })
      .limit(500);

    if (error || !data || data.length === 0) return undefined;

    const readings = data.map((d: { egv: number }) => d.egv);
    const avgGlucose = readings.reduce((a: number, b: number) => a + b, 0) / readings.length;

    // Calculate coefficient of variation
    const stdDev = Math.sqrt(
      readings.reduce((sum: number, val: number) => sum + Math.pow(val - avgGlucose, 2), 0) / readings.length
    );
    const variabilityCV = (stdDev / avgGlucose) * 100;

    // Count spikes (> 180 mg/dL)
    const spikeCount = readings.filter((r: number) => r > 180).length;

    // Time in range (70-180)
    const inRange = readings.filter((r: number) => r >= 70 && r <= 180).length;
    const timeInRange = (inRange / readings.length) * 100;

    // Determine status
    let status: GlucoseContext['status'] = 'optimal';
    if (variabilityCV > 36 || timeInRange < 70) {
      status = 'needs_optimization';
    } else if (variabilityCV > 30 || timeInRange < 80) {
      status = 'good';
    }

    return {
      source: 'dexcom',
      avgGlucose: Math.round(avgGlucose),
      variabilityCV: Math.round(variabilityCV * 10) / 10,
      timeInRange: Math.round(timeInRange),
      spikeCountLast24h: spikeCount,
      status,
    };
  } catch (error) {
    console.error('[HealthContextAggregator] Error fetching Dexcom data:', error);
    return undefined;
  }
}

// ==================== HEALTH BASELINES ====================

interface HealthBaseline {
  metric_type: string;
  value: number;
  unit: string;
  recorded_at: string;
}

async function fetchHealthBaselines(
  userEmail: string,
  supabase: ReturnType<typeof getServiceClient>
): Promise<HealthBaseline[] | null> {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data, error } = await supabase
      .from('user_health_baselines')
      .select('metric_type, value, unit, recorded_at')
      .eq('user_email', userEmail)
      .gte('recorded_at', sevenDaysAgo.toISOString());

    if (error) {
      console.error('[HealthContextAggregator] Health baselines query error:', error);
      return null;
    }

    return data as HealthBaseline[];
  } catch (error) {
    console.error('[HealthContextAggregator] Error fetching health baselines:', error);
    return null;
  }
}

// ==================== CONTEXT BUILDERS ====================

function buildRecoveryContext(
  ouraData: OuraDataRow[] | null,
  whoopData: WhoopData | null,
  healthBaselines: HealthBaseline[] | null
): RecoveryContext | undefined {
  // Prefer Whoop for recovery (more focused on athletic recovery)
  if (whoopData?.recovery !== undefined) {
    const status = whoopData.recovery < 33 ? 'red' : whoopData.recovery < 66 ? 'yellow' : 'green';
    return {
      source: 'whoop',
      score: whoopData.recovery,
      status,
      hrvAvg: whoopData.hrv,
      restingHR: whoopData.restingHR,
      strainLevel: whoopData.strain,
      overtrainingRisk: whoopData.strain && whoopData.strain > 18 ? 'high' : whoopData.strain && whoopData.strain > 14 ? 'moderate' : 'low',
    };
  }

  // Fallback to Oura
  if (ouraData && ouraData.length > 0) {
    const recent = ouraData[0];
    const readinessScore = recent.readiness_score;

    if (readinessScore !== undefined) {
      const status = readinessScore < 60 ? 'red' : readinessScore < 75 ? 'yellow' : 'green';

      // Calculate HRV trend
      let hrvTrend: RecoveryContext['hrvTrend'] = 'stable';
      if (ouraData.length >= 7) {
        const recentHRV = ouraData.slice(0, 3).filter(d => d.hrv).map(d => d.hrv!);
        const olderHRV = ouraData.slice(4, 7).filter(d => d.hrv).map(d => d.hrv!);
        if (recentHRV.length > 0 && olderHRV.length > 0) {
          const recentAvg = recentHRV.reduce((a, b) => a + b, 0) / recentHRV.length;
          const olderAvg = olderHRV.reduce((a, b) => a + b, 0) / olderHRV.length;
          if (recentAvg > olderAvg * 1.05) hrvTrend = 'improving';
          else if (recentAvg < olderAvg * 0.95) hrvTrend = 'declining';
        }
      }

      return {
        source: 'oura',
        score: readinessScore,
        status,
        hrvAvg: recent.hrv,
        hrvTrend,
        restingHR: recent.resting_hr,
      };
    }
  }

  // Try health baselines for HRV
  if (healthBaselines) {
    const hrvReadings = healthBaselines.filter(b => b.metric_type === 'hrv');
    if (hrvReadings.length > 0) {
      const avgHRV = hrvReadings.reduce((sum, r) => sum + r.value, 0) / hrvReadings.length;
      return {
        source: 'apple_health',
        hrvAvg: Math.round(avgHRV),
      };
    }
  }

  return undefined;
}

function buildSleepContext(
  ouraData: OuraDataRow[] | null,
  healthBaselines: HealthBaseline[] | null
): SleepContext | undefined {
  // Try Oura first
  if (ouraData && ouraData.length > 0) {
    const last7Days = ouraData.slice(0, 7);
    const sleepDurations = last7Days
      .filter(d => d.total_sleep_duration)
      .map(d => d.total_sleep_duration! / 3600); // Convert to hours

    if (sleepDurations.length > 0) {
      const avgHours = sleepDurations.reduce((a, b) => a + b, 0) / sleepDurations.length;
      const lastNight = ouraData[0];

      // Calculate sleep debt (target 8 hours)
      const sleepDebt = Math.max(0, (8 * sleepDurations.length) - sleepDurations.reduce((a, b) => a + b, 0));

      // Determine quality
      let quality: SleepContext['quality'] = 'good';
      if (avgHours < 5) quality = 'poor';
      else if (avgHours < 6) quality = 'fair';
      else if (avgHours >= 7.5) quality = 'excellent';

      return {
        source: 'oura',
        avgHoursLast7Days: Math.round(avgHours * 10) / 10,
        lastNightHours: lastNight.total_sleep_duration ? Math.round((lastNight.total_sleep_duration / 3600) * 10) / 10 : undefined,
        quality,
        deepSleepMinutes: lastNight.deep_sleep_duration ? Math.round(lastNight.deep_sleep_duration / 60) : undefined,
        remSleepMinutes: lastNight.rem_sleep_duration ? Math.round(lastNight.rem_sleep_duration / 60) : undefined,
        sleepDebtHours: Math.round(sleepDebt * 10) / 10,
      };
    }
  }

  // Try health baselines
  if (healthBaselines) {
    const sleepReadings = healthBaselines.filter(b => b.metric_type === 'sleep_hours' || b.metric_type === 'sleep_duration');
    if (sleepReadings.length > 0) {
      const avgHours = sleepReadings.reduce((sum, r) => sum + r.value, 0) / sleepReadings.length;

      let quality: SleepContext['quality'] = 'good';
      if (avgHours < 5) quality = 'poor';
      else if (avgHours < 6) quality = 'fair';
      else if (avgHours >= 7.5) quality = 'excellent';

      return {
        source: 'apple_health',
        avgHoursLast7Days: Math.round(avgHours * 10) / 10,
        quality,
      };
    }
  }

  return undefined;
}

function buildActivityContext(
  healthBaselines: HealthBaseline[] | null
): ActivityContext | undefined {
  if (!healthBaselines) return undefined;

  const stepReadings = healthBaselines.filter(b => b.metric_type === 'steps');
  const workoutReadings = healthBaselines.filter(b => b.metric_type === 'workout');

  if (stepReadings.length === 0) return undefined;

  const avgSteps = stepReadings.reduce((sum, r) => sum + r.value, 0) / stepReadings.length;

  // Determine activity level based on steps
  let activityLevel: ActivityContext['activityLevel'] = 'sedentary';
  if (avgSteps >= 12000) activityLevel = 'very_active';
  else if (avgSteps >= 7500) activityLevel = 'moderately_active';
  else if (avgSteps >= 5000) activityLevel = 'lightly_active';

  // Find most recent workout
  const sortedWorkouts = workoutReadings.sort(
    (a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
  );

  return {
    source: 'apple_health',
    avgStepsLast7Days: Math.round(avgSteps),
    workoutsLast7Days: workoutReadings.length,
    activityLevel,
    lastWorkoutDate: sortedWorkouts[0]?.recorded_at,
  };
}

// ==================== UTILITY: CHECK IF CONTEXT HAS DATA ====================

export function hasRelevantHealthData(context: UnifiedHealthContext): boolean {
  return !!(
    context.bloodBiomarkers?.available ||
    context.recovery?.score !== undefined ||
    context.sleep?.avgHoursLast7Days !== undefined ||
    context.glucose?.avgGlucose !== undefined ||
    context.activity?.avgStepsLast7Days !== undefined
  );
}
