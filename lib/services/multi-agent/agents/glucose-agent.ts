/**
 * GlucoseAgent - Analyzes continuous glucose data, variability, and metabolic patterns
 */

import { BaseAgent } from '../base-agent';
import { UserContext, AgentConfig } from '../types';

const CONFIG: AgentConfig = {
  agentId: 'glucose_agent',
  agentName: 'GlucoseAgent',
  domain: 'GLUCOSE',
  requiredDataSources: ['dexcom'],
  optionalDataSources: [],
  insightCategory: 'GLUCOSE',
};

export class GlucoseAgent extends BaseAgent {
  constructor() {
    super(CONFIG);
  }

  extractRelevantData(context: UserContext): Record<string, unknown> {
    const data: Record<string, unknown> = {};

    if (context.dexcom) {
      data.dexcom = {
        avgGlucose: context.dexcom.avgGlucose,
        avgFastingGlucose: context.dexcom.avgFastingGlucose,
        glucoseVariability: context.dexcom.glucoseVariability,
        timeInRange: context.dexcom.timeInRange,
        spikeTimes: context.dexcom.spikeTimes,
        spikeEvents: context.dexcom.spikeEvents,
      };
    }

    data.sources = {
      dexcom: context.availableDataSources.includes('dexcom'),
    };

    return data;
  }

  buildPrompt(relevantData: Record<string, unknown>): string {
    const dexcom = relevantData.dexcom as Record<string, unknown> | undefined;

    return `You are a GLUCOSE & METABOLIC HEALTH SPECIALIST analyzing continuous glucose monitoring data.

YOUR EXPERTISE:
- Glucose variability analysis
- Spike pattern identification
- Time in range optimization
- Fasting glucose interpretation
- Meal timing and glucose response
- Energy stability optimization

AVAILABLE DATA:
### Glucose Metrics:
${dexcom ? `
- Average Glucose: ${dexcom.avgGlucose} mg/dL
- Fasting Glucose: ${dexcom.avgFastingGlucose || 'N/A'} mg/dL
- Glucose Variability: ${dexcom.glucoseVariability}%
- Time in Range (70-180): ${dexcom.timeInRange}%
- Common Spike Times: ${(dexcom.spikeTimes as string[] || []).join(', ') || 'N/A'}
` : 'No CGM data available.'}

${dexcom?.spikeEvents ? `
### Recent Spike Events:
${(dexcom.spikeEvents as Array<Record<string, unknown>>).slice(0, 5).map(e =>
  `- ${e.time}: ${e.value} mg/dL${e.trigger ? ` (trigger: ${e.trigger})` : ''}`
).join('\n')}
` : ''}

ANALYSIS INSTRUCTIONS:
1. Assess glucose stability and variability
2. Identify problematic spike patterns
3. Analyze time in optimal range
4. Connect glucose patterns to energy and focus
5. Recommend meal timing optimizations
6. Suggest foods/behaviors to reduce variability

IMPORTANT: Focus on actionable interventions to improve glucose stability.

Generate 1-2 high-quality insights with specific numbers.`;
  }
}
