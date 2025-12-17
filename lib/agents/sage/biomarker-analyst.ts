/**
 * Biomarker Analyst Agent
 *
 * Purpose: Deep interpretation of blood work with nutritional recommendations
 * Model: GPT-4o (requires reasoning to correlate markers and prioritize interventions)
 * Cost: ~$0.03 per call
 *
 * This agent analyzes blood work results and provides actionable nutritional
 * strategies to address any concerns. It identifies patterns, correlations,
 * and prioritizes interventions based on severity and impact.
 */

import OpenAI from 'openai';
import { ClientProfileCard, NutritionBiomarkerFlag } from '../../types/client-profile';
import { BiomarkerAnalystOutput, BiomarkerAnalysis } from '../../types/sage-plan-output';

// ============================================================================
// OPENAI CLIENT
// ============================================================================

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  return new OpenAI({ apiKey });
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

const SYSTEM_PROMPT = `You are a Clinical Nutrition Biomarker Specialist — an expert at interpreting blood work and translating findings into actionable nutritional strategies.

Your task is to analyze the client's biomarker data and provide comprehensive nutritional recommendations.

CRITICAL RULES:
1. NEVER use colons (:) in your text — use em dashes (—) instead
2. Use "you" and "your" when addressing the client
3. Be specific about which markers need attention and why
4. Prioritize interventions by severity and impact
5. Always recommend whole food sources before supplements
6. Consider interactions between markers (e.g., iron and vitamin C, calcium and vitamin D)

OUTPUT FORMAT:
Return valid JSON with this exact structure:
{
  "biomarkerAnalysis": {
    "summary": "2-3 paragraph summary of overall biomarker status and key patterns",
    "concerns": ["Concern 1 with specific marker reference", "Concern 2..."],
    "positives": ["Positive finding 1", "Positive finding 2..."],
    "optimizations": ["Optimization opportunity 1", "Optimization opportunity 2..."],
    "recommendations": {
      "dietary": ["Specific dietary recommendation 1", "..."],
      "lifestyle": ["Lifestyle recommendation related to biomarkers", "..."],
      "supplements": ["Evidence-based supplement recommendation", "..."],
      "followUp": ["Suggested follow-up tests", "..."],
      "retestTiming": "Suggested timeframe for retesting"
    }
  },
  "nutritionalPriorities": [
    {
      "concern": "Name of the concern (e.g., Low Vitamin D)",
      "markers": ["Vitamin D", "PTH if relevant"],
      "severity": "mild|moderate|severe",
      "nutritionalStrategy": "Detailed strategy to address this concern",
      "foodsToEmphasize": ["Food 1", "Food 2", "Food 3"],
      "foodsToLimit": ["Food to avoid 1", "Food to avoid 2"]
    }
  ],
  "supplementFlags": [
    {
      "supplement": "Supplement name",
      "rationale": "Why this supplement is recommended based on biomarkers",
      "priority": "essential|recommended|optional"
    }
  ]
}

SEVERITY GUIDELINES:
- severe — Values significantly outside optimal range, potential health risk
- moderate — Values suboptimal, affecting wellbeing but not immediately dangerous
- mild — Slightly suboptimal, opportunity for optimization

IMPORTANT:
- If blood work shows optimal values, still provide optimization strategies
- Always correlate related markers (e.g., if iron is low, check ferritin and TIBC)
- Consider the client's goals when prioritizing interventions
- Be encouraging but honest about concerning findings`;

// ============================================================================
// BUILD USER PROMPT
// ============================================================================

