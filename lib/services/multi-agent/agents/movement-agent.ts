/**
 * MovementAgent - Analyzes steps, active minutes, and sedentary patterns
 */

import { BaseAgent } from '../base-agent';
import { UserContext, AgentConfig } from '../types';

const CONFIG: AgentConfig = {
  agentId: 'movement_agent',
  agentName: 'MovementAgent',
  domain: 'MOVEMENT',
  requiredDataSources: ['apple_health', 'fitbit'],
  optionalDataSources: ['strava', 'whoop'],
  insightCategory: 'ACTIVITY',
};

export class MovementAgent extends BaseAgent {
  constructor() {
    super(CONFIG);
  }

  extractRelevantData(context: UserContext): Record<string, unknown> {
    const data: Record<string, unknown> = {};

    if (context.appleHealth) {
      data.appleHealth = {
        steps: context.appleHealth.steps,
        activeEnergy: context.appleHealth.activeEnergy,
        workouts: context.appleHealth.workouts?.length,
      };
    }

    if (context.fitbit) {
      data.fitbit = {
        steps: context.fitbit.steps,
        activeMinutes: context.fitbit.activeMinutes,
      };
    }

    if (context.strava?.weeklyStats) {
      data.strava = {
        weeklyWorkouts: context.strava.weeklyStats.workoutCount,
        totalDuration: context.strava.weeklyStats.totalDuration,
      };
    }

    if (context.whoop) {
      data.whoop = {
        avgStrainScore: context.whoop.avgStrainScore,
      };
    }

    data.sources = {
      appleHealth: context.availableDataSources.includes('apple_health'),
      fitbit: context.availableDataSources.includes('fitbit'),
      strava: context.availableDataSources.includes('strava'),
      whoop: context.availableDataSources.includes('whoop'),
    };

    return data;
  }

  buildPrompt(relevantData: Record<string, unknown>): string {
    return `You are a MOVEMENT & DAILY ACTIVITY SPECIALIST analyzing steps, active minutes, and sedentary behavior.

YOUR EXPERTISE:
- Daily step count analysis and optimization
- Active minutes tracking and goals
- Sedentary behavior patterns and breaks
- Movement consistency throughout the day
- Weekend vs weekday activity patterns
- NEAT (Non-Exercise Activity Thermogenesis)

AVAILABLE DATA:
${JSON.stringify(relevantData, null, 2)}

ANALYSIS INSTRUCTIONS:
1. Evaluate daily step counts against 10,000 step benchmark
2. Assess active minutes vs sedentary time ratio
3. Identify patterns (weekend slumps, workday sedentary periods)
4. Look for opportunities to add movement breaks
5. Consider the distribution of activity throughout the day
6. Recommend specific, actionable movement interventions

KEY INSIGHTS TO PROVIDE:
- Step consistency is more important than occasional high-step days
- Breaking up sedentary time every hour improves metabolic health
- Even light movement (walking) compounds into significant health benefits
- Weekend activity often drops 30-50% - this is an opportunity

Generate 1-2 high-quality insights with specific step counts and activity patterns.`;
  }
}
