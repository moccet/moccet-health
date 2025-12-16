/**
 * MCP Resources
 *
 * Resources expose health data to the AI. The AI can read these
 * to understand the user's health context.
 */

import { Resource } from '@modelcontextprotocol/sdk/types.js';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

export interface ServerConfig {
  supabaseUrl: string;
  supabaseKey: string;
  userEmail: string;
  baseUrl: string;
}

type ResourceHandler = (config: ServerConfig) => Promise<any>;

// =============================================================================
// RESOURCE DEFINITIONS
// =============================================================================

export const resourceDefinitions: Resource[] = [
  // =========================================================================
  // UNIFIED CONTEXT
  // =========================================================================
  {
    uri: 'health://context/unified',
    name: 'Unified Health Context',
    description: 'Complete aggregated health profile including biomarkers, sleep, glucose, activity, work patterns, and AI-generated insights. This is the primary resource for understanding the user.',
    mimeType: 'application/json',
  },
  {
    uri: 'health://insights',
    name: 'AI-Generated Insights',
    description: 'Cross-source health insights generated from pattern analysis across all data sources.',
    mimeType: 'application/json',
  },
  {
    uri: 'health://priorities',
    name: 'Priority Health Areas',
    description: 'Ranked list of health areas requiring attention, with severity and data points.',
    mimeType: 'application/json',
  },

  // =========================================================================
  // BLOOD WORK
  // =========================================================================
  {
    uri: 'health://blood/biomarkers',
    name: 'Blood Biomarkers',
    description: 'Latest blood test results with individual biomarker values, reference ranges, and status (optimal/low/high).',
    mimeType: 'application/json',
  },
  {
    uri: 'health://blood/deficiencies',
    name: 'Deficiencies',
    description: 'Identified nutrient deficiencies from blood work with severity levels and recommended actions.',
    mimeType: 'application/json',
  },

  // =========================================================================
  // OURA RING
  // =========================================================================
  {
    uri: 'health://oura/sleep',
    name: 'Sleep Data (Oura)',
    description: 'Sleep scores, duration, deep/REM sleep, efficiency, and trends from Oura Ring.',
    mimeType: 'application/json',
  },
  {
    uri: 'health://oura/recovery',
    name: 'Recovery Data (Oura)',
    description: 'HRV, readiness scores, resting heart rate, and recovery status from Oura Ring.',
    mimeType: 'application/json',
  },
  {
    uri: 'health://oura/activity',
    name: 'Activity Data (Oura)',
    description: 'Daily activity scores, steps, calories, and movement from Oura Ring.',
    mimeType: 'application/json',
  },

  // =========================================================================
  // DEXCOM CGM
  // =========================================================================
  {
    uri: 'health://dexcom/glucose',
    name: 'Glucose Data (Dexcom)',
    description: 'Continuous glucose monitor readings, averages, variability, spike patterns, and time in range.',
    mimeType: 'application/json',
  },

  // =========================================================================
  // WHOOP
  // =========================================================================
  {
    uri: 'health://whoop/strain',
    name: 'Strain Data (Whoop)',
    description: 'Daily strain scores, cardiovascular load, and workout intensity from Whoop.',
    mimeType: 'application/json',
  },
  {
    uri: 'health://whoop/recovery',
    name: 'Recovery Data (Whoop)',
    description: 'Recovery percentage, HRV, resting heart rate, and sleep performance from Whoop.',
    mimeType: 'application/json',
  },

  // =========================================================================
  // APPLE HEALTH
  // =========================================================================
  {
    uri: 'health://apple/activity',
    name: 'Activity Data (Apple Health)',
    description: 'Steps, active energy, exercise minutes, stand hours, and move/exercise/stand ring progress.',
    mimeType: 'application/json',
  },
  {
    uri: 'health://apple/vitals',
    name: 'Vitals (Apple Health)',
    description: 'Heart rate, blood pressure, respiratory rate, and other vital signs from Apple Health.',
    mimeType: 'application/json',
  },
  {
    uri: 'health://apple/workouts',
    name: 'Workouts (Apple Health)',
    description: 'Workout history, duration, calories, and heart rate zones from Apple Health.',
    mimeType: 'application/json',
  },

  // =========================================================================
  // GOOGLE FIT
  // =========================================================================
  {
    uri: 'health://googlefit/activity',
    name: 'Activity Data (Google Fit)',
    description: 'Steps, calories, distance, and activity minutes from Google Fit.',
    mimeType: 'application/json',
  },
  {
    uri: 'health://googlefit/vitals',
    name: 'Vitals (Google Fit)',
    description: 'Heart rate, blood pressure, and other health metrics from Google Fit.',
    mimeType: 'application/json',
  },

  // =========================================================================
  // FITBIT
  // =========================================================================
  {
    uri: 'health://fitbit/activity',
    name: 'Activity Data (Fitbit)',
    description: 'Steps, floors, active minutes, and calorie burn from Fitbit.',
    mimeType: 'application/json',
  },
  {
    uri: 'health://fitbit/sleep',
    name: 'Sleep Data (Fitbit)',
    description: 'Sleep stages, duration, efficiency, and sleep score from Fitbit.',
    mimeType: 'application/json',
  },
  {
    uri: 'health://fitbit/heart',
    name: 'Heart Rate (Fitbit)',
    description: 'Resting heart rate, heart rate zones, and cardio fitness score from Fitbit.',
    mimeType: 'application/json',
  },

  // =========================================================================
  // GOOGLE CALENDAR
  // =========================================================================
  {
    uri: 'health://calendar/schedule',
    name: 'Schedule (Google Calendar)',
    description: 'Upcoming events, meeting density, free time blocks, and calendar patterns.',
    mimeType: 'application/json',
  },
  {
    uri: 'health://calendar/availability',
    name: 'Availability (Google Calendar)',
    description: 'Available time slots for scheduling health activities or appointments.',
    mimeType: 'application/json',
  },

  // =========================================================================
  // GMAIL
  // =========================================================================
  {
    uri: 'health://gmail/patterns',
    name: 'Work Patterns (Gmail)',
    description: 'Email volume, after-hours activity, response times, and work stress indicators.',
    mimeType: 'application/json',
  },
  {
    uri: 'health://gmail/stress',
    name: 'Stress Indicators (Gmail)',
    description: 'Work-life balance metrics, meeting overload, and email stress patterns.',
    mimeType: 'application/json',
  },

  // =========================================================================
  // SLACK
  // =========================================================================
  {
    uri: 'health://slack/patterns',
    name: 'Work Patterns (Slack)',
    description: 'Message activity, after-hours usage, channel engagement, and work patterns.',
    mimeType: 'application/json',
  },
  {
    uri: 'health://slack/stress',
    name: 'Stress Indicators (Slack)',
    description: 'Message urgency, response pressure, and work-life balance from Slack patterns.',
    mimeType: 'application/json',
  },

  // =========================================================================
  // MICROSOFT (OUTLOOK/TEAMS)
  // =========================================================================
  {
    uri: 'health://outlook/schedule',
    name: 'Schedule (Outlook)',
    description: 'Calendar events, meeting density, and availability from Outlook.',
    mimeType: 'application/json',
  },
  {
    uri: 'health://teams/patterns',
    name: 'Work Patterns (Teams)',
    description: 'Meeting frequency, message activity, and collaboration patterns from Microsoft Teams.',
    mimeType: 'application/json',
  },

  // =========================================================================
  // SPOTIFY
  // =========================================================================
  {
    uri: 'health://spotify/listening',
    name: 'Listening History (Spotify)',
    description: 'Recent listening history, top genres, listening time patterns, and mood indicators.',
    mimeType: 'application/json',
  },
  {
    uri: 'health://spotify/mood',
    name: 'Mood Patterns (Spotify)',
    description: 'Audio features analysis showing energy, valence (happiness), tempo patterns over time.',
    mimeType: 'application/json',
  },

  // =========================================================================
  // STRAVA
  // =========================================================================
  {
    uri: 'health://strava/activities',
    name: 'Activities (Strava)',
    description: 'Recent workouts, runs, rides, and athletic activities from Strava.',
    mimeType: 'application/json',
  },
  {
    uri: 'health://strava/fitness',
    name: 'Fitness Trends (Strava)',
    description: 'Training load, fitness level, fatigue, and form from Strava.',
    mimeType: 'application/json',
  },

  // =========================================================================
  // VITAL (AGGREGATOR)
  // =========================================================================
  {
    uri: 'health://vital/summary',
    name: 'Health Summary (Vital)',
    description: 'Aggregated health data from all Vital-connected providers.',
    mimeType: 'application/json',
  },

  // =========================================================================
  // USER PROFILE
  // =========================================================================
  {
    uri: 'health://user/profile',
    name: 'User Health Profile',
    description: 'User preferences, health goals, dietary restrictions, and onboarding data.',
    mimeType: 'application/json',
  },
  {
    uri: 'health://user/connections',
    name: 'Connected Services',
    description: 'List of connected health services and their sync status.',
    mimeType: 'application/json',
  },

  // =========================================================================
  // MEMORY RESOURCES (User Memory for Personalization)
  // =========================================================================
  {
    uri: 'memory://user/facts',
    name: 'User Learned Facts',
    description: 'Facts learned about the user over time (preferences, allergies, goals, etc.).',
    mimeType: 'application/json',
  },
  {
    uri: 'memory://user/preferences',
    name: 'User Action Preferences',
    description: 'Patterns of what actions user typically approves or rejects.',
    mimeType: 'application/json',
  },
  {
    uri: 'memory://user/outcomes',
    name: 'Advice Outcomes',
    description: 'Historical effectiveness of past health recommendations.',
    mimeType: 'application/json',
  },
  {
    uri: 'memory://user/style',
    name: 'Communication Style',
    description: 'How the user prefers to receive information (verbosity, tone, format).',
    mimeType: 'application/json',
  },
  {
    uri: 'memory://conversations/recent',
    name: 'Recent Conversations',
    description: 'Summary of recent agent interactions with the user.',
    mimeType: 'application/json',
  },
  {
    uri: 'memory://context',
    name: 'Full Memory Context',
    description: 'Complete memory context for agent personalization.',
    mimeType: 'application/json',
  },

  // =========================================================================
  // EMAIL RESOURCES (Email Draft Agent)
  // =========================================================================
  {
    uri: 'email://style/profile',
    name: 'Email Writing Style',
    description: 'Learned email writing patterns including greetings, sign-offs, tone, and verbosity.',
    mimeType: 'application/json',
  },
  {
    uri: 'email://drafts/pending',
    name: 'Pending Email Drafts',
    description: 'AI-generated email drafts awaiting user review.',
    mimeType: 'application/json',
  },
  {
    uri: 'email://drafts/all',
    name: 'All Email Drafts',
    description: 'All AI-generated email drafts with their status.',
    mimeType: 'application/json',
  },
  {
    uri: 'email://settings',
    name: 'Email Draft Settings',
    description: 'User preferences for automatic email draft generation.',
    mimeType: 'application/json',
  },
  {
    uri: 'email://watch/status',
    name: 'Gmail Watch Status',
    description: 'Status of Gmail push notification subscription.',
    mimeType: 'application/json',
  },
];

