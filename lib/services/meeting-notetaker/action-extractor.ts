/**
 * Action Item Extractor Service
 *
 * Extracts action items/tasks from meeting transcripts using Claude AI.
 * Identifies explicit and implicit tasks, owners, and deadlines.
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  ActionItemExtractionResult,
  ExtractedActionItem,
  SpeakerProfile,
  ActionItemPriority,
} from './types';

// ============================================================================
// Configuration
// ============================================================================

const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 2000;
const MAX_TRANSCRIPT_LENGTH = 40000;

const SYSTEM_PROMPT = `You are an expert at identifying action items from meeting transcripts.

Your task is to extract ALL tasks, to-dos, and commitments made during the meeting. This includes:
- Explicit action items ("I will...", "Can you...", "Let's...")
- Implicit commitments ("I'll look into that", "We should follow up")
- Delegated tasks ("John, can you handle...", "Sarah will take care of...")
- Scheduled follow-ups ("Let's meet again next week")
- Research or investigation tasks ("We need to find out...")

For each action item, identify:
1. Task description - What needs to be done (clear, actionable language)
2. Owner - Who is responsible (if mentioned or implied)
3. Priority - Based on urgency signals (high/medium/low)
4. Deadline - If mentioned or implied (null if not specified)
5. Confidence - Your confidence in this being a real action item (0-1)

Priority signals:
- HIGH: urgent, critical, ASAP, before [imminent date], blocking
- MEDIUM: should, need to, important, this week
- LOW: could, might, when you get a chance, nice to have

Be thorough but avoid false positives. Not every statement is an action item.`;

// ============================================================================
// Main Extraction Function
// ============================================================================

/**
 * Extract action items from a meeting transcript
 */
export async function extractActionItems(
  transcript: string,
  speakers: SpeakerProfile[] = []
): Promise<ActionItemExtractionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[ActionExtractor] ANTHROPIC_API_KEY not configured');
    return { success: false, error: 'Action extraction service not configured' };
  }

  const anthropic = new Anthropic({ apiKey });

  try {
    console.log('[ActionExtractor] Extracting action items:', {
      transcriptLength: transcript.length,
      speakers: speakers.length,
    });

    const userPrompt = buildUserPrompt(transcript, speakers);

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
    const items = parseActionItemsResponse(content.text, speakers);

    console.log('[ActionExtractor] Extraction complete:', {
      itemsFound: items.length,
      highPriority: items.filter((i) => i.priority === 'high').length,
    });

    return {
      success: true,
      items,
    };
  } catch (error) {
    console.error('[ActionExtractor] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown extraction error',
    };
  }
}

// ============================================================================
// Prompt Building
// ============================================================================

function buildUserPrompt(
  transcript: string,
  speakers: SpeakerProfile[]
): string {
  // Truncate transcript if too long
  const truncatedTranscript =
    transcript.length > MAX_TRANSCRIPT_LENGTH
      ? transcript.slice(0, MAX_TRANSCRIPT_LENGTH) + '\n\n[Transcript truncated...]'
      : transcript;

  // Build speaker context
  const speakerContext = speakers
    .map((s) => `${s.label}${s.name ? ` = ${s.name}` : ''}${s.email ? ` <${s.email}>` : ''}`)
    .join('\n');

  return `Extract all action items from this meeting transcript.

## PARTICIPANTS
${speakerContext || 'Speaker information not available'}

## TRANSCRIPT
${truncatedTranscript}

## OUTPUT FORMAT
Respond with a JSON array of action items:
[
  {
    "description": "Clear, actionable description of the task",
    "ownerName": "Name of the person responsible (or null if unclear)",
    "ownerEmail": "Email if known (or null)",
    "priority": "high" | "medium" | "low",
    "deadline": "ISO date string if mentioned (or null)",
    "confidence": 0.0 to 1.0
  }
]

If no action items are found, return an empty array: []

Only include items with confidence >= 0.6. Be precise and actionable.`;
}

// ============================================================================
// Response Parsing
// ============================================================================

