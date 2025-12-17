/**
 * Chief Nutritionist Agent
 *
 * Purpose: Final coherence, executive summary, cross-references, and supplement recommendations
 * Model: GPT-4o (requires genuine reasoning for cross-references and coherence)
 * Cost: ~$0.045 per call
 *
 * This agent takes all specialist outputs and creates a cohesive final plan.
 * It crafts the personalized greeting, executive summary, and ensures everything
 * reads as a unified document.
 */

import OpenAI from 'openai';
import { ClientProfileCard } from '../../types/client-profile';
import {
  ChiefNutritionistOutput,
  NutritionArchitectOutput,
  BiomarkerAnalystOutput,
  MealPlannerOutput,
  MicronutrientSpecialistOutput,
  LifestyleIntegratorOutput,
  SupplementRecommendations,
  SupplementRecommendation,
} from '../../types/sage-plan-output';

// ============================================================================
// TYPES
// ============================================================================

export interface ChiefNutritionistInput {
  clientProfile: ClientProfileCard;
  nutritionFramework: NutritionArchitectOutput;
  biomarkerAnalysis?: BiomarkerAnalystOutput;
  mealPlan: MealPlannerOutput;
  micronutrients: MicronutrientSpecialistOutput;
  lifestyle: LifestyleIntegratorOutput;
}

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

const SYSTEM_PROMPT = `You are the Chief Nutritionist — a master at creating cohesive, personalized nutrition experiences. Your role is to take the outputs from specialized agents and weave them into a unified narrative that feels like it was crafted by a single expert who knows the client deeply.

Your responsibilities:
1. Craft a personalized greeting that makes the client feel seen
2. Write an executive summary that ties everything together
3. Create comprehensive supplement recommendations based on biomarkers and needs
4. Generate cross-references that connect nutrition, lifestyle, and supplements

CRITICAL RULES:
1. NEVER use colons (:) in your text — use em dashes (—) instead
2. Use "you" and "your" when addressing the client
3. Reference SPECIFIC data from their profile and ecosystem
4. Keep tone warm, professional, and encouraging
5. Cross-references should feel natural, not forced
6. The executive summary should make the client excited to start
7. IMPORTANT — If ecosystem insights are provided (Whoop, Gmail, Oura, Outlook), you MUST reference at least 2-3 of them specifically in the executive summary

EXECUTIVE SUMMARY REQUIREMENTS:
- Mention specific data points from connected services
- Connect ecosystem insights to the nutrition approach
- Reference biomarker data if available
- Make the client feel that their connected data made a real difference
- 2-3 paragraphs that inspire action

SUPPLEMENT RECOMMENDATIONS:
- Essential — 3-5 supplements based on biomarkers and critical needs
- Optional — 2-4 supplements for optimization
- Include dosage, timing, and clear rationale for each
- Consider interactions with medications if any

OUTPUT FORMAT:
Return valid JSON with this exact structure:
{
  "personalizedGreeting": "Name's Personalized Nutrition Plan",
  "executiveSummary": "2-3 paragraphs that tie everything together and excite the client",
  "supplementRecommendations": {
    "essential": [
      {
        "name": "Supplement name",
        "dosage": "Specific dosage",
        "timing": "When to take",
        "rationale": "Why this supplement for this person",
        "benefits": "Expected benefits",
        "duration": "How long to take"
      }
    ],
    "optional": [...],
    "considerations": "Any warnings or interactions",
    "personalizedNotes": "Notes specific to this client"
  },
  "crossReferences": {
    "nutrition": ["Cross-reference connecting nutrition to other areas", "..."],
    "lifestyle": ["Cross-reference connecting lifestyle to nutrition", "..."],
    "supplements": ["Cross-reference connecting supplements to biomarkers", "..."]
  }
}`;

// ============================================================================
// BUILD USER PROMPT
// ============================================================================

