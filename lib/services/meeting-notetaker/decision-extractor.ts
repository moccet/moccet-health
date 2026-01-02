/**
 * Decision Extractor Service
 *
 * Extracts key decisions made during meetings using Claude AI.
 * Identifies explicit and implicit decisions with their context.
 */

import Anthropic from '@anthropic-ai/sdk';
import { DecisionExtractionResult, ExtractedDecision } from './types';

// ============================================================================
// Configuration
// ============================================================================

const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 1500;
const MAX_TRANSCRIPT_LENGTH = 40000;

const SYSTEM_PROMPT = `You are an expert at identifying key decisions from meeting transcripts.

Your task is to extract all significant decisions made during the meeting. This includes:
- Explicit decisions ("We've decided to...", "Let's go with...", "The decision is...")
- Consensus agreements ("Everyone agrees that...", "So we're all on board with...")
- Direction changes ("We're pivoting to...", "Let's change our approach to...")
- Approvals ("Approved", "Signed off", "Green light")
- Resource allocations ("We'll allocate...", "Budget approved for...")
- Timeline decisions ("Launch date is...", "Deadline set for...")

For each decision, identify:
1. Decision text - Clear statement of what was decided
2. Context - Brief background on why or what alternatives were considered
3. Impact area - What part of the business/project this affects
4. Confidence - Your confidence this is a real decision (0-1)

Focus on significant decisions that would be important to remember. Skip minor or trivial agreements.`;

// ============================================================================
// Main Extraction Function
// ============================================================================

/**
 * Extract decisions from a meeting transcript
 */
export async function extractDecisions(
  transcript: string
): Promise<DecisionExtractionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[DecisionExtractor] ANTHROPIC_API_KEY not configured');
    return { success: false, error: 'Decision extraction service not configured' };
  }

  const anthropic = new Anthropic({ apiKey });

  try {
    console.log('[DecisionExtractor] Extracting decisions:', {
      transcriptLength: transcript.length,
    });

    const userPrompt = buildUserPrompt(transcript);

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    // Extract text content
    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    // Parse the response
    const decisions = parseDecisionsResponse(content.text);

    console.log('[DecisionExtractor] Extraction complete:', {
      decisionsFound: decisions.length,
    });

    return {
      success: true,
      decisions,
    };
  } catch (error) {
    console.error('[DecisionExtractor] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown extraction error',
    };
  }
}

// ============================================================================
// Prompt Building
// ============================================================================

function buildUserPrompt(transcript: string): string {
  // Truncate transcript if too long
  const truncatedTranscript =
    transcript.length > MAX_TRANSCRIPT_LENGTH
      ? transcript.slice(0, MAX_TRANSCRIPT_LENGTH) + '\n\n[Transcript truncated...]'
      : transcript;

  return `Extract all key decisions from this meeting transcript.

## TRANSCRIPT
${truncatedTranscript}

## OUTPUT FORMAT
Respond with a JSON array of decisions:
[
  {
    "decisionText": "Clear statement of the decision made",
    "context": "Brief context or background (optional)",
    "impactArea": "Area affected (e.g., 'Product', 'Engineering', 'Marketing')",
    "confidence": 0.0 to 1.0
  }
]

If no decisions were made, return an empty array: []

Guidelines:
- Only include decisions with confidence >= 0.7
- Focus on significant decisions, not minor agreements
- Keep decision text concise but complete
- Context should explain the "why" if available`;
}

// ============================================================================
// Response Parsing
// ============================================================================

function parseDecisionsResponse(text: string): ExtractedDecision[] {
  const decisions: ExtractedDecision[] = [];

  try {
    // Extract JSON array from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.log('[DecisionExtractor] No JSON array found in response');
      return decisions;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(parsed)) {
      console.log('[DecisionExtractor] Parsed result is not an array');
      return decisions;
    }

    for (const item of parsed) {
      // Validate required fields
      if (!item.decisionText || typeof item.decisionText !== 'string') {
        continue;
      }

      // Skip low confidence items
      const confidence = typeof item.confidence === 'number' ? item.confidence : 0.7;
      if (confidence < 0.7) {
        continue;
      }

      decisions.push({
        decisionText: item.decisionText.trim(),
        context: item.context && typeof item.context === 'string'
          ? item.context.trim()
          : undefined,
        impactArea: item.impactArea && typeof item.impactArea === 'string'
          ? item.impactArea.trim()
          : undefined,
        confidence,
      });
    }
  } catch (e) {
    console.error('[DecisionExtractor] Error parsing response:', e);
    // Try fallback extraction
    return fallbackExtraction(text);
  }

  return decisions;
}

// ============================================================================
// Fallback Extraction
// ============================================================================

function fallbackExtraction(text: string): ExtractedDecision[] {
  const decisions: ExtractedDecision[] = [];

  // Look for common decision patterns
  const patterns = [
    /(?:we(?:'ve)?\s+)?decided\s+(?:to\s+)?(.+?)(?:\.|$)/gi,
    /decision(?:\s+is)?:\s*(.+?)(?:\.|$)/gi,
    /(?:let's|we'll)\s+go\s+with\s+(.+?)(?:\.|$)/gi,
    /approved:\s*(.+?)(?:\.|$)/gi,
    /agreed\s+(?:to|that)\s+(.+?)(?:\.|$)/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const decisionText = match[1].trim();
      if (decisionText.length > 10 && decisionText.length < 300) {
        // Avoid duplicates
        if (!decisions.some((d) => d.decisionText === decisionText)) {
          decisions.push({
            decisionText,
            confidence: 0.7,
          });
        }
      }
    }
  }

  return decisions.slice(0, 10); // Max 10 from fallback
}
