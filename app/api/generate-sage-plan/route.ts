import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { devPlanStorage, devOnboardingStorage } from '@/lib/dev-storage';
import { createClient } from '@/lib/supabase/server';

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
    const email = searchParams.get('email') || searchParams.get('code');

    if (!email) {
      return NextResponse.json(
        { error: 'Email or code parameter is required' },
        { status: 400 }
      );
    }

    console.log('\n' + '='.repeat(80));
    console.log('SAGE PERSONALIZED NUTRITION PLAN GENERATOR');
    console.log('='.repeat(80) + '\n');

    // Fetch onboarding data (works with both dev mode and Supabase)
    console.log(`[1/4] Fetching onboarding data for: ${email}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let formData: any;

    // Check dev storage first
    console.log(`[DEBUG] Checking dev storage for email: ${email}`);
    console.log(`[DEBUG] Dev storage size: ${devOnboardingStorage.size}`);
    console.log(`[DEBUG] Dev storage keys:`, Array.from(devOnboardingStorage.keys()));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const devData = devOnboardingStorage.get(email) as any;
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
          const { data, error } = await supabase
            .from('sage_onboarding_data')
            .select('*')
            .eq('email', email)
            .single();

          if (error) {
            console.error('Failed to fetch onboarding data from Supabase');
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

    // Check for existing plan in cache
    console.log(`[2/4] Checking for existing nutrition plan...`);
    const cachedPlan = devPlanStorage.get(email);

    if (cachedPlan) {
      console.log('[OK] Existing plan found in cache - returning cached version\n');
      return NextResponse.json({
        success: true,
        plan: cachedPlan,
        cached: true,
      });
    }

    console.log('[OK] No existing plan - generating new one\n');

    // Generate AI plan
    console.log(`[3/4] Generating personalized nutrition plan with AI...`);
    const openai = getOpenAIClient();

    // Build comprehensive prompt with all onboarding data
    const userContext = `
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
`;

    const prompt = `You are an elite nutritionist, longevity expert, and personalized health consultant. Generate a comprehensive, personalized Sage Nutrition Plan for this individual.

${userContext}

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
          "description": "Detailed meal description",
          "macros": "calories | protein | carbs | fiber"
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

FORMATTING:
- DO NOT use colons (:) anywhere in the text
- Use em dashes (—) or periods instead of colons
- Example: Instead of "Breakfast: Oatmeal" write "Breakfast — Oatmeal" or "Breakfast. Oatmeal"

Return ONLY valid JSON. Be specific, personal, and actionable.`;

    const completion = await openai.responses.create({
      model: 'gpt-5',
      input: `You are an elite nutritionist and personalized health consultant. You create evidence-based, highly personalized nutrition plans. You MUST respond with valid JSON only.\n\n${prompt}`,
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

    // Store plan in cache (dev mode) or database (if Supabase configured)
    console.log(`[4/4] Storing plan in cache...`);
    devPlanStorage.set(email, planData);
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