function buildUserPrompt(clientProfile: ClientProfileCard): string {
  const { profile, biomarkerFlags, computedMetrics, constraints, rawDataAvailable } = clientProfile;

  let prompt = `# CLIENT BIOMARKER ANALYSIS

## Client Overview
- Name — ${profile.firstName}
- Age — ${profile.age} years
- Gender — ${profile.gender}
- Weight — ${profile.weightKg} kg
- Primary Goal — ${profile.drivingGoal}
- Activity Level — ${profile.activityLevel}
- Eating Style — ${profile.eatingStyle}

## Current Health Status
- Sleep Quality — ${computedMetrics.sleepScore}
- Stress Level — ${computedMetrics.stressScore}
- Metabolic Health — ${computedMetrics.metabolicHealth}

## Blood Work Available
${rawDataAvailable.bloodAnalysis ? 'Yes — full blood analysis provided' : 'Limited or no blood work data'}

`;

  if (biomarkerFlags.length > 0) {
    prompt += `## Biomarker Results\n\n`;

    // Group by priority
    const critical = biomarkerFlags.filter(f => f.priority === 'critical');
    const high = biomarkerFlags.filter(f => f.priority === 'high');
    const medium = biomarkerFlags.filter(f => f.priority === 'medium');
    const low = biomarkerFlags.filter(f => f.priority === 'low');

    if (critical.length > 0) {
      prompt += `### CRITICAL PRIORITY\n`;
      for (const flag of critical) {
        prompt += formatBiomarkerFlag(flag);
      }
    }

    if (high.length > 0) {
      prompt += `### HIGH PRIORITY\n`;
      for (const flag of high) {
        prompt += formatBiomarkerFlag(flag);
      }
    }

    if (medium.length > 0) {
      prompt += `### MEDIUM PRIORITY\n`;
      for (const flag of medium) {
        prompt += formatBiomarkerFlag(flag);
      }
    }

    if (low.length > 0) {
      prompt += `### LOW PRIORITY / OPTIMAL\n`;
      for (const flag of low) {
        prompt += formatBiomarkerFlag(flag);
      }
    }
  } else {
    prompt += `## Biomarker Results\nNo specific biomarker flags identified — either blood work not available or all markers within optimal range.\n`;
  }

  // Add dietary constraints that affect biomarker strategies
  if (constraints.dietary.length > 0) {
    prompt += `\n## Dietary Constraints (must respect in food recommendations)\n`;
    for (const constraint of constraints.dietary) {
      prompt += `- ${constraint.item} — ${constraint.type} (${constraint.severity})\n`;
    }
  }

  // Add medications that might affect biomarkers
  if (constraints.medications.length > 0) {
    prompt += `\n## Current Medications\n- ${constraints.medications.join('\n- ')}\n`;
  }

  // Add current supplements
  if (constraints.currentSupplements.length > 0) {
    prompt += `\n## Current Supplements\n- ${constraints.currentSupplements.join('\n- ')}\n`;
  }

  prompt += `
## YOUR TASK
Analyze the biomarker data and provide:
1. A comprehensive summary of their biomarker status
2. Prioritized list of concerns with specific nutritional strategies
3. Foods to emphasize and foods to limit for each concern
4. Evidence-based supplement recommendations where appropriate
5. Follow-up testing recommendations

Remember to respect their dietary constraints when recommending foods.
Create the JSON structure as specified above.`;

  return prompt;
}

function formatBiomarkerFlag(flag: NutritionBiomarkerFlag): string {
  let output = `**${flag.marker}** — ${flag.status.toUpperCase()}`;
  if (flag.value) output += ` (${flag.value}${flag.unit ? ' ' + flag.unit : ''})`;
  output += `\n`;
  output += `- Implication — ${flag.implication}\n`;
  if (flag.foodRecommendations.length > 0) {
    output += `- Initial food suggestions — ${flag.foodRecommendations.join(', ')}\n`;
  }
  if (flag.supplementRecommendation) {
    output += `- Supplement note — ${flag.supplementRecommendation}\n`;
  }
  output += `\n`;
  return output;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

export async function runBiomarkerAnalyst(
  clientProfile: ClientProfileCard
): Promise<BiomarkerAnalystOutput> {
  console.log('[Biomarker Analyst] Starting blood work analysis...');
  console.log(`[Biomarker Analyst] Client — ${clientProfile.profile.firstName}`);
  console.log(`[Biomarker Analyst] Biomarker flags — ${clientProfile.biomarkerFlags.length}`);

  // If no blood work available, return minimal analysis
  if (!clientProfile.rawDataAvailable.bloodAnalysis && clientProfile.biomarkerFlags.length === 0) {
    console.log('[Biomarker Analyst] No blood work available — returning general recommendations');
    return createNoBloodWorkOutput(clientProfile);
  }

  const openai = getOpenAIClient();
  const userPrompt = buildUserPrompt(clientProfile);

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.6, // Lower temperature for more consistent medical-adjacent advice
      max_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from GPT-4o');
    }

    const result = JSON.parse(content);

    console.log('[Biomarker Analyst] Analysis complete');
    console.log(`[Biomarker Analyst] Tokens used — ${response.usage?.total_tokens || 'unknown'}`);

    return normalizeOutput(result, clientProfile);
  } catch (error) {
    console.error('[Biomarker Analyst] Error:', error);
    console.log('[Biomarker Analyst] Using fallback analysis');
    return createFallbackOutput(clientProfile);
  }
}

