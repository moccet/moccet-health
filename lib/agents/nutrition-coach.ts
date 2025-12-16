/**
 * Nutrition Coach Agent
 *
 * Purpose: Generate nutrition guidance and supplement recommendations
 * Model: GPT-4o-mini (structured output generation)
 * Cost: ~$0.005 per call
 *
 * Creates personalized nutrition plans based on the athlete's goals,
 * biomarkers, training schedule, and dietary preferences.
 */

import OpenAI from 'openai';
import { AthleteProfileCard } from '../types/athlete-profile';
import { NutritionGuidance, SupplementRecommendations, NutritionCoachOutput } from '../types/plan-output';

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

const SYSTEM_PROMPT = `You are a sports nutrition specialist with expertise in optimizing nutrition for athletic performance and health goals.

Your task is to create personalized nutrition guidance based on the athlete's:
- Training goals and schedule
- Calculated macronutrient needs
- Biomarker flags (if available)
- Lifestyle factors

CRITICAL RULES:
1. NEVER use colons (:) in your text — use em dashes (—) instead
2. Use "you" and "your" when addressing the athlete
3. Reference specific calculated targets (protein, calories, etc.)
4. Keep recommendations practical and sustainable
5. For supplements — only recommend evidence-based options

OUTPUT FORMAT:
Return valid JSON with this exact structure:
{
  "nutritionGuidance": {
    "personalizedIntro": "2-3 sentences on nutrition approach",
    "proteinTarget": {
      "target": "180g per day",
      "range": "160-200g",
      "rationale": "Why this amount"
    },
    "calorieGuidance": {
      "target": "2800 calories",
      "range": "2600-3000",
      "rationale": "Why this amount"
    },
    "mealTiming": {
      "mealsPerDay": 4,
      "preworkout": "What to eat before training",
      "postworkout": "What to eat after training",
      "generalGuidance": "Overall timing advice"
    },
    "hydration": {
      "dailyTarget": "3-4 liters",
      "timing": "When to drink"
    },
    "macroBreakdown": "Carbs, fats explanation",
    "mealFrequency": "How often to eat"
  },
  "supplementRecommendations": {
    "essential": [
      {
        "supplement": "Name",
        "dosage": "Amount",
        "timing": "When to take",
        "rationale": "Why recommended",
        "duration": "How long to take"
      }
    ],
    "optional": [...],
    "considerations": "Any warnings or interactions",
    "personalizedNotes": "Notes specific to this athlete"
  }
}`;

// ============================================================================
// BUILD USER PROMPT
// ============================================================================

