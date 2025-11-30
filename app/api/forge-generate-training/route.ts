import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { buildTrainingProgramPrompt } from '@/lib/prompts/training-program-prompt';

export const maxDuration = 300; // 5 minutes max

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key is not configured');
  }
  return new OpenAI({ apiKey });
}

export async function POST(request: NextRequest) {
  try {
    console.log('[TRAINING-AGENT] Starting training program generation...');

    const body = await request.json();
    const { userProfile, biomarkers, recommendations, unifiedContext } = body;

    if (!userProfile || !recommendations) {
      return NextResponse.json(
        { error: 'Missing required fields: userProfile and recommendations are required' },
        { status: 400 }
      );
    }

    const openai = getOpenAIClient();

    // Build the specialized training prompt
    const trainingProtocol = recommendations.training_protocol || {};
    const promptInput = {
      userProfile,
      trainingProtocol,
      biomarkers: biomarkers || {}
    };

    const basePrompt = buildTrainingProgramPrompt(promptInput);

    // Enrich with unified context if available
    let prompt = basePrompt;
    if (unifiedContext) {
      console.log('[TRAINING-AGENT] Enriching prompt with unified ecosystem context');
      const contextEnrichment = `\n\n## ECOSYSTEM CONTEXT (Sage Journals, Health Trends, Behavioral Patterns)

This user has been actively tracking their health and wellness through the moccet ecosystem. Use the following context to make highly personalized training recommendations:

${JSON.stringify(unifiedContext, null, 2)}

**Instructions for using this context:**
- Look for patterns in Sage journal entries (energy levels, mood, exercise adherence)
- Consider historical health trends and how they correlate with training
- Adapt recommendations based on stated preferences and past behaviors
- Reference specific insights from their journal entries when explaining exercise selection
- Account for real-world constraints mentioned in their data (travel, work schedule, etc.)
`;
      prompt = basePrompt + contextEnrichment;
    }

    console.log('[TRAINING-AGENT] Calling GPT-5 with high reasoning...');
    const completion = await openai.responses.create({
      model: 'gpt-5',
      input: prompt,
      reasoning: { effort: 'high' },  // Keep high - complex exercise selection & personalization
      text: { verbosity: 'medium' }  // Reduced from 'high' - word count limits enforce conciseness
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

    const weeklyProgram = JSON.parse(responseText);
    console.log('[TRAINING-AGENT] ✅ Training program generated successfully');

    return NextResponse.json({
      success: true,
      weeklyProgram
    });

  } catch (error) {
    console.error('[TRAINING-AGENT] ❌ Error generating training program:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
