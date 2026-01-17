/**
 * Unified Health Data Types
 *
 * Defines the normalized schema for health data from all providers.
 * These types map directly to the unified_health_data and unified_health_daily tables.
 */

export type HealthProvider =
  | 'oura'
  | 'whoop'
  | 'gmail'
  | 'slack'
  | 'dexcom'
  | 'apple_health'
  | 'strava'
  | 'fitbit'
  | 'garmin'
  | 'teams'
  | 'outlook'
  | 'spotify'
  | 'notion'
  | 'linear';

export type HealthDataType =
  | 'sleep'
  | 'recovery'
  | 'activity'
  | 'workout'
  | 'stress'
  | 'glucose'
  | 'behavioral'
  | 'mood'
  | 'productivity';

export interface UnifiedHealthRecord {
  email: string;
  recorded_at: Date | string;
  provider: HealthProvider;
  data_type: HealthDataType;

  // Sleep fields
  sleep_duration_hours?: number;
  sleep_score?: number;
  deep_sleep_minutes?: number;
  rem_sleep_minutes?: number;
  light_sleep_minutes?: number;
  awake_minutes?: number;
  sleep_efficiency?: number;
  bedtime_start?: Date | string;
  bedtime_end?: Date | string;

  // Recovery fields
  recovery_score?: number;
  readiness_score?: number;
  strain_score?: number;
  hrv_avg?: number;
  hrv_rmssd?: number;
  resting_hr?: number;
  respiratory_rate?: number;
  spo2_avg?: number;
  body_temp_deviation?: number;

  // Activity fields
  steps?: number;
  active_calories?: number;
  total_calories?: number;
  active_minutes?: number;
  distance_meters?: number;
  floors_climbed?: number;

  // Workout fields
  workout_type?: string;
  workout_duration_minutes?: number;
  workout_calories?: number;
  avg_heart_rate?: number;
  max_heart_rate?: number;
  workout_strain?: number;

  // Glucose fields
  glucose_avg?: number;
  glucose_min?: number;
  glucose_max?: number;
  time_in_range_percent?: number;
  readings_count?: number;

  // Stress/Behavioral fields
  stress_score?: number;
  meeting_count?: number;
  meeting_minutes?: number;
  email_count?: number;
  after_hours_activity?: boolean;
  focus_time_minutes?: number;

  // Mood fields (Spotify)
  mood_type?: 'happy' | 'calm' | 'energetic' | 'melancholy' | 'focused' | 'anxious' | 'mixed';
  mood_confidence?: number;
  energy_level?: number; // 0-100
  valence_score?: number; // 0-100 (positivity)
  late_night_activity?: boolean;

  // Productivity fields (Notion/Linear)
  open_tasks?: number;
  overdue_tasks?: number;
  tasks_due_soon?: number;
  urgent_issues?: number;
  high_priority_items?: number;
  task_completion_rate?: number;

  // Raw provider data
  provider_data?: Record<string, unknown>;
}

export interface UnifiedHealthDaily {
  email: string;
  date: Date | string;

  // Sleep
  sleep_hours?: number;
  sleep_score?: number;
  deep_sleep_minutes?: number;
  rem_sleep_minutes?: number;
  sleep_efficiency?: number;
  sleep_provider?: string;

  // Recovery
  recovery_score?: number;
  readiness_score?: number;
  hrv_avg?: number;
  resting_hr?: number;
  recovery_provider?: string;

  // Activity
  steps?: number;
  active_calories?: number;
  active_minutes?: number;
  workout_count?: number;
  total_workout_minutes?: number;
  activity_provider?: string;

  // Glucose
  glucose_avg?: number;
  time_in_range_percent?: number;
  glucose_provider?: string;

  // Behavioral/Stress
  stress_score?: number;
  stress_level?: 'low' | 'moderate' | 'high' | 'very_high';
  meeting_count?: number;
  meeting_minutes?: number;
  focus_time_minutes?: number;
  behavioral_provider?: string;

  // Metadata
  providers_reporting?: string[];
  data_quality_score?: number;
  overall_status?: 'thriving' | 'stable' | 'needs_attention' | 'concerning';
  key_insights?: Array<{
    type: string;
    message: string;
    severity: string;
  }>;
}

// Provider-specific input types for adapters

export interface OuraSleepRecord {
  day: string;
  score?: number;
  total_sleep_duration?: number; // seconds
  deep_sleep_duration?: number; // seconds
  rem_sleep_duration?: number; // seconds
  light_sleep_duration?: number; // seconds
  awake_time?: number; // seconds
  efficiency?: number;
  bedtime_start?: string;
  bedtime_end?: string;
  heart_rate?: { average?: number };
  hrv?: { average?: number };
  contributors?: Record<string, unknown>;
}

export interface OuraReadinessRecord {
  day: string;
  score?: number;
  temperature_deviation?: number;
  previous_night_score?: number;
  hrv_balance?: { value?: number };
  resting_heart_rate?: number;
  contributors?: Record<string, unknown>;
}

