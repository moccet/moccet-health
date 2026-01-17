/**
 * Activity Inference Service
 *
 * Infers user activities from wearable data (Whoop, Oura, Strava, Apple Health).
 * Used by the Insight Enhancer Agent to provide activity-specific recommendations.
 *
 * @module lib/services/activity-inference-service
 */

import { createAdminClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('ActivityInferenceService');

// ============================================================================
// TYPES
// ============================================================================

export interface ActivityInference {
  inferredActivities: string[];      // All detected activities
  primaryActivity: string | null;    // Most frequent activity
  activityFrequency: Record<string, number>; // Activity -> count
  totalWorkouts: number;
  lastInferred: string;
  dataSource: 'whoop' | 'oura' | 'strava' | 'apple_health' | 'combined';
  averageWeeklyFrequency: number;    // Avg workouts per week
  activityStats: ActivityStats[];
}

export interface ActivityStats {
  activity: string;
  count: number;
  avgDurationMins: number;
  avgStrain?: number;          // Whoop strain
  avgCalories?: number;
  lastPerformed?: string;
}

// Whoop sport_id to activity name mapping
// Based on Whoop API documentation
const WHOOP_SPORT_MAP: Record<number, string> = {
  [-1]: 'other',
  0: 'running',
  1: 'cycling',
  16: 'cycling',  // Indoor cycling
  17: 'cycling',  // Mountain biking
  2: 'baseball',
  3: 'basketball',
  4: 'rowing',
  5: 'boxing',
  6: 'crossfit',
  7: 'ice_hockey',
  8: 'mma',
  9: 'powerlifting',
  10: 'rock_climbing',
  11: 'rugby',
  12: 'soccer',
  13: 'squash',
  14: 'swimming',
  15: 'tennis',
  18: 'walking',
  19: 'lacrosse',
  20: 'cricket',
  21: 'yoga',
  22: 'pilates',
  23: 'golf',
  24: 'football',
  25: 'volleyball',
  26: 'hiking',
  27: 'weightlifting',
  28: 'strength_training',
  29: 'functional_fitness',
  30: 'meditation',
  31: 'breathwork',
  32: 'sauna',
  33: 'cold_exposure',
  34: 'hiit',
  35: 'dancing',
  36: 'skiing',
  37: 'snowboarding',
  38: 'surfing',
  39: 'skateboarding',
  40: 'martial_arts',
  41: 'stretching',
  42: 'elliptical',
  43: 'stair_climbing',
  44: 'spinning',
  45: 'assault_bike',
  46: 'rucking',
  47: 'paddle_boarding',
  48: 'kayaking',
  49: 'triathlon',
  50: 'track_and_field',
  63: 'peloton',
  71: 'orangetheory',
  82: 'f45',
  84: 'barry_bootcamp',
};

// Activity categories for grouping
const ACTIVITY_CATEGORIES: Record<string, string[]> = {
  running: ['running', 'track_and_field', 'triathlon'],
  cycling: ['cycling', 'spinning', 'peloton'],
  swimming: ['swimming', 'triathlon'],
  strength: ['weightlifting', 'strength_training', 'powerlifting', 'crossfit', 'functional_fitness', 'f45'],
  cardio: ['hiit', 'elliptical', 'stair_climbing', 'assault_bike', 'orangetheory', 'barry_bootcamp'],
  yoga_wellness: ['yoga', 'pilates', 'meditation', 'breathwork', 'stretching'],
  outdoor: ['hiking', 'skiing', 'snowboarding', 'surfing', 'kayaking', 'paddle_boarding', 'rucking'],
  team_sports: ['basketball', 'soccer', 'volleyball', 'football', 'baseball', 'ice_hockey', 'rugby', 'lacrosse', 'cricket'],
  combat: ['boxing', 'mma', 'martial_arts'],
  racquet: ['tennis', 'squash'],
  recovery: ['sauna', 'cold_exposure', 'walking'],
};

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Infer user's activities from wearable data
 */
export async function inferUserActivities(email: string): Promise<ActivityInference> {
  logger.info('Inferring activities for user', { email });

  const supabase = createAdminClient();

  // Try to get cached inference first (less than 24 hours old)
  const { data: cachedProfile } = await supabase
    .from('user_location_profile')
    .select('inferred_activities, primary_activity, activity_frequency, last_activity_inference')
    .eq('email', email)
    .single();

  if (cachedProfile?.last_activity_inference) {
    const lastInferred = new Date(cachedProfile.last_activity_inference);
    const hoursSinceInference = (Date.now() - lastInferred.getTime()) / (1000 * 60 * 60);

    if (hoursSinceInference < 24 && cachedProfile.inferred_activities?.length > 0) {
      logger.info('Using cached activity inference', { email, age_hours: hoursSinceInference });
      return {
        inferredActivities: cachedProfile.inferred_activities,
        primaryActivity: cachedProfile.primary_activity,
        activityFrequency: cachedProfile.activity_frequency || {},
        totalWorkouts: Object.values(cachedProfile.activity_frequency || {}).reduce((a: number, b) => a + (b as number), 0) as number,
        lastInferred: cachedProfile.last_activity_inference,
        dataSource: 'combined',
        averageWeeklyFrequency: 0,
        activityStats: [],
      };
    }
  }

  // Fetch workout data from multiple sources
  const [whoopWorkouts, ouraWorkouts, stravaWorkouts] = await Promise.all([
    fetchWhoopWorkouts(email, supabase),
    fetchOuraWorkouts(email, supabase),
    fetchStravaWorkouts(email, supabase),
  ]);

  // Combine and analyze activities
  const allWorkouts = [
    ...whoopWorkouts.map(w => ({ ...w, source: 'whoop' as const })),
    ...ouraWorkouts.map(w => ({ ...w, source: 'oura' as const })),
    ...stravaWorkouts.map(w => ({ ...w, source: 'strava' as const })),
  ];

  if (allWorkouts.length === 0) {
    logger.info('No workout data found', { email });
    return {
      inferredActivities: [],
      primaryActivity: null,
      activityFrequency: {},
      totalWorkouts: 0,
      lastInferred: new Date().toISOString(),
      dataSource: 'combined',
      averageWeeklyFrequency: 0,
      activityStats: [],
    };
  }

  // Calculate activity frequency
  const activityFrequency: Record<string, number> = {};
  const activityDurations: Record<string, number[]> = {};
  const activityCalories: Record<string, number[]> = {};
  const activityStrains: Record<string, number[]> = {};
  const activityLastPerformed: Record<string, string> = {};

  for (const workout of allWorkouts) {
    const activity = workout.activity;
    activityFrequency[activity] = (activityFrequency[activity] || 0) + 1;

    if (!activityDurations[activity]) activityDurations[activity] = [];
    if (!activityCalories[activity]) activityCalories[activity] = [];
    if (!activityStrains[activity]) activityStrains[activity] = [];

    if (workout.durationMins) activityDurations[activity].push(workout.durationMins);
    if (workout.calories) activityCalories[activity].push(workout.calories);
    if (workout.strain) activityStrains[activity].push(workout.strain);

    if (workout.date && (!activityLastPerformed[activity] || workout.date > activityLastPerformed[activity])) {
      activityLastPerformed[activity] = workout.date;
    }
  }

  // Sort activities by frequency
  const sortedActivities = Object.entries(activityFrequency)
    .sort((a, b) => b[1] - a[1])
    .map(([activity]) => activity);

  const primaryActivity = sortedActivities[0] || null;

  // Calculate activity stats
  const activityStats: ActivityStats[] = sortedActivities.map(activity => ({
    activity,
    count: activityFrequency[activity],
    avgDurationMins: activityDurations[activity]?.length > 0
      ? Math.round(activityDurations[activity].reduce((a, b) => a + b, 0) / activityDurations[activity].length)
      : 0,
    avgCalories: activityCalories[activity]?.length > 0
      ? Math.round(activityCalories[activity].reduce((a, b) => a + b, 0) / activityCalories[activity].length)
      : undefined,
    avgStrain: activityStrains[activity]?.length > 0
      ? Math.round(activityStrains[activity].reduce((a, b) => a + b, 0) / activityStrains[activity].length * 10) / 10
      : undefined,
    lastPerformed: activityLastPerformed[activity],
  }));

  // Calculate average weekly frequency
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const recentWorkouts = allWorkouts.filter(w => w.date && new Date(w.date) >= thirtyDaysAgo);
  const averageWeeklyFrequency = Math.round((recentWorkouts.length / 30) * 7 * 10) / 10;

  const inference: ActivityInference = {
    inferredActivities: sortedActivities,
    primaryActivity,
    activityFrequency,
    totalWorkouts: allWorkouts.length,
    lastInferred: new Date().toISOString(),
    dataSource: 'combined',
    averageWeeklyFrequency,
    activityStats,
  };

  // Cache the inference
  await updateUserLocationProfile(email, inference, supabase);

  logger.info('Activity inference complete', {
    email,
    activities: sortedActivities.length,
    primary: primaryActivity,
    totalWorkouts: allWorkouts.length,
  });

  return inference;
}

/**
 * Get activity category for a given activity
 */
export function getActivityCategory(activity: string): string | null {
  for (const [category, activities] of Object.entries(ACTIVITY_CATEGORIES)) {
    if (activities.includes(activity)) {
      return category;
    }
  }
  return null;
}

/**
 * Get search terms for an activity (used for Google Places API)
 */
export function getActivitySearchTerms(activity: string): string[] {
  const searchTermsMap: Record<string, string[]> = {
    running: ['running club', 'running group', 'parkrun', 'track club', 'marathon training'],
    cycling: ['cycling club', 'bike club', 'cycling group', 'velodrome', 'indoor cycling'],
    swimming: ['swimming club', 'masters swimming', 'swim team', 'lap pool', 'aquatic center'],
    weightlifting: ['gym', 'fitness center', 'weight training', 'powerlifting gym'],
    strength_training: ['gym', 'fitness center', 'strength training'],
    crossfit: ['crossfit box', 'crossfit gym', 'functional fitness'],
    yoga: ['yoga studio', 'yoga class', 'hot yoga', 'vinyasa yoga'],
    pilates: ['pilates studio', 'pilates class', 'reformer pilates'],
    hiit: ['hiit class', 'fitness studio', 'bootcamp', 'circuit training'],
    boxing: ['boxing gym', 'boxing club', 'kickboxing'],
    mma: ['mma gym', 'martial arts studio', 'jiu jitsu'],
    rock_climbing: ['climbing gym', 'bouldering gym', 'rock climbing'],
    tennis: ['tennis club', 'tennis court', 'tennis center'],
    basketball: ['basketball court', 'recreation center', 'sports center'],
    soccer: ['soccer club', 'football club', 'sports field'],
    golf: ['golf course', 'golf club', 'driving range'],
    hiking: ['hiking group', 'outdoor club', 'trail running'],
    skiing: ['ski resort', 'ski school', 'ski club'],
    surfing: ['surf school', 'surf shop', 'surf club'],
  };

  return searchTermsMap[activity] || ['gym', 'fitness center', 'sports club'];
}

// ============================================================================
// DATA FETCHING FUNCTIONS
// ============================================================================

interface WorkoutRecord {
  activity: string;
  durationMins: number;
  calories?: number;
  strain?: number;
  date: string;
}

/**
 * Fetch Whoop workout data
 */
async function fetchWhoopWorkouts(email: string, supabase: ReturnType<typeof createAdminClient>): Promise<WorkoutRecord[]> {
  try {
    // Fetch from whoop_webhook_data table
    const { data: webhookData } = await supabase
      .from('whoop_webhook_data')
      .select('data, event_type, created_at')
      .eq('email', email)
      .eq('event_type', 'workout.updated')
      .order('created_at', { ascending: false })
      .limit(100);

    if (!webhookData || webhookData.length === 0) {
      // Try forge_training_data as fallback
      const { data: trainingData } = await supabase
        .from('forge_training_data')
        .select('workout_patterns, created_at')
        .eq('email', email)
        .eq('source', 'whoop')
        .order('created_at', { ascending: false })
        .limit(1);

      if (trainingData?.[0]?.workout_patterns) {
        const patterns = trainingData[0].workout_patterns as Record<string, unknown>;
        const workoutTypes = (patterns.workoutTypes || {}) as Record<string, number>;
        return Object.entries(workoutTypes).map(([activity, count]) => ({
          activity: activity.toLowerCase().replace(/\s+/g, '_'),
          durationMins: 60, // Default estimate
          date: trainingData[0].created_at,
          // Spread count across the activity
        })).flatMap(w => Array(Math.min(w.durationMins as unknown as number || 1, 20)).fill(w));
      }

      return [];
    }

    const workouts: WorkoutRecord[] = [];

    for (const record of webhookData) {
      const data = record.data as Record<string, unknown>;
      const workout = data.workout || data.record || data;

      // Get sport_id and map to activity
      const sportId = (workout as Record<string, unknown>).sport_id as number | undefined;
      const activity = sportId !== undefined ? (WHOOP_SPORT_MAP[sportId] || 'other') : 'other';

      // Get duration in minutes
      const score = (workout as Record<string, unknown>).score as Record<string, unknown> | undefined;
      const durationMs = score?.zone_duration as Record<string, unknown>;
      let totalDurationMs = 0;
      if (durationMs) {
        for (const zone of Object.values(durationMs)) {
          if (typeof zone === 'number') totalDurationMs += zone;
        }
      }
      const durationMins = Math.round(totalDurationMs / 60000) || 30;

      // Get strain and calories
      const strain = score?.strain as number | undefined;
      const kilojoules = score?.kilojoule as number | undefined;
      const calories = kilojoules ? Math.round(kilojoules / 4.184) : undefined;

      workouts.push({
        activity,
        durationMins,
        strain,
        calories,
        date: record.created_at,
      });
    }

    return workouts;
  } catch (error) {
    logger.error('Error fetching Whoop workouts', error);
    return [];
  }
}

/**
 * Fetch Oura workout/activity data
 */
async function fetchOuraWorkouts(email: string, supabase: ReturnType<typeof createAdminClient>): Promise<WorkoutRecord[]> {
  try {
    const { data: ouraData } = await supabase
      .from('oura_data')
      .select('activity_data, workouts_data, created_at')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1);

    if (!ouraData || ouraData.length === 0) return [];

    const workouts: WorkoutRecord[] = [];
    const workoutsData = ouraData[0].workouts_data as Array<Record<string, unknown>> | null;

    if (workoutsData && Array.isArray(workoutsData)) {
      for (const workout of workoutsData) {
        const activity = (workout.activity || workout.sport || 'other') as string;
        const durationMins = Math.round(((workout.duration || workout.total_seconds || 0) as number) / 60);
        const calories = workout.calories as number | undefined;

        workouts.push({
          activity: activity.toLowerCase().replace(/\s+/g, '_'),
          durationMins: durationMins || 30,
          calories,
          date: (workout.day || workout.start_datetime || ouraData[0].created_at) as string,
        });
      }
    }

    return workouts;
  } catch (error) {
    logger.error('Error fetching Oura workouts', error);
    return [];
  }
}

