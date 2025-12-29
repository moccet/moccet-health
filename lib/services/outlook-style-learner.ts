/**
 * Outlook Email Style Learner Service
 *
 * Analyzes user's sent emails from Outlook to learn their writing style patterns.
 * Extracts: greetings, sign-offs, tone, verbosity, common phrases.
 *
 * @module lib/services/outlook-style-learner
 */

import { createValidatedOutlookMailClient, OutlookMailClient, OutlookEmail } from '@/lib/services/outlook-mail-client';
import { createAdminClient } from '@/lib/supabase/server';
import Anthropic from '@anthropic-ai/sdk';

// =========================================================================
// TYPES
// =========================================================================

export interface EmailStyleProfile {
  greetingPatterns: string[];
  signoffPatterns: string[];
  toneProfile: {
    formality: number; // 0-1, higher = more formal
    warmth: number; // 0-1, higher = warmer
    directness: number; // 0-1, higher = more direct
  };
  avgSentenceLength: number;
  avgEmailLength: number;
  verbosityLevel: 'concise' | 'medium' | 'detailed';
  commonPhrases: string[];
  usesEmojis: boolean;
  usesBulletPoints: boolean;
  usesNumberedLists: boolean;
  responseTimePreference: 'immediate' | 'thoughtful' | 'brief';
  preferredVocabulary: Record<string, string[]>;
  sampleEmailsAnalyzed: number;
  sentEmailsAnalyzed: number;
  confidenceScore: number;
}

export interface LearnStyleResult {
  success: boolean;
  profile?: EmailStyleProfile;
  emailsAnalyzed: number;
  error?: string;
}

interface ParsedEmail {
  id: string;
  conversationId: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  body: string;
  isReply: boolean;
}

// =========================================================================
// OUTLOOK API HELPERS
// =========================================================================

/**
 * Fetch sent emails from Outlook
 * @param client - Authenticated Outlook client
 * @param maxResults - Maximum number of emails to fetch (default 200)
 */
