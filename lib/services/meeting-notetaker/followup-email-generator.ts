/**
 * Follow-up Email Generator Service
 *
 * Generates meeting follow-up emails using Claude AI.
 * Can optionally match the user's email writing style.
 */

import Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/supabase/server';
import {
  GenerateFollowupInput,
  GenerateFollowupResult,
  MeetingSummary,
  MeetingActionItem,
  MeetingAttendee,
} from './types';

// ============================================================================
// Configuration
// ============================================================================

const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 2000;

const SYSTEM_PROMPT = `You are an expert at writing professional follow-up emails after meetings.

Your emails should:
1. Thank attendees for their time
2. Summarize key discussion points and outcomes
3. Clearly list action items with owners and deadlines
4. Include next steps
5. Be professional but warm in tone
6. Be concise - busy people appreciate brevity

Structure:
- Brief greeting and thanks
- Quick summary (2-3 sentences max)
- Key decisions (if any)
- Action items (bulleted list with owners)
- Next steps/timeline
- Closing

Avoid:
- Overly formal or stiff language
- Unnecessary pleasantries
- Repeating information`;

// ============================================================================
// Main Generation Function
// ============================================================================

/**
 * Generate a follow-up email for a meeting
 */
export async function generateFollowupEmail(
  input: GenerateFollowupInput
): Promise<GenerateFollowupResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[FollowupGenerator] ANTHROPIC_API_KEY not configured');
    return { success: false, error: 'Email generation service not configured' };
  }

  const anthropic = new Anthropic({ apiKey });

  try {
    console.log('[FollowupGenerator] Generating follow-up email:', {
      meetingId: input.meetingId,
      attendees: input.attendees.length,
      actionItems: input.actionItems.length,
    });

    // Optionally fetch user's email style
    let stylePrompt = '';
    if (input.matchStyle) {
      const style = await getUserEmailStyle(input.senderEmail);
      if (style) {
        stylePrompt = buildStylePrompt(style);
      }
    }

    const userPrompt = buildUserPrompt(input, stylePrompt);

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
    const draft = parseResponse(content.text, input);

    console.log('[FollowupGenerator] Email generated successfully');

    return {
      success: true,
      draft,
    };
  } catch (error) {
    console.error('[FollowupGenerator] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown generation error',
    };
  }
}

/**
 * Save a generated follow-up draft to the database
 */