/**
 * Fetch Strava workout data
 */
async function fetchStravaWorkouts(email: string, supabase: ReturnType<typeof createAdminClient>): Promise<WorkoutRecord[]> {
  try {
    const { data: stravaData } = await supabase
      .from('strava_data')
      .select('activities, created_at')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1);

    if (!stravaData || stravaData.length === 0) return [];

    const workouts: WorkoutRecord[] = [];
    const activities = stravaData[0].activities as Array<Record<string, unknown>> | null;

    if (activities && Array.isArray(activities)) {
      for (const activity of activities) {
        const type = (activity.type || activity.sport_type || 'other') as string;
        const durationSecs = (activity.elapsed_time || activity.moving_time || 0) as number;
        const durationMins = Math.round(durationSecs / 60);
        const calories = activity.calories as number | undefined;

        // Map Strava types to normalized names
        const normalizedType = type.toLowerCase()
          .replace('virtualrun', 'running')
          .replace('virtualride', 'cycling')
          .replace('ride', 'cycling')
          .replace('run', 'running')
          .replace('swim', 'swimming')
          .replace('walk', 'walking')
          .replace('hike', 'hiking')
          .replace('workout', 'strength_training')
          .replace(/\s+/g, '_');

        workouts.push({
          activity: normalizedType,
          durationMins: durationMins || 30,
          calories,
          date: (activity.start_date || stravaData[0].created_at) as string,
        });
      }
    }

    return workouts;
  } catch (error) {
    logger.error('Error fetching Strava workouts', error);
    return [];
  }
}

