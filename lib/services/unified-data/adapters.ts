/**
 * Unified Health Data Adapters
 *
 * Transforms provider-specific data formats into the unified health schema.
 * Each adapter normalizes data from a specific provider/data type.
 */

import {
  UnifiedHealthRecord,
  OuraSleepRecord,
  OuraReadinessRecord,
  OuraActivityRecord,
  WhoopRecoveryRecord,
  WhoopSleepRecord,
  WhoopWorkoutRecord,
  GmailBehavioralPatterns,
  DexcomGlucoseRecord,
  AppleHealthData,
  StravaActivityRecord,
  FitbitDayData,
  SpotifyListeningData,
  NotionProductivityData,
  LinearProductivityData,
} from './types';

// ============================================================================
// OURA ADAPTERS
// ============================================================================

/**
 * Transform Oura sleep data to unified format
 */
export function transformOuraSleep(
  email: string,
  record: OuraSleepRecord
): UnifiedHealthRecord {
  return {
    email,
    provider: 'oura',
    data_type: 'sleep',
    recorded_at: new Date(record.day),

    // Sleep metrics
    sleep_duration_hours: record.total_sleep_duration
      ? Number((record.total_sleep_duration / 3600).toFixed(2))
      : undefined,
    sleep_score: record.score,
    deep_sleep_minutes: record.deep_sleep_duration
      ? Math.round(record.deep_sleep_duration / 60)
      : undefined,
    rem_sleep_minutes: record.rem_sleep_duration
      ? Math.round(record.rem_sleep_duration / 60)
      : undefined,
    light_sleep_minutes: record.light_sleep_duration
      ? Math.round(record.light_sleep_duration / 60)
      : undefined,
    awake_minutes: record.awake_time
      ? Math.round(record.awake_time / 60)
      : undefined,
    sleep_efficiency: record.efficiency,
    bedtime_start: record.bedtime_start,
    bedtime_end: record.bedtime_end,

    // Recovery metrics from sleep
    hrv_avg: record.hrv?.average,
    resting_hr: record.heart_rate?.average,

    // Raw data
    provider_data: record as unknown as Record<string, unknown>,
  };
}

/**
 * Transform Oura readiness data to unified format
 */
export function transformOuraReadiness(
  email: string,
  record: OuraReadinessRecord
): UnifiedHealthRecord {
  return {
    email,
    provider: 'oura',
    data_type: 'recovery',
    recorded_at: new Date(record.day),

    readiness_score: record.score,
    body_temp_deviation: record.temperature_deviation,
    resting_hr: record.resting_heart_rate,
    hrv_avg: record.hrv_balance?.value,

    provider_data: record as unknown as Record<string, unknown>,
  };
}

/**
 * Transform Oura activity data to unified format
 */
export function transformOuraActivity(
  email: string,
  record: OuraActivityRecord
): UnifiedHealthRecord {
  const activeMinutes =
    ((record.high_activity_time || 0) + (record.medium_activity_time || 0)) / 60;

  return {
    email,
    provider: 'oura',
    data_type: 'activity',
    recorded_at: new Date(record.day),

    steps: record.steps,
    active_calories: record.active_calories,
    total_calories: record.total_calories,
    active_minutes: Math.round(activeMinutes),

    provider_data: record as unknown as Record<string, unknown>,
  };
}

// ============================================================================
// WHOOP ADAPTERS
// ============================================================================

/**
 * Transform Whoop recovery data to unified format
 */
export function transformWhoopRecovery(
  email: string,
  record: WhoopRecoveryRecord
): UnifiedHealthRecord {
  return {
    email,
    provider: 'whoop',
    data_type: 'recovery',
    recorded_at: new Date(record.created_at),

    recovery_score: record.score?.recovery_score,
    resting_hr: record.score?.resting_heart_rate,
    hrv_rmssd: record.score?.hrv_rmssd_milli,
    spo2_avg: record.score?.spo2_percentage,
    body_temp_deviation: record.score?.skin_temp_celsius,

    provider_data: record as unknown as Record<string, unknown>,
  };
}

/**
 * Transform Whoop sleep data to unified format
 */