function buildUserPrompt(input: ChiefNutritionistInput): string {
  const {
    clientProfile,
    nutritionFramework,
    biomarkerAnalysis,
    mealPlan,
    micronutrients,
    lifestyle,
  } = input;

  const { profile, computedMetrics, keyInsights, biomarkerFlags, constraints } = clientProfile;

  // Extract ecosystem insights by source
  const ecosystemSummary = keyInsights
    .slice(0, 6)
    .map(i => `[${i.source.toUpperCase()}] ${i.insight}`)
    .join('\n');

  // Summarize biomarker concerns
  const biomarkerSummary = biomarkerFlags.length > 0
    ? biomarkerFlags.map(f => `${f.marker} — ${f.status}`).join(', ')
    : 'No significant concerns — general optimization focus';

  // Get key nutrition targets
  const nutritionStructure = nutritionFramework.nutritionOverview?.nutritionStructure;

  // Get supplement flags from biomarker analysis
  const supplementFlags = biomarkerAnalysis?.supplementFlags || [];

  // Get micronutrient priorities
  const nutrientPriorities = micronutrients.micronutrientFocus.nutrients
    .filter(n => n.priority === 'essential')
    .map(n => n.nutrient)
    .slice(0, 5);

  return `# CHIEF NUTRITIONIST FINAL ASSEMBLY

## Client Overview
- Name — ${profile.firstName}
- Age — ${profile.age} years
- Primary Goal — ${profile.drivingGoal}
- Time Horizon — ${profile.timeHorizon}
- Eating Style — ${profile.eatingStyle}

## Health Status
- Sleep Quality — ${computedMetrics.sleepScore}
- Stress Level — ${computedMetrics.stressScore}
- Metabolic Health — ${computedMetrics.metabolicHealth}

## Ecosystem Insights (MUST reference in summary)
${ecosystemSummary || 'No ecosystem data available — focus on profile data'}

## Biomarker Summary
${biomarkerSummary}

## Nutrition Framework
- Calories — ${nutritionStructure?.calories || computedMetrics.targetCalories + ' calories'}
- Protein — ${nutritionStructure?.protein || computedMetrics.proteinTargetGrams + 'g'}
- Key Philosophy — ${nutritionFramework.nutritionPhilosophy?.keyPrinciples[0]?.principle || 'Balanced whole-food nutrition'}

## Meal Plan Overview
- ${profile.mealsPerDay} meals per day
- 7-day plan with ${mealPlan.sampleMealPlan.day1?.meals?.length || 3} meals daily

## Micronutrient Focus
- Priority Nutrients — ${nutrientPriorities.join(', ') || 'General optimization'}

## Lifestyle Integration
- Sleep Protocol — ${typeof lifestyle.lifestyleIntegration.sleepOptimization === 'string' ? 'Standard' : 'Customized'}
- Exercise Protocol — ${typeof lifestyle.lifestyleIntegration.exerciseProtocol === 'string' ? 'Standard' : 'Customized'}
- Stress Management — ${typeof lifestyle.lifestyleIntegration.stressManagement === 'string' ? 'Standard' : 'Customized'}

## Supplement Considerations
### From Biomarker Analysis
${supplementFlags.map(s => `- ${s.supplement} (${s.priority}) — ${s.rationale}`).join('\n') || 'No specific biomarker-driven supplements'}

### Current Medications (avoid interactions)
${constraints.medications.length > 0 ? constraints.medications.join(', ') : 'None reported'}

### Current Supplements (already taking)
${constraints.currentSupplements.length > 0 ? constraints.currentSupplements.join(', ') : 'None reported'}

## YOUR TASK
Create:
1. A personalized greeting that feels premium and personal
2. An executive summary (2-3 paragraphs) that:
   - Acknowledges their specific goal and current status
   - References ecosystem insights where available (REQUIRED if data exists)
   - Explains how the plan addresses their unique needs
   - Gets them excited to start
3. Comprehensive supplement recommendations based on:
   - Biomarker flags and analysis
   - Micronutrient priorities
   - Their current medications (avoid interactions)
   - What they're already taking
4. Cross-references that connect nutrition, lifestyle, and supplements naturally

Return the JSON structure as specified.`;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

export async function runChiefNutritionist(
  input: ChiefNutritionistInput
): Promise<ChiefNutritionistOutput> {
  console.log('[Chief Nutritionist] Starting final assembly...');
  console.log(`[Chief Nutritionist] Client — ${input.clientProfile.profile.firstName}`);

  const openai = getOpenAIClient();
  const userPrompt = buildUserPrompt(input);

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8, // Higher for more creative writing
      max_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from GPT-4o');
    }

    const result = JSON.parse(content);

    console.log('[Chief Nutritionist] Final assembly complete');
    console.log(`[Chief Nutritionist] Tokens used — ${response.usage?.total_tokens || 'unknown'}`);

    return normalizeOutput(result, input);
  } catch (error) {
    console.error('[Chief Nutritionist] Error:', error);
    console.log('[Chief Nutritionist] Using fallback output');
    return createFallbackOutput(input);
  }
}