function parseActionItemsResponse(
  text: string,
  speakers: SpeakerProfile[]
): ExtractedActionItem[] {
  const items: ExtractedActionItem[] = [];

  try {
    // Extract JSON array from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.log('[ActionExtractor] No JSON array found in response');
      return items;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(parsed)) {
      console.log('[ActionExtractor] Parsed result is not an array');
      return items;
    }

    for (const item of parsed) {
      // Validate required fields
      if (!item.description || typeof item.description !== 'string') {
        continue;
      }

      // Skip low confidence items
      const confidence = typeof item.confidence === 'number' ? item.confidence : 0.7;
      if (confidence < 0.6) {
        continue;
      }

      // Parse priority
      const priority = parsePriority(item.priority);

      // Parse deadline
      const deadline = parseDeadline(item.deadline);

      // Try to match owner to a speaker
      const ownerInfo = matchOwnerToSpeaker(
        item.ownerName,
        item.ownerEmail,
        speakers
      );

      items.push({
        description: item.description.trim(),
        ownerName: ownerInfo.name,
        ownerEmail: ownerInfo.email,
        priority,
        deadline,
        confidence,
      });
    }
  } catch (e) {
    console.error('[ActionExtractor] Error parsing response:', e);
    // Try fallback extraction
    return fallbackExtraction(text);
  }

  return items;
}

function parsePriority(value: unknown): ActionItemPriority {
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (lower === 'high') return 'high';
    if (lower === 'low') return 'low';
  }
  return 'medium';
}

function parseDeadline(value: unknown): Date | undefined {
  if (!value) return undefined;

  if (typeof value === 'string') {
    // Try to parse ISO date
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date;
    }

    // Try to parse natural language dates
    const naturalDate = parseNaturalDate(value);
    if (naturalDate) return naturalDate;
  }

  return undefined;
}

function parseNaturalDate(text: string): Date | undefined {
  const lower = text.toLowerCase();
  const now = new Date();

  // Handle relative dates
  if (lower.includes('tomorrow')) {
    const date = new Date(now);
    date.setDate(date.getDate() + 1);
    return date;
  }

  if (lower.includes('next week')) {
    const date = new Date(now);
    date.setDate(date.getDate() + 7);
    return date;
  }

  if (lower.includes('end of week') || lower.includes('friday')) {
    const date = new Date(now);
    const day = date.getDay();
    const daysUntilFriday = (5 - day + 7) % 7 || 7;
    date.setDate(date.getDate() + daysUntilFriday);
    return date;
  }

  if (lower.includes('end of month')) {
    const date = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return date;
  }

  return undefined;
}

function matchOwnerToSpeaker(
  name: string | null | undefined,
  email: string | null | undefined,
  speakers: SpeakerProfile[]
): { name?: string; email?: string } {
  // If we have an email, try to match it to a speaker
  if (email && typeof email === 'string') {
    const matchedSpeaker = speakers.find(
      (s) => s.email?.toLowerCase() === email.toLowerCase()
    );
    if (matchedSpeaker) {
      return {
        name: matchedSpeaker.name || name || undefined,
        email: matchedSpeaker.email,
      };
    }
  }

  // If we have a name, try to match it to a speaker
  if (name && typeof name === 'string') {
    const matchedSpeaker = speakers.find(
      (s) => s.name?.toLowerCase() === name.toLowerCase() ||
             s.label.toLowerCase().includes(name.toLowerCase())
    );
    if (matchedSpeaker) {
      return {
        name: matchedSpeaker.name || name,
        email: matchedSpeaker.email,
      };
    }
  }

  // Return whatever we have
  return {
    name: name && typeof name === 'string' ? name : undefined,
    email: email && typeof email === 'string' ? email : undefined,
  };
}

// ============================================================================
// Fallback Extraction
// ============================================================================

function fallbackExtraction(text: string): ExtractedActionItem[] {
  const items: ExtractedActionItem[] = [];

  // Look for common action item patterns
  const patterns = [
    /(?:action item|todo|task):\s*(.+?)(?:\n|$)/gi,
    /(?:will|going to)\s+(.+?)(?:\.|$)/gi,
    /(?:need to|should|must)\s+(.+?)(?:\.|$)/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const description = match[1].trim();
      if (description.length > 10 && description.length < 200) {
        // Avoid duplicates
        if (!items.some((i) => i.description === description)) {
          items.push({
            description,
            priority: 'medium',
            confidence: 0.6,
          });
        }
      }
    }
  }

  return items.slice(0, 10); // Max 10 from fallback
}
