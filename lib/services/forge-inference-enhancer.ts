/**
 * Forge Inference Enhancer
 *
 * Formats Forge hybrid inference results for AI prompt injection.
 * Focuses on training performance, recovery, and athlete-specific nutrition.
 *
 * @module lib/services/forge-inference-enhancer
 */

import { createClient } from '@/lib/supabase/server';
import { fetchEcosystemData } from './ecosystem-fetcher';
import { runForgeHybridInference, type ForgeHybridInferenceResult } from '@/lib/inference/forge-hybrid-engine';
import type { ForgeQuestionnaireData } from '@/lib/inference/forge-hybrid-engine';

// ============================================================================
// TYPES
// ============================================================================

export interface ForgeEnhancedContext {
  inference: ForgeHybridInferenceResult;
  formData: any;
}

// ============================================================================
// MAIN ENHANCEMENT FUNCTION
// ============================================================================

/**
 * Enhance context with Forge hybrid inference
 */
export async function enhanceForgeContextWithInference(
  email: string,
  formData: any
): Promise<ForgeEnhancedContext | null> {
  try {
    console.log('[Forge Inference Enhancer] Starting inference for:', email);

    // Step 1: Fetch ecosystem data
    const ecosystemData = await fetchEcosystemData(email);

    // Step 2: Map form data to questionnaire format
    const questionnaireData: ForgeQuestionnaireData = {
      // Basic health (from Sage compatibility)
      age: formData.age,
      gender: formData.gender,
      weight: formData.weight,
      height: formData.height,
      activityLevel: formData.activityLevel,

      // Sleep (fallback)
      sleepQuality: formData.sleepQuality,
      sleepHours: formData.sleepHours,
      sleepIssues: formData.sleepIssues,

      // Stress (fallback)
      stressLevel: formData.stressLevel,
      workContext: formData.workContext,

      // Forge-specific training data
      trainingGoal: formData.trainingGoal || formData.goals || 'general fitness',
      availableEquipment: formData.equipment || [],
      timeAvailability: formData.timeAvailability || formData.workoutTime || 60,
      injuryHistory: formData.injuries || formData.limitations || [],
    };

    // Step 3: Run Forge hybrid inference
    const inference = await runForgeHybridInference(
      email,
      ecosystemData,
      questionnaireData
    );

    console.log(`[Forge Inference Enhancer] Completed. Confidence: ${inference.overallConfidence}%`);

    return {
      inference,
      formData,
    };

  } catch (error) {
    console.error('[Forge Inference Enhancer] Error:', error);
    return null;
  }
}

// ============================================================================
// PROMPT FORMATTING
// ============================================================================

/**
 * Format Forge inference results for AI prompt injection
 */
