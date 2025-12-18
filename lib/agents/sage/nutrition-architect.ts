/**
 * Nutrition Architect Agent
 *
 * Purpose: Design the overall nutrition philosophy, calorie/macro framework,
 * and daily recommendation structure for the Sage nutrition plan.
 * Model: GPT-4o (requires reasoning to balance competing goals)
 * Cost: ~$0.03 per call
 *
 * This agent creates the foundational nutrition strategy that other agents
 * will build upon. It considers the client's goals, biomarkers, lifestyle,
 * and dietary preferences to create a personalized approach.
 */

import OpenAI from 'openai';
import { ClientProfileCard } from '../../types/client-profile';
import {
  NutritionArchitectOutput,
  NutritionPhilosophy,
  NutritionOverview,
  DailyRecommendations,
} from '../../types/sage-plan-output';

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

const SYSTEM_PROMPT = `You are a Master Nutrition Architect — an expert at designing personalized nutrition frameworks that optimize health based on individual biomarkers, goals, and lifestyle factors.

Your task is to create the foundational nutrition philosophy and framework that will guide the entire nutrition plan.

CRITICAL RULES:
1. NEVER use colons (:) in your text — use em dashes (—) instead
2. Use "you" and "your" when addressing the client
3. Reference SPECIFIC data from their profile (biomarkers, metrics, goals) WITH ACTUAL NUMBERS
4. Keep recommendations evidence-based and practical
5. Consider biomarker flags when designing the approach
6. Respect ALL dietary constraints (allergies, intolerances, preferences)
7. When ecosystem data is provided, use it to personalize timing and recommendations

ECOSYSTEM DATA INTEGRATION:
When wearable/ecosystem data is provided, incorporate it into the nutrition philosophy:
- Recovery scores — adjust nutrition intensity and recovery foods
- Sleep debt — recommend sleep-supporting nutrients (magnesium, tryptophan)
- Work schedule — design meal timing around busy periods
- Stress indicators — include stress-reducing foods (omega-3s, adaptogens)
- Training strain — ensure adequate protein and carb timing for recovery

DAILY RECOMMENDATIONS REQUIREMENTS:
Each section MUST have 2-4 specific, actionable items. DO NOT give generic advice.
- Reference the client's SPECIFIC biomarkers (e.g., "Your Vitamin D at 31 nmol/L means...")
- Reference their SPECIFIC goals (e.g., "For longevity focus...")
- Include SPECIFIC food examples (e.g., "salmon, mackerel, sardines" not just "fatty fish")
- Include SPECIFIC quantities where relevant (e.g., "30g protein" not just "protein")
- Every item MUST have a "time" field with specific timing
- Descriptions should explain WHY this matters for THIS person

OUTPUT FORMAT:
Return valid JSON with this exact structure:
{
  "nutritionPhilosophy": {
    "personalizedApproach": "2-3 paragraphs explaining the personalized nutrition philosophy based on their unique profile",
    "keyPrinciples": [
      {
        "principle": "Principle name",
        "description": "Why this principle matters for this person"
      }
    ],
    "eatingStrategyRationale": "1-2 paragraphs on why the recommended eating pattern suits them"
  },
  "nutritionOverview": {
    "goals": ["Primary goal 1", "Primary goal 2", "..."],
    "nutritionStructure": {
      "calories": "2400 calories",
      "protein": "180g (30% of calories)",
      "carbs": "240g (40% of calories)",
      "fiber": "35g minimum",
      "fat": "80g (30% of calories)"
    }
  },
  "dailyRecommendations": {
    "morningRitual": {
      "title": "Morning Ritual",
      "items": [
        { "time": "Upon waking", "action": "Drink 500ml water with lemon", "description": "Rehydrates cells after 7-8 hours without fluids and kickstarts metabolism — add lemon for vitamin C to support your immune system" },
        { "time": "Within 30 minutes", "action": "Take Vitamin D3 (4000 IU) with breakfast", "description": "Your Vitamin D at 31 nmol/L is below optimal — taking with fat improves absorption by up to 50%" },
        { "time": "With breakfast", "action": "Include 25-30g protein", "description": "Stabilizes blood sugar for the morning and supports your 93g daily protein target — try eggs, Greek yogurt, or smoked salmon" }
      ]
    },
    "empowerGut": {
      "title": "Gut Health Focus",
      "items": [
        { "time": "With lunch or dinner", "action": "Include fermented foods daily", "description": "Kefir, sauerkraut, kimchi, or miso — these provide live probiotics that support nutrient absorption and immune function" },
        { "time": "Throughout the day", "action": "Aim for 30+ different plants weekly", "description": "Variety feeds different gut bacteria — include herbs, spices, nuts, and seeds which all count toward this goal" },
        { "time": "With each meal", "action": "Include prebiotic fiber", "description": "Garlic, onions, leeks, asparagus, and bananas feed beneficial gut bacteria — aim for 5g prebiotic fiber daily" }
      ]
    },
    "afternoonVitality": {
      "title": "Afternoon Vitality",
      "items": [
        { "time": "2-3 PM", "action": "Protein-rich snack with healthy fats", "description": "Combat the afternoon energy dip — try apple slices with almond butter (15g protein) or Greek yogurt with berries" },
        { "time": "Every 2 hours", "action": "Hydration check — drink 250ml water", "description": "Dehydration causes fatigue before thirst kicks in — set reminders to maintain 2.5L daily intake" },
        { "time": "If energy dips", "action": "Walk for 10 minutes before reaching for caffeine", "description": "Movement increases blood flow and alertness naturally — save caffeine for true need" }
      ]
    },
    "energyOptimization": {
      "title": "Energy Optimization",
      "items": [
        { "time": "At each meal", "action": "Pair carbs with protein and fat", "description": "This slows glucose absorption — prevents the energy spikes and crashes that come from eating carbs alone" },
        { "time": "Throughout the day", "action": "Choose low-glycemic carbs", "description": "Sweet potatoes, quinoa, legumes, and whole grains release energy steadily — avoid white bread, white rice, and sugary foods" },
        { "time": "Mid-morning and mid-afternoon", "action": "Include omega-3 rich foods", "description": "Your HDL at 1.50 mmol/L needs support — walnuts, chia seeds, or fatty fish boost brain energy and cardiovascular health" }
      ]
    },
    "eveningNourishment": {
      "title": "Evening Nourishment",
      "items": [
        { "time": "3+ hours before bed", "action": "Complete your last substantial meal", "description": "Allows digestion to complete before sleep — lying down with a full stomach disrupts sleep quality and HRV" },
        { "time": "With dinner", "action": "Include magnesium-rich foods", "description": "Dark leafy greens, pumpkin seeds, or dark chocolate — magnesium supports muscle relaxation and sleep quality" },
        { "time": "1-2 hours before bed", "action": "Light snack if needed — tryptophan-rich", "description": "Small portion of turkey, cottage cheese, or a banana — tryptophan converts to melatonin to support sleep onset" }
      ]
    },
    "nutritionGuidelines": {
      "title": "Key Nutrition Guidelines",
      "items": [
        { "time": "Daily", "action": "80% whole foods, 20% flexibility", "description": "Base your diet on unprocessed foods — vegetables, fruits, lean proteins, whole grains — while allowing room for enjoyment" },
        { "time": "Weekly", "action": "Include fatty fish 2-3 times", "description": "Salmon, mackerel, sardines provide EPA/DHA — critical for your cardiovascular health and reducing inflammation" },
        { "time": "Daily", "action": "Eat the rainbow — 5+ colors of vegetables", "description": "Different colors provide different phytonutrients — aim for variety at each meal to maximize antioxidant intake" }
      ]
    }
  }
}

IMPORTANT GUIDELINES:
- Design 4-6 key principles based on their specific needs
- Ensure calorie/macro targets match the computed metrics provided
- Each dailyRecommendations section MUST have 2-4 items with SPECIFIC times, actions, and detailed descriptions
- Reference the client's actual biomarker values and health goals in recommendations
- Include specific food examples and quantities — not generic advice
- Morning ritual should include hydration, supplements based on deficiencies, and protein
- Evening nourishment should consider sleep optimization and magnesium
- Address any biomarker concerns directly in the relevant sections`;

