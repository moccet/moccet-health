import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { generateAdaptationPrompt } from '@/lib/prompts/adaptation-prompt';

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
    console.log('[ADAPTATION-AGENT] Starting adaptive features generation...');

    const body = await request.json();
    const { userProfile, biomarkers, trainingProgram, unifiedContext } = body;

    if (!userProfile || !trainingProgram) {
      return NextResponse.json(
        { error: 'Missing required fields: userProfile and trainingProgram are required' },
        { status: 400 }
      );
    }

    const openai = getOpenAIClient();

    // Build the specialized adaptation prompt
    const promptInput = {
      userProfile,
      biomarkers: biomarkers || {},
      trainingProgram
    };

    const basePrompt = generateAdaptationPrompt(promptInput);

    // Enrich with unified context if available
    let prompt = basePrompt;
    if (unifiedContext) {
      console.log('[ADAPTATION-AGENT] Enriching prompt with unified ecosystem context');
      const contextEnrichment = `\n\n## ECOSYSTEM CONTEXT (Sage Journals, Health Trends, Behavioral Patterns)

This user has been actively tracking their health and wellness through the moccet ecosystem. Use the following context to make highly personalized adaptive training recommendations:

${JSON.stringify(unifiedContext, null, 2)}

**Instructions for using this context:**
- Look for patterns in daily readiness, energy fluctuations, and workout adherence from Sage journals
- Identify what factors (sleep, stress, travel, etc.) historically impact their training performance
- Create adaptation rules based on real patterns observed in their data
- Account for schedule variability (work deadlines, travel frequency, busy seasons)
- Reference specific situations from journal entries when creating scenario-based adaptations
- Consider their historical response to different training intensities and volumes
`;
      prompt = basePrompt + contextEnrichment;
    }

    console.log('[ADAPTATION-AGENT] Calling GPT-5 with high reasoning...');
    const completion = await openai.responses.create({
      model: 'gpt-5',
      input: prompt,
      reasoning: { effort: 'high' },
      text: { verbosity: 'high' }
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

    const adaptiveFeatures = JSON.parse(responseText);
    console.log('[ADAPTATION-AGENT] ✅ Adaptive features generated successfully');

    return NextResponse.json({
      success: true,
      adaptiveFeatures
    });

  } catch (error) {
    console.error('[ADAPTATION-AGENT] ❌ Error generating adaptive features:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