export function transformWhoopSleep(
  email: string,
  record: WhoopSleepRecord
): UnifiedHealthRecord {
  const stages = record.score?.stage_summary;
  const totalSleepMs =
    (stages?.total_light_sleep_time_milli || 0) +
    (stages?.total_slow_wave_sleep_time_milli || 0) +
    (stages?.total_rem_sleep_time_milli || 0);

  return {
    email,
    provider: 'whoop',
    data_type: 'sleep',
    recorded_at: new Date(record.created_at),

    sleep_duration_hours: totalSleepMs
      ? Number((totalSleepMs / 3600000).toFixed(2))
      : undefined,
    deep_sleep_minutes: stages?.total_slow_wave_sleep_time_milli
      ? Math.round(stages.total_slow_wave_sleep_time_milli / 60000)
      : undefined,
    rem_sleep_minutes: stages?.total_rem_sleep_time_milli
      ? Math.round(stages.total_rem_sleep_time_milli / 60000)
      : undefined,
    light_sleep_minutes: stages?.total_light_sleep_time_milli
      ? Math.round(stages.total_light_sleep_time_milli / 60000)
      : undefined,
    awake_minutes: stages?.total_awake_time_milli
      ? Math.round(stages.total_awake_time_milli / 60000)
      : undefined,
    sleep_efficiency: record.score?.sleep_efficiency_percentage,
    respiratory_rate: record.score?.respiratory_rate,

    provider_data: record as unknown as Record<string, unknown>,
  };
}

/**
 * Transform Whoop workout data to unified format
 */
export function transformWhoopWorkout(
  email: string,
  record: WhoopWorkoutRecord
): UnifiedHealthRecord {
  const startTime = record.start ? new Date(record.start) : null;
  const endTime = record.end ? new Date(record.end) : null;
  const durationMinutes =
    startTime && endTime
      ? Math.round((endTime.getTime() - startTime.getTime()) / 60000)
      : undefined;

  // Map Whoop sport IDs to workout types
  const sportIdMap: Record<number, string> = {
    0: 'Running',
    1: 'Cycling',
    44: 'Walking',
    71: 'Weight Training',
    84: 'HIIT',
    63: 'CrossFit',
    42: 'Yoga',
    43: 'Stretching',
    [-1]: 'Other',
  };

  return {
    email,
    provider: 'whoop',
    data_type: 'workout',
    recorded_at: startTime || new Date(record.created_at),

    workout_type: record.sport_id !== undefined
      ? sportIdMap[record.sport_id] || `Sport ${record.sport_id}`
      : undefined,
    workout_duration_minutes: durationMinutes,
    workout_strain: record.score?.strain,
    avg_heart_rate: record.score?.average_heart_rate,
    max_heart_rate: record.score?.max_heart_rate,
    workout_calories: record.score?.kilojoule
      ? Math.round(record.score.kilojoule * 0.239) // kJ to kcal
      : undefined,
    distance_meters: record.score?.distance_meter
      ? Math.round(record.score.distance_meter)
      : undefined,

    provider_data: record as unknown as Record<string, unknown>,
  };
}

// ============================================================================
// GMAIL/SLACK ADAPTERS
// ============================================================================

/**
 * Transform Gmail behavioral patterns to unified format
 */
export function transformGmailPatterns(
  email: string,
  data: GmailBehavioralPatterns
): UnifiedHealthRecord {
  const patterns = data.patterns;

  return {
    email,
    provider: 'gmail',
    data_type: 'behavioral',
    recorded_at: new Date(data.sync_date),

    stress_score: patterns?.metrics?.stressScore,
    meeting_count: patterns?.meetingDensity?.avgMeetingsPerDay
      ? Math.round(patterns.meetingDensity.avgMeetingsPerDay)
      : undefined,
    meeting_minutes: patterns?.meetingDensity?.totalMeetingMinutes,
    email_count: patterns?.emailVolume?.total,
    after_hours_activity:
      patterns?.emailVolume?.afterHoursPercentage !== undefined
        ? patterns.emailVolume.afterHoursPercentage > 20
        : undefined,
    focus_time_minutes: patterns?.focusTime?.averageBlockMinutes,

    provider_data: data as unknown as Record<string, unknown>,
  };
}

