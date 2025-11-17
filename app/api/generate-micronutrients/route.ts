import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { devOnboardingStorage } from '@/lib/dev-storage';

function getOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    console.log('\n================================================================================');
    console.log('SAGE MICRONUTRIENT RECOMMENDATIONS GENERATOR');
    console.log('================================================================================\n');

    // Fetch onboarding data
    console.log(`[1/4] Fetching onboarding data for: ${email}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const onboardingData = devOnboardingStorage.get(email) as any;

    if (!onboardingData) {
      return NextResponse.json(
        { error: 'No onboarding data found' },
        { status: 404 }
      );
    }

    console.log('[OK] Onboarding data retrieved');
    console.log(`    Main Priority: ${onboardingData.mainPriority}`);
    console.log(`    Driving Goal: ${onboardingData.drivingGoal}`);
    console.log(`    Medical Conditions: ${onboardingData.medicalConditions?.join(', ') || 'none'}\n`);

    // Fetch blood analysis
    console.log(`[2/4] Fetching blood analysis for personalized recommendations...`);
    let bloodAnalysis = null;
    let biomarkerContext = '';

    if (onboardingData.blood_analysis) {
      bloodAnalysis = onboardingData.blood_analysis;
      console.log('[OK] Blood analysis found - recommendations will be optimized for biomarkers\n');

      const concerns = bloodAnalysis.concerns || [];
      const biomarkers = bloodAnalysis.biomarkers || [];

      if (biomarkers.length > 0) {
        biomarkerContext = `\nBLOOD BIOMARKER DATA:\n`;
        biomarkerContext += `Key Concerns: ${concerns.join(', ')}\n\n`;
        biomarkerContext += `Biomarkers:\n`;
        biomarkers.slice(0, 15).forEach((marker: { name: string; value: string; status: string; }) => {
          biomarkerContext += `- ${marker.name}: ${marker.value} (${marker.status})\n`;
        });
      }
    } else {
      console.log('[NOTE] No blood analysis found - generating general recommendations\n');
    }

    // Fetch nutrition plan for context
    console.log(`[3/4] Fetching nutrition plan context...`);
    let nutritionContext = '';
    if (onboardingData.nutrition_plan) {
      const plan = onboardingData.nutrition_plan;
      nutritionContext = `\nNUTRITION PLAN CONTEXT:\n`;
      nutritionContext += `Daily Calories: ${plan.nutritionOverview?.nutritionStructure?.calories || 'N/A'}\n`;
      nutritionContext += `Protein: ${plan.nutritionOverview?.nutritionStructure?.protein || 'N/A'}\n`;
      nutritionContext += `Eating Style: ${onboardingData.eatingStyle}\n`;
      nutritionContext += `Protein Sources: ${onboardingData.proteinSources?.join(', ') || 'varied'}\n`;
      console.log('[OK] Nutrition plan context retrieved\n');
    }

    // Generate micronutrient recommendations with AI
    console.log(`[4/4] Generating personalized micronutrient recommendations...`);
    const openai = getOpenAIClient();

    const userContext = `
USER PROFILE:
Name: ${onboardingData.fullName || 'User'}
Age: ${onboardingData.age}, Gender: ${onboardingData.gender}
Main Priority: ${onboardingData.mainPriority}
Driving Goal: ${onboardingData.drivingGoal}
Eating Style: ${onboardingData.eatingStyle}
Protein Sources: ${onboardingData.proteinSources?.join(', ') || 'varied'}
Allergies: ${onboardingData.allergies?.join(', ') || 'none'}
Medical Conditions: ${onboardingData.medicalConditions?.join(', ') || 'none'}
Workout Days: ${onboardingData.workoutDays}/week
${biomarkerContext}
${nutritionContext}
`;

    const prompt = `You are an expert nutritionist and longevity medicine specialist creating personalized micronutrient recommendations.

${userContext}

IMPORTANT REQUIREMENTS:
1. Start with a personalized introduction that references:
   - Their specific health goals (${onboardingData.mainPriority}, ${onboardingData.drivingGoal})
   - Key biomarkers from their blood test (if available)
   - Their specific needs based on medical conditions and lifestyle

2. Create a comprehensive micronutrient table with 10-15 key nutrients they should focus on
3. Each nutrient must have:
   - Daily Goal (with unit: mcg, mg, IU, etc.)
   - Food Sources from their allowed foods (consider protein preferences, allergies, eating style)
   - Purpose: Specific health benefit related to their goals and biomarkers
     Examples: "Support thyroid function and metabolism", "Boost immune system", "Reduce inflammation",
     "Support heart health and cholesterol", "Enhance energy production", "Support bone health", etc.

4. Prioritize nutrients based on:
   - Their blood biomarkers (e.g., if low vitamin D → prioritize vitamin D)
   - Their health goals (e.g., athletic performance → magnesium, zinc, B vitamins)
   - Their medical conditions (e.g., high cholesterol → omega-3, fiber, CoQ10)
   - Their lifestyle (e.g., workout days → electrolytes, protein support nutrients)

5. Be specific about food sources that fit their dietary preferences and restrictions

Generate a JSON response with this exact structure:
{
  "personalizedIntro": "A 2-3 sentence introduction referencing their specific goals, biomarkers, and why these nutrients matter for THEM specifically",
  "micronutrients": [
    {
      "nutrient": "Vitamin D",
      "dailyGoal": "2000 IU",
      "foodSources": "Fatty fish (salmon, mackerel), egg yolks, fortified foods",
      "purpose": "Support bone health and immune function, address low vitamin D levels"
    }
  ]
}

The personalizedIntro should sound like it's written specifically for this person, not generic advice.
Example: "Based on your ${onboardingData.mainPriority} goals and your recent blood work showing [specific findings], these micronutrients are essential for optimizing your health..."
`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert nutritionist creating personalized micronutrient recommendations. Always respond with valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const micronutrientData = JSON.parse(completion.choices[0].message.content || '{}');
    console.log('[OK] Micronutrient recommendations generated successfully\n');

    // Store in cache
    console.log('[5/5] Storing micronutrient recommendations in cache...');
    onboardingData.micronutrient_recommendations = micronutrientData;
    devOnboardingStorage.set(email, onboardingData);
    console.log('[OK] Recommendations cached successfully\n');

    console.log('================================================================================');
    console.log('[COMPLETE] MICRONUTRIENT RECOMMENDATIONS READY');
    console.log('================================================================================\n');

    return NextResponse.json({
      success: true,
      micronutrients: micronutrientData,
    });

  } catch (error) {
    console.error('Error generating micronutrient recommendations:', error);
    return NextResponse.json(
      { error: 'Failed to generate micronutrient recommendations' },
      { status: 500 }
    );
  }
}
