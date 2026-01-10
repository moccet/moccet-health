import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/services/token-manager';
import { createClient } from '@/lib/supabase/server';

// ============================================================================
// TYPES
// ============================================================================

interface StravaActivity {
  id: number;
  name: string;
  type: string; // 'Run', 'Ride', 'Swim', 'WeightTraining', etc.
  start_date: string;
  elapsed_time: number; // seconds
  moving_time: number; // seconds
  distance: number; // meters
  average_heartrate?: number;
  max_heartrate?: number;
  suffer_score?: number; // Strava's intensity metric
  calories?: number;
}

interface ProcessedWorkout {
  id: string;
  type: string;
  startTime: string;
  duration: number; // minutes
  distance?: number; // meters
  heartRateZones?: Record<string, number>;
  avgHeartRate?: number;
  calories?: number;
  intensity: 'low' | 'moderate' | 'high';
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Categorize workout type into standard categories
 */
function categorizeWorkoutType(stravaType: string): string {
  const type = stravaType.toLowerCase();

  if (type.includes('run') || type === 'virtualrun') return 'run';
  if (type.includes('ride') || type.includes('bike') || type === 'virtualride') return 'bike';
  if (type.includes('swim')) return 'swim';
  if (type.includes('weight') || type.includes('strength')) return 'strength';
  if (type.includes('hiit') || type.includes('workout')) return 'hiit';
  if (type.includes('yoga')) return 'flexibility';
  if (type.includes('walk') || type === 'hike') return 'walking';

  return 'other';
}

/**
 * Estimate intensity from heart rate or suffer score
 */
function estimateIntensity(avgHR?: number, sufferScore?: number): 'low' | 'moderate' | 'high' {
  // If we have suffer score (Strava's metric), use that
  if (sufferScore !== undefined) {
    if (sufferScore > 150) return 'high';
    if (sufferScore > 50) return 'moderate';
    return 'low';
  }

  // Otherwise use heart rate zones (rough estimates)
  if (avgHR !== undefined) {
    if (avgHR > 160) return 'high';
    if (avgHR > 130) return 'moderate';
    return 'low';
  }

  // Default to moderate if no data
  return 'moderate';
}

/**
 * Estimate heart rate zones from average HR
 * This is a rough estimation - ideally we'd get detailed zone data from Strava
 */
function estimateHRZones(avgHR: number, maxHR: number = 185): Record<string, number> {
  // Rough zone estimates based on average HR
  // This is simplified - real implementation would need detailed HR data per second

  const hrPercent = (avgHR / maxHR) * 100;

  if (hrPercent > 90) {
    // Zone 5 dominant
    return { zone1: 5, zone2: 10, zone3: 15, zone4: 20, zone5: 50 };
  } else if (hrPercent > 80) {
    // Zone 4 dominant
    return { zone1: 5, zone2: 15, zone3: 20, zone4: 50, zone5: 10 };
  } else if (hrPercent > 70) {
    // Zone 3 dominant
    return { zone1: 10, zone2: 20, zone3: 50, zone4: 15, zone5: 5 };
  } else if (hrPercent > 60) {
    // Zone 2 dominant
    return { zone1: 15, zone2: 60, zone3: 20, zone4: 5, zone5: 0 };
  } else {
    // Zone 1 dominant
    return { zone1: 70, zone2: 25, zone3: 5, zone4: 0, zone5: 0 };
  }
}

/**
 * Calculate training patterns from workouts
 */
function analyzeWorkoutPatterns(workouts: ProcessedWorkout[], totalDays: number) {
  if (workouts.length === 0) {
    return {
      weeklyVolume: 0,
      avgWorkoutDuration: 0,
      workoutFrequency: 0,
      intensityDistribution: { zone1: 0, zone2: 0, zone3: 0, zone4: 0, zone5: 0 },
      workoutDistribution: {},
      performanceTrends: {},
    };
  }

  // Weekly volume
  const totalMinutes = workouts.reduce((sum, w) => sum + w.duration, 0);
  const weeksInPeriod = totalDays / 7;
  const weeklyVolume = Math.round(totalMinutes / weeksInPeriod);

  // Avg duration
  const avgWorkoutDuration = Math.round(totalMinutes / workouts.length);

  // Frequency
  const workoutFrequency = Math.round(workouts.length / weeksInPeriod);

  // Workout type distribution
  const workoutDistribution: Record<string, number> = {};
  workouts.forEach(w => {
    workoutDistribution[w.type] = (workoutDistribution[w.type] || 0) + 1;
  });

  // Intensity distribution (averaged across all workouts with HR data)
  const workoutsWithHR = workouts.filter(w => w.heartRateZones);
  const intensityDistribution = workoutsWithHR.length > 0
    ? workoutsWithHR.reduce((acc, w) => {
        if (w.heartRateZones) {
          Object.entries(w.heartRateZones).forEach(([zone, percent]) => {
            acc[zone] = (acc[zone] || 0) + percent;
          });
        }
        return acc;
      }, {} as Record<string, number>)
    : { zone1: 20, zone2: 40, zone3: 25, zone4: 10, zone5: 5 }; // Default if no HR data

  // Normalize intensity distribution
  if (workoutsWithHR.length > 0) {
    Object.keys(intensityDistribution).forEach(zone => {
      intensityDistribution[zone] = Math.round(intensityDistribution[zone] / workoutsWithHR.length);
    });
  }

  // Performance trends (simplified - would need historical comparison in production)
  const performanceTrends = {
    consistency: Math.min(100, (workouts.length / (totalDays / 7) / 5) * 100), // 5 workouts/week = 100%
    trend: 'stable', // Would need historical data to determine
  };

  return {
    weeklyVolume,
    avgWorkoutDuration,
    workoutFrequency,
    intensityDistribution,
    workoutDistribution,
    performanceTrends,
  };
}

// ============================================================================
// MAIN ENDPOINT
// ============================================================================

/**
 * POST /api/strava/fetch-data
 *
 * Fetch workout data from Strava and analyze training patterns
 */
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    console.log(`[Strava Fetch] Starting data fetch for ${email}`);