// ============================================================================
// NORMALIZE OUTPUT
// ============================================================================

function normalizeOutput(
  result: Record<string, unknown>,
  input: ChiefNutritionistInput
): ChiefNutritionistOutput {
  const supplements = result.supplementRecommendations as Record<string, unknown> || {};
  const crossRefs = result.crossReferences as Record<string, string[]> || {};

  // Normalize supplement recommendations
  const normalizedSupplements: SupplementRecommendations = {
    essential: normalizeSupplementList(supplements.essential as Array<Record<string, unknown>>),
    optional: normalizeSupplementList(supplements.optional as Array<Record<string, unknown>>),
    considerations: (supplements.considerations as string),
    personalizedNotes: (supplements.personalizedNotes as string),
  };

  // Ensure we have at least 3 essential supplements
  if (normalizedSupplements.essential && normalizedSupplements.essential.length < 3) {
    const defaults = getDefaultEssentialSupplements(input);
    const existingNames = normalizedSupplements.essential.map(s => s.name.toLowerCase());
    for (const def of defaults) {
      if (!existingNames.includes(def.name.toLowerCase())) {
        normalizedSupplements.essential.push(def);
        if (normalizedSupplements.essential.length >= 3) break;
      }
    }
  }

  return {
    personalizedGreeting: (result.personalizedGreeting as string) || createFallbackGreeting(input),
    executiveSummary: (result.executiveSummary as string) || createFallbackSummary(input),
    supplementRecommendations: normalizedSupplements,
    crossReferences: {
      nutrition: crossRefs.nutrition || [],
      lifestyle: crossRefs.lifestyle || [],
      supplements: crossRefs.supplements || [],
    },
  };
}

function normalizeSupplementList(
  supplements: Array<Record<string, unknown>> | undefined
): SupplementRecommendation[] {
  if (!supplements || !Array.isArray(supplements)) {
    return [];
  }

  return supplements.map(s => ({
    name: (s.name as string) || (s.supplement as string) || 'Unknown',
    dosage: (s.dosage as string) || 'As directed',
    timing: (s.timing as string) || 'With meals',
    rationale: (s.rationale as string) || '',
    benefits: (s.benefits as string),
    duration: (s.duration as string),
  }));
}

// ============================================================================
// DEFAULT SUPPLEMENTS
// ============================================================================

