/**
 * Micronutrient Specialist Agent
 *
 * Purpose: Generate prioritized micronutrient recommendations with food sources
 * Model: GPT-4o-mini (structured output generation)
 * Cost: ~$0.005 per call
 *
 * This agent analyzes the client's biomarkers, goals, and dietary constraints
 * to create a prioritized list of micronutrients they should focus on.
 */

import OpenAI from 'openai';
import { ClientProfileCard } from '../../types/client-profile';
import {
  BiomarkerAnalystOutput,
  MicronutrientSpecialistOutput,
  MicronutrientFocus,
  MicronutrientRecommendation,
} from '../../types/sage-plan-output';

// ============================================================================
// TYPES
// ============================================================================

export interface MicronutrientSpecialistInput {
  clientProfile: ClientProfileCard;
  biomarkerAnalysis?: BiomarkerAnalystOutput;
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

const SYSTEM_PROMPT = `You are a Micronutrient Specialist — an expert at identifying nutrient priorities and food sources for optimal health.

Your task is to create a prioritized list of micronutrients the client should focus on, along with practical food sources.

CRITICAL RULES:
1. NEVER use colons (:) in your text — use em dashes (—) instead
2. Prioritize based on biomarker flags if available
3. Consider their dietary constraints when suggesting food sources
4. Provide realistic daily goals
5. Include 10-15 micronutrients total, prioritized by importance

OUTPUT FORMAT:
Return valid JSON with this structure:
{
  "micronutrientFocus": {
    "personalizedIntro": "1-2 sentences about their specific micronutrient priorities",
    "nutrients": [
      {
        "nutrient": "Vitamin D",
        "dailyGoal": "4000 IU",
        "foodSources": "Fatty fish, egg yolks, fortified foods, mushrooms exposed to sunlight",
        "purpose": "Supports immune function, bone health, and mood regulation",
        "priority": "essential"
      }
    ]
  }
}

PRIORITY LEVELS:
- essential — Based on biomarker deficiency or critical for their goal
- recommended — Beneficial for their profile but not deficient
- optional — General optimization

COMMON PRIORITY NUTRIENTS:
1. Vitamin D — Most people are deficient
2. Omega-3 (EPA/DHA) — Anti-inflammatory, brain health
3. Magnesium — Sleep, muscle function, stress
4. Iron — Energy, especially for active individuals and women
5. Vitamin B12 — Energy, nervous system
6. Zinc — Immune function, testosterone
7. Potassium — Blood pressure, muscle function
8. Calcium — Bone health
9. Vitamin K2 — Works with D3 for bone health
10. Selenium — Thyroid, antioxidant
11. Iodine — Thyroid function
12. Folate — Cell division, especially for women
13. Vitamin C — Immune, collagen, iron absorption
14. Vitamin E — Antioxidant
15. Chromium — Blood sugar regulation`;

// ============================================================================
// BUILD USER PROMPT
// ============================================================================

function buildUserPrompt(input: MicronutrientSpecialistInput): string {
  const { clientProfile, biomarkerAnalysis } = input;
  const { profile, biomarkerFlags, constraints, computedMetrics } = clientProfile;

  let prompt = `# CLIENT MICRONUTRIENT PROFILE

## Basic Information
- Name — ${profile.firstName}
- Age — ${profile.age} years
- Gender — ${profile.gender}
- Primary Goal — ${profile.drivingGoal}
- Activity Level — ${profile.activityLevel}

## Health Status
- Sleep Quality — ${computedMetrics.sleepScore}
- Stress Level — ${computedMetrics.stressScore}
- Metabolic Health — ${computedMetrics.metabolicHealth}

## Eating Pattern
- Eating Style — ${profile.eatingStyle}
- Alcohol Consumption — ${profile.alcoholConsumption}
${profile.caffeineConsumption ? `- Caffeine Consumption — ${profile.caffeineConsumption}` : ''}

`;

  // Add biomarker flags
  if (biomarkerFlags.length > 0) {
    prompt += `## BIOMARKER-IDENTIFIED DEFICIENCIES\n`;
    for (const flag of biomarkerFlags) {
      if (flag.status === 'deficient' || flag.status === 'low') {
        prompt += `- ${flag.marker} — ${flag.status.toUpperCase()}`;
        if (flag.value) prompt += ` (${flag.value}${flag.unit ? ' ' + flag.unit : ''})`;
        prompt += `\n`;
      }
    }
    prompt += `\n`;
  }

  // Add biomarker analysis priorities if available
  if (biomarkerAnalysis && biomarkerAnalysis.nutritionalPriorities.length > 0) {
    prompt += `## NUTRITIONAL PRIORITIES FROM BLOOD WORK\n`;
    for (const priority of biomarkerAnalysis.nutritionalPriorities) {
      prompt += `- ${priority.concern} (${priority.severity})\n`;
      if (priority.foodsToEmphasize.length > 0) {
        prompt += `  Foods to emphasize — ${priority.foodsToEmphasize.join(', ')}\n`;
      }
    }
    prompt += `\n`;
  }

  // Add dietary constraints
  prompt += `## DIETARY CONSTRAINTS (respect in food recommendations)\n`;

  const allergies = constraints.dietary.filter(c => c.type === 'allergy');
  if (allergies.length > 0) {
    prompt += `Allergies — ${allergies.map(a => a.item).join(', ')}\n`;
  }

  const intolerances = constraints.dietary.filter(c => c.type === 'intolerance');
  if (intolerances.length > 0) {
    prompt += `Intolerances — ${intolerances.map(i => i.item).join(', ')}\n`;
  }

  // Special considerations based on eating style
  if (profile.eatingStyle.toLowerCase().includes('vegan') || profile.eatingStyle.toLowerCase().includes('vegetarian')) {
    prompt += `\nSPECIAL CONSIDERATION — ${profile.eatingStyle} diet may require attention to — B12, Iron, Zinc, Omega-3, Vitamin D\n`;
  }

  // Add current supplements
  if (constraints.currentSupplements.length > 0) {
    prompt += `\n## CURRENT SUPPLEMENTS (already taking)\n- ${constraints.currentSupplements.join('\n- ')}\n`;
  }

  prompt += `
## YOUR TASK
Create a prioritized micronutrient list (10-15 nutrients) that:
1. Addresses any biomarker deficiencies first (mark as "essential")
2. Supports their goal of "${profile.drivingGoal}"
3. Considers their ${profile.eatingStyle} eating style
4. Provides food sources that respect their dietary constraints
5. Includes realistic daily goals

Return the JSON structure as specified.`;

  return prompt;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

export async function runMicronutrientSpecialist(
  input: MicronutrientSpecialistInput
): Promise<MicronutrientSpecialistOutput> {
  console.log('[Micronutrient Specialist] Starting micronutrient analysis...');
  console.log(`[Micronutrient Specialist] Client — ${input.clientProfile.profile.firstName}`);
  console.log(`[Micronutrient Specialist] Biomarker flags — ${input.clientProfile.biomarkerFlags.length}`);

  const openai = getOpenAIClient();
  const userPrompt = buildUserPrompt(input);

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.6,
      max_tokens: 3000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from GPT-4o-mini');
    }

    const result = JSON.parse(content);

    console.log('[Micronutrient Specialist] Analysis complete');
    console.log(`[Micronutrient Specialist] Tokens used — ${response.usage?.total_tokens || 'unknown'}`);

    return normalizeOutput(result, input);
  } catch (error) {
    console.error('[Micronutrient Specialist] Error:', error);
    console.log('[Micronutrient Specialist] Using fallback recommendations');
    return createFallbackOutput(input);
  }
}

