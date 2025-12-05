/**
 * Sleep Quality Assessment
 *
 * Assesses sleep quality from wearable data (Oura, Whoop, Fitbit).
 * Falls back to questionnaire data when wearable data is unavailable.
 *
 * @module lib/inference/sleep-quality
 */

import type { EcosystemFetchResult, OuraData } from '@/lib/services/ecosystem-fetcher';

// ============================================================================
// TYPES
// ============================================================================

export interface SleepQualityInput {
  ecosystemData: EcosystemFetchResult;
  questionnaireData?: {
    sleepQuality?: 'excellent' | 'good' | 'fair' | 'poor';
    sleepHours?: number;
    sleepIssues?: string[];
  };
}

export interface SleepMetrics {
  avgSleepHours?: number;
  deepSleepPercentage?: number;
  remSleepPercentage?: number;
  interruptions?: number;
  sleepEfficiency?: number; // percentage
  sleepScore?: number; // 0-100
}

export interface SleepQualityResult {
  category: 'excellent' | 'good' | 'fair' | 'poor';
  metrics: SleepMetrics;
  recommendations: string[];
  confidence: number; // 0-100
  dataSource: string;
  insights: string[];
}

// ============================================================================
// SLEEP QUALITY CALCULATION
// ============================================================================

/**
 * Assess sleep quality from Oura data
 */
function assessFromOura(ouraData: OuraData): {
  category: 'excellent' | 'good' | 'fair' | 'poor';
  metrics: SleepMetrics;
  insights: string[];
  recommendations: string[];
} {
  const insights: string[] = [];
  const recommendations: string[] = [];

  // Use Oura's built-in sleep quality
  const category = ouraData.sleepQuality;

  const metrics: SleepMetrics = {
    avgSleepHours: ouraData.avgSleepHours,
    sleepScore: ouraData.avgReadinessScore, // Readiness includes sleep quality
  };

  // Generate insights based on sleep hours
  if (ouraData.avgSleepHours < 7) {
    insights.push(`Average sleep duration of ${ouraData.avgSleepHours}h is below the recommended 7-9 hours`);
    recommendations.push('Aim for 7-9 hours of sleep per night for optimal recovery');
    recommendations.push('Consider earlier bedtime or later wake time to increase sleep duration');
  } else if (ouraData.avgSleepHours > 9) {
    insights.push(`Average sleep of ${ouraData.avgSleepHours}h may indicate excessive sleep need or poor quality`);
    recommendations.push('Monitor sleep efficiency - quality matters more than quantity');
  } else {
    insights.push(`Good sleep duration averaging ${ouraData.avgSleepHours} hours per night`);
  }

  // HRV-based insights
  if (ouraData.avgHRV < 40 && ouraData.avgHRV > 0) {
    insights.push('Low HRV suggests inadequate recovery during sleep');
    recommendations.push('Focus on sleep environment optimization (temperature, darkness, quiet)');
    recommendations.push('Avoid alcohol and heavy meals 3+ hours before bed');
  }

  // Readiness score insights
  if (ouraData.avgReadinessScore < 70) {
    insights.push(`Low readiness score (${ouraData.avgReadinessScore}/100) indicates sleep is not providing adequate recovery`);
    recommendations.push('Maintain consistent sleep schedule (same bedtime/wake time daily)');
    recommendations.push('Optimize sleep environment: cool (60-67°F), dark, and quiet');
  } else if (ouraData.avgReadinessScore >= 85) {
    insights.push(`Excellent readiness score (${ouraData.avgReadinessScore}/100) indicates high-quality recovery`);
  }

  // Activity level impact on sleep
  if (ouraData.activityLevel === 'high') {
    recommendations.push('High activity detected - ensure adequate protein and carbs to support recovery');
    recommendations.push('Consider magnesium supplementation to support muscle recovery and sleep quality');
  }

  return { category, metrics, insights, recommendations };
}

/**
 * Categorize sleep quality from metrics
 */