function buildUserPrompt(athleteProfile: AthleteProfileCard): string {
  const { profile, computedMetrics, constraints, biomarkerFlags } = athleteProfile;

  let prompt = `# ATHLETE NUTRITION PROFILE

## Basic Info
- Name — ${profile.firstName}
- Age — ${profile.age} years
- Weight — ${profile.weightKg} kg
- Training Days — ${profile.trainingDays} per week
- Primary Goal — ${profile.primaryGoal}
- Session Length — ${profile.sessionLengthMinutes} minutes

## Calculated Needs
- TDEE — ${computedMetrics.tdee} calories
- BMR — ${computedMetrics.bmr} calories
- Protein Target — ${computedMetrics.proteinTargetGrams}g
- Carb Target — ${computedMetrics.carbTargetGrams}g
- Fat Target — ${computedMetrics.fatTargetGrams}g

## Recovery Status
- Sleep Quality — ${computedMetrics.sleepScore}/10
- Stress Level — ${computedMetrics.stressScore}
- Recovery Capacity — ${computedMetrics.recoveryCapacity}
`;

  // Add biomarker flags
  if (biomarkerFlags.length > 0) {
    prompt += `\n## Biomarker Flags (from blood work)\n`;
    for (const flag of biomarkerFlags) {
      prompt += `- ${flag.marker} — ${flag.status}`;
      if (flag.value) prompt += ` (${flag.value})`;
      prompt += `\n`;
      if (flag.recommendations.length > 0) {
        prompt += `  Recommendations — ${flag.recommendations.join(', ')}\n`;
      }
    }
  }

  // Add medications if any
  if (constraints.medications.length > 0) {
    prompt += `\n## Current Medications\n- ${constraints.medications.join('\n- ')}\n`;
  }

  prompt += `
## Your Task
Create nutrition guidance that:
1. Supports their goal of "${profile.primaryGoal}"
2. Provides ${computedMetrics.proteinTargetGrams}g protein daily
3. Addresses any biomarker concerns
4. Fits their ${profile.trainingDays}-day training schedule

Return the JSON structure as specified.`;

  return prompt;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

export async function runNutritionCoach(
  athleteProfile: AthleteProfileCard
): Promise<NutritionCoachOutput> {
  console.log('[Nutrition Coach] Starting nutrition guidance generation...');
  console.log(`[Nutrition Coach] TDEE — ${athleteProfile.computedMetrics.tdee}, Protein — ${athleteProfile.computedMetrics.proteinTargetGrams}g`);

  const openai = getOpenAIClient();
  const userPrompt = buildUserPrompt(athleteProfile);

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 3000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from GPT-4o-mini');
    }

    const result = JSON.parse(content);

    console.log('[Nutrition Coach] Nutrition guidance complete');
    console.log(`[Nutrition Coach] Tokens used — ${response.usage?.total_tokens || 'unknown'}`);

    return {
      nutritionGuidance: result.nutritionGuidance,
      supplementRecommendations: result.supplementRecommendations,
    };
  } catch (error) {
    console.error('[Nutrition Coach] Error:', error);
    console.log('[Nutrition Coach] Using fallback nutrition guidance');
    return createFallbackNutrition(athleteProfile);
  }
}

// ============================================================================
// FALLBACK NUTRITION GUIDANCE
// ============================================================================