// ============================================================================
// BUILD USER PROMPT
// ============================================================================

function buildUserPrompt(clientProfile: ClientProfileCard): string {
  const { profile, computedMetrics, constraints, biomarkerFlags, keyInsights, ecosystemMetrics } = clientProfile;

  // Calculate macro percentages
  const totalCals = computedMetrics.targetCalories;
  const proteinCals = computedMetrics.proteinTargetGrams * 4;
  const carbCals = computedMetrics.carbTargetGrams * 4;
  const fatCals = computedMetrics.fatTargetGrams * 9;
  const proteinPct = Math.round((proteinCals / totalCals) * 100);
  const carbPct = Math.round((carbCals / totalCals) * 100);
  const fatPct = Math.round((fatCals / totalCals) * 100);

  let prompt = `# CLIENT NUTRITION PROFILE

## Basic Information
- Name — ${profile.firstName}
- Age — ${profile.age} years
- Gender — ${profile.gender}
- Weight — ${profile.weightKg} kg
- Height — ${profile.heightCm} cm
- BMI — ${profile.bmi}

## Goals and Priorities
- Main Priority — ${profile.mainPriority}
- Driving Goal — ${profile.drivingGoal}
- Time Horizon — ${profile.timeHorizon}

## Lifestyle Factors
- Activity Level — ${profile.activityLevel}
- Sleep Quality — ${computedMetrics.sleepScore} (${profile.sleepQuality}/10)
- Stress Level — ${computedMetrics.stressScore} (${profile.stressLevel}/10)
- Metabolic Health — ${computedMetrics.metabolicHealth}
`;

  // Add detailed ecosystem metrics if available
  if (ecosystemMetrics) {
    const { recovery, schedule } = ecosystemMetrics;

    prompt += `\n## Wearable Data (Use to personalize nutrition timing)\n`;

    if (recovery.whoopRecoveryScore) {
      prompt += `- Whoop Recovery — ${recovery.whoopRecoveryScore}%`;
      if (recovery.whoopRecoveryScore < 50) {
        prompt += ` (LOW — emphasize recovery nutrition, anti-inflammatory foods)`;
      }
      prompt += `\n`;
    }
    if (recovery.ouraReadinessScore) {
      prompt += `- Oura Readiness — ${recovery.ouraReadinessScore}%\n`;
    }

    if (recovery.sleepHoursAvg) {
      prompt += `- Sleep Average — ${recovery.sleepHoursAvg}h`;
      if (recovery.sleepDebtHours && recovery.sleepDebtHours > 3) {
        prompt += ` (${recovery.sleepDebtHours}h sleep debt — include sleep-supporting foods)`;
      }
      prompt += `\n`;
    }

    if (recovery.strainScore) {
      prompt += `- Training Strain — ${recovery.strainScore}/21`;
      if (recovery.strainScore > 14) {
        prompt += ` (HIGH — ensure adequate carbs and protein for recovery)`;
      }
      prompt += `\n`;
    }

    if (schedule.meetingDensity) {
      prompt += `- Meeting Load — ${schedule.meetingDensity}`;
      if (schedule.avgMeetingsPerDay) {
        prompt += ` (${schedule.avgMeetingsPerDay} meetings/day)`;
      }
      if (schedule.meetingDensity === 'high' || schedule.meetingDensity === 'very-high') {
        prompt += ` — design easy-prep meals for busy days`;
      }
      prompt += `\n`;
    }

    if (schedule.workStressIndicators) {
      const stressFactors: string[] = [];
      if (schedule.workStressIndicators.afterHoursWork) stressFactors.push('after-hours work');
      if (schedule.workStressIndicators.backToBackMeetings) stressFactors.push('back-to-back meetings');
      if (stressFactors.length > 0) {
        prompt += `- Work Stress — ${stressFactors.join(', ')} — include stress-reducing nutrition\n`;
      }
    }

    if (schedule.optimalTrainingWindows && schedule.optimalTrainingWindows.length > 0) {
      prompt += `- Optimal Meal Windows — ${schedule.optimalTrainingWindows.join(', ')}\n`;
    }
  }

  prompt += `
## Eating Patterns
- Eating Style — ${profile.eatingStyle}
- First Meal — ${profile.firstMealTiming}
- Meals Per Day — ${profile.mealsPerDay}
- Cooking Frequency — ${profile.cookingFrequency}
${profile.mealPrepPreference ? `- Meal Prep Preference — ${profile.mealPrepPreference}` : ''}

## Calculated Nutrition Targets
- BMR — ${computedMetrics.bmr} calories
- TDEE — ${computedMetrics.tdee} calories
- Target Calories — ${computedMetrics.targetCalories} calories (adjustment: ${computedMetrics.calorieAdjustment > 0 ? '+' : ''}${computedMetrics.calorieAdjustment})
- Protein — ${computedMetrics.proteinTargetGrams}g (${proteinPct}% of calories)
- Carbs — ${computedMetrics.carbTargetGrams}g (${carbPct}% of calories)
- Fat — ${computedMetrics.fatTargetGrams}g (${fatPct}% of calories)
- Fiber — ${computedMetrics.fiberTargetGrams}g minimum
- Water — ${computedMetrics.waterIntakeLiters}L daily

## Dietary Constraints
`;

  // Add allergies
  if (constraints.dietary.filter(c => c.type === 'allergy').length > 0) {
    const allergies = constraints.dietary.filter(c => c.type === 'allergy');
    prompt += `### Allergies (STRICT AVOID)\n`;
    for (const allergy of allergies) {
      prompt += `- ${allergy.item}${allergy.alternatives ? ` — alternatives: ${allergy.alternatives.join(', ')}` : ''}\n`;
    }
  }

  // Add intolerances
  if (constraints.dietary.filter(c => c.type === 'intolerance').length > 0) {
    const intolerances = constraints.dietary.filter(c => c.type === 'intolerance');
    prompt += `### Intolerances (Minimize)\n`;
    for (const intolerance of intolerances) {
      prompt += `- ${intolerance.item}${intolerance.alternatives ? ` — alternatives: ${intolerance.alternatives.join(', ')}` : ''}\n`;
    }
  }

  // Add food dislikes
  if (constraints.dietary.filter(c => c.type === 'preference').length > 0) {
    const dislikes = constraints.dietary.filter(c => c.type === 'preference');
    prompt += `### Food Preferences (Avoid)\n`;
    for (const dislike of dislikes) {
      prompt += `- ${dislike.item}\n`;
    }
  }

  // Add protein preferences
  if (profile.proteinPreferences?.length > 0) {
    prompt += `### Preferred Protein Sources\n- ${profile.proteinPreferences.join(', ')}\n`;
  }

  // Add biomarker flags
  if (biomarkerFlags.length > 0) {
    prompt += `\n## Biomarker Flags (from blood analysis)\n`;
    for (const flag of biomarkerFlags) {
      prompt += `### ${flag.marker} — ${flag.status.toUpperCase()}`;
      if (flag.value) prompt += ` (${flag.value}${flag.unit ? ' ' + flag.unit : ''})`;
      prompt += `\n`;
      prompt += `- Implication — ${flag.implication}\n`;
      prompt += `- Priority — ${flag.priority}\n`;
      if (flag.foodRecommendations.length > 0) {
        prompt += `- Foods to emphasize — ${flag.foodRecommendations.join(', ')}\n`;
      }
      if (flag.supplementRecommendation) {
        prompt += `- Supplement consideration — ${flag.supplementRecommendation}\n`;
      }
    }
  }

  // Add ecosystem insights
  if (keyInsights.length > 0) {
    prompt += `\n## Ecosystem Insights\n`;
    for (const insight of keyInsights.slice(0, 5)) {
      prompt += `- [${insight.source.toUpperCase()}] ${insight.insight}\n`;
    }
  }

  // Add medical conditions
  if (constraints.medical.length > 0) {
    prompt += `\n## Medical Conditions\n- ${constraints.medical.join('\n- ')}\n`;
  }

  // Add medications
  if (constraints.medications.length > 0) {
    prompt += `\n## Current Medications\n- ${constraints.medications.join('\n- ')}\n`;
  }

  prompt += `
## YOUR TASK
Design a comprehensive nutrition philosophy and framework that:
1. Addresses their primary goal of "${profile.drivingGoal}"
2. Respects ALL dietary constraints listed above
3. Incorporates biomarker-specific recommendations
4. Fits their ${profile.eatingStyle} eating style preference
5. Works with their ${profile.mealsPerDay} meals per day pattern
6. Considers their ${profile.cookingFrequency} cooking frequency

Create the JSON structure as specified above.`;

  return prompt;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

export async function runNutritionArchitect(
  clientProfile: ClientProfileCard
): Promise<NutritionArchitectOutput> {
  console.log('[Nutrition Architect] Starting nutrition framework design...');
  console.log(`[Nutrition Architect] Client — ${clientProfile.profile.firstName}`);
  console.log(`[Nutrition Architect] Goal — ${clientProfile.profile.drivingGoal}`);

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
      temperature: 0.7,
      max_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from GPT-4o');
    }

    const result = JSON.parse(content);

    console.log('[Nutrition Architect] Framework design complete');
    console.log(`[Nutrition Architect] Tokens used — ${response.usage?.total_tokens || 'unknown'}`);

    // Validate and normalize the output
    return normalizeOutput(result, clientProfile);
  } catch (error) {
    console.error('[Nutrition Architect] Error:', error);
    console.log('[Nutrition Architect] Using fallback framework');
    return createFallbackOutput(clientProfile);
  }
}

