import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { devOnboardingStorage } from '@/lib/dev-storage';

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key is not configured. Please set OPENAI_API_KEY environment variable.');
  }
  return new OpenAI({
    apiKey,
  });
}

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const email = searchParams.get('email');
    const identifier = code || email;

    if (!identifier) {
      return NextResponse.json({ error: 'Email or code is required' }, { status: 400 });
    }

    console.log('\n================================================================================');
    console.log('SAGE MICRONUTRIENT RECOMMENDATIONS GENERATOR');
    console.log('================================================================================\n');

    // Fetch onboarding data
    console.log(`[1/4] Fetching onboarding data for: ${identifier}`);

    let lookupEmail = email;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let onboardingData: any = null;

    // If we have a code, find the email first
    if (code) {
      // Search dev storage for the code
      for (const [key, value] of devOnboardingStorage.entries()) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = value as any;
        if (data?.form_data?.uniqueCode === code) {
          lookupEmail = data.form_data.email || key;
          onboardingData = data;
          break;
        }
      }
    } else if (email) {
      // Direct email lookup
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onboardingData = devOnboardingStorage.get(email) as any;
      lookupEmail = email;
    }

    if (!onboardingData) {
      return NextResponse.json(
        { error: 'No onboarding data found' },
        { status: 404 }
      );
    }

    console.log('[OK] Onboarding data retrieved');
    const formData = onboardingData.form_data || onboardingData;
    console.log(`    Main Priority: ${formData.mainPriority}`);
    console.log(`    Driving Goal: ${formData.drivingGoal}`);
    console.log(`    Medical Conditions: ${formData.medicalConditions?.join(', ') || 'none'}\n`);

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
      nutritionContext += `Eating Style: ${formData.eatingStyle}\n`;
      nutritionContext += `Protein Sources: ${formData.proteinSources?.join(', ') || 'varied'}\n`;
      console.log('[OK] Nutrition plan context retrieved\n');
    }

    // Generate micronutrient recommendations with AI
    console.log(`[4/4] Generating personalized micronutrient recommendations...`);
    const openai = getOpenAIClient();

    const userContext = `
USER PROFILE:
Name: ${formData.fullName || 'User'}
Age: ${formData.age}, Gender: ${formData.gender}
Main Priority: ${formData.mainPriority}
Driving Goal: ${formData.drivingGoal}
Eating Style: ${formData.eatingStyle}
Protein Sources: ${formData.proteinSources?.join(', ') || 'varied'}
Allergies: ${formData.allergies?.join(', ') || 'none'}
Medical Conditions: ${formData.medicalConditions?.join(', ') || 'none'}
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

FORMATTING:
- DO NOT use colons (:) anywhere in the text
- Use em dashes (—) or periods instead
- Example: "Vitamin D — 2000 IU" or "Vitamin D. 2000 IU"
`;

    const completion = await openai.responses.create({
      model: 'gpt-5',
      input: `You are an expert nutritionist creating personalized micronutrient recommendations. Always respond with valid JSON only.\n\n${prompt}`,
      reasoning: { effort: 'medium' },
      text: { verbosity: 'high' }
    });

    const responseText = completion.output_text || '{}';
    const micronutrientData = JSON.parse(responseText);
    console.log('[OK] Micronutrient recommendations generated successfully\n');

    // Store in cache
    console.log('[5/5] Storing micronutrient recommendations in cache...');
    onboardingData.micronutrient_recommendations = micronutrientData;
    if (lookupEmail) {
      devOnboardingStorage.set(lookupEmail, onboardingData);
      console.log('[OK] Recommendations cached successfully\n');
    }

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
