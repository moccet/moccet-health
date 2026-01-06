/**
 * BloodAgent - Analyzes blood biomarkers, nutritional status, and metabolic health
 */

import { BaseAgent } from '../base-agent';
import { UserContext, AgentConfig } from '../types';

const CONFIG: AgentConfig = {
  agentId: 'blood_agent',
  agentName: 'BloodAgent',
  domain: 'BLOOD',
  requiredDataSources: ['blood_biomarkers'],
  optionalDataSources: [],
  insightCategory: 'BLOOD',
};

export class BloodAgent extends BaseAgent {
  constructor() {
    super(CONFIG);
  }

  extractRelevantData(context: UserContext): Record<string, unknown> {
    const data: Record<string, unknown> = {};

    if (context.bloodBiomarkers) {
      data.bloodBiomarkers = {
        summary: context.bloodBiomarkers.summary,
        concerns: context.bloodBiomarkers.concerns,
        positives: context.bloodBiomarkers.positives,
        biomarkers: context.bloodBiomarkers.biomarkers,
      };
    }

    data.sources = {
      bloodBiomarkers: context.availableDataSources.includes('blood_biomarkers'),
    };

    return data;
  }

  buildPrompt(relevantData: Record<string, unknown>): string {
    const bloodData = relevantData.bloodBiomarkers as Record<string, unknown> | undefined;

    let biomarkerText = 'No blood biomarker data available.';
    if (bloodData?.biomarkers) {
      const markers = bloodData.biomarkers as Array<Record<string, unknown>>;
      biomarkerText = markers.map(m =>
        `- ${m.name}: ${m.value} ${m.unit} (${m.status})${m.healthImplications ? ` - ${m.healthImplications}` : ''}`
      ).join('\n');
    }

    return `You are a BLOOD BIOMARKER SPECIALIST analyzing lab results and metabolic health.

YOUR EXPERTISE:
- Blood biomarker interpretation
- Nutritional deficiency detection
- Metabolic health assessment
- Inflammation markers
- Hormone levels
- Cardiovascular risk markers

AVAILABLE DATA:
### Blood Analysis Summary:
${bloodData?.summary || 'No summary available'}

### Key Concerns:
${(bloodData?.concerns as string[] || []).map(c => `- ${c}`).join('\n') || 'None identified'}

### Positive Findings:
${(bloodData?.positives as string[] || []).map(p => `- ${p}`).join('\n') || 'None identified'}

### Biomarkers:
${biomarkerText}

ANALYSIS INSTRUCTIONS:
1. Identify the most impactful biomarker findings
2. Connect biomarkers to energy, recovery, and performance
3. Suggest targeted nutritional interventions
4. Recommend specific supplements if appropriate
5. Indicate when to retest

IMPORTANT: Blood tests are static snapshots. Focus on actionable interventions.
Maximum 1 insight from blood data to avoid over-reliance on static data.

Generate 1 high-quality insight with specific numbers.`;
  }
}
