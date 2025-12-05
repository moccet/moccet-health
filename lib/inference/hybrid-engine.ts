/**
 * Hybrid Inference Engine
 *
 * Main orchestrator for data-first inference with questionnaire fallback.
 * Combines insights from all specialized inference modules to generate
 * comprehensive, personalized health and lifestyle recommendations.
 *
 * @module lib/inference/hybrid-engine
 */

import type { EcosystemFetchResult } from '@/lib/services/ecosystem-fetcher';
import { inferStressLevel, type StressInferenceResult } from './stress-calculator';
import { inferMealTiming, type MealTimingResult } from './meal-timing';
import { inferSleepQuality, type SleepQualityResult } from './sleep-quality';
import { inferTrainingProtocol, type TrainingProtocolResult } from './training-protocol';
import { assessSkinHealth, type SkinHealthResult } from './skin-health';

// ============================================================================
// TYPES
// ============================================================================

export interface QuestionnaireData {
  // Stress-related
  stressLevel?: number; // 1-10
  workContext?: string;

  // Sleep-related
  sleepQuality?: 'excellent' | 'good' | 'fair' | 'poor';
  sleepHours?: number;
  sleepIssues?: string[];
  sleepTime?: string;
  wakeTime?: string;

  // Meal timing
  preferredMealTimes?: {
    breakfast?: string;
    lunch?: string;
    dinner?: string;
  };

  // Training (for future implementation)
  trainingFrequency?: number; // days per week
  trainingType?: string[];
  trainingGoal?: string;

  // Demographics
  age?: number;
  gender?: string;
  location?: string;

  // Skin health
  skinConcerns?: string[];
  sunExposure?: 'high' | 'moderate' | 'low';
}

export interface HybridInferenceResult {
  // Individual inference results
  stress: StressInferenceResult;
  mealTiming: MealTimingResult;
  sleepQuality: SleepQualityResult;
  training: TrainingProtocolResult;
  skinHealth: SkinHealthResult;

  // Overall metrics
  overallConfidence: number; // 0-100
  dataSourcesUsed: string[];
  dataGaps: string[];

  // Aggregate insights
  insights: string[];

  // Recommendations
  topRecommendations: string[];

  // Metadata
  inferredAt: string;
}

// ============================================================================
// MAIN INFERENCE FUNCTION
// ============================================================================

/**
 * Run hybrid inference across all modules
 *
 * @param ecosystemData - Data from all connected integrations
 * @param questionnaireData - User's questionnaire responses
 * @returns Comprehensive inference results with confidence scores
 */
