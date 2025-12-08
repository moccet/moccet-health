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

/**
 * Build a minimal prompt for retry (just weeklyProgram, no philosophy sections)
 */
function buildMinimalPrompt(userProfile: any, trainingProtocol: any): string {
  return `You are a fitness coach. Generate a simple 7-day workout program.

USER: ${userProfile.name}, ${userProfile.age} years old, ${userProfile.gender}
GOALS: ${userProfile.goals?.join(', ') || 'General fitness'}
EQUIPMENT: ${userProfile.equipment?.join(', ') || 'Full gym'}
${userProfile.currentBests ? `CURRENT BESTS (5RM): ${userProfile.currentBests}` : ''}

Return ONLY this JSON structure (under 12,000 characters):
{
  "executiveSummary": "2-3 sentences about this plan (50 words max)",
  "weeklyProgram": {
    "monday": { "dayName": "Monday", "focus": "...", "duration": "...", "warmup": {...}, "mainWorkout": [...], "cooldown": {...} },
    "tuesday": { "dayName": "Tuesday", "focus": "Rest Day", "activities": "Light stretching" },
    ... (all 7 days)
  }
}

Each exercise MUST include weight:
{ "exercise": "Name", "prescription": "4x6-8, 90s rest", "weight": "70 kg", "effort": "How hard", "formCues": "Brief tip" }

WEIGHT RULES: Calculate from user's 5RM - use 70-75% for 6-8 reps, 60-70% for 8-12 reps.

Return ONLY valid JSON.`;
}

/**
 * Clean and parse JSON response
 */
function cleanAndParseResponse(responseText: string): any {
  let cleaned = responseText.trim();

  // Strip markdown code blocks
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\n?/, '').replace(/\n?```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\n?/, '').replace(/\n?```$/, '');
  }
  cleaned = cleaned.trim();

  // Additional sanitization
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
  cleaned = cleaned.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  cleaned = cleaned.replace(/[\u0000-\u0009\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, '');

  return parseJSONWithRepair(cleaned);
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

    // Enrich with unified context if available (but keep it shorter)
    let prompt = basePrompt;
    if (unifiedContext) {
      console.log('[TRAINING-AGENT] Enriching prompt with unified ecosystem context');
      // Only include key insights, not full context (reduces token count)
      const contextSummary = unifiedContext.keyInsights?.slice(0, 3) || [];
      const contextEnrichment = `\n\n## KEY INSIGHTS FROM USER DATA
${contextSummary.map((i: any) => `- ${i.insight || i}`).join('\n')}

Use these insights to personalize the program, but keep response under 20,000 characters.`;
      prompt = basePrompt + contextEnrichment;
    }

    console.log('[TRAINING-AGENT] Calling GPT-5 with medium reasoning...');
    let aiResponse;
    let usedMinimalPrompt = false;

    try {
      const completion = await openai.responses.create({
        model: 'gpt-5',
        input: prompt,
        reasoning: { effort: 'medium' },
        text: { verbosity: 'medium' }
      });

      const responseText = completion.output_text || '{}';
      console.log('[TRAINING-AGENT] Response length:', responseText.length);

      aiResponse = cleanAndParseResponse(responseText);
    } catch (firstError) {
      console.log('[TRAINING-AGENT] ⚠️ First attempt failed, retrying with minimal prompt...');
      console.log('[TRAINING-AGENT] Error:', firstError instanceof Error ? firstError.message : 'Unknown');

      // Retry with minimal prompt
      usedMinimalPrompt = true;
      const minimalPrompt = buildMinimalPrompt(userProfile, trainingProtocol);

      try {
        const retryCompletion = await openai.responses.create({
          model: 'gpt-5',
          input: minimalPrompt,
          reasoning: { effort: 'low' },  // Lower effort for simpler prompt
          text: { verbosity: 'low' }     // Lower verbosity for shorter output
        });

        const retryText = retryCompletion.output_text || '{}';
        console.log('[TRAINING-AGENT] Retry response length:', retryText.length);

        aiResponse = cleanAndParseResponse(retryText);
        console.log('[TRAINING-AGENT] ✅ Retry successful with minimal prompt');
      } catch (retryError) {
        console.error('[TRAINING-AGENT] ❌ Retry also failed:', retryError);
        throw new Error(`Failed to parse training program after retry: ${retryError instanceof Error ? retryError.message : 'Unknown'}`);
      }
    }

    // Extract all training sections from AI response
    const executiveSummary = aiResponse.executiveSummary;
    const weeklyProgram = aiResponse.weeklyProgram || aiResponse;
    const trainingPhilosophy = aiResponse.trainingPhilosophy;
    const weeklyStructure = aiResponse.weeklyStructure;

    console.log('[TRAINING-AGENT] ✅ Training program generated successfully');
    console.log('[TRAINING-AGENT] Used minimal prompt:', usedMinimalPrompt);
    console.log('[TRAINING-AGENT] Has executiveSummary:', !!executiveSummary);
    console.log('[TRAINING-AGENT] Has weeklyProgram:', !!weeklyProgram);
    console.log('[TRAINING-AGENT] Has trainingPhilosophy:', !!trainingPhilosophy);
    console.log('[TRAINING-AGENT] Has weeklyStructure:', !!weeklyStructure);

    return NextResponse.json({
      success: true,
      executiveSummary,
      weeklyProgram,
      trainingPhilosophy,
      weeklyStructure,
      usedMinimalPrompt
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
