/**
 * Forge Hybrid Inference Engine
 *
 * Orchestrator for Forge-specific inference with training performance focus.
 * Combines Forge training data with Sage health modules for complete athlete optimization.
 *
 * @module lib/inference/forge-hybrid-engine
 */

import type { EcosystemFetchResult } from '@/lib/services/ecosystem-fetcher';
import { inferForgeTrainingProtocol, type ForgeTrainingProtocolResult } from './forge-training-protocol';
import { inferStressLevel, type StressInferenceResult } from './stress-calculator';
import { inferSleepQuality, type SleepQualityResult } from './sleep-quality';
import type { QuestionnaireData } from './hybrid-engine';

// ============================================================================
// TYPES
// ============================================================================

export interface ForgeQuestionnaireData extends QuestionnaireData {
  // Forge-specific fields
  trainingGoal?: string;
  availableEquipment?: string[];
  timeAvailability?: number;
  injuryHistory?: string[];
}

export interface ForgeHybridInferenceResult {
  // Forge-specific modules
  training: ForgeTrainingProtocolResult;

  // Reused from Sage
  sleep: SleepQualityResult;
  stress: StressInferenceResult;

  // Overall metrics
  overallConfidence: number; // 0-100
  dataSourcesUsed: string[];
  dataGaps: string[];
  insights: string[];
  topRecommendations: string[];
  inferredAt: string;
}

// ============================================================================
// MAIN INFERENCE FUNCTION
// ============================================================================

/**
 * Run Forge hybrid inference across all modules
 */