// ============================================================================
// NORMALIZE OUTPUT
// ============================================================================

function normalizeOutput(
  result: Record<string, unknown>,
  clientProfile: ClientProfileCard
): NutritionArchitectOutput {
  const { computedMetrics, profile } = clientProfile;

  // Ensure nutrition structure has all required fields
  const nutritionStructure = (result.nutritionOverview as Record<string, unknown>)?.nutritionStructure as Record<string, string> || {};

  const normalizedStructure = {
    calories: nutritionStructure.calories || `${computedMetrics.targetCalories} calories`,
    protein: nutritionStructure.protein || `${computedMetrics.proteinTargetGrams}g`,
    carbs: nutritionStructure.carbs || `${computedMetrics.carbTargetGrams}g`,
    fiber: nutritionStructure.fiber || `${computedMetrics.fiberTargetGrams}g minimum`,
    fat: nutritionStructure.fat || `${computedMetrics.fatTargetGrams}g`,
  };

  // Normalize daily recommendations
  const dailyRecs = result.dailyRecommendations as Record<string, unknown> || {};

  const normalizedDailyRecs: DailyRecommendations = {
    morningRitual: dailyRecs.morningRitual || createDefaultMorningRitual(),
    empowerGut: dailyRecs.empowerGut || createDefaultGutHealth(),
    afternoonVitality: dailyRecs.afternoonVitality || createDefaultAfternoon(),
    energyOptimization: dailyRecs.energyOptimization || createDefaultEnergy(),
    eveningNourishment: dailyRecs.eveningNourishment || createDefaultEvening(),
    nutritionGuidelines: dailyRecs.nutritionGuidelines || createDefaultGuidelines(),
  };

  return {
    nutritionPhilosophy: result.nutritionPhilosophy as NutritionPhilosophy || createFallbackPhilosophy(clientProfile),
    nutritionOverview: {
      goals: (result.nutritionOverview as Record<string, unknown>)?.goals as string[] || [profile.drivingGoal, 'Optimize overall health'],
      nutritionStructure: normalizedStructure,
    },
    dailyRecommendations: normalizedDailyRecs,
  };
}