export interface OuraActivityRecord {
  day: string;
  score?: number;
  steps?: number;
  active_calories?: number;
  total_calories?: number;
  high_activity_time?: number; // seconds
  medium_activity_time?: number; // seconds
  low_activity_time?: number; // seconds
  inactivity_alerts?: number;
}

export interface WhoopRecoveryRecord {
  cycle_id: number;
  created_at: string;
  score_state?: string;
  score?: {
    recovery_score?: number;
    resting_heart_rate?: number;
    hrv_rmssd_milli?: number;
    spo2_percentage?: number;
    skin_temp_celsius?: number;
  };
}

export interface WhoopSleepRecord {
  id: number;
  created_at: string;
  score_state?: string;
  score?: {
    stage_summary?: {
      total_in_bed_time_milli?: number;
      total_light_sleep_time_milli?: number;
      total_slow_wave_sleep_time_milli?: number;
      total_rem_sleep_time_milli?: number;
      total_awake_time_milli?: number;
    };
    sleep_efficiency_percentage?: number;
    respiratory_rate?: number;
  };
}

export interface WhoopWorkoutRecord {
  id: number;
  created_at: string;
  sport_id?: number;
  score?: {
    strain?: number;
    average_heart_rate?: number;
    max_heart_rate?: number;
    kilojoule?: number;
    distance_meter?: number;
  };
  start?: string;
  end?: string;
}

export interface GmailBehavioralPatterns {
  sync_date: string;
  patterns?: {
    metrics?: {
      stressScore?: number;
    };
    meetingDensity?: {
      avgMeetingsPerDay?: number;
      totalMeetingMinutes?: number;
    };
    emailVolume?: {
      total?: number;
      afterHoursPercentage?: number;
    };
    focusTime?: {
      averageBlockMinutes?: number;
    };
  };
}

export interface DexcomGlucoseRecord {
  timestamp: string;
  egv_data?: Array<{
    value: number;
    displayTime?: string;
    trend?: string;
  }>;
  analysis?: {
    avgGlucose?: number;
    minGlucose?: number;
    maxGlucose?: number;
    timeInRange?: number;
    readings?: number;
  };
}

export interface AppleHealthData {
  date?: string;
  sleep?: {
    totalDuration?: number; // hours
    deepSleep?: number; // hours
    remSleep?: number; // hours
    awake?: number; // hours
    efficiency?: number;
  };
  steps?: {
    total?: number;
    date?: string;
  };
  heartRate?: {
    resting?: number;
    average?: number;
  };
  activeEnergy?: {
    dailyAverage?: number;
    total?: number;
  };
  workout?: {
    type?: string;
    duration?: number; // minutes
    calories?: number;
    avgHR?: number;
    maxHR?: number;
  };
}

export interface StravaActivityRecord {
  id: number;
  type: string;
  start_date: string;
  moving_time?: number; // seconds
  distance?: number; // meters
  average_heartrate?: number;
  max_heartrate?: number;
  calories?: number;
  kilojoules?: number;
}

export interface FitbitDayData {
  date: string;
  summary?: {
    steps?: number;
    caloriesOut?: number;
    activeMinutes?: number;
    distances?: Array<{ distance: number }>;
    floors?: number;
  };
  sleep?: {
    totalMinutesAsleep?: number;
    efficiency?: number;
    stages?: {
      deep?: number;
      rem?: number;
      light?: number;
      wake?: number;
    };
  };
  heartRate?: {
    restingHeartRate?: number;
  };
}

export interface SpotifyListeningData {
  fetchedAt: string;
  recentTracks: Array<{
    id: string;
    name: string;
    artist: string;
    playedAt: string;
    durationMs: number;
  }>;
  avgEnergy: number; // 0-1
  avgValence: number; // 0-1
  avgTempo: number; // BPM
  avgDanceability: number; // 0-1
  inferredMood: 'happy' | 'calm' | 'energetic' | 'melancholy' | 'focused' | 'anxious' | 'mixed';
  moodConfidence: number; // 0-1
  listeningHours: string[];
  avgTracksPerDay: number;
  topGenres: string[];
  moodTrend: 'improving' | 'stable' | 'declining';
  lateNightListening: boolean;
  emotionalVolatility: 'low' | 'medium' | 'high';
  insights: string[];
}

export interface NotionProductivityData {
  syncDate: string;
  workspaceName: string;
  totalDatabases: number;
  totalTasks: number;
  openTasks: number;
  overdueTasks: number;
  tasksDueSoon: number;
  tasksByStatus: Record<string, number>;
  tasksByPriority: Record<string, number>;
  recentActivity: Array<{
    title: string;
    status?: string;
    dueDate?: string;
    lastEdited: string;
  }>;
  insights: string[];
}

export interface LinearProductivityData {
  syncDate: string;
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
}