export async function runForgeHybridInference(
  email: string,
  ecosystemData: EcosystemFetchResult,
  questionnaireData?: ForgeQuestionnaireData
): Promise<ForgeHybridInferenceResult> {
  console.log('[Forge Hybrid Inference] Starting inference engine...');
  const startTime = Date.now();

  // Run all inference modules in parallel
  const [training, sleep, stress] = await Promise.all([
    inferForgeTrainingProtocol({
      email,
      ecosystemData,
      questionnaireData: questionnaireData ? {
        trainingGoal: questionnaireData.trainingGoal,
        availableEquipment: questionnaireData.availableEquipment,
        timeAvailability: questionnaireData.timeAvailability,
      } : undefined,
    }),

    Promise.resolve(inferSleepQuality({
      ecosystemData,
      questionnaireData: questionnaireData ? {
        sleepQuality: questionnaireData.sleepQuality,
        sleepHours: questionnaireData.sleepHours,
        sleepIssues: questionnaireData.sleepIssues,
      } : undefined,
    })),

    Promise.resolve(inferStressLevel({
      ecosystemData,
      questionnaireData: questionnaireData ? {
        stressLevel: questionnaireData.stressLevel,
        workContext: questionnaireData.workContext,
        sleepQuality: questionnaireData.sleepQuality,
      } : undefined,
    })),
  ]);

  // Aggregate data sources
  const allDataSources = new Set<string>();
  [training.dataSource].forEach(s => allDataSources.add(s));
  [sleep.dataSource].forEach(s => allDataSources.add(s));
  stress.dataSources.forEach(s => allDataSources.add(s));

  const dataSourcesUsed = Array.from(allDataSources);

  // Calculate overall confidence (weighted for Forge)
  const overallConfidence = Math.round(
    (training.confidence * 0.40 +  // Training is 40% of overall (Forge focus)
     sleep.confidence * 0.30 +     // Sleep is 30%
     stress.confidence * 0.30)     // Stress is 30%
  );

  // Identify data gaps
  const dataGaps: string[] = [];

  if (!ecosystemData.oura.available && !training.dataSource.includes('Whoop')) {
    dataGaps.push('No wearable data (Oura, Whoop) - connect for sleep and recovery tracking');
  }

  if (!training.dataSource.includes('Strava')) {
    dataGaps.push('No training data (Strava) - connect for workout analysis and programming');
  }

  if (!training.dataSource.includes('Whoop')) {
    dataGaps.push('No recovery data (Whoop) - connect for HRV and strain tracking');
  }

  if (!ecosystemData.bloodBiomarkers.available) {
    dataGaps.push('No lab biomarkers - upload recent blood work for comprehensive assessment');
  }

  // Aggregate insights
  const insights: string[] = [];

  // Training-specific insights
  if (training.trainingVolume.weeklyMinutes > 500) {
    insights.push(`High training volume (${training.trainingVolume.weeklyMinutes} min/week) detected`);
  }

  if (training.recovery.overtrainingRisk === 'moderate' || training.recovery.overtrainingRisk === 'high') {
    insights.push(`Overtraining risk: ${training.recovery.overtrainingRisk} - reduce volume or implement deload`);
  }

  if (training.recovery.avgRecoveryScore < 67 && training.recovery.avgRecoveryScore > 0) {
    insights.push(`Low recovery score (${training.recovery.avgRecoveryScore}/100) - prioritize rest and nutrition`);
  }

  // Cross-correlation insights
  if (training.trainingVolume.weeklyMinutes > 400 && sleep.category === 'poor') {
    insights.push('High training load with poor sleep - significantly impacting recovery');
  }

  if (stress.category === 'high' && training.recovery.overtrainingRisk !== 'none') {
    insights.push('High stress combined with training load increases injury and burnout risk');
  }

  // Add module-specific insights
  insights.push(...training.insights.slice(0, 2));
  insights.push(...sleep.insights.slice(0, 2));
  insights.push(...stress.stressSignals.slice(0, 1));

  // Generate top recommendations (prioritized for athletes)
  const topRecommendations: string[] = [];

  // Priority 1: Overtraining/recovery issues
  if (training.recovery.overtrainingRisk === 'high') {
    topRecommendations.push('URGENT: Implement immediate deload week (50% volume reduction)');
  }

  if (training.trainingVolume.recommendation === 'deload') {
    topRecommendations.push('Recovery metrics indicate need for deload week');
  }

  // Priority 2: Sleep optimization for athletes
  if (sleep.category === 'poor' || sleep.category === 'fair') {
    topRecommendations.push(...sleep.recommendations.slice(0, 1));
  }

  // Priority 3: Nutrition optimization
  topRecommendations.push(`Protein: ${training.nutritionTiming.dailyProtein} distributed across 4-5 meals`);
  topRecommendations.push(`Carb periodization: ${training.nutritionTiming.dailyCarbs}`);

  // Priority 4: Training-specific nutrition
  if (training.trainingVolume.weeklyMinutes > 300) {
    topRecommendations.push(`Pre-workout: ${training.nutritionTiming.preWorkoutCarbs}`);
    topRecommendations.push(`Post-workout: ${training.nutritionTiming.postWorkoutRecovery}`);
  }

  // Limit to top 6 recommendations
  const finalRecommendations = topRecommendations.slice(0, 6);

  const duration = Date.now() - startTime;
  console.log(`[Forge Hybrid Inference] Completed in ${duration}ms. Confidence: ${overallConfidence}%`);

  return {
    training,
    sleep,
    stress,
    overallConfidence,
    dataSourcesUsed,
    dataGaps,
    insights: insights.slice(0, 8),
    topRecommendations: finalRecommendations,
    inferredAt: new Date().toISOString(),
  };
}

/**
 * Get Forge inference summary for display
 */
export function getForgeInferenceSummary(result: ForgeHybridInferenceResult): {
  confidenceLevel: 'high' | 'medium' | 'low';
  primaryInsight: string;
  dataQuality: string;
  nextSteps: string[];
} {
  const confidenceLevel: 'high' | 'medium' | 'low' =
    result.overallConfidence >= 75 ? 'high' :
    result.overallConfidence >= 50 ? 'medium' : 'low';

  const primaryInsight = result.insights[0] || 'Forge performance analysis based on available data';

  const dataQuality =
    result.overallConfidence >= 75
      ? `Excellent data quality with ${result.dataSourcesUsed.length} sources (training-optimized)`
      : result.overallConfidence >= 50
      ? `Good data quality - ${result.dataGaps.length} recommended connections for improvement`
      : `Limited data - connect ${result.dataGaps.length} integrations for personalized training insights`;

  const nextSteps = result.dataGaps.length > 0
    ? result.dataGaps.slice(0, 3).map(gap => gap.split(' - ')[0])
    : ['Maintain current integrations', 'Monitor training load and recovery'];

  return {
    confidenceLevel,
    primaryInsight,
    dataQuality,
    nextSteps,
  };
}