/**
 * Transform Slack behavioral patterns to unified format
 */
export function transformSlackPatterns(
  email: string,
  data: {
    sync_date: string;
    patterns?: {
      messageCount?: number;
      afterHoursMessages?: number;
      channelActivity?: number;
      respondTime?: number;
    };
  }
): UnifiedHealthRecord {
  return {
    email,
    provider: 'slack',
    data_type: 'behavioral',
    recorded_at: new Date(data.sync_date),

    after_hours_activity: data.patterns?.afterHoursMessages
      ? data.patterns.afterHoursMessages > 10
      : undefined,

    provider_data: data as unknown as Record<string, unknown>,
  };
}

/**
 * Transform Outlook behavioral patterns to unified format
 * Same structure as Gmail patterns
 */
export function transformOutlookPatterns(
  email: string,
  data: GmailBehavioralPatterns
): UnifiedHealthRecord {
  const patterns = data.patterns;

  return {
    email,
    provider: 'outlook',
    data_type: 'behavioral',
    recorded_at: new Date(data.sync_date),

    stress_score: patterns?.metrics?.stressScore,
    meeting_count: patterns?.meetingDensity?.avgMeetingsPerDay
      ? Math.round(patterns.meetingDensity.avgMeetingsPerDay)
      : undefined,
    meeting_minutes: patterns?.meetingDensity?.totalMeetingMinutes,
    email_count: patterns?.emailVolume?.total,
    after_hours_activity:
      patterns?.emailVolume?.afterHoursPercentage !== undefined
        ? patterns.emailVolume.afterHoursPercentage > 20
        : undefined,
    focus_time_minutes: patterns?.focusTime?.averageBlockMinutes,

    provider_data: data as unknown as Record<string, unknown>,
  };
}

/**
 * Transform Teams behavioral patterns to unified format
 * Same structure as Slack patterns
 */
export function transformTeamsPatterns(
  email: string,
  data: {
    sync_date: string;
    patterns?: {
      metrics?: { stressScore?: number };
      messageVolume?: {
        total?: number;
        afterHoursPercentage?: number;
      };
      collaborationIntensity?: string;
    };
  }
): UnifiedHealthRecord {
  return {
    email,
    provider: 'teams',
    data_type: 'behavioral',
    recorded_at: new Date(data.sync_date),

    stress_score: data.patterns?.metrics?.stressScore,
    after_hours_activity: data.patterns?.messageVolume?.afterHoursPercentage
      ? data.patterns.messageVolume.afterHoursPercentage > 20
      : undefined,

    provider_data: data as unknown as Record<string, unknown>,
  };
}

// ============================================================================
// DEXCOM ADAPTERS
// ============================================================================

/**
 * Transform Dexcom glucose data to unified format
 */
export function transformDexcomGlucose(
  email: string,
  record: DexcomGlucoseRecord
): UnifiedHealthRecord {
  const analysis = record.analysis;

  return {
    email,
    provider: 'dexcom',
    data_type: 'glucose',
    recorded_at: new Date(record.timestamp),

    glucose_avg: analysis?.avgGlucose,
    glucose_min: analysis?.minGlucose,
    glucose_max: analysis?.maxGlucose,
    time_in_range_percent: analysis?.timeInRange,
    readings_count: analysis?.readings,

    provider_data: record as unknown as Record<string, unknown>,
  };
}

// ============================================================================
// APPLE HEALTH ADAPTERS
// ============================================================================

/**
 * Transform Apple Health sleep data to unified format
 */
export function transformAppleHealthSleep(
  email: string,
  data: AppleHealthData
): UnifiedHealthRecord {
  const sleep = data.sleep;

  return {
    email,
    provider: 'apple_health',
    data_type: 'sleep',
    recorded_at: data.date ? new Date(data.date) : new Date(),

    sleep_duration_hours: sleep?.totalDuration,
    deep_sleep_minutes: sleep?.deepSleep
      ? Math.round(sleep.deepSleep * 60)
      : undefined,
    rem_sleep_minutes: sleep?.remSleep
      ? Math.round(sleep.remSleep * 60)
      : undefined,
    awake_minutes: sleep?.awake
      ? Math.round(sleep.awake * 60)
      : undefined,
    sleep_efficiency: sleep?.efficiency,
    resting_hr: data.heartRate?.resting,

    provider_data: data as unknown as Record<string, unknown>,
  };
}