/**
 * Update user location profile with inferred activities
 */
async function updateUserLocationProfile(
  email: string,
  inference: ActivityInference,
  supabase: ReturnType<typeof createAdminClient>
): Promise<void> {
  try {
    const { error } = await supabase
      .from('user_location_profile')
      .upsert({
        email,
        inferred_activities: inference.inferredActivities,
        primary_activity: inference.primaryActivity,
        activity_frequency: inference.activityFrequency,
        last_activity_inference: inference.lastInferred,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'email',
      });

    if (error) {
      logger.error('Error updating user location profile', error);
    }
  } catch (error) {
    logger.error('Error in updateUserLocationProfile', error);
  }
}

/**
 * Get formatted activity summary for display
 */
export function formatActivitySummary(inference: ActivityInference): string {
  if (inference.inferredActivities.length === 0) {
    return 'No activity data available';
  }

  const parts: string[] = [];

  if (inference.primaryActivity) {
    const stats = inference.activityStats.find(s => s.activity === inference.primaryActivity);
    const formattedActivity = inference.primaryActivity.replace(/_/g, ' ');
    parts.push(`Primary activity: ${formattedActivity} (${stats?.count || 0} sessions)`);
  }

  if (inference.averageWeeklyFrequency > 0) {
    parts.push(`Average ${inference.averageWeeklyFrequency} workouts/week`);
  }

  const topActivities = inference.activityStats.slice(0, 3);
  if (topActivities.length > 1) {
    const others = topActivities.slice(1).map(s =>
      `${s.activity.replace(/_/g, ' ')} (${s.count})`
    ).join(', ');
    parts.push(`Also active in: ${others}`);
  }

  return parts.join('\n');
}
