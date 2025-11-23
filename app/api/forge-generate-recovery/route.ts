import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key is not configured');
  }
  return new OpenAI({ apiKey });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { formData, bloodAnalysis, calendarData } = body;

    console.log('[RECOVERY] Generating personalized recovery protocol...');

    const openai = getOpenAIClient();

    // Build context from onboarding data
    const userContext = `
USER PROFILE:
- Name: ${formData.fullName}
- Age: ${formData.age}, Gender: ${formData.gender}
- Weight: ${formData.weight}, Height: ${formData.height}
- Primary Goal: ${formData.primaryGoal}
- Training Days: ${formData.trainingDays}
- Training Experience: ${formData.trainingExperience}
- Sleep Quality: ${formData.sleepQuality}/10
- Stress Level: ${formData.stressLevel}/10

HEALTH & RECOVERY NEEDS:
- Injuries: ${formData.injuries?.join(', ') || 'None'}
- Medical Conditions: ${formData.medicalConditions?.join(', ') || 'None'}
- Current Medications: ${formData.medications || 'None'}
- Movement Restrictions: ${formData.movementRestrictions || 'None'}

TRAINING CONTEXT:
- Training Days per Week: ${formData.trainingDays}
- Session Length: ${formData.sessionLength}
- Exercise Time Preference: ${formData.exerciseTime}
- Skills Priority: ${formData.skillsPriority?.join(', ') || 'Not specified'}
- Conditioning Preferences: ${formData.conditioningPreferences?.join(', ') || 'Not specified'}
- Soreness Preference: ${formData.sorenessPreference}/10

${bloodAnalysis ? `\nBLOOD BIOMARKERS AFFECTING RECOVERY:
${bloodAnalysis.concerns?.join('\n') || 'No concerns noted'}
${bloodAnalysis.recommendations?.lifestyle?.join('\n') || ''}
` : ''}

${calendarData ? `\nCALENDAR INTEGRATION:
The user has connected their calendar. Consider:
- Scheduling recovery practices around their busy times
- Suggesting optimal times for active recovery, mobility work, and sleep optimization
- Adapting recommendations to their daily schedule patterns
` : '\nNOTE: Calendar not connected. Provide general timing recommendations.'}
`;

    const prompt = `Based on this user's complete profile, create a highly personalized recovery protocol.

${userContext}

Generate a recovery protocol in JSON format with this structure:

{
  "dailyPractices": [
    "Specific daily recovery practice with timing and duration tailored to their schedule and goals"
  ],
  "weeklyPractices": [
    "Specific weekly recovery practice with recommended frequency and duration"
  ],
  "sleepOptimization": "Personalized sleep optimization strategy considering their current sleep quality (${formData.sleepQuality}/10), stress level, and training schedule. Include specific recommendations for sleep hygiene, timing, and duration.",
  "stressManagement": "Personalized stress management protocol considering their stress level (${formData.stressLevel}/10), training intensity, and lifestyle. Include specific techniques and timing.",
  "mobilityWork": "Personalized mobility and flexibility protocol based on their injuries (${formData.injuries?.join(', ') || 'None'}), movement restrictions, and training goals. Include specific exercises and frequency.",
  "activeRecovery": "Personalized active recovery recommendations based on their conditioning preferences and training schedule. Include specific activities, intensity, and duration.",
  "personalizedNotes": "Key insights about why this recovery protocol is specifically tailored to THIS individual's needs, considering their biomarkers, injuries, stress, sleep quality, and training demands"
}

IMPORTANT:
- Make ALL recommendations highly specific to THIS user's profile
- If calendar is connected, suggest optimal timing for each practice
- Consider their sleep quality and stress levels - these need special attention
- Account for their injuries and movement restrictions
- Match recovery intensity to their training load and experience level
- If they have poor sleep or high stress, prioritize those in the protocol
- Reference specific biomarkers if available
- Provide actionable, realistic recommendations that fit their lifestyle`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an elite recovery and performance optimization specialist. You create personalized recovery protocols that consider the individual\'s complete health profile, training demands, lifestyle factors, biomarkers, and schedule. Your recommendations are evidence-based, actionable, and tailored to each person\'s unique recovery needs.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const recoveryProtocol = JSON.parse(completion.choices[0].message.content || '{}');

    console.log('[RECOVERY] ✅ Recovery protocol generated');

    return NextResponse.json({
      success: true,
      recoveryProtocol
    });

  } catch (error) {
    console.error('[RECOVERY] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate recovery protocol'
      },
      { status: 500 }
    );
  }
}
