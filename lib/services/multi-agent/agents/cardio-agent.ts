/**
 * CardioAgent - Analyzes heart rate trends, resting HR, and cardiovascular fitness
 */

import { BaseAgent } from '../base-agent';
import { UserContext, AgentConfig } from '../types';

const CONFIG: AgentConfig = {
  agentId: 'cardio_agent',
  agentName: 'CardioAgent',
  domain: 'CARDIO',
  requiredDataSources: ['whoop', 'oura', 'fitbit', 'apple_health'],
  optionalDataSources: ['strava'],
  insightCategory: 'CARDIO',
};

export class CardioAgent extends BaseAgent {
  constructor() {
    super(CONFIG);
  }

  extractRelevantData(context: UserContext): Record<string, unknown> {
    const data: Record<string, unknown> = {};

    if (context.whoop) {
      data.whoop = {
        avgRestingHR: context.whoop.avgRestingHR,
        avgHRV: context.whoop.avgHRV,
        hrvPatterns: context.whoop.hrvPatterns,
        avgStrainScore: context.whoop.avgStrainScore,
      };
    }

    if (context.oura) {
      data.oura = {
        avgHRV: context.oura.avgHRV,
        avgReadinessScore: context.oura.avgReadinessScore,
      };
    }

    if (context.fitbit?.heartRate) {
      data.fitbit = {
        restingHR: context.fitbit.heartRate.resting,
        zones: context.fitbit.heartRate.zones,
      };
    }

    if (context.appleHealth?.heartRate) {
      data.appleHealth = {
        avgHeartRate: context.appleHealth.heartRate.average,
        restingHR: context.appleHealth.heartRate.resting,
      };
    }

    if (context.strava?.recentWorkouts) {
      data.strava = {
        workoutsWithHR: context.strava.recentWorkouts?.filter(w => w.avgHeartRate),
      };
    }

    data.sources = {
      whoop: context.availableDataSources.includes('whoop'),
      oura: context.availableDataSources.includes('oura'),
      fitbit: context.availableDataSources.includes('fitbit'),
      appleHealth: context.availableDataSources.includes('apple_health'),
      strava: context.availableDataSources.includes('strava'),
    };

    return data;
  }

  buildPrompt(relevantData: Record<string, unknown>): string {
    return `You are a CARDIOVASCULAR HEALTH SPECIALIST analyzing heart rate data and cardiovascular fitness.

YOUR EXPERTISE:
- Resting heart rate trends and what they indicate
- Heart rate variability (HRV) optimization
- Cardiovascular fitness assessment
- Heart rate zone analysis during exercise
- Recovery efficiency based on HR return to baseline
- Autonomic nervous system balance

AVAILABLE DATA:
${JSON.stringify(relevantData, null, 2)}

ANALYSIS INSTRUCTIONS:
1. Assess resting heart rate trends (lower is generally better)
2. Analyze HRV patterns - higher and more consistent is optimal
3. Evaluate cardiovascular efficiency during exercise
4. Identify factors that may be affecting heart health
5. Look for correlations between HR and sleep/stress
6. Recommend specific interventions to improve cardiovascular fitness

KEY METRICS TO REFERENCE:
- Resting HR below 60 bpm indicates excellent cardiovascular fitness
- HRV trending upward indicates improving fitness and recovery
- Consistent HR zones during exercise indicates good training adaptation

Generate 1-2 high-quality insights with specific heart rate numbers and trends.`;
  }
}