// ============================================================================
// DEFAULT SECTIONS
// ============================================================================

function createDefaultMorningRitual() {
  return {
    title: 'Morning Ritual',
    items: [
      { time: 'Upon waking', action: 'Drink 500ml water with lemon', description: 'Rehydrates cells after overnight fast and kickstarts metabolism — the lemon adds vitamin C and aids digestion' },
      { time: 'Within 30 minutes', action: 'Include 25-30g protein at breakfast', description: 'Stabilizes blood sugar for the morning — try eggs, Greek yogurt, cottage cheese, or smoked salmon' },
      { time: 'With breakfast', action: 'Take any recommended supplements with food', description: 'Fat-soluble vitamins (D, E, K) absorb better with dietary fat — pair with avocado, nuts, or eggs' },
    ],
  };
}

function createDefaultGutHealth() {
  return {
    title: 'Gut Health Focus',
    items: [
      { time: 'With lunch or dinner', action: 'Include fermented foods daily', description: 'Kefir, sauerkraut, kimchi, miso, or live-culture yogurt — these provide probiotics that support nutrient absorption and immune function' },
      { time: 'Throughout the day', action: 'Aim for 30+ different plants weekly', description: 'Include herbs, spices, nuts, seeds, vegetables, and fruits — variety feeds different beneficial gut bacteria' },
      { time: 'With each meal', action: 'Include prebiotic fiber sources', description: 'Garlic, onions, leeks, asparagus, bananas, and oats feed your beneficial gut bacteria' },
    ],
  };
}