async function fetchSentEmails(
  client: OutlookMailClient,
  maxResults: number = 200
): Promise<ParsedEmail[]> {
  const emails: ParsedEmail[] = [];

  try {
    // Fetch sent emails
    const response = await client.getSentEmails({ maxResults: Math.min(maxResults, 500) });
    const messages = response.value || [];
    console.log(`[OutlookStyleLearner] Found ${messages.length} sent emails`);

    // Fetch full content for each email (in batches to avoid rate limits)
    const batchSize = 20;
    for (let i = 0; i < messages.length && emails.length < maxResults; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);

      const emailPromises = batch.map(async (msg) => {
        try {
          // Get full email with body
          const email = await client.getEmail(msg.id);
          return parseEmail(email);
        } catch (e) {
          console.error(`[OutlookStyleLearner] Failed to fetch email ${msg.id}:`, e);
          return null;
        }
      });

      const results = await Promise.all(emailPromises);
      emails.push(...results.filter((e): e is ParsedEmail => e !== null));

      // Small delay between batches to avoid rate limits
      if (i + batchSize < messages.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  } catch (error) {
    console.error('[OutlookStyleLearner] Failed to fetch sent emails:', error);
    throw error;
  }

  return emails;
}

/**
 * Parse an Outlook email into a structured format
 */
function parseEmail(email: OutlookEmail): ParsedEmail | null {
  if (!email.id) return null;

  const subject = email.subject || '';
  const from = email.from?.emailAddress?.address || '';
  const to = email.toRecipients?.map(r => r.emailAddress?.address).filter(Boolean).join(', ') || '';
  const date = email.sentDateTime || email.receivedDateTime || '';

  // Extract body text
  let body = email.body?.content || '';
  if (email.body?.contentType === 'html') {
    body = stripHtml(body);
  }

  // Check if this is a reply (Re: in subject)
  const isReply = subject.toLowerCase().startsWith('re:');

  return {
    id: email.id,
    conversationId: email.conversationId || '',
    subject,
    from,
    to,
    date,
    body,
    isReply,
  };
}

/**
 * Strip HTML tags and convert to plain text
 */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// =========================================================================
// STYLE ANALYSIS WITH CLAUDE
// =========================================================================

/**
 * Analyze emails with Claude to extract writing style patterns
 */
async function analyzeStyleWithClaude(emails: ParsedEmail[]): Promise<EmailStyleProfile> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  // Prepare email samples (limit to prevent token overflow)
  const sampleEmails = emails.slice(0, 50).map((e) => ({
    subject: e.subject,
    body: e.body.slice(0, 1000), // Truncate long emails
    isReply: e.isReply,
  }));

  const prompt = `Analyze the following sent emails and extract the user's writing style patterns.
Be thorough and accurate in your analysis.

EMAIL SAMPLES:
${JSON.stringify(sampleEmails, null, 2)}

Analyze these emails and provide a JSON response with the following structure:
{
  "greetingPatterns": ["list of greeting phrases used, e.g., 'Hey', 'Hi [name]', 'Hello'"],
  "signoffPatterns": ["list of sign-off phrases, e.g., 'Best,', 'Thanks,', 'Cheers,'"],
  "toneProfile": {
    "formality": 0.0-1.0 (0=casual, 1=very formal),
    "warmth": 0.0-1.0 (0=cold/professional, 1=warm/friendly),
    "directness": 0.0-1.0 (0=indirect/elaborate, 1=direct/concise)
  },
  "avgSentenceLength": approximate average words per sentence,
  "avgEmailLength": approximate average words per email,
  "verbosityLevel": "concise" | "medium" | "detailed",
  "commonPhrases": ["frequently used phrases or expressions"],
  "usesEmojis": true/false,
  "usesBulletPoints": true/false,
  "usesNumberedLists": true/false,
  "responseTimePreference": "immediate" | "thoughtful" | "brief" (based on response length/detail),
  "preferredVocabulary": {
    "transitions": ["words used to connect ideas"],
    "emphasis": ["words used for emphasis"],
    "hedging": ["softening words like 'perhaps', 'maybe'"]
  },
  "confidenceScore": 0.0-1.0 (how confident are you in this analysis)
}

Respond with ONLY the JSON object, no additional text.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    // Parse JSON response
    const analysisText = content.text.trim();
    const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from Claude response');
    }

    const analysis = JSON.parse(jsonMatch[0]);

    return {
      greetingPatterns: analysis.greetingPatterns || [],
      signoffPatterns: analysis.signoffPatterns || [],
      toneProfile: {
        formality: analysis.toneProfile?.formality ?? 0.5,
        warmth: analysis.toneProfile?.warmth ?? 0.5,
        directness: analysis.toneProfile?.directness ?? 0.5,
      },
      avgSentenceLength: analysis.avgSentenceLength || 15,
      avgEmailLength: analysis.avgEmailLength || 100,
      verbosityLevel: analysis.verbosityLevel || 'medium',
      commonPhrases: analysis.commonPhrases || [],
      usesEmojis: analysis.usesEmojis || false,
      usesBulletPoints: analysis.usesBulletPoints || false,
      usesNumberedLists: analysis.usesNumberedLists || false,
      responseTimePreference: analysis.responseTimePreference || 'thoughtful',
      preferredVocabulary: analysis.preferredVocabulary || {},
      sampleEmailsAnalyzed: emails.length,
      sentEmailsAnalyzed: emails.filter((e) => !e.isReply).length,
      confidenceScore: analysis.confidenceScore || 0.7,
    };
  } catch (error) {
    console.error('[OutlookStyleLearner] Claude analysis failed:', error);
    throw error;
  }
}

// =========================================================================
// DATABASE OPERATIONS
// =========================================================================

/**
 * Store learned email style in the database
 */
async function storeEmailStyle(
  userEmail: string,
  profile: EmailStyleProfile,
  userCode?: string,
  source: string = 'outlook'
): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase.from('user_email_style').upsert(
    {
      user_email: userEmail,
      user_code: userCode || null,
      greeting_patterns: profile.greetingPatterns,
      signoff_patterns: profile.signoffPatterns,
      tone_profile: profile.toneProfile,
      avg_sentence_length: profile.avgSentenceLength,
      avg_email_length: profile.avgEmailLength,
      verbosity_level: profile.verbosityLevel,
      common_phrases: profile.commonPhrases,
      preferred_vocabulary: profile.preferredVocabulary,
      uses_emojis: profile.usesEmojis,
      uses_bullet_points: profile.usesBulletPoints,
      uses_numbered_lists: profile.usesNumberedLists,
      response_time_preference: profile.responseTimePreference,
      sample_emails_analyzed: profile.sampleEmailsAnalyzed,
      sent_emails_analyzed: profile.sentEmailsAnalyzed,
      confidence_score: profile.confidenceScore,
      source,
      last_learned_at: new Date().toISOString(),
      learning_version: 1,
    },
    {
      onConflict: 'user_email',
    }
  );

  if (error) {
    console.error('[OutlookStyleLearner] Failed to store email style:', error);
    throw error;
  }
}

/**
 * Get existing email style from database
 */
export async function getEmailStyle(
  userEmail: string,
  userCode?: string
): Promise<EmailStyleProfile | null> {
  const supabase = createAdminClient();

  let query = supabase
    .from('user_email_style')
    .select('*')
    .order('last_learned_at', { ascending: false })
    .limit(1);

  if (userCode) {
    query = query.or(`user_email.eq.${userEmail},user_code.eq.${userCode}`);
  } else {
    query = query.eq('user_email', userEmail);
  }

  const { data, error } = await query.maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    greetingPatterns: data.greeting_patterns || [],
    signoffPatterns: data.signoff_patterns || [],
    toneProfile: data.tone_profile || { formality: 0.5, warmth: 0.5, directness: 0.5 },
    avgSentenceLength: data.avg_sentence_length || 15,
    avgEmailLength: data.avg_email_length || 100,
    verbosityLevel: data.verbosity_level || 'medium',
    commonPhrases: data.common_phrases || [],
    usesEmojis: data.uses_emojis || false,
    usesBulletPoints: data.uses_bullet_points || false,
    usesNumberedLists: data.uses_numbered_lists || false,
    responseTimePreference: data.response_time_preference || 'thoughtful',
    preferredVocabulary: data.preferred_vocabulary || {},
    sampleEmailsAnalyzed: data.sample_emails_analyzed || 0,
    sentEmailsAnalyzed: data.sent_emails_analyzed || 0,
    confidenceScore: data.confidence_score || 0,
  };
}

// =========================================================================
// MAIN EXPORT
// =========================================================================

/**
 * Learn user's email writing style from their Outlook sent emails
 *
 * @param userEmail - User's email address
 * @param userCode - Optional user code for lookup
 * @param options - Configuration options
 * @returns Learning result with profile
 */
export async function learnOutlookEmailStyle(
  userEmail: string,
  userCode?: string,
  options?: {
    forceRelearn?: boolean;
    maxEmails?: number;
  }
): Promise<LearnStyleResult> {
  const { forceRelearn = false, maxEmails = 200 } = options || {};

  console.log(`[OutlookStyleLearner] Starting style learning for ${userEmail}`);

  try {
    // Check if style already learned (unless forcing relearn)
    if (!forceRelearn) {
      const existingStyle = await getEmailStyle(userEmail, userCode);
      if (existingStyle && existingStyle.sampleEmailsAnalyzed > 0) {
        console.log('[OutlookStyleLearner] Using existing learned style');
        return {
          success: true,
          profile: existingStyle,
          emailsAnalyzed: existingStyle.sampleEmailsAnalyzed,
        };
      }
    }

    // Create Outlook client
    const { client, error } = await createValidatedOutlookMailClient(userEmail, userCode);
    if (!client) {
      return {
        success: false,
        emailsAnalyzed: 0,
        error: error || 'Failed to authenticate with Outlook. Please reconnect your account.',
      };
    }

    // Fetch sent emails
    console.log(`[OutlookStyleLearner] Fetching up to ${maxEmails} sent emails...`);
    const emails = await fetchSentEmails(client, maxEmails);

    if (emails.length === 0) {
      return {
        success: false,
        emailsAnalyzed: 0,
        error: 'No sent emails found to analyze.',
      };
    }

    console.log(`[OutlookStyleLearner] Analyzing ${emails.length} emails with Claude...`);

    // Analyze with Claude
    const profile = await analyzeStyleWithClaude(emails);

    // Store in database
    await storeEmailStyle(userEmail, profile, userCode, 'outlook');

    console.log('[OutlookStyleLearner] Style learning complete');

    return {
      success: true,
      profile,
      emailsAnalyzed: emails.length,
    };
  } catch (error) {
    console.error('[OutlookStyleLearner] Error learning style:', error);
    return {
      success: false,
      emailsAnalyzed: 0,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
