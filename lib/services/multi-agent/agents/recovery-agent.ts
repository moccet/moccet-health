/**
 * RecoveryAgent - Analyzes physical recovery, HRV, and training readiness
 */

import { BaseAgent } from '../base-agent';
import { UserContext, AgentConfig } from '../types';

const CONFIG: AgentConfig = {
  agentId: 'recovery_agent',
  agentName: 'RecoveryAgent',
  domain: 'RECOVERY',
  requiredDataSources: ['whoop', 'oura', 'vital'],
  optionalDataSources: ['apple_health', 'fitbit'],
  insightCategory: 'RECOVERY',
};

export class RecoveryAgent extends BaseAgent {
  constructor() {
    super(CONFIG);
  }

  extractRelevantData(context: UserContext): Record<string, unknown> {
    const data: Record<string, unknown> = {};

    // Extract Whoop recovery data
    if (context.whoop) {
      data.whoop = {
        avgRecoveryScore: context.whoop.avgRecoveryScore,
        avgStrainScore: context.whoop.avgStrainScore,
        avgHRV: context.whoop.avgHRV,
        avgRestingHR: context.whoop.avgRestingHR,
        recoveryTrend: context.whoop.recoveryTrend,
        strainTrend: context.whoop.strainTrend,
        recoveryZones: context.whoop.recoveryZones,
        hrvPatterns: context.whoop.hrvPatterns,
      };
    }

    // Extract Oura readiness data
    if (context.oura) {
      data.oura = {
        avgReadinessScore: context.oura.avgReadinessScore,
        avgHRV: context.oura.avgHRV,
      };
    }

    // Track which sources are available
    data.sources = {
      whoop: context.availableDataSources.includes('whoop'),
      oura: context.availableDataSources.includes('oura'),
      vital: context.availableDataSources.includes('vital'),
    };

    return data;
  }

  buildPrompt(relevantData: Record<string, unknown>): string {
    return `You are a RECOVERY SPECIALIST analyzing physical recovery and training readiness.

YOUR EXPERTISE:
- HRV (Heart Rate Variability) interpretation and optimization
- Recovery score analysis and training readiness
- Strain vs recovery balance
- Autonomic nervous system health
- Overtraining detection and prevention

AVAILABLE DATA:
${this.formatAllData(relevantData)}

ANALYSIS INSTRUCTIONS:
1. Assess current recovery state (green/yellow/red zone)
2. Analyze HRV trends and what they indicate about ANS health
3. Evaluate strain vs recovery balance
4. Identify overtraining risk signals
5. Recommend optimal training intensity for today
6. Suggest recovery interventions if needed

Generate 1-2 high-quality insights with specific numbers.`;
  }

  private formatAllData(data: Record<string, unknown>): string {
    const sections: string[] = [];

    if (data.whoop) {
      const whoop = data.whoop as Record<string, unknown>;
      const lines: string[] = ['### Whoop Recovery Data:'];
      if (whoop.avgRecoveryScore) lines.push(`- Average Recovery Score: ${whoop.avgRecoveryScore}%`);
      if (whoop.avgStrainScore) lines.push(`- Average Strain: ${whoop.avgStrainScore}`);
      if (whoop.avgHRV) lines.push(`- Average HRV: ${whoop.avgHRV}ms`);
      if (whoop.avgRestingHR) lines.push(`- Average Resting HR: ${whoop.avgRestingHR} bpm`);
      if (whoop.recoveryTrend) lines.push(`- Recovery Trend: ${whoop.recoveryTrend}`);
      if (whoop.strainTrend) lines.push(`- Strain Trend: ${whoop.strainTrend}`);
      if (whoop.recoveryZones) {
        const zones = whoop.recoveryZones as Record<string, number>;
        lines.push(`- Recovery Zones: Green=${zones.greenDays}, Yellow=${zones.yellowDays}, Red=${zones.redDays}`);
      }
      if (whoop.hrvPatterns) {
        const hrv = whoop.hrvPatterns as Record<string, unknown>;
        lines.push(`- HRV Baseline: ${hrv.baseline}ms, Current Week: ${hrv.currentWeekAvg}ms, Trend: ${hrv.trend}`);
      }
      sections.push(lines.join('\n'));
    }

    if (data.oura) {
      const oura = data.oura as Record<string, unknown>;
      const lines: string[] = ['### Oura Readiness Data:'];
      if (oura.avgReadinessScore) lines.push(`- Average Readiness: ${oura.avgReadinessScore}`);
      if (oura.avgHRV) lines.push(`- Average HRV: ${oura.avgHRV}ms`);
      sections.push(lines.join('\n'));
    }

    if (sections.length === 0) {
      sections.push('No recovery data available. User should connect Whoop or Oura Ring.');
    }

    return sections.join('\n\n');
  }
}
