import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { devPlanStorage, devOnboardingStorage } from '@/lib/dev-storage';
import { createClient } from '@/lib/supabase/server';
import { buildNutritionPlanPrompt, buildSystemPrompt } from '@/lib/prompts/unified-context-prompt';

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key is not configured. Please set OPENAI_API_KEY environment variable.');
  }
  return new OpenAI({
    apiKey,
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const email = searchParams.get('email');
    const identifier = code || email;

    if (!identifier) {
      return NextResponse.json(
        { error: 'Email or code parameter is required' },
        { status: 400 }
      );
    }

    console.log('\n' + '='.repeat(80));
    console.log('SAGE PERSONALIZED NUTRITION PLAN GENERATOR');
    console.log('='.repeat(80) + '\n');

    // Fetch onboarding data (works with both dev mode and Supabase)
    console.log(`[1/4] Fetching onboarding data for: ${identifier}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let formData: any;

    // Check dev storage first
    console.log(`[DEBUG] Checking dev storage for identifier: ${identifier}`);
    console.log(`[DEBUG] Dev storage size: ${devOnboardingStorage.size}`);
    console.log(`[DEBUG] Dev storage keys:`, Array.from(devOnboardingStorage.keys()));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const devData = devOnboardingStorage.get(identifier) as any;
    console.log(`[DEBUG] Dev data found:`, !!devData);

    if (devData) {
      formData = devData.form_data;
      console.log('[OK] Onboarding data retrieved from dev storage');
    } else {
      // Try Supabase if configured
      const hasSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (hasSupabase && process.env.FORCE_DEV_MODE !== 'true') {
        try {
          const supabase = await createClient();

          let query;
          if (code) {
            // Search by uniqueCode in the form_data JSON field using the -> operator
            query = supabase
              .from('sage_onboarding_data')
              .select('*')
              .eq('form_data->>uniqueCode', code);
          } else {
            // Search by email (primary key)
            query = supabase
              .from('sage_onboarding_data')
              .select('*')
              .eq('email', email);
          }

          const { data, error } = await query.single();

          if (error) {
            console.error('Failed to fetch onboarding data from Supabase:', error);
            return NextResponse.json(
              { error: 'No onboarding data found for this email' },
              { status: 404 }
            );
          }

          formData = data.form_data;
          console.log('[OK] Onboarding data retrieved from Supabase');
        } catch (error) {
          console.error('Error fetching from Supabase:', error);
          return NextResponse.json(
            { error: 'Failed to retrieve onboarding data' },
            { status: 500 }
          );
        }
      } else {
        console.error('No onboarding data found');
        return NextResponse.json(
          { error: 'No onboarding data found for this email' },
          { status: 404 }
        );
      }
    }

    console.log(`    Name: ${formData.fullName}`);
    console.log(`    Age: ${formData.age}, Gender: ${formData.gender}`);
    console.log(`    Main Priority: ${formData.mainPriority}`);
    console.log(`    Driving Goal: ${formData.drivingGoal}\n`);

    // Check for existing plan in cache or database
    console.log(`[2/4] Checking for existing nutrition plan...`);
    console.log(`[DEBUG] Identifier: ${identifier}, Code: ${code}, Email: ${email}`);
    let cachedPlan = devPlanStorage.get(identifier);

    // If not in dev storage, check Supabase
    if (!cachedPlan) {
      console.log('[INFO] Plan not in dev storage, checking Supabase...');
      const hasSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      console.log(`[DEBUG] Has Supabase: ${!!hasSupabase}, FORCE_DEV_MODE: ${process.env.FORCE_DEV_MODE}`);

      if (hasSupabase && process.env.FORCE_DEV_MODE !== 'true') {
        try {
          const supabase = await createClient();
          let query;

          if (code) {
            console.log(`[DEBUG] Querying by code: ${code}`);
            query = supabase
              .from('sage_onboarding_data')
              .select('sage_plan')
              .eq('form_data->>uniqueCode', code);
          } else {
            console.log(`[DEBUG] Querying by email: ${email}`);
            query = supabase
              .from('sage_onboarding_data')
              .select('sage_plan')
              .eq('email', email);
          }

          const { data, error } = await query.single();

          if (error) {
            console.log('[INFO] Supabase query error:', error);
          }

          if (data?.sage_plan) {
            cachedPlan = data.sage_plan;
            console.log('[OK] Existing plan found in database');
          } else {
            console.log('[INFO] No sage_plan field in database record');
          }
        } catch (error) {
          console.log('[ERROR] Exception checking database:', error);
        }
      } else {
        console.log('[INFO] Skipping Supabase check (not configured or dev mode)');
      }
    } else {
      console.log('[OK] Plan found in dev storage');
    }

    if (cachedPlan) {
      console.log('[OK] Existing plan found - returning cached version\n');
      return NextResponse.json({
        success: true,
        plan: cachedPlan,
        cached: true,
      });
    }

    console.log('[OK] No existing plan - generating new one\n');

    // Step 2.5: Aggregate unified context from ecosystem
    console.log(`[2.5/5] Aggregating unified context from ecosystem data...`);
    let unifiedContext = null;
    const userEmail = email || formData.email;

    try {
      const contextResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/aggregate-context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          contextType: 'sage',
          forceRefresh: false,
        }),
      });

      if (contextResponse.ok) {
        const contextData = await contextResponse.json();
        unifiedContext = contextData.context;
        console.log('[OK] Unified context aggregated successfully');
        console.log(`[OK] Data Quality: ${contextData.qualityMessage?.split('\n')[0] || 'Unknown'}`);
      } else {
        console.log('[WARN] Failed to aggregate context, proceeding with onboarding data only');
      }
    } catch (error) {
      console.error('[WARN] Error aggregating context:', error);
      console.log('[WARN] Proceeding with onboarding data only');
    }

    // Generate AI plan
    console.log(`[3/5] Generating personalized nutrition plan with AI...`);
    const openai = getOpenAIClient();

    // Build comprehensive prompt with unified context
    const prompt = unifiedContext
      ? buildNutritionPlanPrompt(unifiedContext, formData)
      : `You are an elite nutritionist, longevity expert, and personalized health consultant. Generate a comprehensive, personalized Sage Nutrition Plan for this individual.

User Profile:
- Name: ${formData.fullName}
- Age: ${formData.age}
- Gender: ${formData.gender}
- Weight: ${formData.weight}
- Height: ${formData.height}

Health Goals (The Ikigai):
- Main Priority: ${formData.mainPriority}
- Driving Goal: ${formData.drivingGoal}

Health Baseline:
- Allergies/Intolerances: ${formData.allergies.join(', ')} ${formData.otherAllergy ? `+ ${formData.otherAllergy}` : ''}
- Current Medications: ${formData.medications || 'None'}
- Current Supplements: ${formData.supplements || 'None'}
- Medical Conditions: ${formData.medicalConditions.join(', ')} ${formData.otherCondition ? `+ ${formData.otherCondition}` : ''}

Nutrition Profile (The Fuel):
- Eating Style: ${formData.eatingStyle}
- First Meal Timing: ${formData.firstMeal}
- Energy Crash Strategy: ${formData.energyCrash}
- Preferred Protein Sources: ${formData.proteinSources.join(', ')} ${formData.otherProtein ? `+ ${formData.otherProtein}` : ''}
- Food Dislikes: ${formData.foodDislikes || 'None specified'}
- Meals Cooked Per Week: ${formData.mealsCooked}
- Alcohol Consumption: ${formData.alcoholConsumption}

Connected Integrations: ${formData.integrations.join(', ') || 'None yet'}
${formData.hasLabFile ? 'Lab results: Uploaded (analysis pending)' : 'Lab results: Not uploaded'}

Your task is to create a complete nutrition plan that addresses their specific goals, health conditions, lifestyle, and preferences. The plan should be:
1. Evidence-based and scientifically sound
2. Practical and tailored to their cooking habits and schedule
3. Respectful of their allergies, medical conditions, and food preferences
4. Optimized for their specific health goal (longevity, cognitive performance, physical performance, body composition, or emotional balance)

Generate a JSON response with the following structure:
{
  "personalizedGreeting": "A warm, personalized greeting using their first name",
  "executiveSummary": "2-3 paragraphs analyzing their unique situation, health priorities, and what this plan will achieve. Be specific to their data. If no lab data, focus on their goals and lifestyle patterns.",
  "biomarkers": null,
  "nutritionOverview": {
    "goals": ["3-4 specific, measurable nutrition goals based on their priorities"],
    "nutritionStructure": {
      "calories": "Daily calorie range with rationale",
      "protein": "Protein target in grams with rationale",
      "carbs": "Carb target/approach with timing suggestions",
      "fiber": "Fiber target in grams",
      "fat": "Fat target in grams with omega-3 emphasis"
    }
  },
  "dailyRecommendations": {
    "morningRitual": ["3-4 specific morning nutrition habits with their preferences in mind"],
    "empowerGut": ["3-4 gut health strategies (resistant starch, fermented foods, etc.)"],
    "afternoonVitality": ["3-4 afternoon nutrition strategies to prevent energy crashes"],
    "energyOptimization": ["3-4 carb/protein timing strategies around their workout schedule"],
    "middayMastery": ["3-4 lunch-focused strategies emphasizing their protein preferences"],
    "eveningNourishment": ["3-4 dinner and evening nutrition strategies"]
  },
  "micronutrientFocus": [
    {
      "nutrient": "Nutrient name",
      "dailyGoal": "Target amount",
      "foodSources": "Specific foods from their preferred sources"
    }
  ],
  "sampleMealPlan": {
    "day1": {
      "meals": [
        {
          "time": "7:45 am",
          "name": "Breakfast name",
          "description": "Brief one-line description of the meal",
          "macros": "calories | protein | carbs | fiber",
          "ingredients": [
            "Exact amount ingredient 1 (e.g., 150g chicken breast)",
            "Exact amount ingredient 2 (e.g., 1 cup brown rice, cooked)",
            "Exact amount ingredient 3 (e.g., 2 tbsp olive oil)"
          ],
          "cookingInstructions": [
            "Step 1: Detailed first cooking step",
            "Step 2: Detailed second cooking step",
            "Step 3: Detailed third cooking step",
            "Step 4: Final assembly and serving instructions"
          ]
        }
      ]
    },
    "day2": { "meals": [...] },
    "day3": { "meals": [...] },
    "day4": { "meals": [...] },
    "day5": { "meals": [...] },
    "day6": { "meals": [...] },
    "day7": { "meals": [...] }
  },
  "lifestyleIntegration": {
    "sleepOptimization": "Sleep protocol paragraph",
    "exerciseProtocol": "Exercise nutrition paragraph based on their workout schedule",
    "stressManagement": "Stress management paragraph",
    "skinImprovement": "Skin health paragraph if relevant to their goals"
  },
  "supplementRecommendations": {
    "essentialSupplements": [
      {
        "name": "Supplement name (e.g., Omega-3 Fish Oil, Vitamin D3, Magnesium Glycinate)",
        "dosage": "Specific dosage with units (e.g., 2000mg EPA/DHA, 5000 IU, 400mg)",
        "timing": "When to take it (e.g., With breakfast, Before bed, Post-workout)",
        "rationale": "Why this supplement is essential for this user based on their biomarkers, goals, or deficiencies",
        "benefits": "Expected benefits specific to their health priorities",
        "duration": "How long to supplement (e.g., Daily ongoing, 8-12 weeks then retest, Seasonal support)"
      }
    ],
    "optionalSupplements": [
      {
        "name": "Optional supplement name",
        "dosage": "Specific dosage with units",
        "timing": "When to take it",
        "rationale": "Why this could be beneficial but is not essential",
        "benefits": "Potential additional benefits",
        "duration": "Recommended duration"
      }
    ]
  },
  "preventiveFeatures": [
    "Calendar-integrated meal reminders description",
    "Water/sleep/training tracking description",
    "Biomarker recheck plan (10-12 weeks)"
  ]
}

IMPORTANT:
- Use THEIR specific protein sources (${formData.proteinSources.join(', ')})
- Avoid ALL their allergens (${formData.allergies.join(', ')})
- Avoid their disliked foods (${formData.foodDislikes || 'none specified'})
- Consider their cooking frequency (${formData.mealsCooked} meals/week)
- Align with their eating style (${formData.eatingStyle})
- Time meals around their first meal preference (${formData.firstMeal})
- Address their main health priority: ${formData.mainPriority}

SUPPLEMENT RECOMMENDATIONS REQUIREMENTS:
- Provide 2-4 essential supplements that are foundational for this user's health profile
- Essential supplements should target verified deficiencies (from biomarkers) OR core foundational needs (Omega-3, Vitamin D, Magnesium)
- Provide 1-3 optional supplements that could enhance their specific goals but aren't critical
- Each supplement MUST have: specific name, precise dosage with units, timing recommendation, clear rationale tied to their data/goals, expected benefits, and duration guidance
- Focus on supplements that complement their nutrition plan, not replace whole food nutrition
- If they have uploaded lab results showing specific deficiencies, prioritize those
- Common essential supplements to consider: Omega-3 (EPA/DHA), Vitamin D3, Magnesium Glycinate, Methylated B-Complex
- Optional supplements based on goals: Creatine (performance), Ashwagandha (stress), Rhodiola (energy), Curcumin (inflammation)
- Be conservative — only recommend what's truly beneficial for THEIR specific situation

FORMATTING:
- DO NOT use colons (:) ANYWHERE in the plan - not for labels, titles, or in sentences
- Use em dashes (—) instead of colons for labels and separators
- Example: Instead of "Breakfast: Oatmeal" write "Breakfast — Oatmeal"
- Example: Instead of "On training days: pre workout" write "On training days — pre workout" or "On training days, pre workout"
- Use proper punctuation in sentences: commas for lists, periods for sentence endings
- When listing items in a sentence, use commas to separate them (e.g., "fish, nuts, seeds, and colorful produce")
- Only use periods to end complete sentences, NOT to separate list items within a sentence
- NEVER use colons after phrases like "Aim for", "On training days", "Keep the", etc.

🔥 CRITICAL RECIPE REQUIREMENTS 🔥:
1. EVERY meal in the sampleMealPlan MUST include detailed "ingredients" and "cookingInstructions" arrays
2. Ingredients must specify EXACT amounts with units:
   - Use grams (g) for proteins, vegetables, grains
   - Use cups/tablespoons for liquids, oils, dressings
   - Use pieces/items for whole foods (e.g., "2 medium tomatoes", "1 large cucumber")
   - Example: "150g chicken breast, diced", "1 cup brown rice, cooked", "2 tbsp extra virgin olive oil", "1/2 medium red onion, thinly sliced"
3. List ALL ingredients needed for the meal, including seasonings, oils, garnishes
4. CookingInstructions must be detailed step-by-step:
   - Minimum 4-6 steps per recipe
   - Include temperatures (e.g., "Preheat oven to 400°F")
   - Include cooking times (e.g., "Bake for 15-20 minutes")
   - Include technique details (e.g., "Sauté over medium-high heat until golden", "Season with salt and black pepper")
   - Include assembly and plating instructions
   - CRITICAL: Use commas (,) to separate multiple actions within a single step, NOT periods (.)
   - Example CORRECT: "Heat oil in a skillet, add tofu cubes, season with salt and pepper, and cook 6 to 8 minutes turning until golden."
   - Example WRONG: "Heat oil in a skillet. add tofu cubes. season with salt and pepper. and cook 6 to 8 minutes"
   - Each cooking instruction should be ONE complete sentence ending with a period
   - Within that sentence, use commas to separate the sequence of actions
5. For complex meals, break down into preparation phases (e.g., prep vegetables, cook protein, make sauce, assemble)
6. Make recipes practical and achievable based on their cooking frequency (${formData.mealsCooked} meals/week)
7. For people who cook less frequently, include simpler recipes with fewer steps
8. For people who cook more frequently, you can include more elaborate techniques
9. NEVER provide a meal without ingredients and cooking instructions - this is unacceptable
10. The description field should be a brief one-liner, while ingredients and cookingInstructions provide the full detail

EXAMPLE OF CORRECT MEAL FORMAT:
{
  "time": "12:15 pm",
  "name": "Chicken shawarma bowl",
  "description": "Spiced grilled chicken with brown rice, fresh vegetables, and tahini sauce",
  "macros": "780 kcal | 55g protein | 65g carbs | 10g fiber",
  "ingredients": [
    "200g chicken breast, cut into strips",
    "1 cup brown rice, uncooked",
    "1 medium cucumber, diced",
    "2 medium tomatoes, diced",
    "1/2 red onion, thinly sliced",
    "2 tbsp apple cider vinegar",
    "1 tsp sugar",
    "3 tbsp tahini",
    "2 tbsp lemon juice",
    "1 clove garlic, minced",
    "2 tsp shawarma spice blend (cumin, coriander, paprika, turmeric, cinnamon)",
    "2 tbsp olive oil",
    "Fresh parsley for garnish",
    "Salt and black pepper to taste"
  ],
  "cookingInstructions": [
    "Cook 1 cup brown rice according to package directions (typically 45 minutes). Set aside and keep warm.",
    "While rice cooks, prepare pickled onions. Combine sliced red onion with apple cider vinegar, sugar, and a pinch of salt in a small bowl. Let sit for at least 15 minutes.",
    "Season chicken strips with shawarma spice blend, salt, and pepper. Heat 1 tbsp olive oil in a skillet over medium-high heat.",
    "Cook chicken for 6-8 minutes, turning occasionally, until golden brown and cooked through (internal temperature 165°F). Remove from heat.",
    "Prepare tahini sauce by whisking together tahini, lemon juice, minced garlic, and 2-3 tbsp water until smooth and pourable. Season with salt.",
    "Dice cucumber and tomatoes. Chop fresh parsley.",
    "Assemble bowl: Start with brown rice as the base, add grilled chicken, top with cucumbers, tomatoes, pickled onions, and parsley. Drizzle generously with tahini sauce."
  ]
}

Return ONLY valid JSON. Be specific, personal, and actionable.`;

    const systemPrompt = unifiedContext ? buildSystemPrompt() : 'You are an elite nutritionist and personalized health consultant. You create evidence-based, highly personalized nutrition plans. You MUST respond with valid JSON only.';

    console.log(`[OK] Using ${unifiedContext ? 'ECOSYSTEM-ENRICHED' : 'STANDARD'} prompt`);

    const completion = await openai.responses.create({
      model: 'gpt-5',
      input: `${systemPrompt}\n\n${prompt}`,
      reasoning: { effort: 'medium' },
      text: { verbosity: 'high' }
    });

    let responseText = completion.output_text || '{}';

    // Strip markdown code blocks if present
    responseText = responseText.trim();
    if (responseText.startsWith('```json')) {
      responseText = responseText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } else if (responseText.startsWith('```')) {
      responseText = responseText.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }
    responseText = responseText.trim();

    // Parse response
    let planData;
    try {
      planData = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse JSON:', e);
      return NextResponse.json(
        { error: 'Failed to generate valid plan' },
        { status: 500 }
      );
    }

    console.log('[OK] AI plan generated successfully\n');

    // Store plan in cache (dev mode) and database (if Supabase configured)
    console.log(`[4/4] Storing plan in cache and database...`);
    devPlanStorage.set(identifier, planData);

    // Also store in Supabase for persistence
    const hasSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (hasSupabase && process.env.FORCE_DEV_MODE !== 'true') {
      try {
        const supabase = await createClient();

        // Get the email to use as the key
        let emailKey = email;
        if (code && !emailKey) {
          // If we only have code, fetch the email from the database
          const { data: userData } = await supabase
            .from('sage_onboarding_data')
            .select('email')
            .eq('form_data->>uniqueCode', code)
            .single();
          emailKey = userData?.email;
        }

        if (emailKey) {
          await supabase
            .from('sage_onboarding_data')
            .update({ sage_plan: planData })
            .eq('email', emailKey);
          console.log('[OK] Plan saved to Supabase database');
        }
      } catch (error) {
        console.error('Failed to save plan to database:', error);
      }
    }

    console.log('[OK] Plan cached successfully\n');

    console.log('='.repeat(80));
    console.log('[COMPLETE] PERSONALIZED NUTRITION PLAN READY');
    console.log('='.repeat(80) + '\n');

    return NextResponse.json({
      success: true,
      plan: planData,
      cached: false,
    });

  } catch (error) {
    console.error('Error generating sage plan:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate nutrition plan',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
