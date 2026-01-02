/**
 * Summary Generator Service
 *
 * Generates meeting summaries using Claude AI in multiple styles:
 * - Executive: Concise, strategic, focused on decisions and action items
 * - Chronological: Time-ordered discussion points with timestamps
 * - Sales: Customer-focused with needs, objections, and opportunities
 */

import Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/supabase/server';
import {
  SummaryStyle,
  GenerateSummaryInput,
  GenerateSummaryResult,
  TranscriptSegment,
  SpeakerProfile,
  MeetingAttendee,
} from './types';

// ============================================================================
// Configuration
// ============================================================================

const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 3000;
const MAX_TRANSCRIPT_LENGTH = 50000; // Truncate very long transcripts

// System prompts for each summary style
const SUMMARY_SYSTEM_PROMPTS: Record<SummaryStyle, string> = {
  executive: `You are an expert executive meeting summarizer. Your summaries are:
- Concise and strategic - busy executives need the essentials quickly
- Focused on decisions made and action items assigned
- Structured with clear sections: Overview, Key Decisions, Action Items, Next Steps
- Professional in tone, avoiding unnecessary details
- Under 500 words unless the meeting was unusually complex

Format your summaries with clear markdown headers and bullet points.`,

  chronological: `You are a detailed meeting recorder who maintains the flow of conversation. Your summaries:
- Follow the chronological order of discussion
- Include approximate timestamps for major topic transitions
- Capture the progression of ideas and how decisions evolved
- Group related discussions under topic headers
- Preserve important context about why decisions were made

Format with time markers like [0:05], [0:15], etc. and clear topic headers.`,

  sales: `You are a sales meeting analyst who extracts customer intelligence. Your summaries focus on:
- Prospect/Client identification and background
- Needs and pain points expressed (explicit and implied)
- Objections and concerns raised
- Buying signals and opportunities identified
- Competitive mentions
- Next steps with specific dates and owners
- Relationship dynamics and stakeholder mapping

Format with clear sections for each category. Highlight action items prominently.`,
};

// ============================================================================
// Main Summary Generation
// ============================================================================

/**
 * Generate a meeting summary in the specified style
 */
export async function generateSummary(
  input: GenerateSummaryInput
): Promise<GenerateSummaryResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[SummaryGenerator] ANTHROPIC_API_KEY not configured');
    return { success: false, error: 'Summary service not configured' };
  }

  const anthropic = new Anthropic({ apiKey });

  try {
    console.log('[SummaryGenerator] Generating summary:', {
      style: input.style,
      transcriptLength: input.transcript.length,
      attendees: input.attendees.length,
      duration: input.durationMinutes,
    });

    const systemPrompt = SUMMARY_SYSTEM_PROMPTS[input.style];
    const userPrompt = buildUserPrompt(input);

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    // Extract text content
    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    // Parse the structured response
    const parsed = parseSummaryResponse(content.text);

    console.log('[SummaryGenerator] Summary generated successfully:', {
      style: input.style,
      keyPoints: parsed.keyPoints.length,
      topics: parsed.topicsDiscussed.length,
    });

    return {
      success: true,
      summary: parsed,
    };
  } catch (error) {
    console.error('[SummaryGenerator] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown summary error',
    };
  }
}

/**
 * Regenerate summary for an existing meeting with new style or prompt
 */