// ============================================================================
// NORMALIZE OUTPUT
// ============================================================================

function normalizeOutput(
  result: Record<string, unknown>,
  clientProfile: ClientProfileCard
): BiomarkerAnalystOutput {
  const analysis = result.biomarkerAnalysis as Record<string, unknown> || {};
  const priorities = result.nutritionalPriorities as Array<Record<string, unknown>> || [];
  const supplements = result.supplementFlags as Array<Record<string, unknown>> || [];

  return {
    biomarkerAnalysis: {
      summary: (analysis.summary as string) || createDefaultSummary(clientProfile),
      concerns: (analysis.concerns as string[]) || [],
      positives: (analysis.positives as string[]) || ['Blood work analysis provides baseline for optimization'],
      optimizations: (analysis.optimizations as string[]) || [],
      recommendations: {
        dietary: ((analysis.recommendations as Record<string, unknown>)?.dietary as string[]) || [],
        lifestyle: ((analysis.recommendations as Record<string, unknown>)?.lifestyle as string[]) || [],
        supplements: ((analysis.recommendations as Record<string, unknown>)?.supplements as string[]) || [],
        followUp: ((analysis.recommendations as Record<string, unknown>)?.followUp as string[]) || [],
        retestTiming: ((analysis.recommendations as Record<string, unknown>)?.retestTiming as string) || '3-6 months',
      },
    },
    nutritionalPriorities: priorities.map(p => ({
      concern: (p.concern as string) || 'General optimization',
      markers: (p.markers as string[]) || [],
      severity: (p.severity as 'mild' | 'moderate' | 'severe') || 'mild',
      nutritionalStrategy: (p.nutritionalStrategy as string) || '',
      foodsToEmphasize: (p.foodsToEmphasize as string[]) || [],
      foodsToLimit: (p.foodsToLimit as string[]) || [],
    })),
    supplementFlags: supplements.map(s => ({
      supplement: (s.supplement as string) || '',
      rationale: (s.rationale as string) || '',
      priority: (s.priority as 'essential' | 'recommended' | 'optional') || 'optional',
    })),
  };
}

// ============================================================================
// NO BLOOD WORK OUTPUT
// ============================================================================

function createNoBloodWorkOutput(clientProfile: ClientProfileCard): BiomarkerAnalystOutput {
  const { profile, computedMetrics } = clientProfile;

  return {
    biomarkerAnalysis: {
      summary: `Without blood work data, we're providing general nutritional guidance optimized for your goal of ${profile.drivingGoal}. We strongly recommend getting comprehensive blood work done to personalize your nutrition plan further. Key markers to request include — Complete Blood Count (CBC), Comprehensive Metabolic Panel, Lipid Panel, Vitamin D, B12, Iron studies, and Thyroid panel.\n\nBased on your lifestyle factors — ${computedMetrics.sleepScore} sleep quality and ${computedMetrics.stressScore} stress levels — we've included recommendations that support overall health optimization.`,
      concerns: [],
      positives: ['Opportunity to establish baseline with blood work'],
      optimizations: [
        'Consider comprehensive blood panel to personalize recommendations',
        'Focus on foundational nutrition while awaiting data',
      ],
      recommendations: {
        dietary: [
          'Emphasize nutrient-dense whole foods',
          'Include variety of colorful vegetables daily',
          'Consume adequate protein at each meal',
        ],
        lifestyle: [
          'Prioritize consistent sleep schedule',
          'Incorporate stress management practices',
        ],
        supplements: [
          'Vitamin D3 — commonly deficient, safe to supplement',
          'Omega-3 — broad benefits for most people',
        ],
        followUp: [
          'Comprehensive Metabolic Panel',
          'Complete Blood Count',
          'Vitamin D, 25-Hydroxy',
          'Vitamin B12',
          'Iron Panel (Ferritin, TIBC)',
          'Lipid Panel',
          'HbA1c',
        ],
        retestTiming: 'Recommend baseline testing as soon as possible',
      },
    },
    nutritionalPriorities: [
      {
        concern: 'Baseline Optimization (No Blood Work)',
        markers: [],
        severity: 'mild',
        nutritionalStrategy: 'Focus on foundational nutrition principles while awaiting blood work data',
        foodsToEmphasize: [
          'Leafy greens',
          'Fatty fish',
          'Colorful vegetables',
          'Quality proteins',
          'Whole grains',
          'Nuts and seeds',
        ],
        foodsToLimit: [
          'Processed foods',
          'Added sugars',
          'Refined carbohydrates',
          'Excessive alcohol',
        ],
      },
    ],
    supplementFlags: [
      {
        supplement: 'Vitamin D3',
        rationale: 'Commonly deficient in most populations, supports immune function and bone health',
        priority: 'recommended',
      },
      {
        supplement: 'Omega-3 (EPA/DHA)',
        rationale: 'Supports cardiovascular health, brain function, and reduces inflammation',
        priority: 'recommended',
      },
    ],
  };
}

