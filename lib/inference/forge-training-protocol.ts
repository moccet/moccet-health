/**
 * Forge Training Protocol Inference (Advanced)
 *
 * Data-driven training analysis using actual workout data from Strava/Whoop/Fitbit.
 * This is the enhanced Forge version that uses real workout data vs Sage's questionnaire-based version.
 *
 * @module lib/inference/forge-training-protocol
 */

import type { EcosystemFetchResult } from '@/lib/services/ecosystem-fetcher';
import { createClient } from '@/lib/supabase/server';

// ============================================================================
// TYPES
// ============================================================================

export interface ForgeTrainingProtocolInput {
  email: string;
  ecosystemData: EcosystemFetchResult;
  questionnaireData?: {
    trainingGoal?: string;
    availableEquipment?: string[];
    timeAvailability?: number; // minutes per day
  };
}

export interface WorkoutPattern {
  type: 'run' | 'bike' | 'swim' | 'strength' | 'hiit' | 'sports' | 'other';
  frequency: number; // per week
  avgDuration: number; // minutes
  intensityFocus: 'low' | 'moderate' | 'high';
}

export interface ForgeTrainingProtocolResult {
  trainingVolume: {
    weeklyMinutes: number;
    trend: 'increasing' | 'stable' | 'decreasing';
    recommendation: 'increase' | 'maintain' | 'reduce' | 'deload';
    acwr?: number; // Acute:Chronic Workload Ratio
  };
  intensityDistribution: {
    zone1_recovery: number; // percentage
    zone2_base: number;
    zone3_tempo: number;
    zone4_threshold: number;
    zone5_max: number;
    polarizationIndex: number; // 0-100, higher = more polarized
  };
  workoutTypes: WorkoutPattern[];
  performance: {
    trend: 'improving' | 'stable' | 'declining';
    recentPRs: number;
    trainingEffectiveness: number; // 0-100
    consistencyScore: number; // 0-100
  };
  recovery: {
    adequateRecovery: boolean;
    avgRecoveryScore: number; // 0-100 (from Whoop)
    hrvTrend: 'improving' | 'stable' | 'declining';
    overtrainingRisk: 'none' | 'low' | 'moderate' | 'high';
    recommendedRestDays: number;
  };
  nutritionTiming: {
    preWorkoutCarbs: string;
    intraWorkoutFueling: string;
    postWorkoutRecovery: string;
    dailyProtein: string;
    dailyCarbs: string;
  };
  confidence: number; // 0-100
  dataSource: string;
  insights: string[];
  recommendations: string[];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate polarization index from intensity distribution
 * Polarized training = lots of easy (Z1-2) + lots of hard (Z4-5), minimal Z3
 */
function calculatePolarizationIndex(zones: Record<string, number>): number {
  const easyWork = (zones.zone1_recovery || 0) + (zones.zone2_base || 0);
  const hardWork = (zones.zone4_threshold || 0) + (zones.zone5_max || 0);
  const moderateWork = zones.zone3_tempo || 0;

  // Ideal polarization: >70% easy, <5% moderate, >20% hard
  const polarizationScore = (easyWork * 0.4) + (hardWork * 0.4) - (moderateWork * 0.8);

  return Math.max(0, Math.min(100, polarizationScore));
}

/**
 * Infer training goal from patterns
 */
function inferTrainingGoal(
  workoutTypes: WorkoutPattern[],
  weeklyVolume: number,
  intensityDist: Record<string, number>
): 'muscle_gain' | 'athletic_performance' | 'fat_loss' | 'general_health' | 'endurance' {
  const strengthCount = workoutTypes.filter(w => w.type === 'strength').reduce((sum, w) => sum + w.frequency, 0);
  const cardioCount = workoutTypes.filter(w => w.type === 'run' || w.type === 'bike' || w.type === 'swim').reduce((sum, w) => sum + w.frequency, 0);
  const hiitCount = workoutTypes.filter(w => w.type === 'hiit').reduce((sum, w) => sum + w.frequency, 0);

  // High frequency (5+ days) + strength focus = muscle gain
  if (weeklyVolume >= 300 && strengthCount >= 3) {
    return 'muscle_gain';
  }

  // High intensity work (Z4-5) + HIIT = athletic performance
  const highIntensity = (intensityDist.zone4_threshold || 0) + (intensityDist.zone5_max || 0);
  if (highIntensity > 15 || hiitCount >= 2) {
    return 'athletic_performance';
  }

  // High cardio volume = endurance
  if (cardioCount >= 4 && weeklyVolume >= 300) {
    return 'endurance';
  }

  // Moderate volume + mixed work = fat loss or general health
  if (weeklyVolume >= 180) {
    return 'fat_loss';
  }

  return 'general_health';
}

/**
 * Generate nutrition timing recommendations
 */
function generateNutritionTiming(
  trainingGoal: string,
  workoutTypes: WorkoutPattern[],
  avgDuration: number
): ForgeTrainingProtocolResult['nutritionTiming'] {
  const hasStrength = workoutTypes.some(w => w.type === 'strength');
  const hasEndurance = workoutTypes.some(w => w.type === 'run' || w.type === 'bike' || w.type === 'swim');

  // Pre-workout carbs
  let preWorkoutCarbs = '30-40g easily digestible carbs 60-90 min before';
  if (hasStrength) {
    preWorkoutCarbs = '30-40g carbs + 15-20g protein 60-90 min before (e.g., banana + Greek yogurt)';
  } else if (hasEndurance && avgDuration > 60) {
    preWorkoutCarbs = '40-60g carbs 90-120 min before longer sessions (e.g., oatmeal with honey)';
  }

  // Intra-workout fueling
  let intraWorkoutFueling = 'Not needed for sessions <90 minutes';
  if (avgDuration > 90) {
    intraWorkoutFueling = '30-60g carbs per hour for sessions >90 min (sports drink, gels, or dates)';
  } else if (avgDuration > 120) {
    intraWorkoutFueling = '60-90g carbs per hour for sessions >2 hours (mix of liquids and solids)';
  }

  // Post-workout recovery
  let postWorkoutRecovery = '25-30g protein + 30-40g carbs within 30-60 min';
  if (hasStrength) {
    postWorkoutRecovery = '30-40g protein + 30-50g carbs within 30-60 min (e.g., whey shake + banana, or chicken + rice)';
  }

  // Daily protein (based on goal)
  let dailyProtein = '1.6-2.0g per kg bodyweight';
  if (trainingGoal === 'muscle_gain') {
    dailyProtein = '2.0-2.2g per kg bodyweight (distribute across 4-5 meals)';
  } else if (trainingGoal === 'endurance') {
    dailyProtein = '1.6-1.8g per kg bodyweight';
  }

  // Daily carbs (periodized to training)
  let dailyCarbs = 'High training days: 5-7g/kg, Moderate: 4-5g/kg, Rest: 2-3g/kg';
  if (trainingGoal === 'muscle_gain') {
    dailyCarbs = 'High training days: 5-6g/kg, Moderate: 4-5g/kg, Rest: 3-4g/kg';
  } else if (trainingGoal === 'endurance') {
    dailyCarbs = 'High training days: 7-10g/kg, Moderate: 5-7g/kg, Rest: 3-4g/kg';
  } else if (trainingGoal === 'fat_loss') {
    dailyCarbs = 'Training days: 3-5g/kg, Rest days: 2-3g/kg (lower carb approach)';
  }

  return {
    preWorkoutCarbs,
    intraWorkoutFueling,
    postWorkoutRecovery,
    dailyProtein,
    dailyCarbs,
  };
}

// ============================================================================
// MAIN INFERENCE FUNCTION
// ============================================================================

/**
 * Infer training protocol from Forge data (Strava/Whoop)
 */
export async function inferForgeTrainingProtocol(
  input: ForgeTrainingProtocolInput
): Promise<ForgeTrainingProtocolResult> {
  const { email, ecosystemData, questionnaireData } = input;

  try {
    // Fetch Forge training data from database
    const supabase = await createClient();

    // Get Strava workout data
    const { data: stravaData } = await supabase
      .from('forge_workout_patterns')
      .select('*')
      .eq('email', email)
      .eq('source', 'strava')
      .order('sync_date', { ascending: false })
      .limit(1)
      .single();

    // Get Whoop recovery data
    const { data: whoopData } = await supabase
      .from('forge_workout_patterns')
      .select('*')
      .eq('email', email)
      .eq('source', 'whoop')
      .order('sync_date', { ascending: false })
      .limit(1)
      .single();

    // If we have Strava data, use it for training analysis
    if (stravaData && stravaData.patterns) {
      const patterns = stravaData.patterns as Record<string, any>;
      const metrics = stravaData.metrics as Record<string, any>;

      // Extract training volume
      const trainingVolume = {
        weeklyMinutes: patterns.trainingLoad?.weeklyMinutes || 0,
        trend: patterns.trainingLoad?.trend || 'stable',
        recommendation: determineVolumeRecommendation(
          patterns.trainingLoad?.weeklyMinutes || 0,
          whoopData?.patterns?.recovery?.avgRecoveryScore || 75
        ),
      };

      // Extract intensity distribution
      const intensityDistribution = {
        zone1_recovery: patterns.intensityDistribution?.zone1 || 20,
        zone2_base: patterns.intensityDistribution?.zone2 || 40,
        zone3_tempo: patterns.intensityDistribution?.zone3 || 25,
        zone4_threshold: patterns.intensityDistribution?.zone4 || 10,
        zone5_max: patterns.intensityDistribution?.zone5 || 5,
        polarizationIndex: calculatePolarizationIndex(patterns.intensityDistribution || {}),
      };

      // Extract workout types
      const workoutDist = patterns.workoutDistribution || {};
      const workoutTypes: WorkoutPattern[] = Object.entries(workoutDist).map(([type, count]) => ({
        type: type as WorkoutPattern['type'],
        frequency: count as number,
        avgDuration: 60, // Would calculate from actual data
        intensityFocus: 'moderate' as const,
      }));

      // Performance metrics
      const performance = {
        trend: patterns.performanceTrends?.trend || 'stable',
        recentPRs: 0, // Would extract from actual data
        trainingEffectiveness: metrics.trainingScore || 75,
        consistencyScore: metrics.consistencyScore || patterns.performanceTrends?.consistency || 75,
      };

      // Recovery metrics (from Whoop if available)
      const recovery = whoopData?.patterns?.recovery
        ? {
            adequateRecovery: whoopData.patterns.recovery.avgRecoveryScore >= 67,
            avgRecoveryScore: whoopData.patterns.recovery.avgRecoveryScore,
            hrvTrend: whoopData.patterns.hrvTrends?.trend || 'stable',
            overtrainingRisk: metrics.overtrainingRisk || 'low',
            recommendedRestDays: whoopData.patterns.recommendations?.restDaysNeeded || 1,
          }
        : {
            adequateRecovery: true,
            avgRecoveryScore: 75,
            hrvTrend: 'stable' as const,
            overtrainingRisk: 'low' as const,
            recommendedRestDays: 1,
          };

      // Infer training goal
      const trainingGoal = questionnaireData?.trainingGoal ||
        inferTrainingGoal(workoutTypes, trainingVolume.weeklyMinutes, intensityDistribution);

      // Generate nutrition timing
      const nutritionTiming = generateNutritionTiming(
        trainingGoal,
        workoutTypes,
        trainingVolume.weeklyMinutes / (workoutTypes.reduce((sum, w) => sum + w.frequency, 0) || 5)
      );

      // Generate insights
      const insights: string[] = [];
      if (trainingVolume.weeklyMinutes > 500) {
        insights.push(`High training volume (${trainingVolume.weeklyMinutes} min/week) requires optimal fueling and recovery`);
      }
      if (intensityDistribution.polarizationIndex > 70) {
        insights.push('Well-polarized training detected - good balance of easy and hard work');
      }
      if (recovery.avgRecoveryScore < 67 && trainingVolume.recommendation === 'reduce') {
        insights.push('Recovery trending low - consider reducing volume or implementing deload week');
      }

      // Generate recommendations
      const recommendations: string[] = [];
      if (trainingVolume.recommendation === 'deload') {
        recommendations.push('Implement deload week: 50% volume reduction while maintaining intensity');
      }
      if (recovery.overtrainingRisk === 'moderate' || recovery.overtrainingRisk === 'high') {
        recommendations.push(`Overtraining risk: ${recovery.overtrainingRisk} - prioritize sleep and nutrition`);
      }
      recommendations.push(`${nutritionTiming.dailyProtein} to support training load`);
      recommendations.push(`Carb periodization: ${nutritionTiming.dailyCarbs}`);

      return {
        trainingVolume,
        intensityDistribution,
        workoutTypes,
        performance,
        recovery,
        nutritionTiming,
        confidence: 90, // High confidence with real data
        dataSource: whoopData ? 'Strava + Whoop' : 'Strava',
        insights,
        recommendations,
      };
    }

    // Fallback to Sage's training protocol if no Forge data
    const { inferTrainingProtocol } = await import('./training-protocol');
    const sageResult = inferTrainingProtocol({
      ecosystemData,
      questionnaireData,
    });

    // Convert Sage result to Forge format
    return {
      trainingVolume: {
        weeklyMinutes: sageResult.frequencyPerWeek * sageResult.avgDuration,
        trend: 'stable',
        recommendation: 'maintain',
      },
      intensityDistribution: {
        zone1_recovery: 20,
        zone2_base: 40,
        zone3_tempo: 25,
        zone4_threshold: 10,
        zone5_max: 5,
        polarizationIndex: 50,
      },
      workoutTypes: sageResult.workoutTypes.map(w => ({
        ...w,
        intensityFocus: 'moderate' as const,
      })),
      performance: {
        trend: 'stable',
        recentPRs: 0,
        trainingEffectiveness: 50,
        consistencyScore: 50,
      },
      recovery: {
        adequateRecovery: sageResult.recoveryNeeds === 'low',
        avgRecoveryScore: 75,
        hrvTrend: 'stable',
        overtrainingRisk: sageResult.recoveryNeeds === 'high' ? 'moderate' : 'low',
        recommendedRestDays: sageResult.trainingLoad === 'very_heavy' ? 2 : 1,
      },
      nutritionTiming: sageResult.nutritionTiming,
      confidence: sageResult.confidence,
      dataSource: sageResult.dataSource,
      insights: sageResult.insights,
      recommendations: sageResult.recommendations,
    };

  } catch (error) {
    console.error('[Forge Training Protocol] Error:', error);

    // Return safe defaults
    return {
      trainingVolume: { weeklyMinutes: 210, trend: 'stable', recommendation: 'maintain' },
      intensityDistribution: {
        zone1_recovery: 20,
        zone2_base: 40,
        zone3_tempo: 25,
        zone4_threshold: 10,
        zone5_max: 5,
        polarizationIndex: 50,
      },
      workoutTypes: [{ type: 'other', frequency: 3, avgDuration: 45, intensityFocus: 'moderate' }],
      performance: { trend: 'stable', recentPRs: 0, trainingEffectiveness: 50, consistencyScore: 50 },
      recovery: { adequateRecovery: true, avgRecoveryScore: 75, hrvTrend: 'stable', overtrainingRisk: 'low', recommendedRestDays: 1 },
      nutritionTiming: {
        preWorkoutCarbs: '30-40g carbs 60-90 min before',
        intraWorkoutFueling: 'Not needed for sessions <90 min',
        postWorkoutRecovery: '25-30g protein + 30-40g carbs within 60 min',
        dailyProtein: '1.6-2.0g per kg bodyweight',
        dailyCarbs: 'Training days: 4-6g/kg, Rest days: 2-3g/kg',
      },
      confidence: 25,
      dataSource: 'Default recommendations',
      insights: ['No training data available - connect Strava or Whoop for personalized analysis'],
      recommendations: ['Connect Strava to track workouts', 'Connect Whoop for recovery tracking'],
    };
  }
}

/**
 * Determine volume recommendation based on current volume and recovery
 */
function determineVolumeRecommendation(
  weeklyMinutes: number,
  recoveryScore: number
): 'increase' | 'maintain' | 'reduce' | 'deload' {
  // Low recovery = reduce or deload
  if (recoveryScore < 50) return 'deload';
  if (recoveryScore < 67) return 'reduce';

  // High recovery + moderate volume = can increase
  if (recoveryScore >= 67 && weeklyMinutes < 400) return 'increase';

  // Otherwise maintain
  return 'maintain';
}
