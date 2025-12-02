import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { generateNutritionGuidancePrompt } from '@/lib/prompts/nutrition-guidance-prompt';

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
    console.log('[NUTRITION-AGENT] Starting nutrition guidance generation...');

    const body = await request.json();
    const { userProfile, biomarkers, recommendations, trainingProgram, unifiedContext } = body;

    if (!userProfile || !recommendations) {
      return NextResponse.json(
        { error: 'Missing required fields: userProfile and recommendations are required' },
        { status: 400 }
      );
    }

    const openai = getOpenAIClient();

    // Build the specialized nutrition prompt
    const promptInput = {
      userProfile,
      biomarkers: biomarkers || {},
      recommendations,
      trainingProgram
    };

    const basePrompt = generateNutritionGuidancePrompt(promptInput);

    // Enrich with unified context if available
    let prompt = basePrompt;
    if (unifiedContext) {
      console.log('[NUTRITION-AGENT] Enriching prompt with unified ecosystem context');
      const contextEnrichment = `\n\n## ECOSYSTEM CONTEXT (Sage Journals, Health Trends, Behavioral Patterns)

This user has been actively tracking their health and wellness through the moccet ecosystem. Use the following context to make highly personalized nutrition recommendations:

${JSON.stringify(unifiedContext, null, 2)}

**Instructions for using this context:**
- Look for patterns in meal timing, eating habits, and food preferences from Sage journals
- Consider energy level patterns throughout the day to optimize meal timing
- Adapt macronutrient targets based on observed adherence and preferences
- Reference specific dietary patterns or challenges mentioned in journal entries
- Account for real-world eating situations (dining out, meal prep capacity, etc.)
- Note any correlations between nutrition choices and performance/energy levels
`;
      prompt = basePrompt + contextEnrichment;
    }

    console.log('[NUTRITION-AGENT] Calling GPT-5 with medium reasoning...');
    const completion = await openai.responses.create({
      model: 'gpt-5',
      input: prompt,
      reasoning: { effort: 'medium' },  // Reduced from 'high' - mostly calculations & macro splits
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

    // Extract the nutritionGuidance - AI may return {nutritionGuidance: {...}} or just {...}
    // We want the inner structure to prevent double-nesting
    const nutritionGuidance = aiResponse.nutritionGuidance || aiResponse;

    console.log('[NUTRITION-AGENT] ✅ Nutrition guidance generated successfully');
    console.log('[NUTRITION-AGENT] Structure check:', Object.keys(nutritionGuidance).slice(0, 5));

    return NextResponse.json({
      success: true,
      nutritionGuidance
    });

  } catch (error) {
    console.error('[NUTRITION-AGENT] ❌ Error generating nutrition guidance:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
