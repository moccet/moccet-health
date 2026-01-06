/**
 * ActivityAgent - Analyzes workout patterns, training zones, and exercise progress
 */

import { BaseAgent } from '../base-agent';
import { UserContext, AgentConfig } from '../types';

const CONFIG: AgentConfig = {
  agentId: 'activity_agent',
  agentName: 'ActivityAgent',
  domain: 'ACTIVITY',
  requiredDataSources: ['strava', 'fitbit', 'apple_health', 'whoop'],
  optionalDataSources: [],
  insightCategory: 'ACTIVITY',
};

export class ActivityAgent extends BaseAgent {
  constructor() {
    super(CONFIG);
  }

  extractRelevantData(context: UserContext): Record<string, unknown> {
    const data: Record<string, unknown> = {};

    if (context.strava) {
      data.strava = {
        recentWorkouts: context.strava.recentWorkouts,
        weeklyStats: context.strava.weeklyStats,
      };
    }

    if (context.appleHealth?.workouts) {
      data.appleHealth = {
        workouts: context.appleHealth.workouts,
        activeEnergy: context.appleHealth.activeEnergy,
      };
    }

    if (context.fitbit) {
      data.fitbit = {
        activeMinutes: context.fitbit.activeMinutes,
      };
    }

    if (context.whoop) {
      data.whoop = {
        avgStrainScore: context.whoop.avgStrainScore,
        strainTrend: context.whoop.strainTrend,
      };
    }

    data.sources = {
      strava: context.availableDataSources.includes('strava'),
      appleHealth: context.availableDataSources.includes('apple_health'),
      fitbit: context.availableDataSources.includes('fitbit'),
      whoop: context.availableDataSources.includes('whoop'),
    };

    return data;
  }

  buildPrompt(relevantData: Record<string, unknown>): string {
    return `You are an ACTIVITY & FITNESS SPECIALIST analyzing workout patterns and training progress.

YOUR EXPERTISE:
- Workout frequency and consistency analysis
- Training load progression
- Exercise variety and balance
- Heart rate zone training
- Active recovery optimization
- Training periodization

AVAILABLE DATA:
${JSON.stringify(relevantData, null, 2)}

ANALYSIS INSTRUCTIONS:
1. Assess workout frequency and consistency
2. Analyze training load and progression
3. Evaluate exercise variety (cardio vs strength)
4. Identify opportunities for improvement
5. Recommend specific workout adjustments
6. Consider recovery needs when suggesting intensity

Generate 1-2 high-quality insights with specific numbers.`;
  }
}