export async function runHybridInference(
  ecosystemData: EcosystemFetchResult,
  questionnaireData?: QuestionnaireData
): Promise<HybridInferenceResult> {
  console.log('[Hybrid Inference] Starting inference engine...');
  const startTime = Date.now();

  // Run all inference modules in parallel
  const [stress, mealTiming, sleepQuality, training, skinHealth] = await Promise.all([
    Promise.resolve(inferStressLevel({
      ecosystemData,
      questionnaireData: questionnaireData ? {
        stressLevel: questionnaireData.stressLevel,
        workContext: questionnaireData.workContext,
        sleepQuality: questionnaireData.sleepQuality,
      } : undefined,
    })),

    Promise.resolve(inferMealTiming({
      ecosystemData,
      questionnaireData: questionnaireData ? {
        preferredMealTimes: questionnaireData.preferredMealTimes,
        sleepTime: questionnaireData.sleepTime,
        wakeTime: questionnaireData.wakeTime,
      } : undefined,
    })),

    Promise.resolve(inferSleepQuality({
      ecosystemData,
      questionnaireData: questionnaireData ? {
        sleepQuality: questionnaireData.sleepQuality,
        sleepHours: questionnaireData.sleepHours,
        sleepIssues: questionnaireData.sleepIssues,
      } : undefined,
    })),

    Promise.resolve(inferTrainingProtocol({
      ecosystemData,
      questionnaireData: questionnaireData ? {
        trainingFrequency: questionnaireData.trainingFrequency,
        trainingType: questionnaireData.trainingType,
        trainingGoal: questionnaireData.trainingGoal,
      } : undefined,
    })),

    Promise.resolve(assessSkinHealth({
      ecosystemData,
      questionnaireData: questionnaireData ? {
        age: questionnaireData.age,
        skinConcerns: questionnaireData.skinConcerns,
        location: questionnaireData.location,
        sunExposure: questionnaireData.sunExposure,
      } : undefined,
      trainingFrequency: questionnaireData?.trainingFrequency,
    })),
  ]);

  // Aggregate data sources
  const allDataSources = new Set<string>();
  stress.dataSources.forEach(s => allDataSources.add(s));
  [mealTiming.dataSource].forEach(s => allDataSources.add(s));
  [sleepQuality.dataSource].forEach(s => allDataSources.add(s));
  [training.dataSource].forEach(s => allDataSources.add(s));
  [skinHealth.dataSource].forEach(s => allDataSources.add(s));

  const dataSourcesUsed = Array.from(allDataSources);

  // Calculate overall confidence (weighted average)
  const overallConfidence = Math.round(
    (stress.confidence * 0.25 + // Stress is 25% of overall
     mealTiming.confidence * 0.25 + // Meal timing is 25%
     sleepQuality.confidence * 0.25 + // Sleep quality is 25%
     training.confidence * 0.15 + // Training is 15%
     skinHealth.confidence * 0.10) // Skin health is 10%
  );

  // Identify data gaps
  const dataGaps: string[] = [];
  const availableSources = new Set([
    ecosystemData.oura.available ? 'oura' : null,
    ecosystemData.dexcom.available ? 'dexcom' : null,
    ecosystemData.gmail.available ? 'gmail' : null,
    ecosystemData.slack.available ? 'slack' : null,
    ecosystemData.bloodBiomarkers.available ? 'labs' : null,
  ].filter(Boolean));

  if (!ecosystemData.oura.available && !ecosystemData.vital.available) {
    dataGaps.push('No wearable data (Oura, Whoop, Fitbit) - connect for sleep and HRV tracking');
  }

  if (!ecosystemData.gmail.available) {
    dataGaps.push('No calendar data (Gmail) - connect for optimized meal timing based on schedule');
  }

  if (!ecosystemData.dexcom.available) {
    dataGaps.push('No CGM data (Dexcom) - connect for glucose-optimized meal timing');
  }

  if (!ecosystemData.slack.available && !ecosystemData.gmail.available) {
    dataGaps.push('No communication data - connect Gmail or Slack for stress pattern detection');
  }

  if (!ecosystemData.bloodBiomarkers.available) {
    dataGaps.push('No lab biomarkers - upload recent blood work for comprehensive health assessment');
  }

  // Aggregate insights from all modules
  const insights: string[] = [];

  // Stress insights
  if (stress.category === 'high') {
    insights.push(`High stress detected (${stress.stressLevel}/100): ${stress.stressSignals[0]}`);
  } else if (stress.category === 'moderate') {
    insights.push(`Moderate stress levels detected - focus on recovery and stress management`);
  }

  // Sleep insights
  if (sleepQuality.category === 'poor' || sleepQuality.category === 'fair') {
    insights.push(`Sleep quality rated as ${sleepQuality.category} - prioritize sleep optimization`);
  }

  // Work-life balance
  if (stress.workContext.includes('high-intensity') || stress.workContext.includes('demanding')) {
    insights.push(`${stress.workContext} detected - nutrition timing crucial for sustained energy`);
  }

  // Cross-correlation insights
  if (stress.category === 'high' && sleepQuality.category === 'poor') {
    insights.push('High stress combined with poor sleep creates compounding recovery deficit');
  }

  if (mealTiming.confidence < 50 && stress.category === 'moderate') {
    insights.push('Connecting Google Calendar would enable stress-optimized meal timing recommendations');
  }

  // Training insights
  if (training.trainingLoad === 'heavy' || training.trainingLoad === 'very_heavy') {
    insights.push(`${training.trainingLoad} training load (${training.frequencyPerWeek} days/week) requires optimized recovery nutrition`);
  }

  // Skin health insights
  if (skinHealth.nutrientDeficiencies.length > 0) {
    insights.push(`Skin health: ${skinHealth.nutrientDeficiencies.join(', ')} detected`);
  }

  // Add module-specific insights
  insights.push(...stress.stressSignals.slice(0, 2));
  insights.push(...mealTiming.insights.slice(0, 2));
  insights.push(...sleepQuality.insights.slice(0, 2));
  insights.push(...training.insights.slice(0, 1));
  insights.push(...skinHealth.insights.slice(0, 1));

  // Generate top recommendations (prioritized)
  const topRecommendations: string[] = [];

  // Priority 1: Critical issues
  if (sleepQuality.category === 'poor') {
    topRecommendations.push(...sleepQuality.recommendations.slice(0, 2));
  }

  if (stress.category === 'high') {
    topRecommendations.push('Implement stress management protocol: daily NSDR, reduced caffeine after 2pm');
    topRecommendations.push('Schedule dedicated recovery time between meetings when possible');
  }

  // Priority 2: Optimization
  if (mealTiming.confidence >= 70) {
    topRecommendations.push(`Optimize meal timing: First meal at ${mealTiming.firstMeal.suggestedTime}, lunch at ${mealTiming.lunch.suggestedTime}`);
  }

  // Training nutrition
  if (training.trainingLoad !== 'light') {
    topRecommendations.push(...training.recommendations.slice(0, 2));
  }

  // Skin health nutrition
  if (skinHealth.nutrientDeficiencies.length > 0) {
    topRecommendations.push(skinHealth.recommendations[0]?.nutrient + ' to address ' + skinHealth.nutrientDeficiencies[0]);
  }

  // Priority 3: Data gaps
  if (dataGaps.length > 0 && overallConfidence < 70) {
    topRecommendations.push(`Connect ${dataGaps[0].split(' - ')[0]} for more personalized recommendations`);
  }

  // Limit to top 5 recommendations
  const finalRecommendations = topRecommendations.slice(0, 5);

  const duration = Date.now() - startTime;
  console.log(`[Hybrid Inference] Completed in ${duration}ms. Confidence: ${overallConfidence}%`);

  return {
    stress,
    mealTiming,
    sleepQuality,
    training,
    skinHealth,
    overallConfidence,
    dataSourcesUsed,
    dataGaps,
    insights: insights.slice(0, 10), // Top 10 insights
    topRecommendations: finalRecommendations,
    inferredAt: new Date().toISOString(),
  };
}

/**
 * Get inference summary for display
 */
export function getInferenceSummary(result: HybridInferenceResult): {
  confidenceLevel: 'high' | 'medium' | 'low';
  primaryInsight: string;
  dataQuality: string;
  nextSteps: string[];
} {
  const confidenceLevel: 'high' | 'medium' | 'low' =
    result.overallConfidence >= 75 ? 'high' :
    result.overallConfidence >= 50 ? 'medium' : 'low';

  const primaryInsight = result.insights[0] || 'Personalized analysis based on available data';

  const dataQuality =
    result.overallConfidence >= 75
      ? `Excellent data quality with ${result.dataSourcesUsed.length} sources`
      : result.overallConfidence >= 50
      ? `Good data quality - ${result.dataGaps.length} recommended connections for improvement`
      : `Limited data - connect ${result.dataGaps.length} integrations for personalized insights`;

  const nextSteps = result.dataGaps.length > 0
    ? result.dataGaps.slice(0, 3).map(gap => gap.split(' - ')[0])
    : ['Maintain current integrations', 'Monitor patterns over time'];

  return {
    confidenceLevel,
    primaryInsight,
    dataQuality,
    nextSteps,
  };
}
