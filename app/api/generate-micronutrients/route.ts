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
    console.log(`    Driving Goal: ${formData.drivingGoal}`);
    console.log(`    Medical Conditions: ${formData.medicalConditions?.join(', ') || 'none'}\n`);

    // Fetch blood analysis
    console.log(`[2/4] Fetching blood analysis for personalized recommendations...`);
    let bloodAnalysis = null;
    let biomarkerContext = '';

    if (onboardingData.lab_file_analysis) {
      bloodAnalysis = onboardingData.lab_file_analysis;
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

    // Step 3.5: Aggregate unified context from ecosystem
    console.log(`[3.5/5] Aggregating unified context from ecosystem data...`);
    let unifiedContext = null;

    if (lookupEmail) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const contextResponse = await fetch(baseUrl + '/api/aggregate-context', {
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
          console.log('[OK] Data Quality:', contextData.qualityMessage?.split('\n')[0] || 'Unknown');
        } else {
          console.log('[WARN] Failed to aggregate context, proceeding with standard approach');
        }
      } catch (error) {
        console.error('[WARN] Error aggregating context:', error);
        console.log('[WARN] Proceeding with standard approach');
      }
    }

    // Generate micronutrient recommendations with AI
    console.log(`[4/5] Generating personalized micronutrient recommendations...`);
    const openai = getOpenAIClient();

    const prompt = unifiedContext
      ? `You are an expert nutritionist and longevity medicine specialist creating personalized micronutrient recommendations.

UNIFIED HEALTH CONTEXT:
${JSON.stringify(unifiedContext.unifiedProfile, null, 2)}

KEY INSIGHTS FROM ECOSYSTEM:
${(unifiedContext.keyInsights || []).map((i: { insight: string; sources: string[]; dataPoints: string[] }) =>
  `- ${i.insight} (Sources: ${i.sources.join(', ')})\n  Data: ${i.dataPoints?.join('; ') || 'N/A'}`
).join('\n') || 'No key insights available yet'}

PRIORITY AREAS:
${(unifiedContext.priorityAreas || []).map((p: { area: string; severity: string; dataPoints: string[] }) =>
  `- ${p.area} (${p.severity}): ${p.dataPoints?.join('; ') || 'N/A'}`
).join('\n') || 'No priority areas identified yet'}

USER PROFILE:
Name: ${formData.fullName || 'User'}
Age: ${formData.age}, Gender: ${formData.gender}
Main Priority: ${formData.mainPriority}
Driving Goal: ${formData.drivingGoal}
Eating Style: ${formData.eatingStyle}
Protein Sources: ${formData.proteinSources?.join(', ') || 'varied'}
Allergies: ${formData.allergies?.join(', ') || 'none'}
Medical Conditions: ${formData.medicalConditions?.join(', ') || 'none'}`
      : `You are an expert nutritionist and longevity medicine specialist creating personalized micronutrient recommendations.

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

IMPORTANT REQUIREMENTS:
1. Start with a highly personalized 2-3 sentence introduction that MUST reference multiple data sources:
   - Their specific health goals and priorities (${formData.mainPriority}, ${formData.drivingGoal})
   ${bloodAnalysis ? `- CRITICAL: Specific biomarkers from their blood test that need attention (mention actual marker names and values)` : ''}
   - Their age (${formData.age}), gender (${formData.gender}), and lifestyle factors
   - Medical conditions if any: ${formData.medicalConditions?.join(', ') || 'none'}
   - Their eating style and preferences (${formData.eatingStyle})
   - Make it sound like you analyzed their unique biology - be specific, not generic
   - Example tone: "Based on your blood work showing elevated LDL cholesterol (145 mg/dL) and your goal of improving athletic performance, these micronutrients are specifically chosen to support cardiovascular health and optimize your training recovery..."

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

${unifiedContext ? `
ECOSYSTEM-ENRICHED REQUIREMENTS:
- Reference specific wearable data (e.g., "Your Oura shows poor sleep quality averaging 6.2h")
- Cite blood biomarker values with units
- Correlate nutrients with cross-source insights (e.g., "Magnesium for sleep + HRV improvement")
- Mention specific data points that justify each recommendation
` : ''}
`;

    const systemPrompt = unifiedContext ? buildSystemPrompt() : 'You are an expert nutritionist creating personalized micronutrient recommendations. Always respond with valid JSON only.';

    console.log(`[OK] Using ${unifiedContext ? 'ECOSYSTEM-ENRICHED' : 'STANDARD'} prompt`);

    const completion = await openai.responses.create({
      model: 'gpt-5',
      input: `${systemPrompt}\n\n${prompt}`,
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
