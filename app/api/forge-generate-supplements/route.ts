import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key is not configured');
  }
  return new OpenAI({ apiKey, timeout: 240000, maxRetries: 2 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { formData, bloodAnalysis } = body;

    console.log('[SUPPLEMENTS] Generating personalized supplement recommendations...');

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

HEALTH INFORMATION:
- Injuries: ${formData.injuries?.join(', ') || 'None'}
- Medical Conditions: ${formData.medicalConditions?.join(', ') || 'None'}
- Current Medications: ${formData.medications || 'None'}
- Current Supplements: ${formData.supplements || 'None'}

TRAINING CONTEXT:
- Equipment Access: ${formData.equipment?.join(', ') || 'Not specified'}
- Training Location: ${formData.trainingLocation}
- Session Length: ${formData.sessionLength}
- Exercise Time: ${formData.exerciseTime}
- Skills Priority: ${formData.skillsPriority?.join(', ') || 'Not specified'}
${bloodAnalysis ? `\nBLOOD BIOMARKERS:\n${bloodAnalysis.concerns?.join('\n') || 'No concerns noted'}\n${bloodAnalysis.recommendations?.supplements?.join('\n') || ''}` : ''}
`;

    const prompt = `Based on this user's profile and health data, create highly personalized supplement recommendations.

${userContext}

Generate supplement recommendations in JSON format with this structure:

{
  "essentialSupplements": [
    {
      "name": "Supplement name",
      "dosage": "Specific dosage recommendation",
      "timing": "When to take it (e.g., morning with food, pre-workout, before bed)",
      "rationale": "Why this supplement is recommended for THIS specific user based on their goals, biomarkers, training, and health profile",
      "benefits": "Expected benefits specific to their situation"
    }
  ],
  "optionalSupplements": [
    {
      "name": "Supplement name",
      "dosage": "Specific dosage recommendation",
      "timing": "When to take it",
      "rationale": "Why this could help THIS user specifically",
      "benefits": "Potential benefits for their goals"
    }
  ],
  "personalizedNotes": "Key personalized insights about supplement strategy for this individual, considering their medical conditions, medications, and biomarkers"
}

IMPORTANT:
- Consider their medical conditions, current medications, and biomarkers
- Prioritize evidence-based supplements
- Provide specific dosages and timing
- Make rationales highly personalized to THEIR specific situation
- Consider their training goals, experience level, and recovery needs
- If they have medical conditions or take medications, note any interactions to be aware of
- Focus on supplements that will actually move the needle for their specific goals and deficiencies`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert sports nutritionist and supplementation specialist. You provide evidence-based, personalized supplement recommendations that consider the individual\'s complete health profile, training goals, biomarkers, and medical history.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const supplementRecommendations = JSON.parse(completion.choices[0].message.content || '{}');

    console.log('[SUPPLEMENTS] ✅ Supplement recommendations generated');

    return NextResponse.json({
      success: true,
      supplementRecommendations
    });

  } catch (error) {
    console.error('[SUPPLEMENTS] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate supplement recommendations'
      },
      { status: 500 }
    );
  }
}
