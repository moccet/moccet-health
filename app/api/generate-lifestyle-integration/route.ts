import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { devOnboardingStorage } from '@/lib/dev-storage';
import { buildSystemPrompt } from '@/lib/prompts/unified-context-prompt';
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
    console.log('SAGE LIFESTYLE INTEGRATION GENERATOR');
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

    // If not found in dev storage, check Supabase
    if (!onboardingData) {
      const hasSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (hasSupabase && process.env.FORCE_DEV_MODE !== 'true') {
        try {
          const supabase = await createClient();

          if (code) {
            // Search by uniqueCode in the form_data JSON field
            const { data } = await supabase
              .from('sage_onboarding_data')
              .select('*')
              .eq('form_data->>uniqueCode', code)
              .single();

            if (data) {
              onboardingData = data;
              lookupEmail = data.email;
            }
          } else if (email) {
            // Search by email
            const { data } = await supabase
              .from('sage_onboarding_data')
              .select('*')
              .eq('email', email)
              .single();

            if (data) {
              onboardingData = data;
              lookupEmail = email;
            }
          }
        } catch (error) {
          console.error('[ERROR] Supabase query failed:', error);
        }
      }
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
    console.log(`    Driving Goal: ${formData.drivingGoal}\n`);

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
      nutritionContext += `Eating Style: ${formData.eatingStyle}\n`;
      console.log('[OK] Nutrition context retrieved\n');
    }

    // Step 3.5: Aggregate unified context from ecosystem
    console.log(`[3.5/5] Aggregating unified context from ecosystem data...`);
    let unifiedContext = null;

    if (lookupEmail) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

        const contextResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/aggregate-context`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: lookupEmail,
            contextType: 'sage',
            forceRefresh: false,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (contextResponse.ok) {
          const contextData = await contextResponse.json();
          unifiedContext = contextData.context;
          console.log('[OK] Unified context aggregated successfully');
          console.log(`[OK] Data Quality: ${contextData.qualityMessage?.split('\n')[0] || 'Unknown'}`);
        } else {
          console.log('[WARN] Failed to aggregate context, proceeding with standard approach');
        }
      } catch (error) {
        console.error('[WARN] Error aggregating context:', error);
        console.log('[WARN] Proceeding with standard approach');
      }
    }

    // Generate lifestyle integration with AI
    console.log(`[4/5] Generating hyper-personalized lifestyle integration plan...`);
    const openai = getOpenAIClient();

    const prompt = unifiedContext
      ? `You are an expert longevity coach, exercise physiologist, and sleep specialist creating a hyper-personalized lifestyle integration plan.

UNIFIED ECOSYSTEM CONTEXT:
${JSON.stringify(unifiedContext.unifiedProfile, null, 2)}

KEY INSIGHTS:
${(unifiedContext.keyInsights || []).map((i: { insight: string; sources: string[] }) => `- ${i.insight} (${i.sources.join(', ')})`).join('\n') || 'No key insights available yet'}

PRIORITY AREAS:
${(unifiedContext.priorityAreas || []).map((p: { area: string; severity: string }) => `- ${p.area} (${p.severity})`).join('\n') || 'No priority areas identified yet'}

USER PROFILE:
Name: ${formData.fullName || 'User'}
Age: ${formData.age}, Gender: ${formData.gender}
Main Priority: ${formData.mainPriority}
Driving Goal: ${formData.drivingGoal}
Eating Style: ${formData.eatingStyle}`
      : `You are an expert longevity coach, exercise physiologist, and sleep specialist creating a hyper-personalized lifestyle integration plan.

USER PROFILE:
Name: ${formData.fullName || 'User'}
Age: ${formData.age}, Gender: ${formData.gender}
Weight: ${formData.weight} ${formData.weightUnit || 'lbs'}
Height: ${formData.height}

GOALS & PRIORITIES:
Main Priority: ${formData.mainPriority}
Driving Goal: ${formData.drivingGoal}

LIFESTYLE FACTORS:
Eating Style: ${formData.eatingStyle}
First Meal Time: ${formData.firstMeal}
Energy Crash Times: ${formData.energyCrash || 'none reported'}
Alcohol Consumption: ${formData.alcoholConsumption || 'not specified'}

HEALTH CONTEXT:
Medical Conditions: ${Array.isArray(formData.medicalConditions) ? formData.medicalConditions.join(', ') : formData.medicalConditions || 'none'}
Medications: ${Array.isArray(formData.medications) ? formData.medications.join(', ') : formData.medications || 'none'}
Supplements: ${Array.isArray(formData.supplements) ? formData.supplements.join(', ') : formData.supplements || 'none'}
${biomarkerContext}
${nutritionContext}

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

REMEMBER. Every recommendation must feel like it was written specifically for this person, not generic advice.
Reference specific numbers from their profile throughout.

FORMATTING.
- DO NOT use colons (.) anywhere in the text
- Use em dashes (—) or periods instead
- Example. "Sleep Window — 10.30 PM to 6.30 AM" or "Sleep Window. 10.30 PM to 6.30 AM"
`;

    console.log(`[OK] Using ${unifiedContext ? 'ECOSYSTEM-ENRICHED' : 'STANDARD'} prompt`);

    const completion = await openai.responses.create({
      model: 'gpt-5',
      input: prompt,
      reasoning: { effort: 'medium' },
      text: { verbosity: 'high' }
    });

    let responseText = completion.output_text || '{}';

    // Extract JSON from potential markdown code blocks or surrounding text
    if (responseText.includes('```json')) {
      const match = responseText.match(/```json\s*([\s\S]*?)\s*```/);
      if (match) responseText = match[1];
    } else if (responseText.includes('```')) {
      const match = responseText.match(/```\s*([\s\S]*?)\s*```/);
      if (match) responseText = match[1];
    }

    // Remove any leading/trailing non-JSON text
    responseText = responseText.trim();
    if (!responseText.startsWith('{')) {
      // Find first { and last }
      const start = responseText.indexOf('{');
      const end = responseText.lastIndexOf('}');
      if (start !== -1 && end !== -1) {
        responseText = responseText.substring(start, end + 1);
      }
    }

    const lifestyleData = JSON.parse(responseText);
    console.log('[OK] Lifestyle integration plan generated successfully\n');

    // Store in cache
    console.log('[5/5] Storing lifestyle integration plan in cache...');
    onboardingData.lifestyle_integration = lifestyleData;
    if (lookupEmail) {
      devOnboardingStorage.set(lookupEmail, onboardingData);
      console.log('[OK] Plan cached successfully\n');
    }

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
