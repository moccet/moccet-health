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
    console.log('SAGE LIFESTYLE INTEGRATION GENERATOR');
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
    console.log(`    Driving Goal: ${onboardingData.drivingGoal}\n`);

    // Fetch blood analysis
    console.log(`[2/4] Fetching blood analysis for personalized recommendations...`);
    let bloodAnalysis = null;
    let biomarkerContext = '';

    if (onboardingData.blood_analysis) {
      bloodAnalysis = onboardingData.blood_analysis;
      console.log('[OK] Blood analysis found - lifestyle plan will be optimized for biomarkers\n');

      const concerns = bloodAnalysis.concerns || [];
      const biomarkers = bloodAnalysis.biomarkers || [];

      if (biomarkers.length > 0) {
        biomarkerContext = `\nBLOOD BIOMARKER DATA:\n`;
        biomarkerContext += `Key Concerns: ${concerns.join(', ')}\n\n`;
        biomarkerContext += `Key Biomarkers:\n`;
        biomarkers.slice(0, 15).forEach((marker: { name: string; value: string; status: string; }) => {
          biomarkerContext += `- ${marker.name}: ${marker.value} (${marker.status})\n`;
        });
      }
    } else {
      console.log('[NOTE] No blood analysis found - generating general recommendations\n');
    }

    // Fetch nutrition plan context
    console.log(`[3/4] Fetching nutrition and activity context...`);
    let nutritionContext = '';
    if (onboardingData.nutrition_plan) {
      const plan = onboardingData.nutrition_plan;
      nutritionContext = `\nNUTRITION CONTEXT:\n`;
      nutritionContext += `Daily Calories: ${plan.nutritionOverview?.nutritionStructure?.calories || 'N/A'}\n`;
      nutritionContext += `Eating Style: ${onboardingData.eatingStyle}\n`;
      console.log('[OK] Nutrition context retrieved\n');
    }

    // Generate lifestyle integration with AI
    console.log(`[4/4] Generating hyper-personalized lifestyle integration plan...`);
    const openai = getOpenAIClient();

    const userContext = `
USER PROFILE:
Name: ${onboardingData.fullName || 'User'}
Age: ${onboardingData.age}, Gender: ${onboardingData.gender}
Weight: ${onboardingData.weight} ${onboardingData.weightUnit || 'lbs'}
Height: ${onboardingData.height}

GOALS & PRIORITIES:
Main Priority: ${onboardingData.mainPriority}
Driving Goal: ${onboardingData.drivingGoal}

LIFESTYLE FACTORS:
Eating Style: ${onboardingData.eatingStyle}
First Meal Time: ${onboardingData.firstMeal}
Energy Crash Times: ${onboardingData.energyCrash || 'none reported'}
Alcohol Consumption: ${onboardingData.alcoholConsumption || 'not specified'}

HEALTH CONTEXT:
Medical Conditions: ${onboardingData.medicalConditions?.join(', ') || 'none'}
Medications: ${onboardingData.medications?.join(', ') || 'none'}
Supplements: ${onboardingData.supplements?.join(', ') || 'none'}
${biomarkerContext}
${nutritionContext}
`;

    const prompt = `You are an expert longevity coach, exercise physiologist, and sleep specialist creating a hyper-personalized lifestyle integration plan.

${userContext}

CRITICAL: This must be DEEPLY personalized based on THEIR specific data, not generic advice.

Create a comprehensive lifestyle integration plan with these 4 pillars:

1. SLEEP OPTIMIZATION
   - Reference their energy crash times (${onboardingData.energyCrash})
   - Factor in their eating pattern (${onboardingData.eatingStyle}, first meal at ${onboardingData.firstMeal})
   - Address any biomarkers affecting sleep (cortisol, blood sugar, etc.)
   - Provide specific sleep timing, duration, and optimization protocols FOR THEM

2. EXERCISE PROTOCOL
   - Align with their goal: ${onboardingData.mainPriority} (${onboardingData.drivingGoal})
   - Consider their biomarkers (if high cholesterol → cardio emphasis, if insulin issues → resistance training, etc.)
   - Provide specific exercise types, timing, duration, and progression based on their goals

3. STRESS MANAGEMENT
   - Address their specific health concerns and biomarkers
   - Consider their eating patterns
   - Provide practical techniques that fit THEIR lifestyle
   - Link to their energy patterns and crash times
   - Include specific protocols (breathing exercises, timing, duration)

4. SKIN IMPROVEMENT
   - Based on their age (${onboardingData.age}) and gender (${onboardingData.gender})
   - Reference their nutrition plan and hydration needs
   - Address any relevant biomarkers (inflammation, vitamin D, zinc, etc.)
   - Consider their workout schedule (post-workout skincare)
   - Provide specific products, timing, and protocols

IMPORTANT RULES:
- Start each section with a personalized intro referencing THEIR specific data
- Include specific numbers (times, durations, sets, reps, etc.)
- Reference their biomarkers and how each recommendation helps
- Make it actionable and realistic for THEIR schedule
- Explain the "why" behind each recommendation using their data

Generate a JSON response with this exact structure:
{
  "sleepOptimization": {
    "personalizedIntro": "Based on your [specific data point], here's your sleep protocol...",
    "optimalSleepWindow": "10:30 PM - 6:30 AM (8 hours)",
    "preBedroutine": [
      "Action item with specific timing and reasoning"
    ],
    "morningProtocol": [
      "Action item with specific timing and reasoning"
    ],
    "supplementSupport": [
      "Supplement with dosage and timing (if applicable based on their data)"
    ],
    "whyThisMatters": "Explanation referencing their biomarkers and goals"
  },
  "exerciseProtocol": {
    "personalizedIntro": "Based on your [workout frequency] and [goals], here's your protocol...",
    "weeklyStructure": "X days of Y type training",
    "workoutSplit": [
      {
        "day": "Monday",
        "focus": "Upper body strength",
        "duration": "45-60 minutes",
        "exercises": ["Specific exercises with sets/reps"],
        "timing": "Morning/Evening based on their preference"
      }
    ],
    "cardioRecommendations": "Specific cardio protocol based on their biomarkers",
    "recoveryProtocol": "Recovery recommendations",
    "progressionPlan": "How to progress based on their goals",
    "whyThisMatters": "Explanation referencing their goals and biomarkers"
  },
  "stressManagement": {
    "personalizedIntro": "Based on your [stress markers] and [schedule]...",
    "dailyPractices": [
      {
        "practice": "Practice name",
        "timing": "Specific time based on their schedule",
        "duration": "X minutes",
        "protocol": "Step-by-step instructions",
        "benefit": "How it helps their specific biomarkers/goals"
      }
    ],
    "acuteStressProtocols": [
      "Quick protocol for immediate stress relief"
    ],
    "lifestyleOptimizations": [
      "Lifestyle change with specific implementation"
    ],
    "whyThisMatters": "Explanation referencing their biomarkers and lifestyle"
  },
  "skinImprovement": {
    "personalizedIntro": "Based on your [age], [biomarkers], and [nutrition]...",
    "morningRoutine": [
      {
        "step": "Step number",
        "product": "Product type",
        "timing": "When in their morning routine",
        "purpose": "Why this helps their specific skin goals"
      }
    ],
    "eveningRoutine": [
      {
        "step": "Step number",
        "product": "Product type",
        "timing": "When in their evening routine",
        "purpose": "Why this helps their specific skin goals"
      }
    ],
    "nutritionSupport": [
      "Specific nutrients and foods from their plan that support skin"
    ],
    "lifestyleFactors": [
      "Factor with specific recommendation"
    ],
    "whyThisMatters": "Explanation referencing their age, biomarkers, and nutrition"
  }
}

REMEMBER: Every recommendation must feel like it was written specifically for this person, not generic advice.
Reference specific numbers from their profile throughout.

FORMATTING:
- DO NOT use colons (:) anywhere in the text
- Use em dashes (—) or periods instead
- Example: "Sleep Window — 10:30 PM to 6:30 AM" or "Sleep Window. 10:30 PM to 6:30 AM"
`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert longevity coach creating hyper-personalized lifestyle integration plans. Always respond with valid JSON only. Be specific and reference the user\'s actual data points.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const lifestyleData = JSON.parse(completion.choices[0].message.content || '{}');
    console.log('[OK] Lifestyle integration plan generated successfully\n');

    // Store in cache
    console.log('[5/5] Storing lifestyle integration plan in cache...');
    onboardingData.lifestyle_integration = lifestyleData;
    devOnboardingStorage.set(email, onboardingData);
    console.log('[OK] Plan cached successfully\n');

    console.log('================================================================================');
    console.log('[COMPLETE] LIFESTYLE INTEGRATION PLAN READY');
    console.log('================================================================================\n');

    return NextResponse.json({
      success: true,
      lifestyle: lifestyleData,
    });

  } catch (error) {
    console.error('Error generating lifestyle integration plan:', error);
    return NextResponse.json(
      { error: 'Failed to generate lifestyle integration plan' },
      { status: 500 }
    );
  }
}