export async function saveFollowupDraft(
  meetingId: string,
  userEmail: string,
  subject: string,
  body: string,
  htmlBody: string,
  toEmails: string[]
): Promise<{ success: boolean; draftId?: string; error?: string }> {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('meeting_followup_drafts')
      .insert({
        meeting_id: meetingId,
        user_email: userEmail,
        subject,
        body,
        html_body: htmlBody,
        to_emails: toEmails,
        status: 'draft',
        generation_model: MODEL,
        style_matched: true,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[FollowupGenerator] Error saving draft:', error);
      return { success: false, error: error.message };
    }

    return { success: true, draftId: data.id };
  } catch (error) {
    console.error('[FollowupGenerator] Exception saving draft:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Style Matching
// ============================================================================

async function getUserEmailStyle(
  userEmail: string
): Promise<{
  greetingPatterns: string[];
  signoffPatterns: string[];
  toneProfile: { formality: number; warmth: number };
} | null> {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('user_email_style')
      .select('greeting_patterns, signoff_patterns, tone_profile')
      .eq('user_email', userEmail)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      greetingPatterns: data.greeting_patterns || [],
      signoffPatterns: data.signoff_patterns || [],
      toneProfile: data.tone_profile || { formality: 0.5, warmth: 0.5 },
    };
  } catch (error) {
    console.error('[FollowupGenerator] Error fetching style:', error);
    return null;
  }
}

function buildStylePrompt(style: {
  greetingPatterns: string[];
  signoffPatterns: string[];
  toneProfile: { formality: number; warmth: number };
}): string {
  const { greetingPatterns, signoffPatterns, toneProfile } = style;

  let prompt = '\n\n## STYLE GUIDELINES (match the sender\'s usual style)\n';

  if (greetingPatterns.length > 0) {
    prompt += `Preferred greetings: ${greetingPatterns.slice(0, 3).join(', ')}\n`;
  }

  if (signoffPatterns.length > 0) {
    prompt += `Preferred sign-offs: ${signoffPatterns.slice(0, 3).join(', ')}\n`;
  }

  const formalityDesc = toneProfile.formality > 0.7
    ? 'formal'
    : toneProfile.formality < 0.3
      ? 'casual'
      : 'balanced';

  const warmthDesc = toneProfile.warmth > 0.7
    ? 'warm and friendly'
    : toneProfile.warmth < 0.3
      ? 'direct and professional'
      : 'professional with warmth';

  prompt += `Tone: ${formalityDesc}, ${warmthDesc}\n`;

  return prompt;
}

// ============================================================================
// Prompt Building
// ============================================================================

function buildUserPrompt(
  input: GenerateFollowupInput,
  stylePrompt: string
): string {
  const {
    summary,
    actionItems,
    attendees,
    senderName,
  } = input;

  // Build attendee list
  const attendeeList = attendees
    .map((a) => a.name || a.email)
    .filter(Boolean)
    .join(', ');

  // Build action items list
  const actionItemsList = actionItems
    .filter((item) => item.status === 'open')
    .map((item) => {
      let line = `- ${item.taskDescription}`;
      if (item.ownerName) line += ` (Owner: ${item.ownerName})`;
      if (item.dueDate) line += ` - Due: ${formatDate(item.dueDate)}`;
      return line;
    })
    .join('\n');

  return `Generate a follow-up email for this meeting.

## SENDER
${senderName}

## ATTENDEES
${attendeeList}

## MEETING SUMMARY
${summary.summaryText}

## KEY POINTS
${summary.keyPoints.map((p) => `- ${p}`).join('\n')}

## ACTION ITEMS
${actionItemsList || 'No action items recorded'}
${stylePrompt}
## OUTPUT FORMAT
Respond with a JSON object:
{
  "subject": "Email subject line",
  "body": "Plain text email body",
  "htmlBody": "HTML formatted email body"
}

Guidelines:
- Subject should be concise and descriptive
- Body should be well-formatted plain text
- HTML body should use proper HTML tags for formatting`;
}

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

// ============================================================================
// Response Parsing
// ============================================================================

function parseResponse(
  text: string,
  input: GenerateFollowupInput
): {
  subject: string;
  body: string;
  htmlBody: string;
  toEmails: string[];
} {
  // Get recipient emails (excluding sender)
  const toEmails = input.attendees
    .filter((a) => a.email !== input.senderEmail)
    .map((a) => a.email);

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        subject: parsed.subject || generateDefaultSubject(input),
        body: parsed.body || text,
        htmlBody: parsed.htmlBody || convertToHtml(parsed.body || text),
        toEmails,
      };
    }
  } catch (e) {
    // Fall back to text response
  }

  return {
    subject: generateDefaultSubject(input),
    body: text,
    htmlBody: convertToHtml(text),
    toEmails,
  };
}

function generateDefaultSubject(input: GenerateFollowupInput): string {
  const date = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  return `Meeting Follow-up - ${date}`;
}

function convertToHtml(text: string): string {
  // Basic markdown to HTML conversion
  let html = text
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Bullet points
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    // Wrap consecutive li elements in ul
    .replace(/(<li>.+<\/li>\n?)+/g, '<ul>$&</ul>')
    // Paragraphs
    .split('\n\n')
    .map((p) => (p.startsWith('<ul>') || p.startsWith('<li>') ? p : `<p>${p}</p>`))
    .join('');

  return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333;">
${html}
</div>`;
}