// ============================================================================
// NORMALIZE OUTPUT
// ============================================================================

function normalizeOutput(
  result: Record<string, unknown>,
  input: MicronutrientSpecialistInput
): MicronutrientSpecialistOutput {
  const focus = result.micronutrientFocus as Record<string, unknown> || {};
  const nutrients = (focus.nutrients as Array<Record<string, unknown>>) || [];

  const normalizedNutrients: MicronutrientRecommendation[] = nutrients.map(n => ({
    nutrient: (n.nutrient as string) || 'Unknown',
    dailyGoal: (n.dailyGoal as string) || 'As recommended',
    foodSources: (n.foodSources as string) || 'Various whole foods',
    purpose: (n.purpose as string),
    priority: (n.priority as 'essential' | 'recommended' | 'optional') || 'recommended',
  }));

  // Ensure we have at least 10 nutrients
  if (normalizedNutrients.length < 10) {
    const defaults = getDefaultNutrients(input);
    const existingNames = normalizedNutrients.map(n => n.nutrient.toLowerCase());
    for (const def of defaults) {
      if (!existingNames.includes(def.nutrient.toLowerCase())) {
        normalizedNutrients.push(def);
        if (normalizedNutrients.length >= 12) break;
      }
    }
  }

  return {
    micronutrientFocus: {
      personalizedIntro: (focus.personalizedIntro as string) ||
        `Based on your profile and goal of ${input.clientProfile.profile.drivingGoal}, these are the key micronutrients to focus on.`,
      nutrients: normalizedNutrients,
    },
  };
}