function createDefaultAfternoon() {
  return {
    title: 'Afternoon Vitality',
    items: [
      { time: '2-3 PM', action: 'Protein-rich snack with healthy fats', description: 'Combat the afternoon energy dip — try apple with almond butter, Greek yogurt with berries, or a handful of nuts with cheese' },
      { time: 'Every 2 hours', action: 'Hydration check — 250ml water', description: 'Dehydration causes fatigue before you feel thirsty — set reminders to maintain consistent water intake' },
      { time: 'If energy dips', action: 'Walk for 10 minutes before caffeine', description: 'Movement increases blood flow and alertness naturally — save caffeine for when truly needed' },
    ],
  };
}

function createDefaultEnergy() {
  return {
    title: 'Energy Optimization',
    items: [
      { time: 'At each meal', action: 'Pair carbs with protein and fat', description: 'This combination slows glucose absorption — prevents energy spikes and crashes from eating carbs alone' },
      { time: 'Throughout the day', action: 'Choose low-glycemic carbs', description: 'Sweet potatoes, quinoa, legumes, and whole grains release energy steadily — avoid refined white bread and sugary foods' },
      { time: 'Mid-morning and afternoon', action: 'Include omega-3 rich foods', description: 'Walnuts, chia seeds, flaxseeds, or fatty fish — omega-3s support brain energy and reduce inflammation' },
    ],
  };
}