function getDefaultEssentialSupplements(input: ChiefNutritionistInput): SupplementRecommendation[] {
  const { biomarkerAnalysis, micronutrients } = input;

  const defaults: SupplementRecommendation[] = [
    {
      name: 'Vitamin D3',
      dosage: '2000-4000 IU daily',
      timing: 'With a meal containing fat',
      rationale: 'Most people are deficient — supports immune function, bone health, and mood regulation',
      benefits: 'Improved immune function, bone density, and overall wellbeing',
      duration: 'Ongoing — especially important in winter months',
    },
    {
      name: 'Omega-3 Fish Oil',
      dosage: '2-3g EPA+DHA daily',
      timing: 'With meals to improve absorption',
      rationale: 'Anti-inflammatory, supports heart and brain health, aids recovery',
      benefits: 'Reduced inflammation, better cognitive function, cardiovascular support',
      duration: 'Ongoing',
    },
    {
      name: 'Magnesium Glycinate',
      dosage: '300-400mg daily',
      timing: 'Evening — may support sleep quality',
      rationale: 'Many people are deficient — supports muscle function, sleep, and stress response',
      benefits: 'Better sleep, reduced muscle tension, improved stress resilience',
      duration: 'Ongoing',
    },
  ];

  // Add biomarker-specific supplements
  if (biomarkerAnalysis?.supplementFlags) {
    for (const flag of biomarkerAnalysis.supplementFlags) {
      if (flag.priority === 'essential') {
        const existingNames = defaults.map(d => d.name.toLowerCase());
        if (!existingNames.includes(flag.supplement.toLowerCase())) {
          defaults.unshift({
            name: flag.supplement,
            dosage: 'Per healthcare provider guidance',
            timing: 'As recommended',
            rationale: flag.rationale,
            benefits: 'Addresses biomarker deficiency',
            duration: 'Until levels normalize — retest in 3-6 months',
          });
        }
      }
    }
  }

  return defaults;
}

// ============================================================================
// FALLBACK OUTPUT
// ============================================================================

function createFallbackGreeting(input: ChiefNutritionistInput): string {
  const { profile } = input.clientProfile;

  let planType = 'Nutrition';
  if (profile.drivingGoal.toLowerCase().includes('weight') || profile.drivingGoal.toLowerCase().includes('slim')) {
    planType = 'Body Composition';
  } else if (profile.drivingGoal.toLowerCase().includes('energy')) {
    planType = 'Vitality';
  } else if (profile.drivingGoal.toLowerCase().includes('longevity') || profile.drivingGoal.toLowerCase().includes('health')) {
    planType = 'Optimal Health';
  }

  return `${profile.firstName}'s Personalized ${planType} Plan`;
}

function createFallbackSummary(input: ChiefNutritionistInput): string {
  const { clientProfile, nutritionFramework, biomarkerAnalysis } = input;
  const { profile, computedMetrics, keyInsights } = clientProfile;

  let summary = `This comprehensive nutrition plan has been specifically designed for you, ${profile.firstName}, based on your goal of ${profile.drivingGoal}. `;

  // Add computed metrics context
  summary += `With your ${computedMetrics.sleepScore} sleep quality, ${computedMetrics.stressScore} stress level, and ${profile.activityLevel} activity level, we've created an approach that supports your unique needs. `;

  // Add nutrition framework context
  if (nutritionFramework.nutritionOverview?.nutritionStructure) {
    const structure = nutritionFramework.nutritionOverview.nutritionStructure;
    summary += `Your daily targets of ${structure.calories} and ${structure.protein} have been calculated to optimize results while keeping the plan sustainable.\n\n`;
  } else {
    summary += `Your personalized calorie and macro targets have been calculated to support your goals while remaining practical and sustainable.\n\n`;
  }

  // Add ecosystem insights if available
  if (keyInsights.length > 0) {
    summary += `We've incorporated insights from your connected data — `;
    const sources = [...new Set(keyInsights.map(i => i.source))];
    summary += sources.slice(0, 3).join(', ');
    summary += ` — to fine-tune recommendations to your actual lifestyle patterns. `;

    // Reference specific insights
    const specificInsight = keyInsights.find(i =>
      i.insight.toLowerCase().includes('recovery') ||
      i.insight.toLowerCase().includes('sleep') ||
      i.insight.toLowerCase().includes('stress')
    );
    if (specificInsight) {
      summary += `For example, "${specificInsight.insight.toLowerCase()}" informed our approach to your lifestyle protocols. `;
    }
  }

  // Add biomarker context if available
  if (biomarkerAnalysis && biomarkerAnalysis.nutritionalPriorities.length > 0) {
    const topConcern = biomarkerAnalysis.nutritionalPriorities[0];
    summary += `\n\nYour blood work revealed areas for optimization, particularly ${topConcern.concern.toLowerCase()}. The meal plan and supplement recommendations specifically address these findings through targeted nutrition strategies.`;
  } else {
    summary += `\n\nThe meal plan provides a week of delicious, practical meals that hit your nutrition targets while respecting your dietary preferences. The lifestyle protocols support your nutrition through optimized sleep, appropriate exercise, and stress management.`;
  }

  summary += ` This plan works synergistically — nutrition, lifestyle, and strategic supplementation all support your goal. Start with the fundamentals, stay consistent, and you'll see results.`;

  return summary;
}