// ============================================================================
// FALLBACK OUTPUT
// ============================================================================

function createDefaultSummary(clientProfile: ClientProfileCard): string {
  const { biomarkerFlags, profile } = clientProfile;

  if (biomarkerFlags.length === 0) {
    return `Based on the available data, your biomarkers appear to be within acceptable ranges. However, we recommend comprehensive blood work to identify specific optimization opportunities for your goal of ${profile.drivingGoal}.`;
  }

  const concerns = biomarkerFlags.filter(f => f.status !== 'optimal');
  const optimal = biomarkerFlags.filter(f => f.status === 'optimal');

  let summary = `Your blood work analysis reveals ${concerns.length} area${concerns.length !== 1 ? 's' : ''} for improvement and ${optimal.length} marker${optimal.length !== 1 ? 's' : ''} in optimal range. `;

  if (concerns.length > 0) {
    const highPriority = concerns.filter(f => f.priority === 'high' || f.priority === 'critical');
    if (highPriority.length > 0) {
      summary += `Priority focus should be on ${highPriority.map(f => f.marker).join(' and ')}, which require attention through targeted nutrition strategies. `;
    }
  }

  summary += `\n\nThe recommendations below are designed to address these findings through food-first approaches, with supplements suggested where dietary interventions alone may be insufficient.`;

  return summary;
}

function createFallbackOutput(clientProfile: ClientProfileCard): BiomarkerAnalystOutput {
  const { biomarkerFlags, profile, constraints } = clientProfile;

  // Generate priorities from biomarker flags
  const nutritionalPriorities = biomarkerFlags
    .filter(f => f.status !== 'optimal')
    .slice(0, 5)
    .map(flag => ({
      concern: `${flag.marker} — ${flag.status}`,
      markers: [flag.marker],
      severity: flag.priority === 'critical' || flag.priority === 'high' ? 'severe' as const :
                flag.priority === 'medium' ? 'moderate' as const : 'mild' as const,
      nutritionalStrategy: flag.implication,
      foodsToEmphasize: flag.foodRecommendations,
      foodsToLimit: [] as string[],
    }));

  // Generate supplement flags from biomarker recommendations
  const supplementFlags = biomarkerFlags
    .filter(f => f.supplementRecommendation)
    .map(flag => ({
      supplement: flag.supplementRecommendation || '',
      rationale: `Recommended based on ${flag.status} ${flag.marker} levels`,
      priority: flag.priority === 'critical' || flag.priority === 'high' ? 'essential' as const :
                flag.priority === 'medium' ? 'recommended' as const : 'optional' as const,
    }));

  return {
    biomarkerAnalysis: {
      summary: createDefaultSummary(clientProfile),
      concerns: biomarkerFlags
        .filter(f => f.status !== 'optimal')
        .map(f => `${f.marker} is ${f.status} — ${f.implication}`),
      positives: biomarkerFlags
        .filter(f => f.status === 'optimal')
        .map(f => `${f.marker} is in optimal range`),
      optimizations: [
        'Continue monitoring markers quarterly',
        'Adjust nutrition based on response',
      ],
      recommendations: {
        dietary: biomarkerFlags
          .filter(f => f.foodRecommendations.length > 0)
          .flatMap(f => f.foodRecommendations)
          .slice(0, 5),
        lifestyle: [
          'Optimize sleep for better nutrient absorption',
          'Manage stress to support metabolic health',
        ],
        supplements: biomarkerFlags
          .filter(f => f.supplementRecommendation)
          .map(f => f.supplementRecommendation!)
          .slice(0, 3),
        followUp: ['Retest flagged markers in recommended timeframe'],
        retestTiming: '3-6 months',
      },
    },
    nutritionalPriorities,
    supplementFlags,
  };
}
