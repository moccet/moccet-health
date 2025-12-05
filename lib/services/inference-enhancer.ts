/**
 * Inference Enhancement Service
 *
 * Integrates hybrid inference results into the unified context system.
 * Enhances existing context with data-driven insights and personalized recommendations.
 *
 * @module lib/services/inference-enhancer
 */

import { fetchAllEcosystemData } from './ecosystem-fetcher';
import { runHybridInference, getInferenceSummary, type QuestionnaireData, type HybridInferenceResult } from '@/lib/inference/hybrid-engine';

// ============================================================================
// TYPES
// ============================================================================

export interface EnhancedContext {
  // Inference results
  inference: HybridInferenceResult;
  inferenceSummary: ReturnType<typeof getInferenceSummary>;

  // Enhanced sections for prompts
  personalizedInsights: string[];
  dataBasedRecommendations: string[];
  confidenceMetrics: {
    overall: number;
    stress: number;
    mealTiming: number;
    sleep: number;
    training: number;
    skinHealth: number;
  };
  dataQualityReport: {
    sourcesUsed: string[];
    sourcesAvailable: number;
    sourcesMissing: string[];
    qualityLevel: 'excellent' | 'good' | 'fair' | 'limited';
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert onboarding form data to QuestionnaireData format
 */
function mapOnboardingToQuestionnaire(formData: Record<string, unknown>): QuestionnaireData {
  return {
    // Stress-related
    stressLevel: formData.stressLevel as number | undefined,
    workContext: formData.workContext as string | undefined,

    // Sleep-related
    sleepQuality: formData.sleepQuality as 'excellent' | 'good' | 'fair' | 'poor' | undefined,
    sleepHours: formData.sleepHours as number | undefined,
    sleepIssues: formData.sleepIssues as string[] | undefined,
    sleepTime: formData.sleepTime as string | undefined,
    wakeTime: formData.wakeTime as string | undefined,

    // Meal timing
    preferredMealTimes: formData.preferredMealTimes as {
      breakfast?: string;
      lunch?: string;
      dinner?: string;
    } | undefined,

    // Training
    trainingFrequency: formData.trainingFrequency as number | undefined,
    trainingType: formData.trainingType as string[] | undefined,
    trainingGoal: formData.trainingGoal as string | undefined,

    // Demographics
    age: parseInt(formData.age as string) || undefined,
    gender: formData.gender as string | undefined,
    location: formData.location as string | undefined,
  };
}

// ============================================================================
// MAIN ENHANCEMENT FUNCTION
// ============================================================================

/**
 * Enhance unified context with hybrid inference results
 *
 * @param email - User email
 * @param formData - Onboarding form data
 * @param planType - 'sage' or 'forge'
 * @returns Enhanced context with inference results
 */
export async function enhanceContextWithInference(
  email: string,
  formData: Record<string, unknown>,
  planType: 'sage' | 'forge' = 'sage'
): Promise<EnhancedContext | null> {
  try {
    console.log(`[Inference Enhancer] Starting enhancement for ${email}`);

    // 1. Fetch ecosystem data
    const ecosystemData = await fetchAllEcosystemData(email, planType);

    // 2. Map form data to questionnaire format
    const questionnaireData = mapOnboardingToQuestionnaire(formData);

    // 3. Run hybrid inference
    const inference = await runHybridInference(ecosystemData, questionnaireData);
    const inferenceSummary = getInferenceSummary(inference);

    // 4. Build personalized insights
    const personalizedInsights: string[] = [];

    // Stress insights with specific context
    if (inference.stress.category === 'high') {
      personalizedInsights.push(
        `HIGH STRESS DETECTED (${inference.stress.stressLevel}/100): Working in ${inference.stress.workContext}. ` +
        `Key stressor: ${inference.stress.stressSignals[0]}`
      );
    } else if (inference.stress.category === 'moderate') {
      personalizedInsights.push(
        `Moderate stress levels (${inference.stress.stressLevel}/100) in ${inference.stress.workContext}. ` +
        `Primary factor: ${inference.stress.stressSignals[0] || 'Work demands'}`
      );
    }

    // Meal timing insights with specific windows
    if (inference.mealTiming.confidence >= 70) {
      personalizedInsights.push(
        `OPTIMIZED MEAL TIMING available based on calendar analysis: ` +
        `First meal ${inference.mealTiming.firstMeal.suggestedTime} (${inference.mealTiming.firstMeal.rationale}), ` +
        `Lunch ${inference.mealTiming.lunch.suggestedTime} (${inference.mealTiming.lunch.rationale})`
      );
    }

    // Sleep insights with specific metrics
    if (inference.sleepQuality.metrics.avgSleepHours) {
      const sleepStatus = inference.sleepQuality.category === 'poor' || inference.sleepQuality.category === 'fair'
        ? 'NEEDS OPTIMIZATION'
        : 'GOOD';
      personalizedInsights.push(
        `Sleep: ${sleepStatus} (${inference.sleepQuality.category}, averaging ${inference.sleepQuality.metrics.avgSleepHours}h/night). ` +
        `${inference.sleepQuality.insights[0] || ''}`
      );
    }

    // Add cross-correlation insights
    personalizedInsights.push(...inference.insights);

    // 5. Build data-based recommendations (prioritized)
    const dataBasedRecommendations = inference.topRecommendations;

    // 6. Build confidence metrics
    const confidenceMetrics = {
      overall: inference.overallConfidence,
      stress: inference.stress.confidence,
      mealTiming: inference.mealTiming.confidence,
      sleep: inference.sleepQuality.confidence,
      training: inference.training.confidence,
      skinHealth: inference.skinHealth.confidence,
    };

    // 7. Build data quality report
    const sourcesAvailable = inference.dataSourcesUsed.filter(s => s !== 'Questionnaire').length;
    const sourcesMissing = inference.dataGaps.map(gap => gap.split(' - ')[0]);

    let qualityLevel: 'excellent' | 'good' | 'fair' | 'limited';
    if (inference.overallConfidence >= 75) {
      qualityLevel = 'excellent';
    } else if (inference.overallConfidence >= 60) {
      qualityLevel = 'good';
    } else if (inference.overallConfidence >= 40) {
      qualityLevel = 'fair';
    } else {
      qualityLevel = 'limited';
    }

    const dataQualityReport = {
      sourcesUsed: inference.dataSourcesUsed,
      sourcesAvailable,
      sourcesMissing,
      qualityLevel,
    };

    console.log(`[Inference Enhancer] Enhancement complete. Confidence: ${inference.overallConfidence}%, Quality: ${qualityLevel}`);

    return {
      inference,
      inferenceSummary,
      personalizedInsights,
      dataBasedRecommendations,
      confidenceMetrics,
      dataQualityReport,
    };

  } catch (error) {
    console.error('[Inference Enhancer] Error enhancing context:', error);
    return null;
  }
}

/**
 * Format inference results for prompt injection
 *
 * @param enhanced - Enhanced context from inference
 * @returns Formatted string for AI prompt
 */
export function formatInferenceForPrompt(enhanced: EnhancedContext): string {
  let prompt = '\n## DATA-DRIVEN INSIGHTS (Hybrid Inference Engine)\n\n';

  // Overall confidence
  prompt += `**Overall Confidence:** ${enhanced.confidenceMetrics.overall}% (${enhanced.dataQualityReport.qualityLevel} data quality)\n`;
  prompt += `**Data Sources:** ${enhanced.dataQualityReport.sourcesUsed.join(', ')}\n\n`;

  // Key personalized insights
  prompt += `**Key Insights:**\n`;
  enhanced.personalizedInsights.slice(0, 5).forEach(insight => {
    prompt += `- ${insight}\n`;
  });

  prompt += `\n**Stress Analysis:**\n`;
  prompt += `- Level: ${enhanced.inference.stress.stressLevel}/100 (${enhanced.inference.stress.category})\n`;
  prompt += `- Work Context: ${enhanced.inference.stress.workContext}\n`;
  prompt += `- Confidence: ${enhanced.inference.stress.confidence}%\n`;
  if (enhanced.inference.stress.stressSignals.length > 0) {
    prompt += `- Primary Signals:\n`;
    enhanced.inference.stress.stressSignals.forEach(signal => {
      prompt += `  • ${signal}\n`;
    });
  }

  prompt += `\n**Optimized Meal Timing:**\n`;
  prompt += `- First Meal: ${enhanced.inference.mealTiming.firstMeal.suggestedTime} (window: ${enhanced.inference.mealTiming.firstMeal.windowStart}-${enhanced.inference.mealTiming.firstMeal.windowEnd})\n`;
  prompt += `  Rationale: ${enhanced.inference.mealTiming.firstMeal.rationale}\n`;
  prompt += `- Lunch: ${enhanced.inference.mealTiming.lunch.suggestedTime} (window: ${enhanced.inference.mealTiming.lunch.windowStart}-${enhanced.inference.mealTiming.lunch.windowEnd})\n`;
  prompt += `  Rationale: ${enhanced.inference.mealTiming.lunch.rationale}\n`;
  prompt += `- Dinner: ${enhanced.inference.mealTiming.dinner.suggestedTime} (window: ${enhanced.inference.mealTiming.dinner.windowStart}-${enhanced.inference.mealTiming.dinner.windowEnd})\n`;
  prompt += `  Rationale: ${enhanced.inference.mealTiming.dinner.rationale}\n`;
  prompt += `- Confidence: ${enhanced.inference.mealTiming.confidence}%\n`;

  prompt += `\n**Sleep Quality Assessment:**\n`;
  prompt += `- Quality: ${enhanced.inference.sleepQuality.category}\n`;
  if (enhanced.inference.sleepQuality.metrics.avgSleepHours) {
    prompt += `- Average Hours: ${enhanced.inference.sleepQuality.metrics.avgSleepHours}h/night\n`;
  }
  if (enhanced.inference.sleepQuality.metrics.sleepScore) {
    prompt += `- Sleep Score: ${enhanced.inference.sleepQuality.metrics.sleepScore}/100\n`;
  }
  prompt += `- Confidence: ${enhanced.inference.sleepQuality.confidence}%\n`;

  prompt += `\n**Training Protocol:**\n`;
  prompt += `- Frequency: ${enhanced.inference.training.frequencyPerWeek} days/week\n`;
  prompt += `- Training Load: ${enhanced.inference.training.trainingLoad}\n`;
  prompt += `- Training Goal: ${enhanced.inference.training.trainingGoal}\n`;
  prompt += `- Recovery Needs: ${enhanced.inference.training.recoveryNeeds}\n`;
  prompt += `- Pre-Workout Nutrition: ${enhanced.inference.training.nutritionTiming.preWorkout}\n`;
  prompt += `- Post-Workout Nutrition: ${enhanced.inference.training.nutritionTiming.postWorkout}\n`;
  prompt += `- Confidence: ${enhanced.inference.training.confidence}%\n`;

  prompt += `\n**Skin Health Assessment:**\n`;
  if (enhanced.inference.skinHealth.nutrientDeficiencies.length > 0) {
    prompt += `- Deficiencies Detected: ${enhanced.inference.skinHealth.nutrientDeficiencies.join(', ')}\n`;
  }
  if (enhanced.inference.skinHealth.riskFactors.length > 0) {
    prompt += `- Risk Factors: ${enhanced.inference.skinHealth.riskFactors.join(', ')}\n`;
  }
  prompt += `- Key Recommendations:\n`;
  enhanced.inference.skinHealth.recommendations.slice(0, 3).forEach(rec => {
    prompt += `  • ${rec.nutrient}: ${rec.targetAmount} — ${rec.rationale}\n`;
  });
  prompt += `- Confidence: ${enhanced.inference.skinHealth.confidence}%\n`;

  // Top recommendations
  prompt += `\n**Priority Recommendations:**\n`;
  enhanced.dataBasedRecommendations.forEach((rec, idx) => {
    prompt += `${idx + 1}. ${rec}\n`;
  });

  // Data gaps (if any)
  if (enhanced.dataQualityReport.sourcesMissing.length > 0) {
    prompt += `\n**Data Gaps** (connect for better personalization):\n`;
    enhanced.dataQualityReport.sourcesMissing.forEach(gap => {
      prompt += `- ${gap}\n`;
    });
  }

  prompt += `\n---\n\n`;
  prompt += `**INSTRUCTION:** Use the above data-driven insights to personalize the nutrition plan. `;
  prompt += `Prioritize objective data (${enhanced.confidenceMetrics.overall}% confidence) over general recommendations. `;
  prompt += `Reference specific measurements and timeframes when making recommendations.\n\n`;

  return prompt;
}

/**
 * Generate confidence transparency section for user display
 *
 * @param enhanced - Enhanced context
 * @returns HTML/Markdown formatted transparency section
 */
export function generateConfidenceSection(enhanced: EnhancedContext): string {
  let section = `## How This Plan Was Built\n\n`;

  section += `This personalized plan was created using a hybrid approach that prioritizes objective data from your connected devices and integrations, `;
  section += `falling back to your questionnaire responses when specific data isn't available.\n\n`;

  section += `### Data Sources Used\n\n`;
  enhanced.dataQualityReport.sourcesUsed.forEach(source => {
    section += `- ✅ **${source}**\n`;
  });

  section += `\n### Confidence Scores\n\n`;
  section += `- **Overall Plan Confidence:** ${enhanced.confidenceMetrics.overall}%\n`;
  section += `- **Stress Assessment:** ${enhanced.confidenceMetrics.stress}%\n`;
  section += `- **Meal Timing:** ${enhanced.confidenceMetrics.mealTiming}%\n`;
  section += `- **Sleep Quality:** ${enhanced.confidenceMetrics.sleep}%\n`;
  section += `- **Training Protocol:** ${enhanced.confidenceMetrics.training}%\n`;
  section += `- **Skin Health:** ${enhanced.confidenceMetrics.skinHealth}%\n`;

  if (enhanced.dataQualityReport.sourcesMissing.length > 0) {
    section += `\n### Recommended Connections\n\n`;
    section += `Connect these integrations for even more personalized recommendations:\n\n`;
    enhanced.dataQualityReport.sourcesMissing.forEach(source => {
      section += `- ${source}\n`;
    });
  }

  section += `\n### Data Quality: ${enhanced.dataQualityReport.qualityLevel.toUpperCase()}\n\n`;

  return section;
}
