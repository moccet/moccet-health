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

/**
 * Attempt to repair truncated or malformed JSON
 * This handles cases where GPT-5 response gets cut off mid-stream
 */
function repairJSON(jsonString: string): string {
  let repaired = jsonString.trim();

  // Count open vs close braces and brackets
  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < repaired.length; i++) {
    const char = repaired[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    if (char === '"' && !escapeNext) {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '{') openBraces++;
      else if (char === '}') openBraces--;
      else if (char === '[') openBrackets++;
      else if (char === ']') openBrackets--;
    }
  }

  // If we're still in a string, close it
  if (inString) {
    repaired += '"';
  }

  // Remove any trailing incomplete property (e.g., "key": or "key":  )
  repaired = repaired.replace(/,?\s*"[^"]*":\s*$/, '');
  repaired = repaired.replace(/,?\s*"[^"]*$/, '');

  // Remove trailing comma before closing
  repaired = repaired.replace(/,(\s*)$/, '$1');

  // Add missing closing brackets and braces
  while (openBrackets > 0) {
    repaired += ']';
    openBrackets--;
  }
  while (openBraces > 0) {
    repaired += '}';
    openBraces--;
  }

  return repaired;
}

/**
 * Try to parse JSON with multiple repair attempts
 */
function parseJSONWithRepair(jsonString: string): any {
  // First, try parsing as-is
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    console.log('[TRAINING-AGENT] Initial parse failed, attempting repair...');
  }

  // Try repairing the JSON
  const repaired = repairJSON(jsonString);
  try {
    const result = JSON.parse(repaired);
    console.log('[TRAINING-AGENT] ✅ JSON repaired successfully');
    return result;
  } catch (e) {
    console.log('[TRAINING-AGENT] Repair attempt 1 failed, trying aggressive repair...');
  }

  // Aggressive repair: find the last valid closing brace
  let lastValidEnd = jsonString.length;
  for (let i = jsonString.length - 1; i >= 0; i--) {
    const substring = jsonString.substring(0, i + 1);
    // Try to find a point where JSON could be valid
    if (substring.endsWith('}') || substring.endsWith('}]') || substring.endsWith('"}')) {
      try {
        const testRepair = repairJSON(substring);
        const result = JSON.parse(testRepair);
        console.log(`[TRAINING-AGENT] ✅ JSON repaired by truncating at position ${i + 1}`);
        return result;
      } catch (e) {
        // Keep trying
      }
    }
  }

  // Last resort: throw the original error
  throw new Error('Could not repair JSON after multiple attempts');
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

    console.log('[TRAINING-AGENT] Calling GPT-5 with medium reasoning...');
    const completion = await openai.responses.create({
      model: 'gpt-5',
      input: prompt,
      reasoning: { effort: 'medium' },  // Medium to prevent timeout - training is complex but structured
      text: { verbosity: 'medium' }
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

    // Additional JSON sanitization to handle common GPT formatting issues
    // Remove any trailing commas before closing braces/brackets
    responseText = responseText.replace(/,(\s*[}\]])/g, '$1');
    // Remove JavaScript-style comments (// and /* */)
    responseText = responseText.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    // Remove control characters EXCEPT newlines (\n = 0x0A) and carriage returns (\r = 0x0D) which are valid in JSON strings
    // This removes null bytes, tabs in wrong places, etc. while preserving line breaks
    responseText = responseText.replace(/[\u0000-\u0009\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, '');

    let aiResponse;
    try {
      // Use repair-aware parsing to handle truncated responses
      aiResponse = parseJSONWithRepair(responseText);
    } catch (parseError) {
      console.error('[TRAINING-AGENT] ❌ Failed to parse GPT-5 response as JSON:', parseError);
      console.error('[TRAINING-AGENT] Error at position:', parseError instanceof SyntaxError ? (parseError as any).message : 'Unknown');
      console.error('[TRAINING-AGENT] Response length:', responseText.length);
      console.error('[TRAINING-AGENT] First 1000 chars:', responseText.substring(0, 1000));
      console.error('[TRAINING-AGENT] Last 500 chars:', responseText.substring(Math.max(0, responseText.length - 500)));

      // Re-throw with more context
      throw new Error(`Failed to parse training program response: ${parseError instanceof Error ? parseError.message : 'Unknown parse error'}`);
    }

    // Extract all training sections from AI response
    const executiveSummary = aiResponse.executiveSummary;
    const weeklyProgram = aiResponse.weeklyProgram || aiResponse;
    const trainingPhilosophy = aiResponse.trainingPhilosophy;
    const weeklyStructure = aiResponse.weeklyStructure;

    console.log('[TRAINING-AGENT] ✅ Training program generated successfully');
    console.log('[TRAINING-AGENT] Has executiveSummary:', !!executiveSummary);
    console.log('[TRAINING-AGENT] Has weeklyProgram:', !!weeklyProgram);
    console.log('[TRAINING-AGENT] Has trainingPhilosophy:', !!trainingPhilosophy);
    console.log('[TRAINING-AGENT] Has weeklyStructure:', !!weeklyStructure);

    return NextResponse.json({
      success: true,
      executiveSummary,
      weeklyProgram,
      trainingPhilosophy,
      weeklyStructure
    });

  } catch (error) {
    console.error('[TRAINING-AGENT] ❌ Error generating training program:', error);
    console.error('[TRAINING-AGENT] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('[TRAINING-AGENT] Error message:', error instanceof Error ? error.message : 'No message');

    // Log more details about the error with proper serialization
    if (error && typeof error === 'object') {
      try {
        console.error('[TRAINING-AGENT] Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      } catch (serializationError) {
        console.error('[TRAINING-AGENT] Could not serialize error:', serializationError);
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorType: error?.constructor?.name || 'Unknown'
      },
      { status: 500 }
    );
  }
}
