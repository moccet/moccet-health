import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { devOnboardingStorage } from '@/lib/dev-storage';
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
    console.log('MOCCET PERSONALIZED INSIGHTS GENERATOR');
    console.log('='.repeat(80) + '\n');

    // Fetch onboarding data
    console.log(`[1/2] Fetching user data for: ${email}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let formData: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const devData = devOnboardingStorage.get(email) as any;

    if (devData) {
      formData = devData.form_data;
      console.log('[OK] User data retrieved from dev storage');
    } else {
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
            console.error('Failed to fetch user data');
            return NextResponse.json(
              { error: 'No user data found for this email' },
              { status: 404 }
            );
          }

          formData = data.form_data;
          console.log('[OK] User data retrieved from Supabase');
        } catch (error) {
          console.error('Error fetching from Supabase:', error);
          return NextResponse.json(
            { error: 'Failed to retrieve user data' },
            { status: 500 }
          );
        }
      } else {
        console.error('No user data found');
        return NextResponse.json(
          { error: 'No user data found for this email' },
          { status: 404 }
        );
      }
    }

    console.log(`    Name: ${formData.fullName}`);
    console.log(`    Main Priority: ${formData.mainPriority}`);
    console.log(`    Age: ${formData.age}, Gender: ${formData.gender}\n`);

    // Check for connected integrations
    const hasGmailIntegration = formData.integrations?.includes('Gmail');
    const hasSlackIntegration = formData.integrations?.includes('Slack');
    const hasWearableIntegration = formData.integrations?.some((int: string) =>
      ['Apple Health', 'Oura Ring', 'Whoop'].includes(int)
    );
    const hasLabFile = formData.hasLabFile;

    console.log('Data Sources Available:');
    console.log(`  Biomarkers (Lab File): ${hasLabFile ? '[OK]' : '[--]'}`);
    console.log(`  Wearables: ${hasWearableIntegration ? '[OK]' : '[--]'}`);
    console.log(`  Gmail: ${hasGmailIntegration ? '[OK]' : '[--]'}`);
    console.log(`  Slack: ${hasSlackIntegration ? '[OK]' : '[--]'}\n`);

    // Generate insights
    console.log(`[2/2] Generating personalized insights...`);
    const openai = getOpenAIClient();

    const userContext = `
User Profile:
- Name: ${formData.fullName}
- Age: ${formData.age}
- Gender: ${formData.gender}
- Weight: ${formData.weight}
- Height: ${formData.height}

Health Goals & Priorities:
- Main Priority: ${formData.mainPriority}
- Driving Goal: ${formData.drivingGoal}

Lifestyle & Behavior:
- Eating Style: ${formData.eatingStyle}
- First Meal Timing: ${formData.firstMeal}
- Energy Crash Pattern: ${formData.energyCrash}
- Meals Cooked Per Week: ${formData.mealsCooked}
- Alcohol Consumption: ${formData.alcoholConsumption}

Health Baseline:
- Current Supplements: ${formData.supplements || 'None'}
- Current Medications: ${formData.medications || 'None'}
- Medical Conditions: ${formData.medicalConditions.join(', ') || 'None'}
- Allergies/Intolerances: ${formData.allergies.join(', ') || 'None'}

Connected Data Sources:
- Biomarkers (Lab Results): ${hasLabFile ? 'Available' : 'Not provided'}
- Wearables (Activity/Sleep): ${hasWearableIntegration ? formData.integrations.filter((i: string) => ['Apple Health', 'Oura Ring', 'Whoop'].includes(i)).join(', ') : 'Not connected'}
- Gmail (Behavior Patterns): ${hasGmailIntegration ? 'Connected' : 'Not connected'}
- Slack (Work Patterns): ${hasSlackIntegration ? 'Connected' : 'Not connected'}
`;

    const prompt = `You are an elite health analytics expert specializing in personalized longevity and performance optimization. Generate exactly 10 cutting-edge, high-impact insights for this individual based on their profile and lifestyle data.

${userContext}

Requirements for each insight:
- Extract ADVANCED patterns and correlations from their lifestyle, goals, and health data
- Include SPECIFIC QUANTITATIVE observations when possible (based on typical patterns for their profile)
- Focus on: metabolic optimization, circadian rhythm, recovery, hormonal balance, longevity markers, performance optimization
- Insights should be sophisticated and actionable - not generic advice
- Tailor recommendations to their specific goals: ${formData.mainPriority}
- Consider their eating style (${formData.eatingStyle}) and lifestyle patterns

${hasLabFile ? 'IMPORTANT: They have uploaded lab results - generate insights that reference typical biomarker patterns for someone with their profile (age, gender, fitness level, eating style).' : ''}

${hasWearableIntegration ? `IMPORTANT: They have connected wearables - generate insights about sleep, recovery, and activity optimization based on typical patterns for their age and fitness level.` : ''}

${hasGmailIntegration ? 'IMPORTANT: They have connected Gmail - include insights about circadian optimization, digital stress management, and work-life balance based on email behavior patterns.' : ''}

${hasSlackIntegration ? 'IMPORTANT: They have connected Slack - include insights about workplace stress, communication patterns, and productivity optimization.' : ''}

Format your response as a JSON object with an "insights" key containing an array of exactly 10 insights. Each insight MUST have:

- "dataObservation": Specific, quantitative observation based on their profile and data sources. Examples:
  * "Based on your ${formData.eatingStyle} eating pattern and ${formData.firstMeal} first meal timing, you likely experience a ${formData.age > 40 ? '3-4 hour' : '2-3 hour'} cortisol window post-wake, with peak metabolic flexibility occurring between ${formData.firstMeal === 'Before 8am' ? '10am-2pm' : '12pm-4pm'}."
  * "Your supplement stack of ${formData.supplements} ${formData.supplements ? 'may benefit from timing optimization' : 'is missing key longevity biomarkers'}."

- "title": Specific, actionable title tailored to their goals (e.g., "Optimize Post-Workout Nutrient Timing for ${formData.mainPriority}")

- "insight": Precise, actionable protocol with timing, dosing, and implementation details specific to their schedule and preferences

- "impact": Quantified improvement potential (e.g., "Could improve recovery score by 15-20%, reduce inflammation markers by 12-18%")

- "evidence": Recent research or mechanistic explanation

CRITICAL: Make insights feel personalized to THIS specific individual - reference their age (${formData.age}), gender (${formData.gender}), eating style (${formData.eatingStyle}), and main priority (${formData.mainPriority}).

FORMATTING:
- DO NOT use colons (:) anywhere in the text
- Use em dashes (—) or periods instead
- Example: "Impact — Could improve recovery by 15-20%" or "Impact. Could improve recovery by 15-20%"

Return ONLY valid JSON.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an elite health analytics expert specializing in personalized longevity and performance optimization. You analyze user profiles and health data to extract sophisticated patterns and actionable insights. You MUST respond with valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.85,
      max_tokens: 4500,
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
    let insights;


    try {
      const parsed = JSON.parse(responseText);
      if (Array.isArray(parsed)) {
        insights = parsed;
      } else if (parsed.insights && Array.isArray(parsed.insights)) {
        insights = parsed.insights;
      } else {
        console.error('Unexpected JSON format:', parsed);
        insights = [];
      }
    } catch (e) {
      console.error('Failed to parse JSON:', e);
      return NextResponse.json(
        { error: 'Failed to generate valid insights' },
        { status: 500 }
      );
    }

    console.log(`[OK] Generated ${insights.length} personalized insights\n`);

    console.log('='.repeat(80));
    console.log('[COMPLETE] INSIGHTS READY');
    console.log('='.repeat(80) + '\n');

    return NextResponse.json({
      success: true,
      insights,
      dataSourcesUsed: {
        biomarkers: hasLabFile,
        wearables: hasWearableIntegration,
        gmail: hasGmailIntegration,
        slack: hasSlackIntegration,
      }
    });

  } catch (error) {
    console.error('Error generating insights:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate insights',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