export async function regenerateSummary(
  meetingId: string,
  style: SummaryStyle,
  customPrompt?: string
): Promise<GenerateSummaryResult> {
  try {
    const supabase = createAdminClient();

    // Fetch meeting with transcript
    const { data: meeting, error: meetingError } = await supabase
      .from('meeting_recordings')
      .select('*')
      .eq('id', meetingId)
      .single();

    if (meetingError || !meeting) {
      return { success: false, error: 'Meeting not found' };
    }

    // Fetch transcript
    const { data: transcript, error: transcriptError } = await supabase
      .from('meeting_transcripts')
      .select('*')
      .eq('meeting_id', meetingId)
      .single();

    if (transcriptError || !transcript) {
      return { success: false, error: 'Transcript not found' };
    }

    // Generate new summary
    const result = await generateSummary({
      transcript: transcript.edited_transcript || transcript.raw_transcript,
      segments: transcript.segments || [],
      speakers: transcript.speakers || [],
      style,
      meetingTitle: meeting.title,
      attendees: meeting.attendees || [],
      durationMinutes: Math.round((meeting.duration_seconds || 0) / 60),
      customPrompt,
    });

    if (!result.success || !result.summary) {
      return result;
    }

    // Store the new summary
    const { error: insertError } = await supabase
      .from('meeting_summaries')
      .upsert(
        {
          meeting_id: meetingId,
          summary_style: style,
          summary_text: result.summary.summaryText,
          key_points: result.summary.keyPoints,
          topics_discussed: result.summary.topicsDiscussed,
          generation_model: MODEL,
          custom_prompt: customPrompt,
          is_primary: style === 'executive', // Executive is primary by default
        },
        { onConflict: 'meeting_id,summary_style' }
      );

    if (insertError) {
      console.error('[SummaryGenerator] Error storing summary:', insertError);
      // Return success anyway since we generated it
    }

    return result;
  } catch (error) {
    console.error('[SummaryGenerator] Regeneration error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Prompt Building
// ============================================================================

function buildUserPrompt(input: GenerateSummaryInput): string {
  const {
    transcript,
    segments,
    speakers,
    style,
    meetingTitle,
    attendees,
    durationMinutes,
    customPrompt,
  } = input;

  // Truncate transcript if too long
  const truncatedTranscript =
    transcript.length > MAX_TRANSCRIPT_LENGTH
      ? transcript.slice(0, MAX_TRANSCRIPT_LENGTH) + '\n\n[Transcript truncated due to length...]'
      : transcript;

  // Build attendee list
  const attendeeList = attendees
    .map((a) => a.name || a.email)
    .filter(Boolean)
    .join(', ');

  // Build speaker summary
  const speakerSummary = speakers
    .map((s) => `${s.label}${s.name ? ` (${s.name})` : ''}: ${s.wordCount} words, ${formatDuration(s.speakingTimeSeconds)}`)
    .join('\n');

  let prompt = `Generate a ${style} summary for this meeting.

## MEETING DETAILS
- **Title:** ${meetingTitle || 'Untitled Meeting'}
- **Duration:** ${durationMinutes} minutes
- **Attendees:** ${attendeeList || 'Unknown'}

## SPEAKER BREAKDOWN
${speakerSummary || 'Speaker information not available'}

## TRANSCRIPT
${truncatedTranscript}

`;

  if (customPrompt) {
    prompt += `
## ADDITIONAL INSTRUCTIONS
${customPrompt}

`;
  }

  prompt += `## OUTPUT FORMAT
Please provide your response as valid JSON with this structure:
{
  "summaryText": "Your formatted summary here with markdown...",
  "keyPoints": ["Key point 1", "Key point 2", ...],
  "topicsDiscussed": ["Topic 1", "Topic 2", ...]
}

Important:
- The summaryText should be properly formatted markdown
- Key points should be concise (one sentence each)
- Topics should be just the topic names, not descriptions
- Ensure the JSON is valid and parseable`;

  return prompt;
}

// ============================================================================
// Response Parsing
// ============================================================================

function parseSummaryResponse(text: string): {
  summaryText: string;
  keyPoints: string[];
  topicsDiscussed: string[];
} {
  // Try to extract JSON from the response
  try {
    // Look for JSON block
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        summaryText: parsed.summaryText || text,
        keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
        topicsDiscussed: Array.isArray(parsed.topicsDiscussed)
          ? parsed.topicsDiscussed
          : [],
      };
    }
  } catch (e) {
    console.log('[SummaryGenerator] JSON parsing failed, using text extraction');
  }

  // Fall back to text-based extraction
  return {
    summaryText: text,
    keyPoints: extractKeyPoints(text),
    topicsDiscussed: extractTopics(text),
  };
}

function extractKeyPoints(text: string): string[] {
  const keyPoints: string[] = [];

  // Look for bullet points after "Key Points" or similar headers
  const keyPointsMatch = text.match(
    /(?:key points?|highlights?|summary)[\s:]*\n((?:[-*•]\s*.+\n?)+)/i
  );

  if (keyPointsMatch) {
    const bullets = keyPointsMatch[1].match(/[-*•]\s*(.+)/g);
    if (bullets) {
      bullets.forEach((bullet) => {
        const point = bullet.replace(/^[-*•]\s*/, '').trim();
        if (point) keyPoints.push(point);
      });
    }
  }

  return keyPoints.slice(0, 10); // Max 10 key points
}

function extractTopics(text: string): string[] {
  const topics: string[] = [];

  // Look for headers that might be topics
  const headers = text.match(/^#+\s*(.+)$/gm);
  if (headers) {
    headers.forEach((header) => {
      const topic = header.replace(/^#+\s*/, '').trim();
      // Filter out meta-headers
      if (
        topic &&
        !topic.toLowerCase().includes('summary') &&
        !topic.toLowerCase().includes('key point') &&
        !topic.toLowerCase().includes('action item') &&
        !topic.toLowerCase().includes('decision')
      ) {
        topics.push(topic);
      }
    });
  }

  return topics.slice(0, 10); // Max 10 topics
}

// ============================================================================
// Utilities
// ============================================================================

function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (remainingSeconds === 0) {
    return `${minutes}m`;
  }
  return `${minutes}m ${remainingSeconds}s`;
}