function categorizeSleepQuality(metrics: SleepMetrics): 'excellent' | 'good' | 'fair' | 'poor' {
  let score = 0;

  // Sleep duration (0-30 points)
  if (metrics.avgSleepHours) {
    if (metrics.avgSleepHours >= 7 && metrics.avgSleepHours <= 9) {
      score += 30;
    } else if (metrics.avgSleepHours >= 6 && metrics.avgSleepHours < 7) {
      score += 20;
    } else if (metrics.avgSleepHours >= 5) {
      score += 10;
    }
  }

  // Sleep efficiency (0-30 points)
  if (metrics.sleepEfficiency) {
    if (metrics.sleepEfficiency >= 90) {
      score += 30;
    } else if (metrics.sleepEfficiency >= 80) {
      score += 20;
    } else if (metrics.sleepEfficiency >= 70) {
      score += 10;
    }
  }

  // Deep sleep (0-20 points)
  if (metrics.deepSleepPercentage) {
    if (metrics.deepSleepPercentage >= 20) {
      score += 20;
    } else if (metrics.deepSleepPercentage >= 15) {
      score += 15;
    } else if (metrics.deepSleepPercentage >= 10) {
      score += 10;
    }
  }

  // Interruptions (0-20 points)
  if (metrics.interruptions !== undefined) {
    if (metrics.interruptions <= 1) {
      score += 20;
    } else if (metrics.interruptions <= 2) {
      score += 15;
    } else if (metrics.interruptions <= 3) {
      score += 10;
    }
  }

  // Categorize
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  return 'poor';
}

// ============================================================================
// MAIN INFERENCE FUNCTION
// ============================================================================

/**
 * Infer sleep quality from ecosystem data
 */
export function inferSleepQuality(input: SleepQualityInput): SleepQualityResult {
  const { ecosystemData, questionnaireData } = input;

  // Try Oura data first (most comprehensive sleep tracking)
  if (ecosystemData.oura.available && ecosystemData.oura.data) {
    const ouraData = ecosystemData.oura.data as OuraData;
    const assessment = assessFromOura(ouraData);

    return {
      category: assessment.category,
      metrics: assessment.metrics,
      recommendations: assessment.recommendations,
      confidence: 90,
      dataSource: 'Oura Ring',
      insights: assessment.insights,
    };
  }

  // TODO: Add Whoop, Fitbit assessments when those data structures are available

  // Fallback to questionnaire
  if (questionnaireData?.sleepQuality) {
    const category = questionnaireData.sleepQuality;
    const metrics: SleepMetrics = {
      avgSleepHours: questionnaireData.sleepHours,
    };

    const insights: string[] = [];
    const recommendations: string[] = [];

    if (category === 'poor' || category === 'fair') {
      insights.push('Self-reported sleep quality indicates room for improvement');
      recommendations.push('Connect a wearable device (Oura, Whoop, Fitbit) to track sleep objectively');
      recommendations.push('Maintain consistent sleep schedule with 7-9 hours nightly');
      recommendations.push('Optimize sleep environment: dark, cool (60-67°F), and quiet');

      if (questionnaireData.sleepIssues) {
        for (const issue of questionnaireData.sleepIssues) {
          if (issue.toLowerCase().includes('fall asleep')) {
            recommendations.push('Practice relaxation techniques before bed (meditation, deep breathing)');
            recommendations.push('Avoid screens 60-90 minutes before bedtime');
          }
          if (issue.toLowerCase().includes('stay asleep')) {
            recommendations.push('Avoid caffeine after 2pm');
            recommendations.push('Limit fluid intake 2 hours before bed');
          }
        }
      }
    } else {
      insights.push('Good self-reported sleep quality');
      recommendations.push('Maintain current sleep habits');
    }

    return {
      category,
      metrics,
      recommendations,
      confidence: 40,
      dataSource: 'Questionnaire',
      insights,
    };
  }

  // Default fallback
  return {
    category: 'fair',
    metrics: {},
    recommendations: [
      'Connect a wearable device to track sleep objectively',
      'Aim for 7-9 hours of sleep per night',
      'Maintain consistent sleep schedule',
    ],
    confidence: 20,
    dataSource: 'Default recommendations',
    insights: ['No sleep data available - recommendations are general guidelines'],
  };
}
