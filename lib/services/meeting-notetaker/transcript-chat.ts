/**
 * Transcript Chat Service
 *
 * Provides Q&A interface for querying meeting transcripts.
 * Uses Claude to answer questions with citations from the transcript.
 */

import Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/supabase/server';
import {
  ChatResponse,
  ChatCitation,
  TranscriptSegment,
  SpeakerProfile,
} from './types';

// ============================================================================
// Configuration
// ============================================================================

const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 1500;

const SYSTEM_PROMPT = `You are a helpful assistant that answers questions about meeting transcripts.

Your task is to answer user questions based ONLY on the provided transcript. You should:
1. Answer accurately based on what was actually said in the meeting
2. Cite specific parts of the transcript that support your answer
3. If the information is not in the transcript, say so clearly
4. Use the speaker names when referencing who said something
5. Be concise but thorough

When citing the transcript:
- Include the approximate timestamp
- Quote the relevant text
- Name the speaker

If asked about something not discussed in the meeting, respond:
"This information is not covered in the meeting transcript."`;

// ============================================================================
// Main Chat Function
// ============================================================================

/**
 * Answer a question about a meeting transcript
 */
export async function answerTranscriptQuestion(
  meetingId: string,
  question: string,
  userEmail: string
): Promise<{ success: boolean; response?: ChatResponse; error?: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[TranscriptChat] ANTHROPIC_API_KEY not configured');
    return { success: false, error: 'Chat service not configured' };
  }

  try {
    const supabase = createAdminClient();

    // Fetch transcript
    const { data: transcript, error: transcriptError } = await supabase
      .from('meeting_transcripts')
      .select('*')
      .eq('meeting_id', meetingId)
      .single();

    if (transcriptError || !transcript) {
      return { success: false, error: 'Transcript not found' };
    }

    // Fetch meeting for context
    const { data: meeting } = await supabase
      .from('meeting_recordings')
      .select('title, attendees')
      .eq('id', meetingId)
      .single();

    const anthropic = new Anthropic({ apiKey });

    const userPrompt = buildUserPrompt(
      question,
      transcript.edited_transcript || transcript.raw_transcript,
      transcript.segments || [],
      transcript.speakers || [],
      meeting?.title
    );

    console.log('[TranscriptChat] Processing question:', {
      meetingId,
      questionLength: question.length,
    });

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
    const chatResponse = parseResponse(content.text, transcript.segments || []);

    // Save to chat history
    await saveChatMessage(meetingId, userEmail, 'user', question);
    await saveChatMessage(
      meetingId,
      userEmail,
      'assistant',
      chatResponse.answer,
      chatResponse.citations,
      chatResponse.confidence
    );

    return { success: true, response: chatResponse };
  } catch (error) {
    console.error('[TranscriptChat] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get chat history for a meeting
 */
export async function getChatHistory(
  meetingId: string,
  userEmail: string,
  limit: number = 50
): Promise<Array<{
  role: 'user' | 'assistant';
  content: string;
  citations?: ChatCitation[];
  createdAt: Date;
}>> {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('meeting_chat_history')
      .select('*')
      .eq('meeting_id', meetingId)
      .eq('user_email', userEmail)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error || !data) {
      return [];
    }

    return data.map((row) => ({
      role: row.role as 'user' | 'assistant',
      content: row.content,
      citations: row.source_citations,
      createdAt: new Date(row.created_at),
    }));
  } catch (error) {
    console.error('[TranscriptChat] Error fetching history:', error);
    return [];
  }
}

// ============================================================================
// Prompt Building
// ============================================================================

function buildUserPrompt(
  question: string,
  transcript: string,
  segments: TranscriptSegment[],
  speakers: SpeakerProfile[],
  meetingTitle?: string
): string {
  // Build speaker context
  const speakerContext = speakers
    .map((s) => `${s.label}${s.name ? ` = ${s.name}` : ''}`)
    .join('\n');

  // Build formatted transcript with timestamps
  const formattedTranscript = segments.length > 0
    ? formatSegmentsWithTimestamps(segments)
    : transcript;

  return `Answer this question about the meeting transcript.

## MEETING
${meetingTitle ? `Title: ${meetingTitle}` : 'Title: Not specified'}

## PARTICIPANTS
${speakerContext || 'Speaker information not available'}

## TRANSCRIPT
${formattedTranscript}

## QUESTION
${question}

## OUTPUT FORMAT
Respond with a JSON object:
{
  "answer": "Your answer here...",
  "citations": [
    {
      "timestamp": 123.45,
      "speaker": "Speaker name",
      "text": "Relevant quote from transcript"
    }
  ],
  "confidence": 0.0 to 1.0
}

Guidelines:
- Answer based ONLY on the transcript
- Include citations for claims
- Set confidence based on how clearly the answer is supported
- If not found, say so and set confidence to 0.1`;
}

function formatSegmentsWithTimestamps(segments: TranscriptSegment[]): string {
  return segments
    .map((s) => `[${formatTimestamp(s.startTime)}] ${s.speaker}: ${s.text}`)
    .join('\n');
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ============================================================================
// Response Parsing
// ============================================================================

function parseResponse(
  text: string,
  segments: TranscriptSegment[]
): ChatResponse {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        answer: parsed.answer || text,
        citations: Array.isArray(parsed.citations) ? parsed.citations : [],
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.7,
      };
    }
  } catch (e) {
    // Fall back to text response
  }

  return {
    answer: text,
    citations: [],
    confidence: 0.7,
  };
}

// ============================================================================
// Database Operations
// ============================================================================

async function saveChatMessage(
  meetingId: string,
  userEmail: string,
  role: 'user' | 'assistant',
  content: string,
  citations?: ChatCitation[],
  confidence?: number
): Promise<void> {
  try {
    const supabase = createAdminClient();

    await supabase.from('meeting_chat_history').insert({
      meeting_id: meetingId,
      user_email: userEmail,
      role,
      content,
      source_citations: citations,
      confidence,
    });
  } catch (error) {
    console.error('[TranscriptChat] Error saving message:', error);
    // Don't throw - chat history is not critical
  }
}
