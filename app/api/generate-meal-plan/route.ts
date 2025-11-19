import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { devPlanStorage, devOnboardingStorage } from '@/lib/dev-storage';
import { createClient } from '@/lib/supabase/server';

function getOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter is required' },
        { status: 400 }
      );
    }

    console.log('\n' + '='.repeat(80));
    console.log('SAGE DETAILED MEAL PLAN GENERATOR');
    console.log('='.repeat(80) + '\n');

    // Fetch onboarding data (works with both dev mode and Supabase)
    console.log(`[1/3] Fetching onboarding data for: ${email}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let formData: any;

    // Check dev storage first
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const devData = devOnboardingStorage.get(email) as any;
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
    console.log(`    Eating Style: ${formData.eatingStyle}`);
    console.log(`    Protein Sources: ${formData.proteinSources.join(', ')}\n`);

    // Get the nutrition plan context
    console.log(`[2/3] Fetching nutrition plan context...`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nutritionPlan = devPlanStorage.get(email) as any;

    if (!nutritionPlan) {
      console.error('No nutrition plan found - please generate the plan first');
      return NextResponse.json(
        { error: 'No nutrition plan found. Please generate the nutrition plan first.' },
        { status: 404 }
      );
    }

    console.log('[OK] Nutrition plan context retrieved\n');

    // Fetch blood analysis for biomarker-optimized meals
    console.log(`[3/4] Fetching blood analysis for biomarker optimization...`);
    let bloodAnalysis = null;
    let biomarkerContext = '';

    // Check dev storage for blood analysis
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bloodData = devOnboardingStorage.get(email) as any;
    if (bloodData?.blood_analysis) {
      bloodAnalysis = bloodData.blood_analysis;
      console.log('[OK] Blood analysis found - meals will be optimized for biomarkers\n');

      // Extract key biomarkers for meal targeting
      const concerns = bloodAnalysis.concerns || [];
      const biomarkers = bloodAnalysis.biomarkers || [];

      // Build biomarker context for AI
      if (biomarkers.length > 0) {
        biomarkerContext = `\nBLOOD BIOMARKER DATA (CRITICAL - Design meals to address these):\n`;
        biomarkerContext += `Key Concerns: ${concerns.join(', ')}\n\n`;
        biomarkerContext += `Biomarkers to Target:\n`;
        biomarkers.slice(0, 10).forEach((marker: { name: string; value: string; status: string; }) => {
          biomarkerContext += `- ${marker.name}: ${marker.value} (${marker.status})\n`;
        });
        biomarkerContext += `\nYou MUST design meals that specifically target these biomarkers with evidence-based foods.\n`;
      }
    } else {
      console.log('[NOTE] No blood analysis found - generating standard meal plan\n');
    }

    // Generate detailed meal plan with AI
    console.log(`[4/4] Generating biomarker-optimized 7-day meal plan...`);
    const openai = getOpenAIClient();

    const userContext = `
User Profile:
- Name: ${formData.fullName}
- Age: ${formData.age}
- Gender: ${formData.gender}
- Weight: ${formData.weight}
- Height: ${formData.height}

Health Goals:
- Main Priority: ${formData.mainPriority}
- Driving Goal: ${formData.drivingGoal}

Nutrition Targets (from their plan):
- Calories: ${nutritionPlan.nutritionOverview.nutritionStructure.calories}
- Protein: ${nutritionPlan.nutritionOverview.nutritionStructure.protein}
- Carbs: ${nutritionPlan.nutritionOverview.nutritionStructure.carbs}
- Fiber: ${nutritionPlan.nutritionOverview.nutritionStructure.fiber}
- Fat: ${nutritionPlan.nutritionOverview.nutritionStructure.fat}

Dietary Preferences & Restrictions:
- Eating Style: ${formData.eatingStyle}
- First Meal Timing: ${formData.firstMeal}
- Preferred Protein Sources: ${formData.proteinSources.join(', ')} ${formData.otherProtein ? `+ ${formData.otherProtein}` : ''}
- Food Dislikes: ${formData.foodDislikes || 'None specified'}
- Allergies/Intolerances: ${formData.allergies.join(', ')} ${formData.otherAllergy ? `+ ${formData.otherAllergy}` : ''}
- Meals Cooked Per Week: ${formData.mealsCooked}

Current Supplements: ${formData.supplements || 'None'}
Medical Conditions: ${formData.medicalConditions.join(', ')} ${formData.otherCondition ? `+ ${formData.otherCondition}` : ''}
`;

    const prompt = `You are an elite nutritionist and longevity medicine expert creating a biomarker-optimized, personalized 7-day meal plan.

${userContext}
${biomarkerContext}

Create a comprehensive 7-day meal plan with detailed recipes, cooking instructions, nutritional breakdowns, and biomarker optimization notes.

Requirements:
1. Each day should include 2-4 meals (based on their eating style and first meal timing)
2. MUST use ONLY their preferred protein sources: ${formData.proteinSources.join(', ')}
3. MUST avoid ALL allergens: ${formData.allergies.join(', ')}
4. MUST avoid their disliked foods: ${formData.foodDislikes || 'none'}
5. Align with their eating style: ${formData.eatingStyle}
6. Time first meal around: ${formData.firstMeal}
7. Each meal should be practical given they cook ${formData.mealsCooked} meals/week
8. Include variety across the week to prevent boredom
9. Each meal should include detailed ingredients with quantities and step-by-step cooking instructions

${bloodAnalysis ? `
BIOMARKER OPTIMIZATION (CRITICAL):
- Design meals specifically to address the biomarkers listed above
- For high cholesterol: Include omega-3 rich foods, soluble fiber, plant sterols
- For low HDL: Include healthy fats (avocado, nuts, olive oil, fatty fish)
- For high LDL: Avoid saturated fats, include oats, beans, berries
- For high triglycerides: Limit refined carbs, include omega-3s
- For low vitamin D: Include fortified foods, fatty fish, egg yolks
- For inflammation markers: Include anti-inflammatory foods (turmeric, berries, leafy greens)
- Each meal MUST include a "biomarkerNotes" field explaining how it helps specific markers
` : ''}

MEAL COMPLEXITY & SCHEDULE ADAPTATION:
- Provide variety: quick meals (under 20 min), batch cooking options, slow cooker meals
- Include "prepType" field: "quick" | "batch-cook" | "slow-cooker" | "meal-prep" | "standard"
- Include "complexity" field: "simple" | "moderate" | "complex"
- Include realistic prep and cook times
- Add batch cooking suggestions for busy schedules
- Include meal prep tips where applicable

Generate a JSON response with this structure:
{
  "profileSummary": {
    "goals": "Their main priority and driving goal in 1 sentence",
    "dietaryPreferences": "Eating style, protein sources, key restrictions in 1 sentence",
    "keyBiomarkers": ["Top 3-5 biomarkers being targeted in this plan (if blood analysis available)"]
  },
  "day1": {
    "meals": [
      {
        "time": "9:30 am",
        "name": "Meal name",
        "description": "Brief appetizing description",
        "ingredients": [
          "2 large eggs",
          "1 cup fresh spinach",
          "50g feta cheese",
          "etc."
        ],
        "cookingInstructions": [
          "Step 1: Detailed instruction",
          "Step 2: Detailed instruction",
          "etc."
        ],
        "macros": "350 calories | 25g protein | 10g carbs | 4g fiber",
        "prepTime": "10 minutes",
        "cookTime": "15 minutes",
        "prepType": "quick",
        "complexity": "simple",
        "biomarkerNotes": "This meal's omega-3s from eggs help increase HDL cholesterol and reduce inflammation",
        "mealPrepTip": "Can be prepped ahead if applicable"
      }
    ]
  },
  "day2": { "meals": [...] },
  "day3": { "meals": [...] },
  "day4": { "meals": [...] },
  "day5": { "meals": [...] },
  "day6": { "meals": [...] },
  "day7": { "meals": [...] }
}

CRITICAL REMINDERS:
- Use ONLY these proteins: ${formData.proteinSources.join(', ')}
- AVOID these allergens: ${formData.allergies.join(', ')}
- AVOID these foods: ${formData.foodDislikes || 'none'}
- Make meals practical for someone who cooks ${formData.mealsCooked} meals/week
- Ensure total daily calories align with: ${nutritionPlan.nutritionOverview.nutritionStructure.calories}

FORMATTING:
- DO NOT use colons (:) anywhere in the text
- Use em dashes (—) or periods instead
- Example: "Prep Time — 10 minutes" or "Prep Time. 10 minutes"

Return ONLY valid JSON. Be specific, creative, and delicious!`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an elite nutritionist specializing in personalized meal planning. You create detailed, practical meal plans with recipes. You MUST respond with valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.9,
      max_tokens: 8000,
      response_format: { type: 'json_object' }
    });

    let responseText = completion.choices[0].message.content || '{}';

    // Strip markdown code blocks if present
    responseText = responseText.trim();
    if (responseText.startsWith('```json')) {
      responseText = responseText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } else if (responseText.startsWith('```')) {
      responseText = responseText.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }
    responseText = responseText.trim();

    // Parse response
    let mealPlanData;
    try {
      mealPlanData = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse JSON:', e);
      return NextResponse.json(
        { error: 'Failed to generate valid meal plan' },
        { status: 500 }
      );
    }

    console.log('[OK] Detailed meal plan generated successfully\n');

    console.log('='.repeat(80));
    console.log('[COMPLETE] 7-DAY MEAL PLAN READY');
    console.log('='.repeat(80) + '\n');

    return NextResponse.json({
      success: true,
      mealPlan: mealPlanData,
    });

  } catch (error) {
    console.error('Error generating meal plan:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate meal plan',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