function createDefaultEvening() {
  return {
    title: 'Evening Nourishment',
    items: [
      { time: '3+ hours before bed', action: 'Complete your last substantial meal', description: 'Allows digestion to complete before sleep — lying down with a full stomach disrupts sleep quality' },
      { time: 'With dinner', action: 'Include magnesium-rich foods', description: 'Dark leafy greens, pumpkin seeds, almonds, or dark chocolate — magnesium supports muscle relaxation and sleep' },
      { time: '1-2 hours before bed', action: 'Light snack if needed — tryptophan-rich', description: 'Small portion of turkey, cottage cheese, or banana — tryptophan helps with natural melatonin production' },
    ],
  };
}

function createDefaultGuidelines() {
  return {
    title: 'Key Nutrition Guidelines',
    items: [
      { time: 'Daily', action: '80% whole foods, 20% flexibility', description: 'Base your diet on unprocessed foods — vegetables, fruits, lean proteins, whole grains — while allowing room for enjoyment' },
      { time: 'Weekly', action: 'Include fatty fish 2-3 times', description: 'Salmon, mackerel, sardines, or trout provide EPA and DHA — critical for brain health and reducing inflammation' },
      { time: 'Daily', action: 'Eat the rainbow — 5+ colors of vegetables', description: 'Different colors provide different phytonutrients and antioxidants — aim for variety at each meal' },
    ],
  };
}

// ============================================================================
// FALLBACK OUTPUT
// ============================================================================

