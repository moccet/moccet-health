/**
 * Training Protocol Inference
 *
 * Infers training patterns, frequency, and goals from wearable data (Strava, Fitbit, Oura, Whoop).
 * Falls back to questionnaire data when wearable workout data is unavailable.
 *
 * @module lib/inference/training-protocol
 */

import type { EcosystemFetchResult } from '@/lib/services/ecosystem-fetcher';

// ============================================================================
// TYPES
// ============================================================================

export interface TrainingProtocolInput {
  ecosystemData: EcosystemFetchResult;
  questionnaireData?: {
    trainingFrequency?: number; // days per week
    trainingType?: string[]; // ['strength', 'cardio', 'HIIT']
    trainingGoal?: string; // 'muscle_gain', 'fat_loss', 'performance', 'health'
    preferredWorkoutTime?: string; // 'morning', 'afternoon', 'evening'
  };
}

export interface WorkoutPattern {
  type: 'strength' | 'cardio' | 'HIIT' | 'flexibility' | 'sports' | 'mixed';
  frequency: number; // per week
  avgDuration: number; // minutes
  intensityDistribution?: {
    low: number; // percentage
    moderate: number;
    high: number;
  };
}

export interface TrainingProtocolResult {
  frequencyPerWeek: number;
  avgDuration: number; // minutes
  workoutTypes: WorkoutPattern[];
  preferredTime: 'morning' | 'afternoon' | 'evening' | 'varied';
  trainingGoal: 'muscle_gain' | 'athletic_performance' | 'fat_loss' | 'general_health' | 'endurance';
  trainingLoad: 'light' | 'moderate' | 'heavy' | 'very_heavy';
  recoveryNeeds: 'low' | 'moderate' | 'high';
  nutritionTiming: {
    preWorkout: string; // timing recommendation
    postWorkout: string;
    offDays: string;
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
 * Categorize workout type from activity name
 */
function categorizeWorkoutType(activityName: string): WorkoutPattern['type'] {
  const name = activityName.toLowerCase();

  if (name.includes('run') || name.includes('jog') || name.includes('cycling') || name.includes('bike')) {
    return 'cardio';
  }
  if (name.includes('strength') || name.includes('weight') || name.includes('lift') || name.includes('gym')) {
    return 'strength';
  }
  if (name.includes('hiit') || name.includes('interval') || name.includes('circuit')) {
    return 'HIIT';
  }
  if (name.includes('yoga') || name.includes('stretch') || name.includes('mobility')) {
    return 'flexibility';
  }
  if (name.includes('basketball') || name.includes('soccer') || name.includes('tennis') || name.includes('sports')) {
    return 'sports';
  }

  return 'mixed';
}

/**
 * Determine preferred workout time from workout timestamps
 */
function determinePreferredTime(workoutTimes: Date[]): 'morning' | 'afternoon' | 'evening' | 'varied' {
  if (workoutTimes.length === 0) return 'varied';

  const timeDistribution = { morning: 0, afternoon: 0, evening: 0 };

  workoutTimes.forEach(time => {
    const hour = time.getHours();
    if (hour >= 5 && hour < 12) {
      timeDistribution.morning++;
    } else if (hour >= 12 && hour < 17) {
      timeDistribution.afternoon++;
    } else {
      timeDistribution.evening++;
    }
  });

  const total = workoutTimes.length;
  const morningPct = (timeDistribution.morning / total) * 100;
  const afternoonPct = (timeDistribution.afternoon / total) * 100;
  const eveningPct = (timeDistribution.evening / total) * 100;

  // If one time dominates (>60%), that's preferred
  if (morningPct > 60) return 'morning';
  if (afternoonPct > 60) return 'afternoon';
  if (eveningPct > 60) return 'evening';

  return 'varied';
}

/**
 * Infer training goal from patterns
 */
function inferTrainingGoal(
  patterns: WorkoutPattern[],
  frequencyPerWeek: number
): TrainingProtocolResult['trainingGoal'] {
  // High frequency (5+ days) + strength focus = muscle gain or performance
  const strengthWorkouts = patterns.filter(p => p.type === 'strength');
  const cardioWorkouts = patterns.filter(p => p.type === 'cardio');
  const hiitWorkouts = patterns.filter(p => p.type === 'HIIT');

  if (frequencyPerWeek >= 5 && strengthWorkouts.length >= 3) {
    return 'muscle_gain';
  }

  if (hiitWorkouts.length >= 2 || (frequencyPerWeek >= 5 && cardioWorkouts.length >= 3)) {
    return 'athletic_performance';
  }

  if (frequencyPerWeek >= 4 && cardioWorkouts.length >= 3) {
    return 'endurance';
  }

  if (frequencyPerWeek >= 3) {
    return 'fat_loss';
  }

  return 'general_health';
}

/**
 * Calculate training load
 */
function calculateTrainingLoad(
  frequencyPerWeek: number,
  avgDuration: number,
  patterns: WorkoutPattern[]
): TrainingProtocolResult['trainingLoad'] {
  // Calculate weekly volume (frequency × duration)
  const weeklyMinutes = frequencyPerWeek * avgDuration;

  // Factor in intensity
  const hiitCount = patterns.filter(p => p.type === 'HIIT').length;
  const strengthCount = patterns.filter(p => p.type === 'strength').length;

  // Very heavy: 6+ days, 60+ min avg, or lots of HIIT
  if (weeklyMinutes > 360 || (frequencyPerWeek >= 6 && avgDuration >= 45) || hiitCount >= 3) {
    return 'very_heavy';
  }

  // Heavy: 5-6 days, 45+ min avg
  if (weeklyMinutes > 270 || (frequencyPerWeek >= 5 && avgDuration >= 45)) {
    return 'heavy';
  }

  // Moderate: 3-4 days, 30+ min avg
  if (weeklyMinutes > 120 || frequencyPerWeek >= 3) {
    return 'moderate';
  }

  return 'light';
}

/**
 * Determine recovery needs
 */
function determineRecoveryNeeds(
  trainingLoad: TrainingProtocolResult['trainingLoad'],
  patterns: WorkoutPattern[]
): TrainingProtocolResult['recoveryNeeds'] {
  const hiitCount = patterns.filter(p => p.type === 'HIIT').length;

  if (trainingLoad === 'very_heavy' || hiitCount >= 3) {
    return 'high';
  }

  if (trainingLoad === 'heavy' || hiitCount >= 2) {
    return 'moderate';
  }

  return 'low';
}

// ============================================================================
// MAIN INFERENCE FUNCTION
// ============================================================================

/**
 * Infer training protocol from ecosystem data
 */
export function inferTrainingProtocol(input: TrainingProtocolInput): TrainingProtocolResult {
  const { ecosystemData, questionnaireData } = input;

  // TODO: Extract from Strava, Fitbit, Vital workout data when available
  // For now, use questionnaire fallback

  // Check if we have wearable workout data
  // This would be expanded when Strava/Fitbit sync is implemented
  const hasWorkoutData = false; // Placeholder

  if (hasWorkoutData) {
    // Future implementation: extract from wearable data
    // const workouts = extractWorkouts(ecosystemData);
    // return analyzeWorkoutPatterns(workouts);
  }

  // Fallback to questionnaire
  if (questionnaireData) {
    const frequencyPerWeek = questionnaireData.trainingFrequency || 3;
    const trainingTypes = questionnaireData.trainingType || ['mixed'];

    // Build workout patterns from questionnaire
    const workoutTypes: WorkoutPattern[] = trainingTypes.map(type => ({
      type: type as WorkoutPattern['type'],
      frequency: frequencyPerWeek / trainingTypes.length,
      avgDuration: 45, // Default assumption
    }));

    const trainingLoad = calculateTrainingLoad(frequencyPerWeek, 45, workoutTypes);
    const recoveryNeeds = determineRecoveryNeeds(trainingLoad, workoutTypes);
    const trainingGoal = questionnaireData.trainingGoal as TrainingProtocolResult['trainingGoal'] ||
                        inferTrainingGoal(workoutTypes, frequencyPerWeek);

    const insights: string[] = [];
    const recommendations: string[] = [];

    // Generate insights
    if (frequencyPerWeek >= 5) {
      insights.push(`High training frequency (${frequencyPerWeek} days/week) requires optimal nutrition timing`);
    }

    if (trainingLoad === 'heavy' || trainingLoad === 'very_heavy') {
      insights.push(`${trainingLoad} training load detected - prioritize recovery nutrition`);
      recommendations.push('Increase protein intake to 1.6-2.2g per kg bodyweight for recovery');
      recommendations.push('Ensure adequate carbohydrate intake (4-7g/kg) to support training volume');
    }

    if (trainingTypes.includes('strength')) {
      recommendations.push('Pre-workout: Light carbs + protein 60-90 min before training');
      recommendations.push('Post-workout: Protein + carbs within 30-60 min for optimal recovery');
    }

    if (trainingTypes.includes('cardio') || trainingTypes.includes('HIIT')) {
      recommendations.push('Pre-workout: Easily digestible carbs 30-60 min before for energy');
      recommendations.push('Post-workout: Replenish glycogen with carbs + protein');
    }

    // Nutrition timing recommendations
    const nutritionTiming = {
      preWorkout: trainingTypes.includes('strength')
        ? 'Light protein + carbs 60-90 minutes before (e.g., banana + Greek yogurt)'
        : 'Easily digestible carbs 30-60 minutes before (e.g., fruit, toast with honey)',
      postWorkout: 'Protein + carbs within 30-60 minutes (e.g., whey shake + fruit, or chicken + rice)',
      offDays: 'Standard meal timing, focus on protein distribution throughout day',
    };

    return {
      frequencyPerWeek,
      avgDuration: 45,
      workoutTypes,
      preferredTime: (questionnaireData.preferredWorkoutTime as any) || 'varied',
      trainingGoal,
      trainingLoad,
      recoveryNeeds,
      nutritionTiming,
      confidence: 45, // Questionnaire-based
      dataSource: 'Questionnaire',
      insights,
      recommendations,
    };
  }

  // Default fallback
  return {
    frequencyPerWeek: 3,
    avgDuration: 45,
    workoutTypes: [{ type: 'mixed', frequency: 3, avgDuration: 45 }],
    preferredTime: 'varied',
    trainingGoal: 'general_health',
    trainingLoad: 'moderate',
    recoveryNeeds: 'moderate',
    nutritionTiming: {
      preWorkout: 'Light meal 60-90 minutes before exercise',
      postWorkout: 'Protein + carbs within 60 minutes after exercise',
      offDays: 'Standard meal timing',
    },
    confidence: 25,
    dataSource: 'Default recommendations',
    insights: ['No training data available - using general guidelines'],
    recommendations: [
      'Connect Strava or Fitbit to track workouts for personalized training nutrition',
      'Maintain consistent protein intake (1.6-2.0g/kg bodyweight)',
    ],
  };
}
