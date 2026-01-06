import { NextRequest, NextResponse } from 'next/server';
import { getValidatedAccessToken } from '@/lib/services/token-manager';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { runHealthAnalysis } from '@/lib/services/health-pattern-analyzer';
import { circuitBreakers, CircuitOpenError } from '@/lib/utils/circuit-breaker';

// Validation function to test if Whoop token is valid
async function validateWhoopToken(token: string): Promise<boolean> {
  try {
    // Quick API call to validate token - use user profile endpoint (lightweight)
    const response = await fetch('https://api.prod.whoop.com/developer/v1/user/profile/basic', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Helper function to look up user's unique code from onboarding data
async function getUserCode(email: string): Promise<string | null> {
  const supabase = createAdminClient();

  // Try forge_onboarding_data first
  const { data: forgeData } = await supabase
    .from('forge_onboarding_data')
    .select('form_data')
    .eq('email', email)
    .single();

  if (forgeData?.form_data?.uniqueCode) {
    return forgeData.form_data.uniqueCode;
  }

  // Try sage_onboarding_data
  const { data: sageData } = await supabase
    .from('sage_onboarding_data')
    .select('form_data')
    .eq('email', email)
    .single();

  if (sageData?.form_data?.uniqueCode) {
    return sageData.form_data.uniqueCode;
  }

  return null;
}

// ============================================================================
// TYPES
// ============================================================================

interface WhoopRecovery {
  score: number; // 0-100
  resting_heart_rate: number;
  hrv_rmssd: number; // HRV in milliseconds
  spo2_percentage?: number;
  skin_temp_celsius?: number;
}

interface WhoopWorkout {
  id: number;
  sport_id: number;
  strain: number; // 0-21
  average_heart_rate: number;
  max_heart_rate: number;
  kilojoules: number;
  distance_meter?: number;
  duration_millis: number;
  created_at: string;
}

interface WhoopSleep {
  id: number;
  score: number; // 0-100
  duration_millis: number;
  sleep_efficiency: number; // percentage
  respiratory_rate: number;
  stage_summary: {
    total_light_sleep_time_millis: number;
    total_slow_wave_sleep_time_millis: number; // Deep sleep
    total_rem_sleep_time_millis: number;
    total_awake_time_millis: number;
  };
}

interface WhoopCycle {
  id: number;
  days: string[];
  score: {
    strain: number; // 0-21
    kilojoule: number;
    average_heart_rate: number;
    max_heart_rate: number;
  };
  recovery?: WhoopRecovery;
  sleep?: WhoopSleep;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Categorize recovery score
 */
function categorizeRecovery(score: number): 'green' | 'yellow' | 'red' {
  if (score >= 67) return 'green';  // High recovery
  if (score >= 34) return 'yellow'; // Moderate recovery
  return 'red'; // Low recovery
}

/**
 * Analyze recovery trends
 */
function analyzeRecoveryTrends(cycles: WhoopCycle[]) {
  const recoveryScores = cycles
    .filter(c => c.recovery)
    .map(c => c.recovery!.score);

  if (recoveryScores.length === 0) {
    return {
      avgRecoveryScore: 0,
      trend: 'stable',
      greenDays: 0,
      yellowDays: 0,
      redDays: 0,
    };
  }

  const avgRecoveryScore = recoveryScores.reduce((sum, s) => sum + s, 0) / recoveryScores.length;

  // Count recovery zone days
  let greenDays = 0;
  let yellowDays = 0;
  let redDays = 0;

  recoveryScores.forEach(score => {
    const category = categorizeRecovery(score);
    if (category === 'green') greenDays++;
    else if (category === 'yellow') yellowDays++;
    else redDays++;
  });

  // Simple trend detection (comparing first half to second half)
  const midpoint = Math.floor(recoveryScores.length / 2);
  const firstHalfAvg = recoveryScores.slice(0, midpoint).reduce((sum, s) => sum + s, 0) / midpoint;
  const secondHalfAvg = recoveryScores.slice(midpoint).reduce((sum, s) => sum + s, 0) / (recoveryScores.length - midpoint);

  let trend: 'improving' | 'stable' | 'declining' = 'stable';
  if (secondHalfAvg > firstHalfAvg + 5) trend = 'improving';
  else if (secondHalfAvg < firstHalfAvg - 5) trend = 'declining';

  return {
    avgRecoveryScore: Math.round(avgRecoveryScore),
    trend,
    greenDays,
    yellowDays,
    redDays,
  };
}

/**
 * Analyze HRV trends
 */
function analyzeHRVTrends(cycles: WhoopCycle[]) {
  const hrvValues = cycles
    .filter(c => c.recovery?.hrv_rmssd)
    .map(c => c.recovery!.hrv_rmssd);

  if (hrvValues.length === 0) {
    return {
      avgHRV: 0,
      trend: 'stable',
      baseline: 0,
    };
  }

  const avgHRV = Math.round(hrvValues.reduce((sum, v) => sum + v, 0) / hrvValues.length);
  const baseline = Math.round(hrvValues.slice(0, 7).reduce((sum, v) => sum + v, 0) / Math.min(7, hrvValues.length));

  // Trend detection
  const midpoint = Math.floor(hrvValues.length / 2);
  const firstHalfAvg = hrvValues.slice(0, midpoint).reduce((sum, v) => sum + v, 0) / midpoint;
  const secondHalfAvg = hrvValues.slice(midpoint).reduce((sum, v) => sum + v, 0) / (hrvValues.length - midpoint);

  let trend: 'improving' | 'stable' | 'declining' = 'stable';
  if (secondHalfAvg > firstHalfAvg + 3) trend = 'improving';
  else if (secondHalfAvg < firstHalfAvg - 3) trend = 'declining';

  return {
    avgHRV,
    trend,
    baseline,
  };
}

/**
 * Analyze strain patterns
 */
function analyzeStrainPatterns(cycles: WhoopCycle[]) {
  const strainValues = cycles
    .filter(c => c.score?.strain)
    .map(c => c.score.strain);

  if (strainValues.length === 0) {
    return {
      avgDailyStrain: 0,
      optimalStrainRange: [10, 15],
      overreachingDays: 0,
    };
  }

  const avgDailyStrain = strainValues.reduce((sum, s) => sum + s, 0) / strainValues.length;
  const overreachingDays = strainValues.filter(s => s > 18).length; // Strain > 18 is very high

  // Optimal strain based on recovery
  const cyclesWithRecovery = cycles.filter(c => c.recovery && c.score);
  const avgRecovery = cyclesWithRecovery.length > 0
    ? cyclesWithRecovery.reduce((sum, c) => sum + c.recovery!.score, 0) / cyclesWithRecovery.length
    : 75;

  // Higher recovery = can handle more strain
  const optimalStrainRange: [number, number] = avgRecovery >= 67
    ? [12, 17]  // Green recovery
    : avgRecovery >= 34
    ? [10, 14]  // Yellow recovery
    : [8, 12];  // Red recovery

  return {
    avgDailyStrain: Math.round(avgDailyStrain * 10) / 10,
    optimalStrainRange,
    overreachingDays,
  };
}

// ============================================================================
// MAIN ENDPOINT
// ============================================================================

/**
 * POST /api/whoop/fetch-data
 *
 * Fetch recovery and training data from Whoop
 */
export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    console.log(`[Whoop Fetch] Starting data fetch for ${email}`);

    // Get user code - use provided code or look it up from onboarding data
    const userCode = code || await getUserCode(email);
    if (userCode) {
      console.log(`[Whoop Fetch] Using user code: ${userCode}`);
    }

    // Get access token using token-manager with validation (auto-refreshes if invalid)
    const { token, error: tokenError, wasRefreshed } = await getValidatedAccessToken(
      email,
      'whoop',
      userCode,
      validateWhoopToken  // Validates token against Whoop API, refreshes if invalid
    );

    if (wasRefreshed) {
      console.log(`[Whoop Fetch] Token was refreshed for ${email}`);
    }

    if (!token || tokenError) {
      console.error('[Whoop Fetch] Token error:', tokenError);
      return NextResponse.json(
        { error: 'Not authenticated with Whoop', details: tokenError },
        { status: 401 }
      );
    }

    // Date ranges (past 30 days)
    const endDate = new Date();
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const totalDays = 30;

    console.log(`[Whoop Fetch] Fetching cycles from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Fetch cycles (Whoop's main data structure - contains strain data)
    // Note: Recovery data requires separate /v1/recovery endpoint call
    // Use circuit breaker to protect against cascading failures
    let cyclesResponse: Response;
    try {
      cyclesResponse = await circuitBreakers.whoop.execute(async () => {
        return fetch(
          `https://api.prod.whoop.com/developer/v1/cycle?start=${startDate.toISOString()}&end=${endDate.toISOString()}&limit=25`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json'
            }
          }
        );
      });
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        console.warn('[Whoop Fetch] Circuit breaker open for Whoop API');
        return NextResponse.json(
          { error: 'Whoop service temporarily unavailable. Please try again later.' },
          { status: 503 }
        );
      }
      throw error;
    }

    if (!cyclesResponse.ok) {
      const errorData = await cyclesResponse.json().catch(() => ({}));
      console.error('[Whoop Fetch] API error:', errorData);
      // Treat 5xx errors as failures for circuit breaker
      if (cyclesResponse.status >= 500) {
        throw new Error(`Whoop API error: ${cyclesResponse.status}`);
      }
      return NextResponse.json(
        { error: 'Failed to fetch Whoop cycles', details: errorData },
        { status: cyclesResponse.status }
      );
    }

    const cyclesData = await cyclesResponse.json();
    // Whoop API returns { records: [...] } not a direct array
    const cycles: WhoopCycle[] = cyclesData.records || cyclesData || [];
    console.log(`[Whoop Fetch] Retrieved ${cycles.length} cycles`);

    // Fetch recovery data separately (Whoop API requires separate endpoint)
    let recoveryData: any[] = [];
    try {
      const recoveryResponse = await circuitBreakers.whoop.execute(async () => {
        return fetch(
          `https://api.prod.whoop.com/developer/v2/recovery?start=${startDate.toISOString()}&end=${endDate.toISOString()}&limit=25`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json'
            }
          }
        );
      });

      if (recoveryResponse.ok) {
        const recoveryJson = await recoveryResponse.json();
        recoveryData = recoveryJson.records || recoveryJson || [];
        console.log(`[Whoop Fetch] Retrieved ${recoveryData.length} recovery records`);

        // Merge recovery data into cycles by matching cycle_id
        for (const cycle of cycles) {
          const matchingRecovery = recoveryData.find((r: any) => r.cycle_id === cycle.id);
          if (matchingRecovery) {
            cycle.recovery = {
              score: matchingRecovery.score?.recovery_score || 0,
              resting_heart_rate: matchingRecovery.score?.resting_heart_rate || 0,
              hrv_rmssd: matchingRecovery.score?.hrv_rmssd_milli || 0,
              spo2_percentage: matchingRecovery.score?.spo2_percentage,
              skin_temp_celsius: matchingRecovery.score?.skin_temp_celsius,
            };
          }
        }
        console.log(`[Whoop Fetch] Merged recovery data into ${cycles.filter(c => c.recovery).length} cycles`);
      } else {
        const errorText = await recoveryResponse.text();
        console.warn(`[Whoop Fetch] Recovery endpoint returned ${recoveryResponse.status}: ${errorText}`);
      }
    } catch (recoveryError) {
      console.warn('[Whoop Fetch] Failed to fetch recovery data:', recoveryError);
      // Continue without recovery data - strain data is still useful
    }

    // Analyze recovery trends
    const recoveryAnalysis = analyzeRecoveryTrends(cycles);

    // Analyze HRV trends
    const hrvAnalysis = analyzeHRVTrends(cycles);

    // Analyze strain patterns
    const strainAnalysis = analyzeStrainPatterns(cycles);

    // Calculate resting HR trend
    const restingHRValues = cycles
      .filter(c => c.recovery?.resting_heart_rate)
      .map(c => c.recovery!.resting_heart_rate);
    const avgRestingHR = restingHRValues.length > 0
      ? Math.round(restingHRValues.reduce((sum, hr) => sum + hr, 0) / restingHRValues.length)
      : 0;

    // Determine if deload is needed
    const needsRest = recoveryAnalysis.redDays > 3 || recoveryAnalysis.avgRecoveryScore < 50;
    const recommendedRestDays = needsRest ? 2 : 1;

    // Optimal training days (based on recovery patterns)
    const optimalTrainingDays: string[] = [];
    const recentCycles = cycles.slice(-7); // Last week
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    recentCycles.forEach((cycle, idx) => {
      if (cycle.recovery && categorizeRecovery(cycle.recovery.score) === 'green') {
        const dayIndex = (new Date().getDay() + idx) % 7;
        optimalTrainingDays.push(daysOfWeek[dayIndex]);
      }
    });

    // Build patterns object
    const patterns = {
      recovery: recoveryAnalysis,
      strain: strainAnalysis,
      hrvTrends: hrvAnalysis,
      restingHR: {
        avg: avgRestingHR,
        trend: 'stable', // Would need historical comparison
      },
      recommendations: {
        restDaysNeeded: recommendedRestDays,
        optimalTrainingDays: optimalTrainingDays.length > 0 ? optimalTrainingDays : ['Mon', 'Wed', 'Fri'],
        deloadWeekRecommended: recoveryAnalysis.redDays > 5,
      },
    };

    // Calculate metrics
    const recoveryScore = recoveryAnalysis.avgRecoveryScore;
    const overtrainingRisk = recoveryAnalysis.redDays > 5 || strainAnalysis.overreachingDays > 3
      ? 'high'
      : recoveryAnalysis.redDays > 3
      ? 'moderate'
      : 'low';

    const metrics = {
      recoveryScore,
      strainScore: Math.round(strainAnalysis.avgDailyStrain * 5), // Convert 0-21 to 0-100 scale
      overtrainingRisk,
      hrvHealth: hrvAnalysis.avgHRV >= 60 ? 'good' : hrvAnalysis.avgHRV >= 40 ? 'moderate' : 'poor',
    };

    // Store in database (use admin client to bypass RLS for server-side operations)
    const supabase = createAdminClient();

    // Update or insert training data
    const { error: trainingDataError } = await supabase
      .from('forge_training_data')
      .upsert({
        email,
        provider: 'whoop',
        workouts: [], // Whoop workouts would go here if we fetch them separately
        recovery_score: recoveryAnalysis,
        hrv_trends: hrvAnalysis,
        resting_hr_trends: { avg: avgRestingHR, trend: 'stable' },
        data_period_start: startDate.toISOString().split('T')[0],
        data_period_end: endDate.toISOString().split('T')[0],
        data_points_analyzed: cycles.length,
        sync_date: new Date().toISOString(),
      }, {
        onConflict: 'email,provider',
        ignoreDuplicates: false,
      });

    if (trainingDataError) {
      console.error('[Whoop Fetch] Database error (training_data):', trainingDataError);
    }

    // Store workout patterns
    const { error: patternsError } = await supabase
      .from('forge_workout_patterns')
      .upsert({
        email,
        source: 'whoop',
        patterns,
        metrics,
        data_period_start: startDate.toISOString().split('T')[0],
        data_period_end: endDate.toISOString().split('T')[0],
        data_points_analyzed: cycles.length,
        sync_date: new Date().toISOString(),
      }, {
        onConflict: 'email,source',
        ignoreDuplicates: false,
      });

    if (patternsError) {
      console.error('[Whoop Fetch] Database error (patterns):', patternsError);
    }

    console.log(`[Whoop Fetch] Successfully completed for ${email}`);

    // =====================================================
    // TRIGGER HEALTH PATTERN ANALYSIS (Pro/Max feature)
    // Analyze trends and correlate with life events
    // =====================================================
    let healthAnalysisResult = null;
    try {
      const adminClient = createAdminClient();

      // Check if user is Pro/Max
      const { data: userData } = await adminClient
        .from('users')
        .select('subscription_tier')
        .eq('email', email)
        .single();

      const isPremium = userData?.subscription_tier === 'pro' || userData?.subscription_tier === 'max';

      if (isPremium) {
        console.log(`[Whoop Fetch] Running health pattern analysis for ${email} (${userData?.subscription_tier} tier)`);

        // Prepare Whoop data for analysis
        const whoopData = {
          recoveryData: cycles
            .filter(c => c.recovery)
            .map(c => ({
              date: c.days?.[0],
              recovery_score: c.recovery!.score,
              hrv_rmssd_milli: c.recovery!.hrv_rmssd,
            })),
          sleepData: cycles
            .filter(c => c.sleep)
            .map(c => ({
              date: c.days?.[0],
              quality_duration_ms: c.sleep!.duration_millis,
              sleep_performance_percentage: c.sleep!.sleep_efficiency,
            })),
        };

        // Run health analysis (detects patterns + correlates with life events)
        healthAnalysisResult = await runHealthAnalysis(email, null, whoopData, null);

        console.log(`[Whoop Fetch] Health analysis complete: ${healthAnalysisResult.patterns.length} patterns, ${healthAnalysisResult.correlations.length} correlations`);
      }
    } catch (analysisError) {
      // Don't fail the fetch if analysis fails
      console.error('[Whoop Fetch] Health analysis error (non-fatal):', analysisError);
    }

    return NextResponse.json({
      success: true,
      cyclesAnalyzed: cycles.length,
      patterns,
      metrics,
      dataPeriod: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0],
      },
      healthAnalysis: healthAnalysisResult ? {
        patterns: healthAnalysisResult.patterns.length,
        correlations: healthAnalysisResult.correlations.length,
        summary: healthAnalysisResult.summary,
      } : null,
    });

  } catch (error) {
    console.error('[Whoop Fetch] Unexpected error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch Whoop data',
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