    // Get access token using token-manager
    const { token, error: tokenError } = await getAccessToken(email, 'strava');

    if (!token || tokenError) {
      console.error('[Strava Fetch] Token error:', tokenError);
      return NextResponse.json(
        { error: 'Not authenticated with Strava', details: tokenError },
        { status: 401 }
      );
    }

    // Date ranges (past 30 days)
    const endDate = new Date();
    const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const unixStart = Math.floor(startDate.getTime() / 1000);
    const totalDays = 30;

    console.log(`[Strava Fetch] Fetching activities from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Fetch activities from Strava API
    const activitiesResponse = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?after=${unixStart}&per_page=200`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      }
    );

    if (!activitiesResponse.ok) {
      const errorData = await activitiesResponse.json().catch(() => ({}));
      console.error('[Strava Fetch] API error:', errorData);
      return NextResponse.json(
        { error: 'Failed to fetch Strava activities', details: errorData },
        { status: activitiesResponse.status }
      );
    }

    const activities: StravaActivity[] = await activitiesResponse.json();
    console.log(`[Strava Fetch] Retrieved ${activities.length} activities`);

    // Process workouts
    const processedWorkouts: ProcessedWorkout[] = activities.map(activity => ({
      id: activity.id.toString(),
      type: categorizeWorkoutType(activity.type),
      startTime: activity.start_date,
      duration: Math.round(activity.moving_time / 60), // Convert to minutes
      distance: activity.distance,
      avgHeartRate: activity.average_heartrate,
      heartRateZones: activity.average_heartrate && activity.max_heartrate
        ? estimateHRZones(activity.average_heartrate, activity.max_heartrate)
        : undefined,
      calories: activity.calories,
      intensity: estimateIntensity(activity.average_heartrate, activity.suffer_score)
    }));

    // Analyze patterns
    const patterns = analyzeWorkoutPatterns(processedWorkouts, totalDays);

    // Calculate metrics
    const trainingScore = Math.min(100, (patterns.weeklyVolume / 300) * 100); // 300 min/week = 100 score
    const consistencyScore = typeof patterns.performanceTrends === 'object' && 'consistency' in patterns.performanceTrends
      ? patterns.performanceTrends.consistency
      : 50;

    // Simple overtraining risk based on volume
    let overtrainingRisk: 'none' | 'low' | 'moderate' | 'high' = 'none';
    if (patterns.weeklyVolume > 600) overtrainingRisk = 'moderate';
    if (patterns.weeklyVolume > 800) overtrainingRisk = 'high';

    const metrics = {
      trainingScore: Math.round(trainingScore),
      consistencyScore: Math.round(consistencyScore),
      overtrainingRisk,
      performanceScore: 75, // Would calculate from actual performance data
    };

    // Store in database
    const supabase = await createClient();

    // Store raw training data
    const { error: trainingDataError } = await supabase
      .from('forge_training_data')
      .insert({
        email,
        provider: 'strava',
        workouts: processedWorkouts,
        weekly_volume: patterns.weeklyVolume,
        avg_workout_duration: patterns.avgWorkoutDuration,
        workout_frequency: patterns.workoutFrequency,
        intensity_distribution: patterns.intensityDistribution,
        performance_trends: patterns.performanceTrends,
        data_period_start: startDate.toISOString().split('T')[0],
        data_period_end: endDate.toISOString().split('T')[0],
        data_points_analyzed: processedWorkouts.length,
      });

    if (trainingDataError) {
      console.error('[Strava Fetch] Database insert error (training_data):', trainingDataError);
    }

    // Store analyzed patterns
    const { error: patternsError } = await supabase
      .from('forge_workout_patterns')
      .insert({
        email,
        source: 'strava',
        patterns: {
          trainingLoad: {
            weeklyMinutes: patterns.weeklyVolume,
            trend: 'stable',
            status: patterns.weeklyVolume >= 180 && patterns.weeklyVolume <= 600 ? 'optimal' : 'suboptimal',
          },
          workoutDistribution: patterns.workoutDistribution,
          intensityDistribution: patterns.intensityDistribution,
          performanceTrends: patterns.performanceTrends,
        },
        metrics,
        data_period_start: startDate.toISOString().split('T')[0],
        data_period_end: endDate.toISOString().split('T')[0],
        data_points_analyzed: processedWorkouts.length,
      });

    if (patternsError) {
      console.error('[Strava Fetch] Database insert error (patterns):', patternsError);
    }

    console.log(`[Strava Fetch] Successfully completed for ${email}`);

    return NextResponse.json({
      success: true,
      workoutsAnalyzed: processedWorkouts.length,
      patterns: {
        weeklyVolume: patterns.weeklyVolume,
        workoutFrequency: patterns.workoutFrequency,
        workoutDistribution: patterns.workoutDistribution,
        intensityDistribution: patterns.intensityDistribution,
      },
      metrics,
      dataPeriod: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
      }
    });

  } catch (error) {
    console.error('[Strava Fetch] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch Strava data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint (legacy support)
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    error: 'Please use POST method with email in request body',
    example: { email: 'user@example.com' }
  }, { status: 400 });
}
