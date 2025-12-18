/**
 * Re-run Nutrition Architect for a specific Sage plan
 * Usage: node --env-file=.env.local scripts/rerun-nutrition-architect.mjs C3QKLEE8
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const uniqueCode = process.argv[2] || 'C3QKLEE8';

console.log(`\n🔄 Re-running Nutrition Architect for plan: ${uniqueCode}\n`);

// Fetch the plan data (uniqueCode is inside form_data JSON)
const { data: planData, error: fetchError } = await supabase
  .from('sage_onboarding_data')
  .select('*')
  .eq('form_data->>uniqueCode', uniqueCode)
  .single();

if (fetchError || !planData) {
  console.error('❌ Error fetching plan:', fetchError?.message || 'Not found');
  process.exit(1);
}

console.log(`✅ Found plan for: ${planData.email}`);
console.log(`📊 Current plan has dailyRecommendations:`, !!planData.sage_plan?.dailyRecommendations);

// Build client profile from form data
const formData = planData.form_data;
const bloodAnalysis = planData.lab_file_analysis;

// Calculate basic metrics
const weightKg = parseFloat(formData.weight) || 70;
const heightCm = parseFloat(formData.height) || 170;
const age = parseInt(formData.age) || 30;
const gender = formData.gender || 'female';

// BMR calculation (Mifflin-St Jeor)
const bmr = gender === 'male'
  ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
  : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;

const activityMultipliers = {
  'sedentary': 1.2,
  'light': 1.375,
  'moderate': 1.55,
  'active': 1.725,
  'very-active': 1.9
};
const activityLevel = formData.activityLevel || 'moderate';
const tdee = Math.round(bmr * (activityMultipliers[activityLevel] || 1.55));

// Macro targets
const proteinTarget = Math.round(weightKg * 1.6);
const fatTarget = Math.round((tdee * 0.28) / 9);
const carbTarget = Math.round((tdee - proteinTarget * 4 - fatTarget * 9) / 4);

// Build biomarker flags from blood analysis
const biomarkerFlags = [];
if (bloodAnalysis?.biomarkers) {
  for (const marker of bloodAnalysis.biomarkers) {
    if (marker.status && !['Normal', 'normal'].includes(marker.status)) {
      biomarkerFlags.push({
        marker: marker.name,
        status: marker.status.toLowerCase(),
        value: marker.value,
        implication: `${marker.name} is ${marker.status.toLowerCase()}`,
        foodRecommendations: [],
        priority: marker.status.toLowerCase().includes('high') || marker.status.toLowerCase().includes('low') ? 'high' : 'medium'
      });
    }
  }
}

console.log(`\n📋 Profile Summary:`);
console.log(`   - Name: ${formData.fullName}`);
console.log(`   - Age: ${age}, Gender: ${gender}`);
console.log(`   - Weight: ${weightKg}kg, Height: ${heightCm}cm`);
console.log(`   - TDEE: ${tdee} calories`);
console.log(`   - Protein target: ${proteinTarget}g`);
console.log(`   - Biomarker flags: ${biomarkerFlags.length}`);
if (biomarkerFlags.length > 0) {
  biomarkerFlags.forEach(f => console.log(`     • ${f.marker}: ${f.status}`));
}

// Build the system prompt (same as nutrition-architect.ts)
const SYSTEM_PROMPT = `You are a Master Nutrition Architect — an expert at designing personalized nutrition frameworks that optimize health based on individual biomarkers, goals, and lifestyle factors.

Your task is to create the foundational nutrition philosophy and framework that will guide the entire nutrition plan.

CRITICAL RULES:
1. NEVER use colons (:) in your text — use em dashes (—) instead
2. Use "you" and "your" when addressing the client
3. Reference SPECIFIC data from their profile (biomarkers, metrics, goals) WITH ACTUAL NUMBERS
4. Keep recommendations evidence-based and practical
5. Consider biomarker flags when designing the approach
6. Respect ALL dietary constraints (allergies, intolerances, preferences)

DAILY RECOMMENDATIONS REQUIREMENTS — MANDATORY:
⚠️ Each section MUST have EXACTLY 3 items. No less, no more.
- Reference the client's SPECIFIC biomarkers with ACTUAL VALUES (e.g., "Your Vitamin D at 31 nmol/L is deficient — supplement with 4000 IU daily")
- Reference their SPECIFIC goals (e.g., "For longevity focus...")
- Include SPECIFIC food examples (e.g., "salmon, mackerel, sardines" not just "fatty fish")
- Include SPECIFIC quantities where relevant (e.g., "25-30g protein" not just "protein")
- Every item MUST have a "time" field with specific timing
- Descriptions MUST be 1-2 sentences explaining WHY this matters for THIS person, referencing their biomarkers or goals

OUTPUT FORMAT:
Return valid JSON. CRITICAL — Each section in dailyRecommendations MUST have EXACTLY 3 items. Do NOT return fewer than 3 items per section.
{
  "nutritionPhilosophy": {
    "personalizedApproach": "2-3 paragraphs",
    "keyPrinciples": [{ "principle": "name", "description": "why" }],
    "eatingStrategyRationale": "1-2 paragraphs"
  },
  "nutritionOverview": {
    "goals": ["goal1", "goal2"],
    "nutritionStructure": {
      "calories": "${tdee} calories",
      "protein": "${proteinTarget}g",
      "carbs": "${carbTarget}g",
      "fiber": "28g minimum",
      "fat": "${fatTarget}g"
    }
  },
  "dailyRecommendations": {
    "morningRitual": {
      "title": "Morning Ritual",
      "items": [
        { "time": "Upon waking", "action": "Drink 500ml water with lemon", "description": "Rehydrates cells after 7-8 hours without fluids — the lemon adds vitamin C and aids digestion to kickstart your metabolism" },
        { "time": "Within 30 minutes", "action": "Take Vitamin D3 (4000 IU) with breakfast", "description": "Your Vitamin D at 31 nmol/L is deficient — taking with dietary fat improves absorption by up to 50% to support bone health and immune function" },
        { "time": "With breakfast", "action": "Include 25-30g protein from eggs or Greek yogurt", "description": "Stabilizes blood sugar for the morning — your elevated glucose at 6.16 mmol/L needs steady insulin response from protein, not carb-heavy breakfasts" }
      ]
    },
    "empowerGut": {
      "title": "Gut Health Focus",
      "items": [
        { "time": "With lunch or dinner", "action": "Include fermented foods daily", "description": "Kefir, sauerkraut, kimchi, or miso provide live probiotics — these support nutrient absorption and may help with cholesterol metabolism" },
        { "time": "Throughout the day", "action": "Aim for 30+ different plants weekly", "description": "Include herbs, spices, nuts, seeds, vegetables — variety feeds different beneficial gut bacteria that support hormone balance" },
        { "time": "With each meal", "action": "Include prebiotic fiber sources", "description": "Garlic, onions, leeks, asparagus, and oats feed beneficial bacteria — prebiotics support the probiotics you're consuming" }
      ]
    },
    "afternoonVitality": {
      "title": "Afternoon Vitality",
      "items": [
        { "time": "2-3 PM", "action": "Protein-rich snack with healthy fats", "description": "Combat the afternoon energy dip — try apple slices with almond butter (15g protein) or Greek yogurt with berries to stabilize blood sugar" },
        { "time": "Every 2 hours", "action": "Hydration check — drink 250ml water", "description": "Dehydration causes fatigue before you feel thirsty — aim for 2L daily to support metabolism and energy" },
        { "time": "If energy dips", "action": "Walk for 10 minutes before reaching for caffeine", "description": "Movement increases blood flow and alertness naturally — save caffeine for when truly needed to avoid cortisol spikes" }
      ]
    },
    "energyOptimization": {
      "title": "Energy Optimization",
      "items": [
        { "time": "At each meal", "action": "Pair carbs with protein and healthy fats", "description": "This combination slows glucose absorption — critical for your elevated glucose at 6.16 mmol/L to prevent energy spikes and crashes" },
        { "time": "Throughout the day", "action": "Choose low-glycemic carbs", "description": "Sweet potatoes, quinoa, legumes release energy steadily — avoid white bread and sugary foods that spike your already elevated blood sugar" },
        { "time": "Mid-morning and afternoon", "action": "Include omega-3 rich foods", "description": "Your HDL at 1.50 mmol/L is low — walnuts, chia seeds, fatty fish boost HDL cholesterol and reduce inflammation" }
      ]
    },
    "eveningNourishment": {
      "title": "Evening Nourishment",
      "items": [
        { "time": "3+ hours before bed", "action": "Complete your last substantial meal", "description": "Allows digestion to complete before sleep — eating late disrupts sleep quality which affects hormone balance and glucose regulation" },
        { "time": "With dinner", "action": "Include magnesium-rich foods", "description": "Dark leafy greens, pumpkin seeds, or dark chocolate — magnesium supports progesterone production and your hormones need optimization" },
        { "time": "1-2 hours before bed", "action": "Light snack if needed — tryptophan-rich", "description": "Small portion of turkey, cottage cheese, or banana — tryptophan supports melatonin production for quality sleep" }
      ]
    },
    "nutritionGuidelines": {
      "title": "Key Nutrition Guidelines",
      "items": [
        { "time": "Daily", "action": "80% whole foods, 20% flexibility", "description": "Base your diet on unprocessed foods to support cholesterol management — your Total Cholesterol at 5.80 mmol/L and LDL at 3.76 mmol/L need dietary intervention" },
        { "time": "Weekly", "action": "Include fatty fish 2-3 times", "description": "Salmon, mackerel, sardines provide EPA and DHA — critical for raising your low HDL at 1.50 mmol/L and reducing inflammation" },
        { "time": "Daily", "action": "Eat the rainbow — 5+ colors of vegetables", "description": "Different colors provide different phytonutrients — antioxidants support hormone balance and cardiovascular health" }
      ]
    }
  }
}`;

// Build the user prompt
const userPrompt = `# CLIENT NUTRITION PROFILE

## Basic Information
- Name — ${formData.fullName || formData.firstName}
- Age — ${age} years
- Gender — ${gender}
- Weight — ${weightKg} kg
- Height — ${heightCm} cm
- Activity Level — ${activityLevel}

## Health Goals
- Main Priority — ${formData.mainPriority || 'health'}
- Driving Goal — ${formData.drivingGoal || 'overall health'}
- Time Horizon — medium-term

## Eating Patterns
- Eating Style — ${formData.eatingStyle || '3 meals'}
- First Meal — ${formData.firstMeal || '9 AM'}
- Meals Per Day — 3
- Cooking Frequency — ${formData.mealsCooked || 'all meals'}

## Dietary Constraints
- Allergies — ${(formData.allergies || []).join(', ') || 'None reported'}
- Protein Preferences — ${(formData.proteinSources || []).join(', ') || 'All'}
- Food Dislikes — ${formData.foodDislikes || 'None'}

## Computed Nutrition Targets
- Target Calories — ${tdee} kcal/day
- Protein Target — ${proteinTarget}g (${Math.round((proteinTarget * 4 / tdee) * 100)}% of calories)
- Carb Target — ${carbTarget}g (${Math.round((carbTarget * 4 / tdee) * 100)}% of calories)
- Fat Target — ${fatTarget}g (${Math.round((fatTarget * 9 / tdee) * 100)}% of calories)
- Fiber Target — 28g minimum

## Biomarker Flags (IMPORTANT - Address these in recommendations)
${biomarkerFlags.length > 0
  ? biomarkerFlags.map(f => `- ${f.marker} — ${f.status} (${f.value || 'value not specified'})`).join('\n')
  : '- No blood work data available'}

## Key Concerns from Blood Work
${bloodAnalysis?.concerns?.length > 0
  ? bloodAnalysis.concerns.map(c => `- ${c}`).join('\n')
  : '- No specific concerns identified'}

---

Create a comprehensive, personalized nutrition framework for ${formData.fullName || formData.firstName}.

IMPORTANT:
- Each dailyRecommendations section MUST have 2-4 items
- Every item MUST have a "time" field
- Reference their SPECIFIC biomarker values (Vitamin D at 31 nmol/L, HDL at 1.50 mmol/L, etc.)
- Include SPECIFIC food examples and quantities
- Descriptions should be 1-2 sentences explaining WHY this matters for this person`;

console.log(`\n🤖 Calling GPT-4o for Nutrition Architect...\n`);

try {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.7,
    response_format: { type: 'json_object' }
  });

  const content = response.choices[0].message.content;
  const result = JSON.parse(content);

  console.log(`✅ Nutrition Architect completed!`);
  console.log(`\n📋 Daily Recommendations sections:`);

  if (result.dailyRecommendations) {
    for (const [key, section] of Object.entries(result.dailyRecommendations)) {
      const items = section.items || [];
      console.log(`   - ${section.title || key}: ${items.length} items`);
      items.forEach((item, i) => {
        console.log(`     ${i + 1}. [${item.time || 'no time'}] ${item.action}`);
      });
    }
  }

  // Merge with existing plan
  const existingPlan = planData.sage_plan || {};
  const updatedPlan = {
    ...existingPlan,
    nutritionPhilosophy: result.nutritionPhilosophy || existingPlan.nutritionPhilosophy,
    nutritionOverview: result.nutritionOverview || existingPlan.nutritionOverview,
    dailyRecommendations: result.dailyRecommendations || existingPlan.dailyRecommendations
  };

  // Update the database
  console.log(`\n💾 Updating database...`);

  const { error: updateError } = await supabase
    .from('sage_onboarding_data')
    .update({ sage_plan: updatedPlan })
    .eq('form_data->>uniqueCode', uniqueCode);

  if (updateError) {
    console.error('❌ Error updating plan:', updateError.message);
    process.exit(1);
  }

  console.log(`\n✅ Plan updated successfully!`);
  console.log(`🔗 View at: https://moccet.ai/sage/plan/${uniqueCode}`);

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