// ============================================================================
// FALLBACK OUTPUT
// ============================================================================

function getDefaultNutrients(input: MicronutrientSpecialistInput): MicronutrientRecommendation[] {
  const { clientProfile, biomarkerAnalysis } = input;
  const { profile, biomarkerFlags, constraints } = clientProfile;

  const nutrients: MicronutrientRecommendation[] = [];

  // Check for allergens to avoid in food recommendations
  const allergies = constraints.dietary
    .filter(c => c.type === 'allergy')
    .map(c => c.item.toLowerCase());

  const hasFishAllergy = allergies.some(a => a.includes('fish') || a.includes('seafood') || a.includes('shellfish'));
  const hasDairyAllergy = allergies.some(a => a.includes('dairy') || a.includes('milk') || a.includes('lactose'));
  const hasNutAllergy = allergies.some(a => a.includes('nut') || a.includes('tree nut') || a.includes('peanut'));

  // Add biomarker-based deficiencies first (essential)
  for (const flag of biomarkerFlags) {
    if (flag.status === 'deficient' || flag.status === 'low') {
      const marker = flag.marker.toLowerCase();

      if (marker.includes('vitamin d') || marker.includes('25-hydroxy')) {
        nutrients.push({
          nutrient: 'Vitamin D3',
          dailyGoal: '4000-5000 IU',
          foodSources: hasFishAllergy
            ? 'Egg yolks, fortified foods, mushrooms exposed to sunlight'
            : 'Fatty fish (salmon, mackerel), egg yolks, fortified foods',
          purpose: 'Your blood work shows deficiency — critical for immune function and bone health',
          priority: 'essential',
        });
      }

      if (marker.includes('b12') || marker.includes('cobalamin')) {
        nutrients.push({
          nutrient: 'Vitamin B12',
          dailyGoal: '1000-2000 mcg',
          foodSources: 'Meat, fish, eggs, fortified nutritional yeast',
          purpose: 'Your blood work shows deficiency — essential for energy and nerve function',
          priority: 'essential',
        });
      }

      if (marker.includes('iron') || marker.includes('ferritin')) {
        nutrients.push({
          nutrient: 'Iron',
          dailyGoal: '18-27 mg (with vitamin C for absorption)',
          foodSources: 'Red meat, spinach, lentils, fortified cereals',
          purpose: 'Your blood work shows low levels — critical for oxygen transport and energy',
          priority: 'essential',
        });
      }
    }
  }

  // Add standard recommendations
  const standardNutrients: MicronutrientRecommendation[] = [
    {
      nutrient: 'Vitamin D3',
      dailyGoal: '2000-4000 IU',
      foodSources: hasFishAllergy
        ? 'Egg yolks, fortified foods, mushrooms exposed to sunlight'
        : 'Fatty fish, egg yolks, fortified foods',
      purpose: 'Supports immune function, bone health, and mood',
      priority: 'essential',
    },
    {
      nutrient: 'Omega-3 (EPA/DHA)',
      dailyGoal: '2-3g combined',
      foodSources: hasFishAllergy
        ? 'Algae-based supplements, chia seeds, walnuts, flaxseed'
        : 'Fatty fish (salmon, sardines, mackerel), fish oil, algae',
      purpose: 'Anti-inflammatory, supports brain and heart health',
      priority: 'essential',
    },
    {
      nutrient: 'Magnesium',
      dailyGoal: '400-500 mg',
      foodSources: hasNutAllergy
        ? 'Dark leafy greens, avocado, dark chocolate, legumes'
        : 'Dark leafy greens, nuts, seeds, dark chocolate, avocado',
      purpose: 'Supports sleep, muscle function, and stress response',
      priority: 'essential',
    },
    {
      nutrient: 'Zinc',
      dailyGoal: '15-30 mg',
      foodSources: 'Oysters, beef, pumpkin seeds, chickpeas',
      purpose: 'Immune function, hormone production, wound healing',
      priority: 'recommended',
    },
    {
      nutrient: 'Vitamin K2',
      dailyGoal: '100-200 mcg',
      foodSources: hasDairyAllergy
        ? 'Natto, sauerkraut, egg yolks'
        : 'Natto, hard cheeses, egg yolks, sauerkraut',
      purpose: 'Works with vitamin D for bone and cardiovascular health',
      priority: 'recommended',
    },
    {
      nutrient: 'Potassium',
      dailyGoal: '3500-4700 mg',
      foodSources: 'Potatoes, bananas, leafy greens, beans, avocado',
      purpose: 'Blood pressure regulation, muscle and nerve function',
      priority: 'recommended',
    },
    {
      nutrient: 'Vitamin C',
      dailyGoal: '500-1000 mg',
      foodSources: 'Bell peppers, citrus fruits, strawberries, broccoli',
      purpose: 'Antioxidant, immune support, collagen synthesis',
      priority: 'recommended',
    },
    {
      nutrient: 'Selenium',
      dailyGoal: '55-200 mcg',
      foodSources: hasNutAllergy
        ? 'Fish, eggs, chicken, mushrooms'
        : 'Brazil nuts (1-2 daily), fish, eggs, sunflower seeds',
      purpose: 'Thyroid function, antioxidant protection',
      priority: 'recommended',
    },
    {
      nutrient: 'Vitamin B Complex',
      dailyGoal: 'As per RDA',
      foodSources: 'Whole grains, meat, eggs, legumes, leafy greens',
      purpose: 'Energy production, nervous system support',
      priority: 'recommended',
    },
    {
      nutrient: 'Calcium',
      dailyGoal: '1000-1200 mg',
      foodSources: hasDairyAllergy
        ? 'Fortified plant milks, leafy greens, tofu, sardines with bones'
        : 'Dairy products, leafy greens, fortified foods, sardines',
      purpose: 'Bone health, muscle function, nerve signaling',
      priority: profile.gender === 'female' ? 'essential' : 'recommended',
    },
    {
      nutrient: 'Iodine',
      dailyGoal: '150-300 mcg',
      foodSources: hasFishAllergy
        ? 'Iodized salt, seaweed (in moderation), eggs'
        : 'Seaweed, fish, iodized salt, dairy',
      purpose: 'Thyroid hormone production',
      priority: 'optional',
    },
    {
      nutrient: 'Chromium',
      dailyGoal: '200-500 mcg',
      foodSources: 'Broccoli, whole grains, grape juice, beef',
      purpose: 'Blood sugar regulation, insulin sensitivity',
      priority: 'optional',
    },
  ];

  // Add standards that aren't already included
  const existingNames = nutrients.map(n => n.nutrient.toLowerCase());
  for (const std of standardNutrients) {
    if (!existingNames.includes(std.nutrient.toLowerCase())) {
      nutrients.push(std);
    }
  }

  return nutrients.slice(0, 15);
}

function createFallbackOutput(input: MicronutrientSpecialistInput): MicronutrientSpecialistOutput {
  const nutrients = getDefaultNutrients(input);
  const { profile } = input.clientProfile;

  return {
    micronutrientFocus: {
      personalizedIntro: `Based on your goal of ${profile.drivingGoal} and your ${profile.eatingStyle} eating style, here are the key micronutrients to prioritize. Focus on food sources first, and consider supplementation for essential nutrients.`,
      nutrients: nutrients.slice(0, 12),
    },
  };
}