function createFallbackOutput(input: ChiefNutritionistInput): ChiefNutritionistOutput {
  const { clientProfile, biomarkerAnalysis, micronutrients, lifestyle } = input;

  // Build supplement recommendations from available data
  const essentialSupplements = getDefaultEssentialSupplements(input);

  const optionalSupplements: SupplementRecommendation[] = [
    {
      name: 'Vitamin K2',
      dosage: '100-200mcg daily',
      timing: 'With vitamin D3',
      rationale: 'Works synergistically with D3 for bone and cardiovascular health',
      benefits: 'Enhanced vitamin D utilization, cardiovascular support',
      duration: 'Ongoing',
    },
    {
      name: 'Zinc',
      dosage: '15-30mg daily',
      timing: 'With food — can cause nausea if taken empty stomach',
      rationale: 'Supports immune function and hormone production',
      benefits: 'Immune support, testosterone optimization, wound healing',
      duration: 'Ongoing — avoid long-term high doses',
    },
  ];

  // Build cross-references
  const crossReferences = {
    nutrition: [
      'Your protein targets align with your activity level for optimal muscle maintenance',
      'Meal timing recommendations support your sleep optimization protocol',
    ],
    lifestyle: [
      'Sleep protocols complement your nutrition by optimizing hormone balance',
      'Stress management practices help regulate cortisol, supporting your nutrition goals',
    ],
    supplements: [
      'Supplement recommendations address specific findings from your profile',
      'Timing of supplements coordinates with meal schedule for optimal absorption',
    ],
  };

  // Add biomarker-specific cross-references
  if (biomarkerAnalysis && biomarkerAnalysis.nutritionalPriorities.length > 0) {
    crossReferences.nutrition.push(
      `Meal plan emphasizes foods that address your ${biomarkerAnalysis.nutritionalPriorities[0].concern.toLowerCase()}`
    );
    crossReferences.supplements.push(
      'Essential supplements target biomarker findings — retest in 3-6 months'
    );
  }

  return {
    personalizedGreeting: createFallbackGreeting(input),
    executiveSummary: createFallbackSummary(input),
    supplementRecommendations: {
      essential: essentialSupplements.slice(0, 5),
      optional: optionalSupplements,
      considerations: 'Always consult with a healthcare provider before starting new supplements, especially if you take medications. Quality matters — choose reputable brands with third-party testing.',
      personalizedNotes: clientProfile.biomarkerFlags.length > 0
        ? `Based on your blood work, pay particular attention to ${clientProfile.biomarkerFlags.slice(0, 2).map(f => f.marker).join(' and ')}. The supplements above address these concerns.`
        : 'Focus on getting nutrients from whole foods first — supplements fill gaps, not replace good nutrition.',
    },
    crossReferences,
  };
}