/**
 * Transform Apple Health activity data to unified format
 */
export function transformAppleHealthActivity(
  email: string,
  data: AppleHealthData
): UnifiedHealthRecord {
  return {
    email,
    provider: 'apple_health',
    data_type: 'activity',
    recorded_at: data.steps?.date ? new Date(data.steps.date) : new Date(),

    steps: data.steps?.total,
    active_calories: data.activeEnergy?.dailyAverage,
    total_calories: data.activeEnergy?.total,
    resting_hr: data.heartRate?.resting,

    provider_data: data as unknown as Record<string, unknown>,
  };
}

/**
 * Transform Apple Health workout data to unified format
 */
export function transformAppleHealthWorkout(
  email: string,
  data: AppleHealthData
): UnifiedHealthRecord | null {
  if (!data.workout) return null;

  return {
    email,
    provider: 'apple_health',
    data_type: 'workout',
    recorded_at: data.date ? new Date(data.date) : new Date(),

    workout_type: data.workout.type,
    workout_duration_minutes: data.workout.duration,
    workout_calories: data.workout.calories,
    avg_heart_rate: data.workout.avgHR,
    max_heart_rate: data.workout.maxHR,

    provider_data: data as unknown as Record<string, unknown>,
  };
}

// ============================================================================
// STRAVA ADAPTERS
// ============================================================================

/**
 * Transform Strava activity to unified format
 */
export function transformStravaActivity(
  email: string,
  activity: StravaActivityRecord
): UnifiedHealthRecord {
  return {
    email,
    provider: 'strava',
    data_type: 'workout',
    recorded_at: new Date(activity.start_date),

    workout_type: activity.type,
    workout_duration_minutes: activity.moving_time
      ? Math.round(activity.moving_time / 60)
      : undefined,
    distance_meters: activity.distance
      ? Math.round(activity.distance)
      : undefined,
    avg_heart_rate: activity.average_heartrate,
    max_heart_rate: activity.max_heartrate,
    workout_calories: activity.calories || (activity.kilojoules
      ? Math.round(activity.kilojoules * 0.239)
      : undefined),

    provider_data: activity as unknown as Record<string, unknown>,
  };
}

// ============================================================================
// FITBIT ADAPTERS
// ============================================================================

/**
 * Transform Fitbit day summary to unified activity format
 */
export function transformFitbitActivity(
  email: string,
  data: FitbitDayData
): UnifiedHealthRecord {
  const summary = data.summary;

  return {
    email,
    provider: 'fitbit',
    data_type: 'activity',
    recorded_at: new Date(data.date),

    steps: summary?.steps,
    total_calories: summary?.caloriesOut,
    active_minutes: summary?.activeMinutes,
    distance_meters: summary?.distances?.[0]?.distance
      ? Math.round(summary.distances[0].distance * 1000)
      : undefined,
    floors_climbed: summary?.floors,
    resting_hr: data.heartRate?.restingHeartRate,

    provider_data: data as unknown as Record<string, unknown>,
  };
}

/**
 * Transform Fitbit sleep data to unified format
 */
export function transformFitbitSleep(
  email: string,
  data: FitbitDayData
): UnifiedHealthRecord | null {
  const sleep = data.sleep;
  if (!sleep) return null;

  return {
    email,
    provider: 'fitbit',
    data_type: 'sleep',
    recorded_at: new Date(data.date),

    sleep_duration_hours: sleep.totalMinutesAsleep
      ? Number((sleep.totalMinutesAsleep / 60).toFixed(2))
      : undefined,
    sleep_efficiency: sleep.efficiency,
    deep_sleep_minutes: sleep.stages?.deep,
    rem_sleep_minutes: sleep.stages?.rem,
    light_sleep_minutes: sleep.stages?.light,
    awake_minutes: sleep.stages?.wake,
    resting_hr: data.heartRate?.restingHeartRate,

    provider_data: data as unknown as Record<string, unknown>,
  };
}

