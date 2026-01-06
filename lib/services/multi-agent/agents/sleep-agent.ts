/**
 * SleepAgent - Analyzes sleep architecture, quality, and circadian patterns
 */

import { BaseAgent } from '../base-agent';
import { UserContext, AgentConfig } from '../types';

const CONFIG: AgentConfig = {
  agentId: 'sleep_agent',
  agentName: 'SleepAgent',
  domain: 'SLEEP',
  requiredDataSources: ['oura', 'whoop', 'apple_health'],
  optionalDataSources: ['fitbit'],
  insightCategory: 'SLEEP',
};

export class SleepAgent extends BaseAgent {
  constructor() {
    super(CONFIG);
  }

  extractRelevantData(context: UserContext): Record<string, unknown> {
    const data: Record<string, unknown> = {};

    // Extract Oura sleep data
    if (context.oura) {
      data.oura = {
        avgSleepScore: context.oura.avgSleepScore,
        sleepArchitecture: context.oura.sleepArchitecture,
        sleepConsistency: context.oura.sleepConsistency,
        sleepDebt: context.oura.sleepDebt,
      };
    }

    // Extract Whoop sleep data
    if (context.whoop) {
      data.whoop = {
        sleepPerformance: context.whoop.sleepPerformance,
      };
    }

    // Extract Apple Health sleep
    if (context.appleHealth?.sleep) {
      data.appleHealth = {
        averageHours: context.appleHealth.sleep.averageHours,
        quality: context.appleHealth.sleep.quality,
      };
    }

    data.sources = {
      oura: context.availableDataSources.includes('oura'),
      whoop: context.availableDataSources.includes('whoop'),
      appleHealth: context.availableDataSources.includes('apple_health'),
    };

    return data;
  }

  buildPrompt(relevantData: Record<string, unknown>): string {
    return `You are a SLEEP SPECIALIST analyzing sleep architecture, quality, and circadian patterns.

YOUR EXPERTISE:
- Sleep stage analysis (deep, REM, light, awake)
- Sleep debt accumulation and recovery
- Circadian rhythm optimization
- Sleep timing and consistency impact
- Sleep efficiency and quality metrics

AVAILABLE DATA:
${this.formatAllData(relevantData)}

ANALYSIS INSTRUCTIONS:
1. Assess overall sleep quality and duration
2. Analyze sleep architecture (deep, REM balance)
3. Evaluate sleep consistency and timing
4. Calculate and interpret sleep debt
5. Identify circadian rhythm disruptions
6. Recommend specific sleep optimizations

Generate 1-2 high-quality insights with specific numbers.`;
  }

  private formatAllData(data: Record<string, unknown>): string {
    const sections: string[] = [];

    if (data.oura) {
      const oura = data.oura as Record<string, unknown>;
      const lines: string[] = ['### Oura Sleep Data:'];
      if (oura.avgSleepScore) lines.push(`- Average Sleep Score: ${oura.avgSleepScore}`);

      if (oura.sleepArchitecture) {
        const arch = oura.sleepArchitecture as Record<string, unknown>;
        lines.push(`- Deep Sleep: ${arch.deepSleepPercent}% (${arch.avgDeepSleepMins} min)`);
        lines.push(`- REM Sleep: ${arch.remSleepPercent}% (${arch.avgRemSleepMins} min)`);
        lines.push(`- Sleep Efficiency: ${arch.sleepEfficiency}%`);
      }

      if (oura.sleepConsistency) {
        const cons = oura.sleepConsistency as Record<string, unknown>;
        lines.push(`- Avg Bedtime: ${cons.avgBedtime}`);
        lines.push(`- Avg Wake Time: ${cons.avgWakeTime}`);
        lines.push(`- Consistency Score: ${cons.consistencyScore}`);
      }

      if (oura.sleepDebt) {
        const debt = oura.sleepDebt as Record<string, unknown>;
        lines.push(`- Sleep Debt: ${debt.accumulatedHours} hours accumulated`);
        lines.push(`- Weekly Deficit: ${debt.weeklyDeficit} hours`);
      }

      sections.push(lines.join('\n'));
    }

    if (data.whoop) {
      const whoop = data.whoop as Record<string, unknown>;
      const lines: string[] = ['### Whoop Sleep Data:'];
      if (whoop.sleepPerformance) lines.push(`- Sleep Performance: ${whoop.sleepPerformance}%`);
      sections.push(lines.join('\n'));
    }

    if (data.appleHealth) {
      const ah = data.appleHealth as Record<string, unknown>;
      const lines: string[] = ['### Apple Health Sleep:'];
      if (ah.averageHours) lines.push(`- Average Hours: ${ah.averageHours}`);
      if (ah.quality) lines.push(`- Quality: ${ah.quality}`);
      sections.push(lines.join('\n'));
    }

    if (sections.length === 0) {
      sections.push('No sleep data available.');
    }

    return sections.join('\n\n');
  }
}
