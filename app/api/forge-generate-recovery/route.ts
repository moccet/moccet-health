import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { generateRecoveryProtocolPrompt } from '@/lib/prompts/recovery-protocol-prompt';

export const maxDuration = 300; // 5 minutes max

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key is not configured');
  }
  return new OpenAI({ apiKey, timeout: 240000, maxRetries: 2 });
}

export async function POST(request: NextRequest) {
  try {
    console.log('[RECOVERY-AGENT] Starting recovery protocol generation...');

    const body = await request.json();
    const { userProfile, biomarkers, recommendations, trainingProgram, unifiedContext } = body;

    if (!userProfile) {
      return NextResponse.json(
        { error: 'Missing required field: userProfile' },
        { status: 400 }
      );
    }

    const openai = getOpenAIClient();

    // Build the specialized recovery prompt
    const promptInput = {
      userProfile,
      biomarkers: biomarkers || {},
      recommendations: recommendations || {},
      trainingProgram
    };

    const basePrompt = generateRecoveryProtocolPrompt(promptInput);

    // Enrich with unified context if available
    let prompt = basePrompt;
    if (unifiedContext) {
      console.log('[RECOVERY-AGENT] Enriching prompt with unified ecosystem context');
      const contextEnrichment = `\n\n## ECOSYSTEM CONTEXT (Sage Journals, Health Trends, Behavioral Patterns)

This user has been actively tracking their health and wellness through the moccet ecosystem. Use the following context to make highly personalized recovery and injury prevention recommendations:

${JSON.stringify(unifiedContext, null, 2)}

**Instructions for using this context:**
- Look for patterns in sleep quality, stress levels, and recovery capacity from Sage journals
- Identify correlations between recovery practices and performance outcomes
- Consider historical injury patterns or recurring pain points
- Adapt progress tracking metrics based on what the user actually tracks consistently
- Account for real-world recovery constraints (sleep schedule, work stress, etc.)
- Reference specific insights about their recovery needs from journal entries
`;
      prompt = basePrompt + contextEnrichment;
    }

    console.log('[RECOVERY-AGENT] Calling GPT-5 with medium reasoning...');
    const completion = await openai.responses.create({
      model: 'gpt-5',
      input: prompt,
      reasoning: { effort: 'medium' },  // Reduced from 'high' - mostly template-based with parameters
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

    const aiResponse = JSON.parse(responseText);

    // Extract each section - AI may nest or not, we want consistent structure
    const progressTracking = aiResponse.progressTracking || aiResponse;
    const injuryPrevention = aiResponse.injuryPrevention;
    const recoveryProtocol = aiResponse.recoveryProtocol;

    console.log('[RECOVERY-AGENT] ✅ Recovery protocol generated successfully');
    console.log('[RECOVERY-AGENT] Structure check - has recoveryProtocol:', !!recoveryProtocol);

    return NextResponse.json({
      success: true,
      progressTracking,
      injuryPrevention,
      recoveryProtocol
    });

  } catch (error) {
    console.error('[RECOVERY-AGENT] ❌ Error generating recovery protocol:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