function createFallbackPhilosophy(clientProfile: ClientProfileCard): NutritionPhilosophy {
  const { profile, computedMetrics, biomarkerFlags } = clientProfile;

  let personalizedApproach = `Your nutrition plan is designed around your goal of ${profile.drivingGoal}, taking into account your ${profile.activityLevel} activity level and ${profile.eatingStyle} eating preferences. `;

  if (biomarkerFlags.length > 0) {
    personalizedApproach += `We've also incorporated insights from your blood work to address key areas like ${biomarkerFlags.slice(0, 2).map(f => f.marker.toLowerCase()).join(' and ')}. `;
  }

  personalizedApproach += `\n\nThe foundation of this approach is sustainable, whole-food nutrition that fits your lifestyle. Rather than restrictive dieting, we focus on nourishing your body with the right nutrients at the right times. `;
  personalizedApproach += `With your ${computedMetrics.sleepScore} sleep quality and ${computedMetrics.stressScore} stress levels, we've also incorporated strategies to support recovery and stress management through nutrition.`;

  const keyPrinciples = [
    {
      principle: 'Protein Priority',
      description: `At ${computedMetrics.proteinTargetGrams}g daily, protein is your foundation for energy, satiety, and body composition.`,
    },
    {
      principle: 'Nutrient Density',
      description: 'Focus on foods that provide maximum nutrition per calorie — vegetables, fruits, lean proteins, and whole grains.',
    },
    {
      principle: 'Metabolic Flexibility',
      description: 'Training your body to efficiently use both carbs and fats for fuel through balanced nutrition.',
    },
    {
      principle: 'Gut-Brain Connection',
      description: 'Supporting digestive health to improve mood, energy, and overall wellbeing.',
    },
  ];

  // Add biomarker-specific principle if relevant
  if (biomarkerFlags.some(f => f.priority === 'high' || f.priority === 'critical')) {
    const criticalFlag = biomarkerFlags.find(f => f.priority === 'high' || f.priority === 'critical');
    if (criticalFlag) {
      keyPrinciples.push({
        principle: `${criticalFlag.marker} Optimization`,
        description: criticalFlag.implication,
      });
    }
  }

  const eatingStrategyRationale = `Your ${profile.mealsPerDay}-meal structure with ${profile.eatingStyle} preferences provides the flexibility you need while ensuring adequate nutrition throughout the day. `;

  return {
    personalizedApproach,
    keyPrinciples,
    eatingStrategyRationale,
  };
}

function createFallbackOutput(clientProfile: ClientProfileCard): NutritionArchitectOutput {
  const { profile, computedMetrics } = clientProfile;

  // Calculate percentages
  const totalCals = computedMetrics.targetCalories;
  const proteinPct = Math.round((computedMetrics.proteinTargetGrams * 4 / totalCals) * 100);
  const carbPct = Math.round((computedMetrics.carbTargetGrams * 4 / totalCals) * 100);
  const fatPct = Math.round((computedMetrics.fatTargetGrams * 9 / totalCals) * 100);

  return {
    nutritionPhilosophy: createFallbackPhilosophy(clientProfile),
    nutritionOverview: {
      goals: [
        profile.drivingGoal,
        'Optimize metabolic health',
        'Improve energy levels',
        'Support overall wellbeing',
      ],
      nutritionStructure: {
        calories: `${computedMetrics.targetCalories} calories`,
        protein: `${computedMetrics.proteinTargetGrams}g (${proteinPct}% of calories)`,
        carbs: `${computedMetrics.carbTargetGrams}g (${carbPct}% of calories)`,
        fiber: `${computedMetrics.fiberTargetGrams}g minimum`,
        fat: `${computedMetrics.fatTargetGrams}g (${fatPct}% of calories)`,
      },
    },
    dailyRecommendations: {
      morningRitual: createDefaultMorningRitual(),
      empowerGut: createDefaultGutHealth(),
      afternoonVitality: createDefaultAfternoon(),
      energyOptimization: createDefaultEnergy(),
      eveningNourishment: createDefaultEvening(),
      nutritionGuidelines: createDefaultGuidelines(),
    },
  };
}