// =============================================================================
// RESOURCE HANDLERS
// =============================================================================

const getSupabase = (config: ServerConfig) => {
  return createClient(config.supabaseUrl, config.supabaseKey);
};

// Unified Context - calls the existing aggregate-context API
async function getUnifiedContext(config: ServerConfig): Promise<any> {
  if (!config.userEmail) {
    return { error: 'User email not configured. Set MCP_USER_EMAIL environment variable.' };
  }

  try {
    // Call the existing aggregate-context API
    const response = await fetch(`${config.baseUrl}/api/aggregate-context`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: config.userEmail,
        contextType: 'unified',
        skipSync: true, // Don't trigger sync, just get cached/current data
      }),
    });

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }

    const data = await response.json();

    if (data.cached) {
      return data.context;
    }

    return data.context;
  } catch (error) {
    // Fallback to direct database query
    const supabase = getSupabase(config);

    const { data: cached } = await supabase
      .from('ecosystem_context_cache')
      .select('*')
      .eq('email', config.userEmail)
      .eq('context_type', 'unified')
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cached) {
      return {
        unifiedProfile: cached.unified_profile,
        keyInsights: cached.key_insights,
        priorityAreas: cached.priority_areas,
        dataSourcesUsed: cached.data_sources_used,
        dataQuality: cached.data_quality,
        generatedAt: cached.generated_at,
      };
    }

    return { error: 'No unified context available. User may need to sync data first.' };
  }
}

// Blood Biomarkers
async function getBloodBiomarkers(config: ServerConfig): Promise<any> {
  if (!config.userEmail) {
    return { error: 'User email not configured' };
  }

  const supabase = getSupabase(config);

  const { data, error } = await supabase
    .from('blood_analysis_results')
    .select('*')
    .eq('user_email', config.userEmail)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return { available: false, message: 'No blood test results found' };
  }

  return {
    available: true,
    analyzedAt: data.created_at,
    biomarkers: data.analysis?.biomarkers || [],
    summary: data.analysis?.summary,
    recommendations: data.analysis?.recommendations,
  };
}