export function formatForgeInferenceForPrompt(enhanced: ForgeEnhancedContext): string {
  const { inference } = enhanced;

  let prompt = `
# FORGE HYBRID INFERENCE DATA (Confidence: ${inference.overallConfidence}%)

This section contains OBJECTIVE DATA from the athlete's connected ecosystem.
Prioritize this data over questionnaire responses when available.

---

## TRAINING PERFORMANCE ANALYSIS
**Data Source:** ${inference.training.dataSource}
**Confidence:** ${inference.training.confidence}%

### Training Volume
- Weekly Minutes: ${inference.training.trainingVolume.weeklyMinutes} min/week
- Workout Frequency: ${inference.training.trainingVolume.workoutFrequency}x/week
- Recommendation: ${inference.training.trainingVolume.recommendation}
- Status: ${inference.training.trainingVolume.status}

### Workout Distribution
${Object.entries(inference.training.workoutTypes).map(([type, count]) =>
  `- ${type}: ${count} workouts`
).join('\n')}

### Intensity Distribution (HR-based)
- Zone 1 (Recovery): ${inference.training.intensityDistribution.zone1}%
- Zone 2 (Aerobic): ${inference.training.intensityDistribution.zone2}%
- Zone 3 (Tempo): ${inference.training.intensityDistribution.zone3}%
- Zone 4 (Threshold): ${inference.training.intensityDistribution.zone4}%
- Zone 5 (VO2 Max): ${inference.training.intensityDistribution.zone5}%
- Polarization Index: ${inference.training.intensityDistribution.polarizationIndex}

### Recovery & Overtraining Risk
- Average Recovery Score: ${inference.training.recovery.avgRecoveryScore}/100
- HRV Trend: ${inference.training.recovery.hrvTrend}
- Overtraining Risk: ${inference.training.recovery.overtrainingRisk}
- Rest Days Needed: ${inference.training.recovery.recommendedRestDays}
- Optimal Training Days: ${inference.training.recovery.optimalTrainingDays.join(', ')}

### Inferred Training Goal
**Goal:** ${inference.training.inferredGoal.primary}
${inference.training.inferredGoal.secondary ? `**Secondary:** ${inference.training.inferredGoal.secondary}` : ''}
**Goal Confidence:** ${inference.training.inferredGoal.confidence}%

---

## PERFORMANCE NUTRITION TIMING
**Based on training patterns and recovery needs**

### Daily Macronutrients
- Protein: ${inference.training.nutritionTiming.dailyProtein}
- Carbohydrates: ${inference.training.nutritionTiming.dailyCarbs}
- Fats: ${inference.training.nutritionTiming.dailyFats}

### Workout Nutrition
- Pre-Workout: ${inference.training.nutritionTiming.preWorkoutCarbs}
- Post-Workout: ${inference.training.nutritionTiming.postWorkoutRecovery}
- Intra-Workout: ${inference.training.nutritionTiming.intraWorkoutNutrition}

### Hydration & Supplements
- Hydration: ${inference.training.nutritionTiming.hydration}
- Key Supplements: ${inference.training.nutritionTiming.supplements.join(', ')}

---

## SLEEP QUALITY ANALYSIS
**Data Source:** ${inference.sleep.dataSource}
**Confidence:** ${inference.sleep.confidence}%

### Sleep Metrics
- Category: ${inference.sleep.category}
- Average Duration: ${inference.sleep.avgDuration} hours
- Sleep Efficiency: ${inference.sleep.efficiency}%
- REM Sleep: ${inference.sleep.remSleep} hours
- Deep Sleep: ${inference.sleep.deepSleep} hours
- Readiness Score: ${inference.sleep.readinessScore || 'N/A'}

### Sleep Quality Insights
${inference.sleep.insights.map(insight => `- ${insight}`).join('\n')}

### Sleep Recommendations
${inference.sleep.recommendations.map(rec => `- ${rec}`).join('\n')}

---

## STRESS & RECOVERY ANALYSIS
**Data Source(s):** ${inference.stress.dataSources.join(', ')}
**Confidence:** ${inference.stress.confidence}%

### Stress Metrics
- Overall Stress Level: ${inference.stress.category}
- Stress Score: ${inference.stress.score}/100

#### Breakdown
- Wearable Stress: ${inference.stress.breakdown.wearable}/100 (${inference.stress.breakdown.wearableConfidence}%)
- Calendar Stress: ${inference.stress.breakdown.calendar}/100 (${inference.stress.breakdown.calendarConfidence}%)
- Communication Stress: ${inference.stress.breakdown.communication}/100 (${inference.stress.breakdown.communicationConfidence}%)
- Lab Biomarker Stress: ${inference.stress.breakdown.lab}/100 (${inference.stress.breakdown.labConfidence}%)

### Stress Signals
${inference.stress.stressSignals.map(signal => `- ${signal}`).join('\n')}

### Stress Management Recommendations
${inference.stress.recommendations.map(rec => `- ${rec}`).join('\n')}

---

## CROSS-CORRELATION INSIGHTS
${inference.insights.map(insight => `- ${insight}`).join('\n')}

---

## TOP RECOMMENDATIONS (Prioritized for Athletes)
${inference.topRecommendations.map((rec, idx) => `${idx + 1}. ${rec}`).join('\n')}

---

## DATA QUALITY & GAPS
**Data Sources Used:** ${inference.dataSourcesUsed.join(', ')}

${inference.dataGaps.length > 0 ? `
### Recommended Integrations
${inference.dataGaps.map(gap => `- ${gap}`).join('\n')}
` : '**All recommended integrations connected.**'}

---

## CONFIDENCE TRANSPARENCY
- **Overall Confidence:** ${inference.overallConfidence}%
- **Training Module:** ${inference.training.confidence}% (40% weight)
- **Sleep Module:** ${inference.sleep.confidence}% (30% weight)
- **Stress Module:** ${inference.stress.confidence}% (30% weight)

${inference.overallConfidence >= 75
  ? 'High-quality data available. Generate highly personalized training and nutrition recommendations.'
  : inference.overallConfidence >= 50
  ? 'Good data quality. Provide personalized recommendations with some questionnaire supplementation.'
  : 'Limited objective data. Rely more on questionnaire while encouraging data integration.'}

---

## INSTRUCTIONS FOR AI PLAN GENERATION

1. **Prioritize objective data over questionnaire responses**
   - When training volume is available from Strava/Whoop, use it over user estimates
   - When recovery scores are available, adjust training recommendations accordingly
   - When HR zones are available, design intensity-based workouts

2. **Respect recovery metrics**
   - If overtraining risk is "high", MANDATE deload week
   - If recovery score is low (<67), reduce volume by 20-30%
   - Schedule rest days based on "optimalTrainingDays" pattern

3. **Align nutrition with training**
   - Use the calculated macronutrients from nutrition timing section
   - Adjust carb periodization based on training intensity distribution
   - Include pre/post-workout nutrition guidelines from data

4. **Address data gaps proactively**
   - If confidence < 75%, mention specific integrations that would improve personalization
   - Explain how connecting Strava/Whoop would unlock better training programming

5. **Cross-reference insights**
   - If high training load + poor sleep detected, prioritize sleep optimization
   - If high stress + training load, add extra recovery protocols
   - Use cross-correlation insights to create holistic recommendations

---

*Inference generated at: ${inference.inferredAt}*
`;

  return prompt;
}

// ============================================================================
// RESPONSE METADATA
// ============================================================================

/**
 * Generate metadata to attach to Forge plan response
 */
export function generateForgeInferenceMetadata(enhanced: ForgeEnhancedContext) {
  return {
    inferenceConfidence: enhanced.inference.overallConfidence,
    inferenceTimestamp: enhanced.inference.inferredAt,
    dataSourcesUsed: enhanced.inference.dataSourcesUsed,
    dataGaps: enhanced.inference.dataGaps,
    trainingDataSource: enhanced.inference.training.dataSource,
    trainingConfidence: enhanced.inference.training.confidence,
    overtrainingRisk: enhanced.inference.training.recovery.overtrainingRisk,
    avgRecoveryScore: enhanced.inference.training.recovery.avgRecoveryScore,
    inferredGoal: enhanced.inference.training.inferredGoal.primary,
  };
}