function createFallbackNutrition(athleteProfile: AthleteProfileCard): NutritionCoachOutput {
  const { profile, computedMetrics, biomarkerFlags } = athleteProfile;
  const goal = profile.primaryGoal;

  // Adjust calories based on goal
  let calorieAdjustment = 0;
  let calorieRationale = '';
  if (goal === 'build-up' || goal === 'muscle_gain') {
    calorieAdjustment = 300;
    calorieRationale = 'A modest surplus supports muscle growth without excessive fat gain';
  } else if (goal === 'slim-down' || goal === 'fat_loss') {
    calorieAdjustment = -400;
    calorieRationale = 'A moderate deficit promotes fat loss while preserving muscle';
  } else {
    calorieRationale = 'Maintenance calories support performance and body composition';
  }

  const targetCalories = computedMetrics.tdee + calorieAdjustment;

  const nutritionGuidance: NutritionGuidance = {
    personalizedIntro: `Your nutrition plan is designed to support your goal of ${goal} while fueling your ${profile.trainingDays}-day training week. We've calculated your needs based on your body composition, activity level, and goals. Consistency matters more than perfection — aim for 80% adherence and you'll see results.`,

    proteinTarget: {
      target: `${computedMetrics.proteinTargetGrams}g per day`,
      range: `${computedMetrics.proteinTargetGrams - 20}-${computedMetrics.proteinTargetGrams + 20}g`,
      rationale: `At ${profile.weightKg}kg with your training volume, this provides optimal amino acids for muscle protein synthesis and recovery. Spread intake across 4-5 meals for best absorption.`,
    },

    calorieGuidance: {
      target: `${targetCalories} calories`,
      range: `${targetCalories - 200}-${targetCalories + 200}`,
      rationale: calorieRationale,
    },

    mealTiming: {
      mealsPerDay: 4,
      preworkout: '1-2 hours before training — moderate carbs and protein, low fat. Example — oatmeal with protein powder, or chicken with rice.',
      postworkout: 'Within 2 hours of training — protein and carbs to kickstart recovery. Example — protein shake with banana, or lean meat with potatoes.',
      generalGuidance: 'Space meals 3-4 hours apart when possible. Don\'t stress about exact timing — total daily intake matters most.',
    },

    hydration: {
      dailyTarget: `${Math.round(profile.weightKg * 0.04)} liters minimum`,
      timing: 'Start with 500ml upon waking, sip throughout the day, extra 500ml per hour of training.',
    },

    macroBreakdown: `Beyond protein, aim for roughly ${computedMetrics.carbTargetGrams}g carbs and ${computedMetrics.fatTargetGrams}g fat daily. Carbs fuel training and recovery — don't fear them. Fats support hormones and nutrient absorption — include sources like olive oil, nuts, and fatty fish.`,

    mealFrequency: 'Four meals works well for most people — breakfast, lunch, dinner, and one snack. If your schedule requires fewer or more meals, that is fine — protein distribution matters more than meal count.',
  };

  // Build supplement recommendations
  const essentialSupplements = [
    {
      supplement: 'Creatine Monohydrate',
      dosage: '5g daily',
      timing: 'Any time — consistency matters more than timing',
      rationale: 'The most researched performance supplement. Supports strength, power, and muscle recovery.',
      duration: 'Ongoing — no need to cycle',
    },
    {
      supplement: 'Vitamin D3',
      dosage: '2000-4000 IU daily',
      timing: 'With a meal containing fat for absorption',
      rationale: 'Most people are deficient, especially if limited sun exposure. Supports immune function, bone health, and potentially muscle function.',
      duration: 'Ongoing — especially in winter months',
    },
  ];

  const optionalSupplements = [
    {
      supplement: 'Omega-3 Fish Oil',
      dosage: '2-3g EPA+DHA daily',
      timing: 'With meals',
      rationale: 'Supports recovery, reduces inflammation, and benefits heart and brain health.',
      duration: 'Ongoing',
    },
    {
      supplement: 'Magnesium',
      dosage: '200-400mg daily',
      timing: 'Evening — may support sleep quality',
      rationale: 'Many athletes are deficient. Supports muscle function, sleep, and recovery.',
      duration: 'Ongoing',
    },
  ];

  // Add biomarker-specific supplements
  for (const flag of biomarkerFlags) {
    if (flag.marker.toLowerCase().includes('vitamin d') && flag.status === 'low') {
      // Already included, but note the deficiency
    }
    if (flag.marker.toLowerCase().includes('iron') && flag.status === 'low') {
      optionalSupplements.push({
        supplement: 'Iron',
        dosage: 'Per healthcare provider recommendation',
        timing: 'On empty stomach or with vitamin C',
        rationale: `Your blood work shows low iron — this impacts oxygen delivery and energy levels.`,
        duration: 'Until levels normalize',
      });
    }
    if (flag.marker.toLowerCase().includes('b12') && flag.status === 'low') {
      optionalSupplements.push({
        supplement: 'Vitamin B12',
        dosage: '1000mcg daily',
        timing: 'Morning with food',
        rationale: 'Your blood work indicates low B12 — important for energy and nervous system function.',
        duration: 'Until levels normalize',
      });
    }
  }

  const supplementRecommendations: SupplementRecommendations = {
    essential: essentialSupplements,
    optional: optionalSupplements,
    considerations: 'Always check with a healthcare provider before starting new supplements, especially if you take medications. Quality matters — choose reputable brands with third-party testing.',
    personalizedNotes: biomarkerFlags.length > 0
      ? `Based on your blood work, pay particular attention to ${biomarkerFlags.map(f => f.marker).join(', ')}. The supplements above address these concerns, but follow up with your doctor.`
      : 'Your basic supplementation covers the essentials. Focus on getting most nutrients from whole foods — supplements fill gaps, not replace good nutrition.',
  };

  return {
    nutritionGuidance,
    supplementRecommendations,
  };
}
