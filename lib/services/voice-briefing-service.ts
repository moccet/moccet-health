/**
 * Voice Briefing Service
 *
 * Generates personalized audio briefings for users with their daily health summary.
 * Supports morning briefings, sleep summaries, and on-demand voice updates.
 *
 * Uses ElevenLabs API for natural voice synthesis.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// ============================================================================
// Types
// ============================================================================

export type BriefingType =
  | 'morning'
  | 'evening'
  | 'sleep_summary'
  | 'workout_summary'
  | 'weekly_recap'
  | 'goal_update'
  | 'on_demand';

export type VoiceId =
  | 'rachel'      // Professional female
  | 'adam'        // Professional male
  | 'bella'       // Warm female
  | 'josh'        // Casual male
  | 'elli'        // Young female
  | 'sam';        // Neutral

export interface VoiceBriefing {
  id: string;
  type: BriefingType;
  text: string;
  ssml?: string;
  audioUrl?: string;
  audioDurationSeconds?: number;
  highlights: string[];
  generatedAt: string;
  expiresAt: string;
  voiceId: VoiceId;
  metadata: {
    sleepScore?: number;
    recoveryScore?: number;
    activeGoals?: number;
    upcomingEvents?: number;
    streaksAtRisk?: number;
  };
}

export interface BriefingPreferences {
  enabled: boolean;
  preferredTime: string; // HH:mm
  timezone: string;
  voiceId: VoiceId;
  includeWeather: boolean;
  includeCalendar: boolean;
  includeGoals: boolean;
  includeStreaks: boolean;
  maxDurationSeconds: number;
  language: string;
}

interface HealthSummary {
  sleepScore?: number;
  sleepDuration?: number;
  sleepQuality?: string;
  hrvScore?: number;
  recoveryScore?: number;
  restingHeartRate?: number;
  steps?: number;
  activeMinutes?: number;
  caloriesBurned?: number;
  glucoseAvg?: number;
  glucoseTrend?: string;
  weight?: number;
  weightTrend?: string;
}

interface ScheduleSummary {
  totalEvents: number;
  firstEvent?: {
    title: string;
    time: string;
  };
  busyHours: number;
  conflictsCount: number;
}

interface GoalsSummary {
  activeGoals: number;
  dueToday: number;
  completedThisWeek: number;
  behindSchedule: number;
}

interface StreaksSummary {
  activeStreaks: number;
  atRiskStreaks: number;
  longestStreak: {
    type: string;
    days: number;
  } | null;
  totalStreakDays: number;
}

// ============================================================================
// Configuration
// ============================================================================

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

const VOICE_CONFIG: Record<VoiceId, { id: string; name: string; style: string }> = {
  rachel: { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel', style: 'professional' },
  adam: { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam', style: 'professional' },
  bella: { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella', style: 'warm' },
  josh: { id: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh', style: 'casual' },
  elli: { id: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli', style: 'energetic' },
  sam: { id: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam', style: 'neutral' },
};

const DEFAULT_PREFERENCES: BriefingPreferences = {
  enabled: true,
  preferredTime: '07:00',
  timezone: 'America/New_York',
  voiceId: 'rachel',
  includeWeather: true,
  includeCalendar: true,
  includeGoals: true,
  includeStreaks: true,
  maxDurationSeconds: 45,
  language: 'en',
};

const BRIEFING_TEMPLATES = {
  morning: {
    greeting: [
      "Good morning! Here's your health briefing for today.",
      "Rise and shine! Let me catch you up on your health.",
      "Good morning! Ready for your daily wellness update?",
    ],
    closing: [
      "Have a great day!",
      "Wishing you a healthy and productive day!",
      "Make today count!",
    ],
  },
  evening: {
    greeting: [
      "Good evening! Here's your day in review.",
      "Time for your evening health summary.",
    ],
    closing: [
      "Rest well tonight!",
      "Have a peaceful evening!",
    ],
  },
  sleep_summary: {
    greeting: [
      "Here's your sleep report from last night.",
      "Let's look at how you slept.",
    ],
    closing: [
      "Sweet dreams tonight!",
      "Here's to better rest!",
    ],
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

function getRandomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} minutes`;
  if (mins === 0) return hours === 1 ? '1 hour' : `${hours} hours`;
  return `${hours} hour${hours > 1 ? 's' : ''} and ${mins} minutes`;
}

function formatTime(time24: string): string {
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

function getSleepQualityDescription(score: number): string {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 55) return 'fair';
  return 'below average';
}

function getRecoveryDescription(score: number): string {
  if (score >= 67) return 'fully recovered';
  if (score >= 34) return 'moderately recovered';
  return 'still recovering';
}

function generateId(): string {
  return `briefing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// Data Fetching Functions
// ============================================================================

async function getHealthSummary(
  userEmail: string,
  supabase: SupabaseClient
): Promise<HealthSummary> {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Fetch sleep data
  const { data: sleepData } = await supabase
    .from('sleep_logs')
    .select('score, duration_minutes, quality')
    .eq('user_email', userEmail)
    .eq('date', yesterday)
    .single();

  type SleepRow = { score?: number; duration_minutes?: number; quality?: string };
  const sleep = sleepData as SleepRow | null;

  // Fetch daily metrics
  const { data: metricsData } = await supabase
    .from('daily_metrics')
    .select('steps, active_minutes, calories_burned, hrv, resting_hr, recovery_score')
    .eq('user_email', userEmail)
    .eq('date', today)
    .single();

  type MetricsRow = {
    steps?: number;
    active_minutes?: number;
    calories_burned?: number;
    hrv?: number;
    resting_hr?: number;
    recovery_score?: number;
  };
  const metrics = metricsData as MetricsRow | null;

  // Fetch glucose data (if available)
  const { data: glucoseData } = await supabase
    .from('glucose_readings')
    .select('value')
    .eq('user_email', userEmail)
    .gte('timestamp', new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString())
    .order('timestamp', { ascending: false })
    .limit(20);

  type GlucoseRow = { value: number };
  const glucose = glucoseData as GlucoseRow[] | null;

  let glucoseAvg: number | undefined;
  let glucoseTrend: string | undefined;

  if (glucose && glucose.length > 0) {
    glucoseAvg = Math.round(glucose.reduce((sum, r) => sum + r.value, 0) / glucose.length);
    if (glucose.length >= 3) {
      const recent = glucose.slice(0, 3).reduce((sum, r) => sum + r.value, 0) / 3;
      const older = glucose.slice(-3).reduce((sum, r) => sum + r.value, 0) / 3;
      glucoseTrend = recent > older + 10 ? 'rising' : recent < older - 10 ? 'falling' : 'stable';
    }
  }

  // Fetch weight (most recent)
  const { data: weightData } = await supabase
    .from('weight_logs')
    .select('weight')
    .eq('user_email', userEmail)
    .order('date', { ascending: false })
    .limit(2);

  type WeightRow = { weight: number };
  const weights = weightData as WeightRow[] | null;
  const weight = weights?.[0]?.weight;
  const weightTrend = weights && weights.length >= 2
    ? (weights[0].weight > weights[1].weight ? 'up' : weights[0].weight < weights[1].weight ? 'down' : 'stable')
    : undefined;

  return {
    sleepScore: sleep?.score,
    sleepDuration: sleep?.duration_minutes,
    sleepQuality: sleep?.quality,
    hrvScore: metrics?.hrv,
    recoveryScore: metrics?.recovery_score,
    restingHeartRate: metrics?.resting_hr,
    steps: metrics?.steps,
    activeMinutes: metrics?.active_minutes,
    caloriesBurned: metrics?.calories_burned,
    glucoseAvg,
    glucoseTrend,
    weight,
    weightTrend,
  };
}

async function getScheduleSummary(
  userEmail: string,
  supabase: SupabaseClient
): Promise<ScheduleSummary> {
  const today = new Date();
  const todayStart = new Date(today.setHours(0, 0, 0, 0)).toISOString();
  const todayEnd = new Date(today.setHours(23, 59, 59, 999)).toISOString();

  const { data: events } = await supabase
    .from('calendar_events')
    .select('title, start_time, end_time')
    .eq('user_email', userEmail)
    .gte('start_time', todayStart)
    .lte('start_time', todayEnd)
    .order('start_time', { ascending: true });

  type EventRow = { title: string; start_time: string; end_time: string };
  const eventList = (events || []) as EventRow[];

  const totalMinutes = eventList.reduce((sum, e) => {
    const start = new Date(e.start_time).getTime();
    const end = new Date(e.end_time).getTime();
    return sum + (end - start) / (1000 * 60);
  }, 0);

  return {
    totalEvents: eventList.length,
    firstEvent: eventList[0] ? {
      title: eventList[0].title,
      time: new Date(eventList[0].start_time).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      }),
    } : undefined,
    busyHours: Math.round(totalMinutes / 60),
    conflictsCount: 0, // Could be calculated with overlap detection
  };
}

async function getGoalsSummary(
  userEmail: string,
  supabase: SupabaseClient
): Promise<GoalsSummary> {
  const today = new Date().toISOString().split('T')[0];
  const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const { data: goals } = await supabase
    .from('goals')
    .select('status, target_date')
    .eq('user_email', userEmail)
    .in('status', ['active', 'completed']);

  type GoalRow = { status: string; target_date: string };
  const goalList = (goals || []) as GoalRow[];

  const activeGoals = goalList.filter(g => g.status === 'active').length;
  const dueToday = goalList.filter(g => g.status === 'active' && g.target_date === today).length;
  const completedThisWeek = goalList.filter(
    g => g.status === 'completed' && g.target_date >= weekStart
  ).length;
  const behindSchedule = goalList.filter(
    g => g.status === 'active' && g.target_date < today
  ).length;

  return { activeGoals, dueToday, completedThisWeek, behindSchedule };
}

async function getStreaksSummary(
  userEmail: string,
  supabase: SupabaseClient
): Promise<StreaksSummary> {
  const { data: streaks } = await supabase
    .from('user_streaks')
    .select('streak_type, current_days, last_activity_date')
    .eq('user_email', userEmail);

  type StreakRow = { streak_type: string; current_days: number; last_activity_date: string };
  const streakList = (streaks || []) as StreakRow[];

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const activeStreaks = streakList.filter(s => s.current_days > 0).length;
  const atRiskStreaks = streakList.filter(
    s => s.current_days > 0 && s.last_activity_date < today && s.last_activity_date >= yesterday
  ).length;

  const longestStreak = streakList.reduce(
    (max, s) => (s.current_days > (max?.days || 0) ? { type: s.streak_type, days: s.current_days } : max),
    null as { type: string; days: number } | null
  );

  const totalStreakDays = streakList.reduce((sum, s) => sum + s.current_days, 0);

  return { activeStreaks, atRiskStreaks, longestStreak, totalStreakDays };
}

// ============================================================================
// Briefing Generation
// ============================================================================

function generateMorningBriefingText(
  health: HealthSummary,
  schedule: ScheduleSummary,
  goals: GoalsSummary,
  streaks: StreaksSummary,
  preferences: BriefingPreferences
): { text: string; highlights: string[] } {
  const parts: string[] = [];
  const highlights: string[] = [];

  // Greeting
  parts.push(getRandomElement(BRIEFING_TEMPLATES.morning.greeting));

  // Sleep summary
  if (health.sleepScore !== undefined) {
    const quality = getSleepQualityDescription(health.sleepScore);
    const duration = health.sleepDuration ? formatDuration(health.sleepDuration) : 'unknown duration';
    parts.push(`You had ${quality} sleep last night with a score of ${health.sleepScore}, sleeping for ${duration}.`);
    highlights.push(`Sleep: ${health.sleepScore}/100`);
  }

  // Recovery
  if (health.recoveryScore !== undefined) {
    const recovery = getRecoveryDescription(health.recoveryScore);
    parts.push(`Your recovery score is ${health.recoveryScore}%, meaning you're ${recovery}.`);
    highlights.push(`Recovery: ${health.recoveryScore}%`);
  }

  // HRV insight
  if (health.hrvScore !== undefined) {
    const hrvTrend = health.hrvScore >= 50 ? 'looking good' : 'a bit lower than usual';
    parts.push(`Your heart rate variability is ${health.hrvScore} milliseconds, which is ${hrvTrend}.`);
  }

  // Calendar
  if (preferences.includeCalendar && schedule.totalEvents > 0) {
    if (schedule.firstEvent) {
      parts.push(`You have ${schedule.totalEvents} event${schedule.totalEvents > 1 ? 's' : ''} today. Your first is "${schedule.firstEvent.title}" at ${schedule.firstEvent.time}.`);
      highlights.push(`${schedule.totalEvents} events today`);
    }
  } else if (preferences.includeCalendar) {
    parts.push("Your calendar is clear today.");
  }

  // Goals
  if (preferences.includeGoals && goals.activeGoals > 0) {
    if (goals.dueToday > 0) {
      parts.push(`You have ${goals.dueToday} goal${goals.dueToday > 1 ? 's' : ''} due today.`);
      highlights.push(`${goals.dueToday} goals due`);
    }
    if (goals.behindSchedule > 0) {
      parts.push(`${goals.behindSchedule} goal${goals.behindSchedule > 1 ? 's are' : ' is'} behind schedule.`);
    }
  }

  // Streaks
  if (preferences.includeStreaks && streaks.activeStreaks > 0) {
    if (streaks.atRiskStreaks > 0) {
      parts.push(`Heads up! ${streaks.atRiskStreaks} streak${streaks.atRiskStreaks > 1 ? 's are' : ' is'} at risk today. Don't forget to log your activities!`);
      highlights.push(`${streaks.atRiskStreaks} streaks at risk`);
    }
    if (streaks.longestStreak && streaks.longestStreak.days >= 7) {
      parts.push(`Your longest active streak is ${streaks.longestStreak.days} days on ${streaks.longestStreak.type.replace('_', ' ')}. Keep it up!`);
    }
  }

  // Closing
  parts.push(getRandomElement(BRIEFING_TEMPLATES.morning.closing));

  return { text: parts.join(' '), highlights };
}

function generateEveningBriefingText(
  health: HealthSummary,
  goals: GoalsSummary,
  streaks: StreaksSummary
): { text: string; highlights: string[] } {
  const parts: string[] = [];
  const highlights: string[] = [];

  parts.push(getRandomElement(BRIEFING_TEMPLATES.evening.greeting));

  // Activity summary
  if (health.steps !== undefined) {
    const stepGoalMet = health.steps >= 10000;
    parts.push(`You took ${health.steps.toLocaleString()} steps today${stepGoalMet ? ', hitting your goal!' : '.'}`);
    highlights.push(`${health.steps.toLocaleString()} steps`);
  }

  if (health.activeMinutes !== undefined) {
    parts.push(`You were active for ${health.activeMinutes} minutes.`);
    highlights.push(`${health.activeMinutes} active minutes`);
  }

  // Glucose (if tracked)
  if (health.glucoseAvg !== undefined) {
    const glucoseStatus = health.glucoseAvg >= 70 && health.glucoseAvg <= 140 ? 'in a healthy range' : 'worth monitoring';
    parts.push(`Your average glucose today was ${health.glucoseAvg} mg/dL, which is ${glucoseStatus}.`);
    highlights.push(`Glucose: ${health.glucoseAvg} mg/dL`);
  }

  // Goals progress
  if (goals.completedThisWeek > 0) {
    parts.push(`You've completed ${goals.completedThisWeek} goal${goals.completedThisWeek > 1 ? 's' : ''} this week.`);
  }

  // Streaks maintained
  if (streaks.totalStreakDays > 0) {
    parts.push(`You're maintaining ${streaks.activeStreaks} active streak${streaks.activeStreaks > 1 ? 's' : ''} totaling ${streaks.totalStreakDays} days.`);
  }

  parts.push(getRandomElement(BRIEFING_TEMPLATES.evening.closing));

  return { text: parts.join(' '), highlights };
}

function generateSleepBriefingText(health: HealthSummary): { text: string; highlights: string[] } {
  const parts: string[] = [];
  const highlights: string[] = [];

  parts.push(getRandomElement(BRIEFING_TEMPLATES.sleep_summary.greeting));

  if (health.sleepScore !== undefined) {
    const quality = getSleepQualityDescription(health.sleepScore);
    parts.push(`Your sleep score was ${health.sleepScore}, indicating ${quality} sleep.`);
    highlights.push(`Score: ${health.sleepScore}/100`);
  }

  if (health.sleepDuration !== undefined) {
    const hours = Math.floor(health.sleepDuration / 60);
    const mins = health.sleepDuration % 60;
    parts.push(`You slept for ${hours} hours and ${mins} minutes.`);
    highlights.push(`Duration: ${hours}h ${mins}m`);
  }

  if (health.hrvScore !== undefined) {
    parts.push(`Your overnight HRV was ${health.hrvScore} milliseconds.`);
  }

  if (health.restingHeartRate !== undefined) {
    parts.push(`Your resting heart rate was ${health.restingHeartRate} beats per minute.`);
    highlights.push(`RHR: ${health.restingHeartRate} bpm`);
  }

  parts.push(getRandomElement(BRIEFING_TEMPLATES.sleep_summary.closing));

  return { text: parts.join(' '), highlights };
}

// ============================================================================
// Audio Generation
// ============================================================================

async function generateAudio(
  text: string,
  voiceId: VoiceId
): Promise<{ audioUrl: string; durationSeconds: number } | null> {
  const elevenLabsKey = process.env.ELEVENLABS_API_KEY;

  if (!elevenLabsKey) {
    console.warn('ElevenLabs API key not configured, skipping audio generation');
    return null;
  }

  const voiceConfig = VOICE_CONFIG[voiceId];

  try {
    const response = await fetch(`${ELEVENLABS_API_URL}/text-to-speech/${voiceConfig.id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': elevenLabsKey,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true,
        },
      }),
    });

    if (!response.ok) {
      console.error('ElevenLabs API error:', response.status, await response.text());
      return null;
    }

    const audioBuffer = await response.arrayBuffer();

    // In production, you would upload this to S3/GCS and return the URL
    // For now, we'll create a data URL (not recommended for production)
    const base64Audio = Buffer.from(audioBuffer).toString('base64');
    const audioUrl = `data:audio/mpeg;base64,${base64Audio}`;

    // Estimate duration (rough: ~150 words per minute, ~5 chars per word)
    const wordCount = text.split(/\s+/).length;
    const durationSeconds = Math.round((wordCount / 150) * 60);

    return { audioUrl, durationSeconds };
  } catch (error) {
    console.error('Failed to generate audio:', error);
    return null;
  }
}

// ============================================================================
// Main Functions
// ============================================================================

export async function getUserBriefingPreferences(
  userEmail: string,
  supabase: SupabaseClient
): Promise<BriefingPreferences> {
  const { data } = await supabase
    .from('user_preferences')
    .select('voice_briefing_preferences')
    .eq('user_email', userEmail)
    .single();

  type PrefsRow = { voice_briefing_preferences?: Partial<BriefingPreferences> };
  const row = data as PrefsRow | null;

  return { ...DEFAULT_PREFERENCES, ...(row?.voice_briefing_preferences || {}) };
}

export async function updateBriefingPreferences(
  userEmail: string,
  preferences: Partial<BriefingPreferences>,
  supabase: SupabaseClient
): Promise<void> {
  const current = await getUserBriefingPreferences(userEmail, supabase);
  const updated = { ...current, ...preferences };

  await supabase
    .from('user_preferences')
    .upsert({
      user_email: userEmail,
      voice_briefing_preferences: updated,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_email',
    });
}

export async function generateBriefing(
  userEmail: string,
  type: BriefingType,
  supabase: SupabaseClient,
  options?: {
    includeAudio?: boolean;
    voiceOverride?: VoiceId;
  }
): Promise<VoiceBriefing> {
  const preferences = await getUserBriefingPreferences(userEmail, supabase);
  const voiceId = options?.voiceOverride || preferences.voiceId;
  const includeAudio = options?.includeAudio ?? true;

  // Fetch all relevant data
  const [health, schedule, goals, streaks] = await Promise.all([
    getHealthSummary(userEmail, supabase),
    getScheduleSummary(userEmail, supabase),
    getGoalsSummary(userEmail, supabase),
    getStreaksSummary(userEmail, supabase),
  ]);

  // Generate text based on briefing type
  let textResult: { text: string; highlights: string[] };

  switch (type) {
    case 'morning':
    case 'on_demand':
      textResult = generateMorningBriefingText(health, schedule, goals, streaks, preferences);
      break;
    case 'evening':
      textResult = generateEveningBriefingText(health, goals, streaks);
      break;
    case 'sleep_summary':
      textResult = generateSleepBriefingText(health);
      break;
    default:
      textResult = generateMorningBriefingText(health, schedule, goals, streaks, preferences);
  }

  // Generate audio if requested
  let audioData: { audioUrl: string; durationSeconds: number } | null = null;
  if (includeAudio) {
    audioData = await generateAudio(textResult.text, voiceId);
  }

  const briefing: VoiceBriefing = {
    id: generateId(),
    type,
    text: textResult.text,
    audioUrl: audioData?.audioUrl,
    audioDurationSeconds: audioData?.durationSeconds,
    highlights: textResult.highlights,
    generatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h
    voiceId,
    metadata: {
      sleepScore: health.sleepScore,
      recoveryScore: health.recoveryScore,
      activeGoals: goals.activeGoals,
      upcomingEvents: schedule.totalEvents,
      streaksAtRisk: streaks.atRiskStreaks,
    },
  };

  // Store briefing for later retrieval
  await supabase
    .from('voice_briefings')
    .insert({
      id: briefing.id,
      user_email: userEmail,
      type: briefing.type,
      text: briefing.text,
      highlights: briefing.highlights,
      metadata: briefing.metadata,
      voice_id: briefing.voiceId,
      generated_at: briefing.generatedAt,
      expires_at: briefing.expiresAt,
    });

  return briefing;
}

export async function getLatestBriefing(
  userEmail: string,
  type: BriefingType,
  supabase: SupabaseClient
): Promise<VoiceBriefing | null> {
  const { data } = await supabase
    .from('voice_briefings')
    .select('*')
    .eq('user_email', userEmail)
    .eq('type', type)
    .gt('expires_at', new Date().toISOString())
    .order('generated_at', { ascending: false })
    .limit(1)
    .single();

  if (!data) return null;

  type BriefingRow = {
    id: string;
    type: BriefingType;
    text: string;
    audio_url?: string;
    audio_duration_seconds?: number;
    highlights: string[];
    generated_at: string;
    expires_at: string;
    voice_id: VoiceId;
    metadata: Record<string, unknown>;
  };

  const row = data as BriefingRow;

  return {
    id: row.id,
    type: row.type,
    text: row.text,
    audioUrl: row.audio_url,
    audioDurationSeconds: row.audio_duration_seconds,
    highlights: row.highlights,
    generatedAt: row.generated_at,
    expiresAt: row.expires_at,
    voiceId: row.voice_id,
    metadata: row.metadata as VoiceBriefing['metadata'],
  };
}

export async function scheduleMorningBriefings(
  supabase: SupabaseClient
): Promise<{ scheduled: number; errors: number }> {
  // Get all users with voice briefings enabled
  const { data: users } = await supabase
    .from('user_preferences')
    .select('user_email, voice_briefing_preferences')
    .not('voice_briefing_preferences', 'is', null);

  if (!users) return { scheduled: 0, errors: 0 };

  type UserRow = { user_email: string; voice_briefing_preferences?: { enabled?: boolean } };
  const userList = users as UserRow[];

  let scheduled = 0;
  let errors = 0;

  for (const user of userList) {
    if (user.voice_briefing_preferences?.enabled) {
      try {
        await generateBriefing(user.user_email, 'morning', supabase, { includeAudio: true });
        scheduled++;
      } catch (error) {
        console.error(`Failed to generate briefing for ${user.user_email}:`, error);
        errors++;
      }
    }
  }

  return { scheduled, errors };
}

export function formatBriefingForAgent(briefing: VoiceBriefing): string {
  const lines = [
    '## Voice Briefing Summary',
    `Generated: ${new Date(briefing.generatedAt).toLocaleString()}`,
    '',
    '**Highlights:**',
    ...briefing.highlights.map(h => `- ${h}`),
    '',
    '**Full Text:**',
    briefing.text,
  ];

  if (briefing.metadata.streaksAtRisk && briefing.metadata.streaksAtRisk > 0) {
    lines.push('', `**Alert:** ${briefing.metadata.streaksAtRisk} streak(s) at risk today!`);
  }

  return lines.join('\n');
}