// ============================================================================
// SPOTIFY ADAPTERS
// ============================================================================

/**
 * Transform Spotify listening data to unified mood format
 */
export function transformSpotifyMood(
  email: string,
  data: SpotifyListeningData
): UnifiedHealthRecord {
  return {
    email,
    provider: 'spotify',
    data_type: 'mood',
    recorded_at: new Date(data.fetchedAt),

    mood_type: data.inferredMood,
    mood_confidence: data.moodConfidence
      ? Math.round(data.moodConfidence * 100)
      : undefined,
    energy_level: data.avgEnergy
      ? Math.round(data.avgEnergy * 100)
      : undefined,
    valence_score: data.avgValence
      ? Math.round(data.avgValence * 100)
      : undefined,
    late_night_activity: data.lateNightListening,

    provider_data: data as unknown as Record<string, unknown>,
  };
}

// ============================================================================
// NOTION ADAPTERS
// ============================================================================

/**
 * Transform Notion productivity data to unified format
 */
export function transformNotionProductivity(
  email: string,
  data: NotionProductivityData
): UnifiedHealthRecord {
  // Calculate task completion rate if we have enough data
  const completionRate = data.totalTasks > 0
    ? Math.round(((data.totalTasks - data.openTasks) / data.totalTasks) * 100)
    : undefined;

  // Count high priority items
  const highPriority = (data.tasksByPriority?.['High'] || 0) +
    (data.tasksByPriority?.['Urgent'] || 0);

  return {
    email,
    provider: 'notion',
    data_type: 'productivity',
    recorded_at: new Date(data.syncDate),

    open_tasks: data.openTasks,
    overdue_tasks: data.overdueTasks,
    tasks_due_soon: data.tasksDueSoon,
    high_priority_items: highPriority > 0 ? highPriority : undefined,
    task_completion_rate: completionRate,

    // Map overdue tasks to stress score (more overdue = higher stress)
    stress_score: data.overdueTasks > 0
      ? Math.min(100, data.overdueTasks * 10 + data.tasksDueSoon * 5)
      : undefined,

    provider_data: data as unknown as Record<string, unknown>,
  };
}

// ============================================================================
// LINEAR ADAPTERS
// ============================================================================

/**
 * Transform Linear productivity data to unified format
 */
export function transformLinearProductivity(
  email: string,
  data: LinearProductivityData
): UnifiedHealthRecord {
  // Calculate completion rate
  const completionRate = data.totalIssues > 0
    ? Math.round(((data.totalIssues - data.openIssues) / data.totalIssues) * 100)
    : undefined;

  return {
    email,
    provider: 'linear',
    data_type: 'productivity',
    recorded_at: new Date(data.syncDate),

    open_tasks: data.openIssues,
    overdue_tasks: data.overdueIssues,
    tasks_due_soon: data.issuesDueSoon,
    urgent_issues: data.urgentIssues,
    high_priority_items: data.highPriorityIssues,
    task_completion_rate: completionRate,

    // Map urgent + overdue issues to stress score
    stress_score: (data.urgentIssues > 0 || data.overdueIssues > 0)
      ? Math.min(100, data.urgentIssues * 15 + data.overdueIssues * 10 + data.issuesDueSoon * 3)
      : undefined,

    provider_data: data as unknown as Record<string, unknown>,
  };
}

// ============================================================================
// BATCH TRANSFORM UTILITIES
// ============================================================================

/**
 * Transform multiple Oura sleep records
 */
export function transformOuraSleepBatch(
  email: string,
  records: OuraSleepRecord[]
): UnifiedHealthRecord[] {
  return records.map((record) => transformOuraSleep(email, record));
}

/**
 * Transform multiple Whoop recovery records
 */
export function transformWhoopRecoveryBatch(
  email: string,
  records: WhoopRecoveryRecord[]
): UnifiedHealthRecord[] {
  return records.map((record) => transformWhoopRecovery(email, record));
}

/**
 * Transform multiple Strava activities
 */
export function transformStravaActivityBatch(
  email: string,
  activities: StravaActivityRecord[]
): UnifiedHealthRecord[] {
  return activities.map((activity) => transformStravaActivity(email, activity));
}
