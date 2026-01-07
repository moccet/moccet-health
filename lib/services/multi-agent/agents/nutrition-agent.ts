/**
 * NutritionAgent - Analyzes meal timing, eating patterns, and fasting windows
 */

import { BaseAgent } from '../base-agent';
import { UserContext, AgentConfig } from '../types';

const CONFIG: AgentConfig = {
  agentId: 'nutrition_agent',
  agentName: 'NutritionAgent',
  domain: 'NUTRITION',
  requiredDataSources: ['dexcom'],
  optionalDataSources: ['apple_health', 'oura'],
  insightCategory: 'NUTRITION',
};

export class NutritionAgent extends BaseAgent {
  constructor() {
    super(CONFIG);
  }

  extractRelevantData(context: UserContext): Record<string, unknown> {
    const data: Record<string, unknown> = {};

    // Dexcom glucose data reveals meal timing patterns
    if (context.dexcom) {
      data.glucose = {
        avgGlucose: context.dexcom.avgGlucose,
        avgFastingGlucose: context.dexcom.avgFastingGlucose,
        glucoseVariability: context.dexcom.glucoseVariability,
        timeInRange: context.dexcom.timeInRange,
        spikeTimes: context.dexcom.spikeTimes,
        spikeEvents: context.dexcom.spikeEvents,
      };
    }

    // Sleep data helps assess overnight fasting
    if (context.oura?.sleepConsistency) {
      data.sleepTiming = {
        avgBedtime: context.oura.sleepConsistency.avgBedtime,
        avgWakeTime: context.oura.sleepConsistency.avgWakeTime,
      };
    }

    // Blood biomarkers related to nutrition
    if (context.bloodBiomarkers?.biomarkers) {
      const nutritionBiomarkers = context.bloodBiomarkers.biomarkers.filter(b =>
        ['vitamin d', 'b12', 'iron', 'ferritin', 'folate', 'hba1c', 'fasting glucose', 'insulin']
          .some(name => b.name.toLowerCase().includes(name))
      );
      if (nutritionBiomarkers.length > 0) {
        data.nutritionBiomarkers = nutritionBiomarkers;
      }
    }

    data.sources = {
      dexcom: context.availableDataSources.includes('dexcom'),
      oura: context.availableDataSources.includes('oura'),
      bloodBiomarkers: context.availableDataSources.includes('blood_biomarkers'),
    };

    return data;
  }

  buildPrompt(relevantData: Record<string, unknown>): string {
    return `You are a NUTRITION & METABOLIC SPECIALIST analyzing eating patterns, meal timing, and metabolic health.

YOUR EXPERTISE:
- Meal timing and circadian rhythm alignment
- Fasting windows and time-restricted eating
- Glucose response patterns to meals
- Nutritional deficiency indicators from biomarkers
- Post-meal glucose spike management
- Metabolic flexibility assessment

AVAILABLE DATA:
${JSON.stringify(relevantData, null, 2)}

ANALYSIS INSTRUCTIONS:
1. Analyze glucose spike patterns to infer meal timing
2. Assess overnight fasting window based on glucose data
3. Evaluate fasting glucose levels and trends
4. Look for late-night eating patterns (glucose spikes after 9pm)
5. Consider nutrient timing relative to exercise and sleep
6. Identify opportunities for meal timing optimization

KEY INSIGHTS TO PROVIDE:
- Eating within a 10-12 hour window supports metabolic health
- Late-night eating impairs sleep quality and next-day glucose control
- Post-meal walks can reduce glucose spikes by 30-50%
- Consistent meal timing supports circadian rhythm
- Fasting glucose below 90 mg/dL is optimal

Generate 1-2 high-quality insights about nutrition timing and metabolic patterns.`;
  }
}