// Blood Deficiencies
async function getDeficiencies(config: ServerConfig): Promise<any> {
  const biomarkers = await getBloodBiomarkers(config);

  if (!biomarkers.available) {
    return biomarkers;
  }

  const deficiencies = (biomarkers.biomarkers || [])
    .filter((b: any) => b.status === 'low' || b.status === 'deficient' || b.status === 'below_optimal')
    .map((b: any) => ({
      name: b.name,
      value: b.value,
      unit: b.unit,
      status: b.status,
      referenceRange: b.referenceRange,
      severity: b.status === 'deficient' ? 'severe' : 'moderate',
      healthImplications: b.healthImplications,
      recommendation: b.recommendation,
    }));

  return {
    available: true,
    deficiencyCount: deficiencies.length,
    deficiencies,
    analyzedAt: biomarkers.analyzedAt,
  };
}

// Oura Sleep Data
async function getOuraSleep(config: ServerConfig): Promise<any> {
  if (!config.userEmail) {
    return { error: 'User email not configured' };
  }

  const supabase = getSupabase(config);

  const { data, error } = await supabase
    .from('oura_data')
    .select('*')
    .eq('user_email', config.userEmail)
    .order('date', { ascending: false })
    .limit(7);

  if (error || !data || data.length === 0) {
    return { available: false, message: 'No Oura sleep data found' };
  }

  const avgSleepScore = data.reduce((sum, d) => sum + (d.sleep_score || 0), 0) / data.length;
  const avgDuration = data.reduce((sum, d) => sum + (d.sleep_duration_hours || 0), 0) / data.length;

  return {
    available: true,
    daysOfData: data.length,
    latest: {
      date: data[0].date,
      sleepScore: data[0].sleep_score,
      duration: data[0].sleep_duration_hours,
      deepSleep: data[0].deep_sleep_minutes,
      remSleep: data[0].rem_sleep_minutes,
      efficiency: data[0].efficiency,
    },
    averages: {
      sleepScore: Math.round(avgSleepScore),
      duration: Math.round(avgDuration * 10) / 10,
    },
    quality: avgSleepScore > 85 ? 'Excellent' :
             avgSleepScore > 70 ? 'Good' :
             avgSleepScore > 60 ? 'Fair' : 'Poor',
    trend: data.length >= 3 ?
      (data[0].sleep_score > data[2].sleep_score ? 'improving' :
       data[0].sleep_score < data[2].sleep_score ? 'declining' : 'stable') : 'insufficient_data',
    history: data.map(d => ({
      date: d.date,
      score: d.sleep_score,
      duration: d.sleep_duration_hours,
    })),
  };
}

// Oura Recovery Data
async function getOuraRecovery(config: ServerConfig): Promise<any> {
  if (!config.userEmail) {
    return { error: 'User email not configured' };
  }

  const supabase = getSupabase(config);

  const { data, error } = await supabase
    .from('oura_data')
    .select('*')
    .eq('user_email', config.userEmail)
    .order('date', { ascending: false })
    .limit(7);

  if (error || !data || data.length === 0) {
    return { available: false, message: 'No Oura recovery data found' };
  }

  const avgReadiness = data.reduce((sum, d) => sum + (d.readiness_score || 0), 0) / data.length;
  const avgHRV = data.reduce((sum, d) => sum + (d.hrv || 0), 0) / data.length;

  return {
    available: true,
    daysOfData: data.length,
    latest: {
      date: data[0].date,
      readinessScore: data[0].readiness_score,
      hrv: data[0].hrv,
      restingHR: data[0].resting_hr,
      bodyTemperature: data[0].body_temperature,
    },
    averages: {
      readinessScore: Math.round(avgReadiness),
      hrv: Math.round(avgHRV),
    },
    recoveryStatus: avgReadiness > 85 ? 'Excellent' :
                    avgReadiness > 70 ? 'Good' :
                    avgReadiness > 60 ? 'Fair' : 'Needs Rest',
    hrvStatus: avgHRV > 70 ? 'Excellent' :
               avgHRV > 50 ? 'Good' :
               avgHRV > 30 ? 'Fair' : 'Low',
    history: data.map(d => ({
      date: d.date,
      readiness: d.readiness_score,
      hrv: d.hrv,
    })),
  };
}

// Dexcom Glucose Data
async function getDexcomGlucose(config: ServerConfig): Promise<any> {
  if (!config.userEmail) {
    return { error: 'User email not configured' };
  }

  const supabase = getSupabase(config);

  // Get last 24 hours of readings (288 readings at 5-min intervals)
  const { data, error } = await supabase
    .from('dexcom_readings')
    .select('*')
    .eq('user_email', config.userEmail)
    .order('timestamp', { ascending: false })
    .limit(288);

  if (error || !data || data.length === 0) {
    return { available: false, message: 'No Dexcom glucose data found' };
  }

  const values = data.map((d: any) => d.glucose_value);
  const avg = values.reduce((a: number, b: number) => a + b, 0) / values.length;
  const spikes = values.filter((v: number) => v > 140).length;
  const lows = values.filter((v: number) => v < 70).length;

  // Calculate variability (coefficient of variation)
  const variance = values.reduce((sum: number, v: number) => sum + Math.pow(v - avg, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  const cv = (stdDev / avg) * 100;

  return {
    available: true,
    readingsCount: data.length,
    hoursOfData: Math.round(data.length * 5 / 60),
    latest: {
      timestamp: data[0].timestamp,
      value: data[0].glucose_value,
      trend: data[0].trend,
    },
    statistics: {
      average: Math.round(avg),
      min: Math.min(...values),
      max: Math.max(...values),
      standardDeviation: Math.round(stdDev),
      coefficientOfVariation: Math.round(cv),
    },
    events: {
      spikeCount: spikes,
      lowCount: lows,
      timeInRange: Math.round((values.filter((v: number) => v >= 70 && v <= 140).length / values.length) * 100),
    },
    status: avg < 100 && spikes < 5 ? 'Optimal' :
            avg < 110 && spikes < 10 ? 'Good' : 'Needs Attention',
    variability: cv < 20 ? 'Low (stable)' :
                 cv < 30 ? 'Moderate' : 'High (variable)',
  };
}

// AI-Generated Insights
async function getInsights(config: ServerConfig): Promise<any> {
  const context = await getUnifiedContext(config);

  if (context.error) {
    return context;
  }

  return {
    available: true,
    insightCount: context.keyInsights?.length || 0,
    insights: context.keyInsights || [],
    aiAnalysis: context.aiAnalysis || null,
    generatedAt: context.generatedAt,
  };
}

// Priority Health Areas
async function getPriorities(config: ServerConfig): Promise<any> {
  const context = await getUnifiedContext(config);

  if (context.error) {
    return context;
  }

  return {
    available: true,
    priorityCount: context.priorityAreas?.length || 0,
    priorities: context.priorityAreas || [],
    dataQuality: context.dataQuality || null,
    generatedAt: context.generatedAt,
  };
}

// =============================================================================
// ADDITIONAL RESOURCE HANDLERS
// =============================================================================

// Oura Activity
async function getOuraActivity(config: ServerConfig): Promise<any> {
  if (!config.userEmail) return { error: 'User email not configured' };

  const supabase = getSupabase(config);
  const { data } = await supabase
    .from('oura_data')
    .select('*')
    .eq('user_email', config.userEmail)
    .order('date', { ascending: false })
    .limit(7);

  if (!data || data.length === 0) {
    return { available: false, message: 'No Oura activity data found' };
  }

  return {
    available: true,
    daysOfData: data.length,
    latest: {
      date: data[0].date,
      steps: data[0].steps,
      activeCalories: data[0].active_calories,
      totalCalories: data[0].total_calories,
      activityScore: data[0].activity_score,
    },
    averages: {
      steps: Math.round(data.reduce((sum: number, d: any) => sum + (d.steps || 0), 0) / data.length),
      activeCalories: Math.round(data.reduce((sum: number, d: any) => sum + (d.active_calories || 0), 0) / data.length),
    },
    history: data.map((d: any) => ({ date: d.date, steps: d.steps, score: d.activity_score })),
  };
}

// Whoop Strain
async function getWhoopStrain(config: ServerConfig): Promise<any> {
  if (!config.userEmail) return { error: 'User email not configured' };

  const supabase = getSupabase(config);
  const { data } = await supabase
    .from('whoop_data')
    .select('*')
    .eq('user_email', config.userEmail)
    .order('date', { ascending: false })
    .limit(7);

  if (!data || data.length === 0) {
    return { available: false, message: 'No Whoop strain data found' };
  }

  return {
    available: true,
    daysOfData: data.length,
    latest: {
      date: data[0].date,
      strain: data[0].strain,
      maxHR: data[0].max_hr,
      calories: data[0].calories,
    },
    averages: {
      strain: (data.reduce((sum: number, d: any) => sum + (d.strain || 0), 0) / data.length).toFixed(1),
    },
    history: data.map((d: any) => ({ date: d.date, strain: d.strain })),
  };
}

// Whoop Recovery
async function getWhoopRecovery(config: ServerConfig): Promise<any> {
  if (!config.userEmail) return { error: 'User email not configured' };

  const supabase = getSupabase(config);
  const { data } = await supabase
    .from('whoop_data')
    .select('*')
    .eq('user_email', config.userEmail)
    .order('date', { ascending: false })
    .limit(7);

  if (!data || data.length === 0) {
    return { available: false, message: 'No Whoop recovery data found' };
  }

  return {
    available: true,
    latest: {
      date: data[0].date,
      recoveryScore: data[0].recovery_score,
      hrv: data[0].hrv,
      restingHR: data[0].resting_hr,
      sleepPerformance: data[0].sleep_performance,
    },
    averages: {
      recoveryScore: Math.round(data.reduce((sum: number, d: any) => sum + (d.recovery_score || 0), 0) / data.length),
      hrv: Math.round(data.reduce((sum: number, d: any) => sum + (d.hrv || 0), 0) / data.length),
    },
    history: data.map((d: any) => ({ date: d.date, recovery: d.recovery_score, hrv: d.hrv })),
  };
}

// Apple Health Activity
async function getAppleActivity(config: ServerConfig): Promise<any> {
  if (!config.userEmail) return { error: 'User email not configured' };

  const supabase = getSupabase(config);
  const { data } = await supabase
    .from('apple_health_data')
    .select('*')
    .eq('user_email', config.userEmail)
    .order('date', { ascending: false })
    .limit(7);

  if (!data || data.length === 0) {
    return { available: false, message: 'No Apple Health activity data found' };
  }

  return {
    available: true,
    daysOfData: data.length,
    latest: {
      date: data[0].date,
      steps: data[0].steps,
      activeEnergy: data[0].active_energy,
      exerciseMinutes: data[0].exercise_minutes,
      standHours: data[0].stand_hours,
    },
    averages: {
      steps: Math.round(data.reduce((sum: number, d: any) => sum + (d.steps || 0), 0) / data.length),
      exerciseMinutes: Math.round(data.reduce((sum: number, d: any) => sum + (d.exercise_minutes || 0), 0) / data.length),
    },
    rings: {
      move: data[0].move_ring_progress,
      exercise: data[0].exercise_ring_progress,
      stand: data[0].stand_ring_progress,
    },
  };
}

// Apple Health Vitals
async function getAppleVitals(config: ServerConfig): Promise<any> {
  if (!config.userEmail) return { error: 'User email not configured' };

  const supabase = getSupabase(config);
  const { data } = await supabase
    .from('apple_health_vitals')
    .select('*')
    .eq('user_email', config.userEmail)
    .order('date', { ascending: false })
    .limit(7);

  if (!data || data.length === 0) {
    return { available: false, message: 'No Apple Health vitals found' };
  }

  return {
    available: true,
    latest: {
      date: data[0].date,
      restingHR: data[0].resting_hr,
      bloodPressureSystolic: data[0].bp_systolic,
      bloodPressureDiastolic: data[0].bp_diastolic,
      respiratoryRate: data[0].respiratory_rate,
    },
  };
}

// Apple Health Workouts
async function getAppleWorkouts(config: ServerConfig): Promise<any> {
  if (!config.userEmail) return { error: 'User email not configured' };

  const supabase = getSupabase(config);
  const { data } = await supabase
    .from('apple_health_workouts')
    .select('*')
    .eq('user_email', config.userEmail)
    .order('date', { ascending: false })
    .limit(10);

  if (!data || data.length === 0) {
    return { available: false, message: 'No Apple Health workouts found' };
  }

  return {
    available: true,
    recentWorkouts: data.map((w: any) => ({
      date: w.date,
      type: w.workout_type,
      duration: w.duration_minutes,
      calories: w.calories,
      avgHR: w.avg_hr,
    })),
    workoutCount: data.length,
  };
}

// Google Fit Activity
async function getGoogleFitActivity(config: ServerConfig): Promise<any> {
  if (!config.userEmail) return { error: 'User email not configured' };

  const supabase = getSupabase(config);
  const { data } = await supabase
    .from('google_fit_data')
    .select('*')
    .eq('user_email', config.userEmail)
    .order('date', { ascending: false })
    .limit(7);

  if (!data || data.length === 0) {
    return { available: false, message: 'No Google Fit data found' };
  }

  return {
    available: true,
    daysOfData: data.length,
    latest: {
      date: data[0].date,
      steps: data[0].steps,
      calories: data[0].calories,
      distance: data[0].distance,
      activeMinutes: data[0].active_minutes,
    },
    averages: {
      steps: Math.round(data.reduce((sum: number, d: any) => sum + (d.steps || 0), 0) / data.length),
    },
  };
}

// Google Fit Vitals
async function getGoogleFitVitals(config: ServerConfig): Promise<any> {
  return { available: false, message: 'Google Fit vitals - use Google Fit Activity or Apple Health' };
}

// Fitbit Activity
async function getFitbitActivity(config: ServerConfig): Promise<any> {
  if (!config.userEmail) return { error: 'User email not configured' };

  const supabase = getSupabase(config);
  const { data } = await supabase
    .from('fitbit_data')
    .select('*')
    .eq('user_email', config.userEmail)
    .order('date', { ascending: false })
    .limit(7);

  if (!data || data.length === 0) {
    return { available: false, message: 'No Fitbit activity data found' };
  }

  return {
    available: true,
    daysOfData: data.length,
    latest: {
      date: data[0].date,
      steps: data[0].steps,
      floors: data[0].floors,
      activeMinutes: data[0].active_minutes,
      calories: data[0].calories,
    },
    averages: {
      steps: Math.round(data.reduce((sum: number, d: any) => sum + (d.steps || 0), 0) / data.length),
    },
  };
}

// Fitbit Sleep
async function getFitbitSleep(config: ServerConfig): Promise<any> {
  if (!config.userEmail) return { error: 'User email not configured' };

  const supabase = getSupabase(config);
  const { data } = await supabase
    .from('fitbit_sleep')
    .select('*')
    .eq('user_email', config.userEmail)
    .order('date', { ascending: false })
    .limit(7);

  if (!data || data.length === 0) {
    return { available: false, message: 'No Fitbit sleep data found' };
  }

  return {
    available: true,
    latest: {
      date: data[0].date,
      duration: data[0].duration_hours,
      efficiency: data[0].efficiency,
      sleepScore: data[0].sleep_score,
      deepSleep: data[0].deep_sleep_minutes,
      remSleep: data[0].rem_sleep_minutes,
    },
  };
}

// Fitbit Heart
async function getFitbitHeart(config: ServerConfig): Promise<any> {
  if (!config.userEmail) return { error: 'User email not configured' };

  const supabase = getSupabase(config);
  const { data } = await supabase
    .from('fitbit_data')
    .select('resting_hr, cardio_score')
    .eq('user_email', config.userEmail)
    .order('date', { ascending: false })
    .limit(7);

  if (!data || data.length === 0) {
    return { available: false, message: 'No Fitbit heart data found' };
  }

  return {
    available: true,
    latest: {
      restingHR: data[0].resting_hr,
      cardioFitness: data[0].cardio_score,
    },
    trend: data.map((d: any) => d.resting_hr).filter(Boolean),
  };
}

// Google Calendar Schedule
async function getCalendarSchedule(config: ServerConfig): Promise<any> {
  if (!config.userEmail) return { error: 'User email not configured' };

  const token = await getOAuthToken(config, 'google');
  if (!token) {
    return { available: false, message: 'Google Calendar not connected' };
  }

  try {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: token });
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const now = new Date();
    const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const events = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: weekAhead.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    const eventList = events.data.items || [];
    const meetingCount = eventList.length;
    const totalMeetingMinutes = eventList.reduce((sum: number, e: any) => {
      if (e.start?.dateTime && e.end?.dateTime) {
        return sum + (new Date(e.end.dateTime).getTime() - new Date(e.start.dateTime).getTime()) / 60000;
      }
      return sum;
    }, 0);

    return {
      available: true,
      upcomingEvents: eventList.slice(0, 10).map((e: any) => ({
        title: e.summary,
        start: e.start?.dateTime || e.start?.date,
        end: e.end?.dateTime || e.end?.date,
        location: e.location,
      })),
      weekSummary: {
        meetingCount,
        totalMeetingHours: Math.round(totalMeetingMinutes / 60 * 10) / 10,
        meetingDensity: meetingCount > 20 ? 'High' : meetingCount > 10 ? 'Medium' : 'Low',
      },
    };
  } catch (error) {
    return { available: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Calendar Availability
async function getCalendarAvailability(config: ServerConfig): Promise<any> {
  // This reuses the find_slots tool logic
  const schedule = await getCalendarSchedule(config);
  if (!schedule.available) return schedule;

  return {
    available: true,
    message: 'Use calendar_find_slots tool to find specific available slots',
    meetingDensity: schedule.weekSummary?.meetingDensity,
  };
}

// Gmail Patterns
async function getGmailPatterns(config: ServerConfig): Promise<any> {
  if (!config.userEmail) return { error: 'User email not configured' };

  const supabase = getSupabase(config);
  const { data } = await supabase
    .from('gmail_patterns')
    .select('*')
    .eq('user_email', config.userEmail)
    .order('analyzed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    // Try unified context
    const context = await getUnifiedContext(config);
    if (context.rawPatterns?.gmail) {
      return { available: true, ...context.rawPatterns.gmail };
    }
    return { available: false, message: 'No Gmail pattern data found' };
  }

  return {
    available: true,
    patterns: {
      dailyEmailVolume: data.daily_volume,
      afterHoursEmails: data.after_hours_count,
      avgResponseTime: data.avg_response_time,
      meetingDensity: data.meeting_density,
      peakHours: data.peak_hours,
    },
    analyzedAt: data.analyzed_at,
  };
}

// Gmail Stress
async function getGmailStress(config: ServerConfig): Promise<any> {
  const patterns = await getGmailPatterns(config);
  if (!patterns.available) return patterns;

  const afterHours = patterns.patterns?.afterHoursEmails || 0;
  const meetingDensity = patterns.patterns?.meetingDensity || 0;

  return {
    available: true,
    stressIndicators: {
      afterHoursActivity: afterHours > 20 ? 'High' : afterHours > 10 ? 'Medium' : 'Low',
      meetingOverload: meetingDensity > 0.7 ? 'High' : meetingDensity > 0.5 ? 'Medium' : 'Low',
      workLifeBalance: afterHours > 15 || meetingDensity > 0.6 ? 'Poor' : 'Good',
    },
  };
}

// Slack Patterns
async function getSlackPatterns(config: ServerConfig): Promise<any> {
  if (!config.userEmail) return { error: 'User email not configured' };

  const supabase = getSupabase(config);
  const { data } = await supabase
    .from('slack_patterns')
    .select('*')
    .eq('user_email', config.userEmail)
    .order('analyzed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    const context = await getUnifiedContext(config);
    if (context.rawPatterns?.slack) {
      return { available: true, ...context.rawPatterns.slack };
    }
    return { available: false, message: 'No Slack pattern data found' };
  }

  return {
    available: true,
    patterns: {
      dailyMessages: data.daily_messages,
      afterHoursMessages: data.after_hours_count,
      channelActivity: data.channel_activity,
      peakHours: data.peak_hours,
    },
    analyzedAt: data.analyzed_at,
  };
}

// Slack Stress
async function getSlackStress(config: ServerConfig): Promise<any> {
  const patterns = await getSlackPatterns(config);
  if (!patterns.available) return patterns;

  const afterHours = patterns.patterns?.afterHoursMessages || 0;

  return {
    available: true,
    stressIndicators: {
      afterHoursActivity: afterHours > 20 ? 'High' : afterHours > 10 ? 'Medium' : 'Low',
      messagePressure: patterns.patterns?.dailyMessages > 100 ? 'High' : 'Normal',
    },
  };
}

// Outlook Schedule
async function getOutlookSchedule(config: ServerConfig): Promise<any> {
  if (!config.userEmail) return { error: 'User email not configured' };

  const supabase = getSupabase(config);
  const { data } = await supabase
    .from('outlook_calendar_data')
    .select('*')
    .eq('user_email', config.userEmail)
    .order('date', { ascending: false })
    .limit(7);

  if (!data || data.length === 0) {
    return { available: false, message: 'No Outlook calendar data found' };
  }

  return {
    available: true,
    events: data,
  };
}

// Teams Patterns
async function getTeamsPatterns(config: ServerConfig): Promise<any> {
  if (!config.userEmail) return { error: 'User email not configured' };

  const supabase = getSupabase(config);
  const { data } = await supabase
    .from('teams_patterns')
    .select('*')
    .eq('user_email', config.userEmail)
    .order('analyzed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return { available: false, message: 'No Teams pattern data found' };
  }

  return {
    available: true,
    patterns: {
      meetingFrequency: data.meeting_frequency,
      messageActivity: data.message_count,
      collaborationScore: data.collaboration_score,
    },
  };
}

// Spotify Listening
async function getSpotifyListening(config: ServerConfig): Promise<any> {
  if (!config.userEmail) return { error: 'User email not configured' };

  const token = await getOAuthToken(config, 'spotify');
  if (!token) {
    return { available: false, message: 'Spotify not connected' };
  }

  try {
    const response = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=20', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();

    return {
      available: true,
      recentTracks: (data.items || []).map((item: any) => ({
        track: item.track.name,
        artist: item.track.artists[0]?.name,
        playedAt: item.played_at,
      })),
      listeningTime: data.items?.length || 0,
    };
  } catch (error) {
    return { available: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Spotify Mood
async function getSpotifyMood(config: ServerConfig): Promise<any> {
  const listening = await getSpotifyListening(config);
  if (!listening.available) return listening;

  // In production, would use Spotify audio features API
  return {
    available: true,
    message: 'Mood analysis based on recent listening',
    recentListening: listening.recentTracks?.slice(0, 5),
  };
}

// Strava Activities
async function getStravaActivities(config: ServerConfig): Promise<any> {
  if (!config.userEmail) return { error: 'User email not configured' };

  const supabase = getSupabase(config);
  const { data } = await supabase
    .from('strava_activities')
    .select('*')
    .eq('user_email', config.userEmail)
    .order('date', { ascending: false })
    .limit(10);

  if (!data || data.length === 0) {
    return { available: false, message: 'No Strava activities found' };
  }

  return {
    available: true,
    recentActivities: data.map((a: any) => ({
      date: a.date,
      type: a.activity_type,
      name: a.name,
      distance: a.distance,
      duration: a.duration_minutes,
      calories: a.calories,
    })),
    activityCount: data.length,
  };
}

// Strava Fitness
async function getStravaFitness(config: ServerConfig): Promise<any> {
  const activities = await getStravaActivities(config);
  if (!activities.available) return activities;

  return {
    available: true,
    recentActivityCount: activities.activityCount,
    message: 'Fitness trends based on recent Strava activities',
  };
}

// Vital Summary
async function getVitalSummary(config: ServerConfig): Promise<any> {
  if (!config.userEmail) return { error: 'User email not configured' };

  const supabase = getSupabase(config);
  const { data } = await supabase
    .from('vital_data')
    .select('*')
    .eq('user_email', config.userEmail)
    .order('synced_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return { available: false, message: 'No Vital data found' };
  }

  return {
    available: true,
    connectedProviders: data.connected_providers,
    lastSync: data.synced_at,
    summary: data.health_summary,
  };
}

// User Profile
async function getUserProfile(config: ServerConfig): Promise<any> {
  if (!config.userEmail) return { error: 'User email not configured' };

  const supabase = getSupabase(config);
  const { data } = await supabase
    .from('sage_onboarding_data')
    .select('*')
    .eq('email', config.userEmail)
    .maybeSingle();

  if (!data) {
    return { available: false, message: 'No user profile found' };
  }

  return {
    available: true,
    profile: {
      healthGoals: data.form_data?.healthGoals,
      dietaryPreferences: data.form_data?.dietaryPreferences,
      activityLevel: data.form_data?.activityLevel,
      sleepGoal: data.form_data?.sleepGoal,
      supplements: data.form_data?.currentSupplements,
    },
  };
}

// User Connections
async function getUserConnections(config: ServerConfig): Promise<any> {
  if (!config.userEmail) return { error: 'User email not configured' };

  const supabase = getSupabase(config);
  const { data } = await supabase
    .from('user_oauth_connections')
    .select('provider, connected_at')
    .eq('user_email', config.userEmail);

  const connections = (data || []).reduce((acc: Record<string, any>, conn: any) => {
    acc[conn.provider] = { connected: true, connectedAt: conn.connected_at };
    return acc;
  }, {});

  return {
    available: true,
    connections,
    connectedCount: Object.keys(connections).length,
  };
}

// Helper to get OAuth token
async function getOAuthToken(config: ServerConfig, provider: string): Promise<string | null> {
  const supabase = getSupabase(config);
  const { data } = await supabase
    .from('user_oauth_connections')
    .select('access_token')
    .eq('user_email', config.userEmail)
    .eq('provider', provider)
    .maybeSingle();
  return data?.access_token || null;
}

// =============================================================================
// MEMORY RESOURCE HANDLERS
// =============================================================================

// Memory: Learned Facts
async function getMemoryFacts(config: ServerConfig): Promise<any> {
  if (!config.userEmail) return { error: 'User email not configured' };

  const supabase = getSupabase(config);
  const { data, error } = await supabase
    .from('user_learned_facts')
    .select('*')
    .eq('user_email', config.userEmail)
    .or('expires_at.is.null,expires_at.gt.now()')
    .order('confidence', { ascending: false });

  if (error) {
    return { available: false, error: error.message };
  }

  // Group facts by category
  const byCategory: Record<string, any[]> = {};
  for (const fact of data || []) {
    if (!byCategory[fact.category]) {
      byCategory[fact.category] = [];
    }
    byCategory[fact.category].push({
      key: fact.fact_key,
      value: fact.fact_value,
      confidence: fact.confidence,
      source: fact.source,
      learnedAt: fact.learned_at,
    });
  }

  return {
    available: true,
    totalFacts: (data || []).length,
    byCategory,
    highConfidenceFacts: (data || []).filter((f: any) => f.confidence >= 0.7),
  };
}

// Memory: Action Preferences
async function getMemoryPreferences(config: ServerConfig): Promise<any> {
  if (!config.userEmail) return { error: 'User email not configured' };

  const supabase = getSupabase(config);
  const { data, error } = await supabase
    .from('user_action_preferences')
    .select('*')
    .eq('user_email', config.userEmail)
    .order('created_at', { ascending: false });

  if (error) {
    return { available: false, error: error.message };
  }

  // Calculate approval rates by action type
  const byType: Record<string, { approvals: number; total: number; learnedPreference?: string }> = {};
  for (const pref of data || []) {
    if (!byType[pref.action_type]) {
      byType[pref.action_type] = { approvals: 0, total: 0 };
    }
    byType[pref.action_type].total++;
    if (pref.approved) byType[pref.action_type].approvals++;
    if (pref.learned_preference) {
      byType[pref.action_type].learnedPreference = pref.learned_preference;
    }
  }

  const preferences = Object.entries(byType).map(([type, stats]) => ({
    actionType: type,
    approvalRate: Math.round((stats.approvals / stats.total) * 100),
    totalDecisions: stats.total,
    learnedPreference: stats.learnedPreference,
    usuallyApproves: stats.approvals > stats.total / 2,
  }));

  return {
    available: true,
    totalDecisions: (data || []).length,
    preferences,
    summary: preferences.map(p =>
      `${p.actionType}: ${p.usuallyApproves ? 'Usually approves' : 'Usually rejects'} (${p.approvalRate}%)`
    ).join('; '),
  };
}

// Memory: Advice Outcomes
async function getMemoryOutcomes(config: ServerConfig): Promise<any> {
  if (!config.userEmail) return { error: 'User email not configured' };

  const supabase = getSupabase(config);
  const { data, error } = await supabase
    .from('advice_outcomes')
    .select('*')
    .eq('user_email', config.userEmail)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return { available: false, error: error.message };
  }

  const completed = (data || []).filter((a: any) => a.outcome && a.outcome !== 'pending');
  const improved = completed.filter((a: any) => a.outcome === 'improved');
  const noChange = completed.filter((a: any) => a.outcome === 'no_change');
  const worsened = completed.filter((a: any) => a.outcome === 'worsened');
  const pending = (data || []).filter((a: any) => a.outcome === 'pending');

  return {
    available: true,
    totalAdvice: (data || []).length,
    stats: {
      improved: improved.length,
      noChange: noChange.length,
      worsened: worsened.length,
      pending: pending.length,
      successRate: completed.length > 0
        ? Math.round((improved.length / completed.length) * 100)
        : null,
    },
    recentOutcomes: completed.slice(0, 10).map((a: any) => ({
      adviceType: a.advice_type,
      advice: a.advice_summary || a.advice_given,
      metric: a.metric_name,
      outcome: a.outcome,
      baseline: a.baseline_value,
      current: a.current_value,
      improvement: a.improvement_percentage,
    })),
    pendingChecks: pending.slice(0, 5).map((a: any) => ({
      adviceType: a.advice_type,
      advice: a.advice_summary,
      metric: a.metric_name,
      checkAfterDays: a.check_after_days,
      createdAt: a.created_at,
    })),
  };
}

// Memory: Communication Style
async function getMemoryStyle(config: ServerConfig): Promise<any> {
  if (!config.userEmail) return { error: 'User email not configured' };

  const supabase = getSupabase(config);
  const { data, error } = await supabase
    .from('user_communication_style')
    .select('*')
    .eq('user_email', config.userEmail)
    .maybeSingle();

  if (error) {
    return { available: false, error: error.message };
  }

  if (!data) {
    // Return defaults
    return {
      available: true,
      style: {
        verbosity: 'medium',
        tone: 'professional',
        emojiUsage: false,
        prefersLists: true,
        prefersExplanations: true,
        prefersResearchCitations: false,
        prefersActionItems: true,
        preferredTimeFormat: '12h',
        preferredUnits: 'imperial',
        responseLengthPreference: 'medium',
      },
      isDefault: true,
      inferredFromInteractions: 0,
    };
  }

  return {
    available: true,
    style: {
      verbosity: data.verbosity,
      tone: data.tone,
      emojiUsage: data.emoji_usage,
      prefersLists: data.prefers_lists,
      prefersExplanations: data.prefers_explanations,
      prefersResearchCitations: data.prefers_research_citations,
      prefersActionItems: data.prefers_action_items,
      preferredTimeFormat: data.preferred_time_format,
      preferredUnits: data.preferred_units,
      responseLengthPreference: data.response_length_preference,
    },
    isDefault: false,
    inferredFromInteractions: data.inferred_from_interactions,
    lastUpdated: data.updated_at,
  };
}

// Memory: Recent Conversations
async function getMemoryConversations(config: ServerConfig): Promise<any> {
  if (!config.userEmail) return { error: 'User email not configured' };

  const supabase = getSupabase(config);
  const { data, error } = await supabase
    .from('user_conversations')
    .select('id, thread_id, topic, summary, insights_discussed, actions_taken, updated_at')
    .eq('user_email', config.userEmail)
    .order('updated_at', { ascending: false })
    .limit(10);

  if (error) {
    return { available: false, error: error.message };
  }

  return {
    available: true,
    totalConversations: (data || []).length,
    conversations: (data || []).map((c: any) => ({
      threadId: c.thread_id,
      topic: c.topic || 'General conversation',
      summary: c.summary || 'No summary available',
      insightsDiscussed: c.insights_discussed || [],
      actionsTaken: c.actions_taken || [],
      date: c.updated_at,
    })),
  };
}

// Memory: Full Context (combines all memory for agent)
async function getMemoryContext(config: ServerConfig): Promise<any> {
  if (!config.userEmail) return { error: 'User email not configured' };

  // Fetch all memory components in parallel
  const [facts, preferences, outcomes, style, conversations] = await Promise.all([
    getMemoryFacts(config),
    getMemoryPreferences(config),
    getMemoryOutcomes(config),
    getMemoryStyle(config),
    getMemoryConversations(config),
  ]);

  // Get recent summary if available
  const supabase = getSupabase(config);
  const { data: summaryData } = await supabase
    .from('user_memory_summaries')
    .select('summary_text')
    .eq('user_email', config.userEmail)
    .eq('summary_type', 'weekly')
    .order('period_end', { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    available: true,
    userEmail: config.userEmail,
    facts: facts.available ? facts : null,
    preferences: preferences.available ? preferences : null,
    outcomes: outcomes.available ? outcomes : null,
    style: style.available ? style : null,
    conversations: conversations.available ? conversations : null,
    recentSummary: summaryData?.summary_text || null,
    generatedAt: new Date().toISOString(),
  };
}

// =============================================================================
// EXPORT HANDLERS
// =============================================================================

export const resourceHandlers: Record<string, ResourceHandler> = {
  // Unified
  'health://context/unified': getUnifiedContext,
  'health://insights': getInsights,
  'health://priorities': getPriorities,

  // Blood
  'health://blood/biomarkers': getBloodBiomarkers,
  'health://blood/deficiencies': getDeficiencies,

  // Oura
  'health://oura/sleep': getOuraSleep,
  'health://oura/recovery': getOuraRecovery,
  'health://oura/activity': getOuraActivity,

  // Dexcom
  'health://dexcom/glucose': getDexcomGlucose,

  // Whoop
  'health://whoop/strain': getWhoopStrain,
  'health://whoop/recovery': getWhoopRecovery,

  // Apple Health
  'health://apple/activity': getAppleActivity,
  'health://apple/vitals': getAppleVitals,
  'health://apple/workouts': getAppleWorkouts,

  // Google Fit
  'health://googlefit/activity': getGoogleFitActivity,
  'health://googlefit/vitals': getGoogleFitVitals,

  // Fitbit
  'health://fitbit/activity': getFitbitActivity,
  'health://fitbit/sleep': getFitbitSleep,
  'health://fitbit/heart': getFitbitHeart,

  // Google Calendar
  'health://calendar/schedule': getCalendarSchedule,
  'health://calendar/availability': getCalendarAvailability,

  // Gmail
  'health://gmail/patterns': getGmailPatterns,
  'health://gmail/stress': getGmailStress,

  // Slack
  'health://slack/patterns': getSlackPatterns,
  'health://slack/stress': getSlackStress,

  // Microsoft
  'health://outlook/schedule': getOutlookSchedule,
  'health://teams/patterns': getTeamsPatterns,

  // Spotify
  'health://spotify/listening': getSpotifyListening,
  'health://spotify/mood': getSpotifyMood,

  // Strava
  'health://strava/activities': getStravaActivities,
  'health://strava/fitness': getStravaFitness,

  // Vital
  'health://vital/summary': getVitalSummary,

  // User
  'health://user/profile': getUserProfile,
  'health://user/connections': getUserConnections,

  // Memory Resources
  'memory://user/facts': getMemoryFacts,
  'memory://user/preferences': getMemoryPreferences,
  'memory://user/outcomes': getMemoryOutcomes,
  'memory://user/style': getMemoryStyle,
  'memory://conversations/recent': getMemoryConversations,
  'memory://context': getMemoryContext,

  // Email Resources
  'email://style/profile': getEmailStyleProfile,
  'email://drafts/pending': getEmailDraftsPending,
  'email://drafts/all': getEmailDraftsAll,
  'email://settings': getEmailDraftSettings,
  'email://watch/status': getEmailWatchStatus,
};

// =============================================================================
// EMAIL RESOURCE HANDLERS
// =============================================================================

async function getEmailStyleProfile(config: ServerConfig): Promise<any> {
  const supabase = getSupabase(config);

  const { data, error } = await supabase
    .from('user_email_style')
    .select('*')
    .eq('user_email', config.userEmail)
    .maybeSingle();

  if (error || !data) {
    return {
      available: false,
      message: 'Email style not yet learned. Run style learning first.',
    };
  }

  return {
    available: true,
    greetingPatterns: data.greeting_patterns,
    signoffPatterns: data.signoff_patterns,
    toneProfile: data.tone_profile,
    verbosityLevel: data.verbosity_level,
    avgEmailLength: data.avg_email_length,
    usesEmojis: data.uses_emojis,
    usesBulletPoints: data.uses_bullet_points,
    commonPhrases: data.common_phrases,
    sampleEmailsAnalyzed: data.sample_emails_analyzed,
    confidenceScore: data.confidence_score,
    lastLearnedAt: data.last_learned_at,
  };
}

async function getEmailDraftsPending(config: ServerConfig): Promise<any> {
  const supabase = getSupabase(config);

  const { data, error } = await supabase
    .from('email_drafts')
    .select('*')
    .eq('user_email', config.userEmail)
    .in('status', ['pending', 'created'])
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    return { available: false, error: error.message };
  }

  return {
    available: true,
    count: data?.length || 0,
    drafts: (data || []).map((d) => ({
      id: d.id,
      originalFrom: d.original_from,
      originalSubject: d.original_subject,
      draftSubject: d.draft_subject,
      draftBody: d.draft_body?.slice(0, 200) + (d.draft_body?.length > 200 ? '...' : ''),
      emailType: d.email_type,
      urgencyLevel: d.urgency_level,
      status: d.status,
      gmailDraftId: d.gmail_draft_id,
      createdAt: d.created_at,
    })),
  };
}

async function getEmailDraftsAll(config: ServerConfig): Promise<any> {
  const supabase = getSupabase(config);

  const { data, error, count } = await supabase
    .from('email_drafts')
    .select('*', { count: 'exact' })
    .eq('user_email', config.userEmail)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return { available: false, error: error.message };
  }

  // Group by status
  const byStatus: Record<string, number> = {};
  for (const d of data || []) {
    byStatus[d.status] = (byStatus[d.status] || 0) + 1;
  }

  return {
    available: true,
    total: count || 0,
    byStatus,
    recentDrafts: (data || []).slice(0, 10).map((d) => ({
      id: d.id,
      originalFrom: d.original_from,
      originalSubject: d.original_subject,
      status: d.status,
      createdAt: d.created_at,
    })),
  };
}

async function getEmailDraftSettings(config: ServerConfig): Promise<any> {
  const supabase = getSupabase(config);

  const { data, error } = await supabase
    .from('email_draft_settings')
    .select('*')
    .eq('user_email', config.userEmail)
    .maybeSingle();

  if (error || !data) {
    return {
      configured: false,
      defaults: {
        autoDraftEnabled: true,
        requireApproval: false,
        processPrimaryOnly: true,
        maxDraftsPerDay: 20,
      },
    };
  }

  return {
    configured: true,
    autoDraftEnabled: data.auto_draft_enabled,
    requireApproval: data.require_approval,
    processPrimaryOnly: data.process_primary_only,
    maxDraftsPerDay: data.max_drafts_per_day,
    excludedSenders: data.excluded_senders,
    excludedDomains: data.excluded_domains,
    includeSignature: data.include_signature,
    signatureConfigured: !!data.signature_text,
  };
}

async function getEmailWatchStatus(config: ServerConfig): Promise<any> {
  const supabase = getSupabase(config);

  const { data, error } = await supabase
    .from('gmail_watch_subscriptions')
    .select('*')
    .eq('user_email', config.userEmail)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data) {
    return {
      active: false,
      message: 'Gmail push notifications not configured',
    };
  }

  const expiresIn = new Date(data.expiration_timestamp).getTime() - Date.now();

  return {
    active: true,
    historyId: data.history_id,
    expiration: data.expiration_timestamp,
    expiresInHours: Math.round(expiresIn / 1000 / 60 / 60),
    lastNotificationAt: data.last_notification_at,
    notificationCount: data.notification_count,
    emailsProcessed: data.emails_processed,
    draftsGenerated: data.drafts_generated,
  };
}
