/**
 * Email Draft Agent - LangGraph Implementation
 *
 * Generates draft email responses using learned user style and memory context.
 * This is a streamlined agent focused specifically on email drafting.
 *
 * Flow:
 * 1. Receive original email + user style + memory context
 * 2. Generate draft response matching user's writing style
 * 3. Create draft in Gmail (or store locally if approval required)
 *
 * @module lib/agents/email-draft-agent
 */

import { StateGraph, END, START, Annotation } from '@langchain/langgraph';
import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import Anthropic from '@anthropic-ai/sdk';
import { google, gmail_v1 } from 'googleapis';
import { createAdminClient } from '@/lib/supabase/server';
import { getAccessToken } from '@/lib/services/token-manager';
import { EmailStyleProfile, getEmailStyle } from '@/lib/services/email-style-learner';
import { EmailClassification, EmailToClassify, classifyEmail } from '@/lib/services/email-classifier';

// =========================================================================
// TYPES
// =========================================================================

export interface OriginalEmail {
  messageId: string;
  threadId: string;
  from: string;
  fromName?: string;
  to: string;
  subject: string;
  body: string;
  snippet?: string;
  labels: string[];
  receivedAt: Date;
}

export interface GeneratedDraft {
  subject: string;
  body: string;
  htmlBody?: string;
  reasoning: string;
}

export interface DraftSettings {
  autoCreateInGmail: boolean;
  requireApproval: boolean;
  maxResponseLength: number;
  includeSignature: boolean;
  signatureText?: string;
}

export interface MemoryContext {
  facts: Array<{ category: string; factKey: string; factValue: string }>;
  style?: { verbosity: string; tone: string };
  recentTopics?: string[];
}

// =========================================================================
// STATE DEFINITION
// =========================================================================

const EmailDraftStateAnnotation = Annotation.Root({
  // Input
  taskId: Annotation<string>(),
  userEmail: Annotation<string>(),
  userCode: Annotation<string | undefined>(),
  originalEmail: Annotation<OriginalEmail>(),

  // Context
  emailStyle: Annotation<EmailStyleProfile | null>({
    reducer: (_, y) => y,
    default: () => null,
  }),
  memoryContext: Annotation<MemoryContext | null>({
    reducer: (_, y) => y,
    default: () => null,
  }),
  settings: Annotation<DraftSettings>({
    reducer: (_, y) => y,
    default: () => ({
      autoCreateInGmail: true,
      requireApproval: false,
      maxResponseLength: 500,
      includeSignature: true,
    }),
  }),

  // Classification
  classification: Annotation<EmailClassification | null>({
    reducer: (_, y) => y,
    default: () => null,
  }),

  // Draft Generation
  generatedDraft: Annotation<GeneratedDraft | null>({
    reducer: (_, y) => y,
    default: () => null,
  }),

  // Gmail Integration
  gmailDraftId: Annotation<string | null>({
    reducer: (_, y) => y,
    default: () => null,
  }),
  draftRecordId: Annotation<string | null>({
    reducer: (_, y) => y,
    default: () => null,
  }),

  // Status
  status: Annotation<
    'initializing' | 'classifying' | 'generating' | 'creating_draft' | 'completed' | 'skipped' | 'failed'
  >({
    reducer: (_, y) => y,
    default: () => 'initializing' as const,
  }),
  error: Annotation<string | null>({
    reducer: (_, y) => y,
    default: () => null,
  }),

  // Execution tracking
  reasoning: Annotation<string[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
});

type EmailDraftState = typeof EmailDraftStateAnnotation.State;

// =========================================================================
// GMAIL HELPERS
// =========================================================================

async function createGmailClient(
  userEmail: string,
  userCode?: string
): Promise<gmail_v1.Gmail | null> {
  const { token, error } = await getAccessToken(userEmail, 'gmail', userCode);
  if (!token || error) {
    console.error('[EmailDraftAgent] Failed to get Gmail token:', error);
    return null;
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ access_token: token });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

/**
 * Create a draft in Gmail
 * IMPORTANT: This does NOT mark the original email as read
 */
async function createGmailDraft(
  gmail: gmail_v1.Gmail,
  originalEmail: OriginalEmail,
  draft: GeneratedDraft
): Promise<string | null> {
  try {
    // Build RFC 2822 message
    const message = [
      `To: ${originalEmail.from}`,
      `Subject: ${draft.subject}`,
      `In-Reply-To: ${originalEmail.messageId}`,
      `References: ${originalEmail.messageId}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      draft.body,
    ].join('\r\n');

    const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const response = await gmail.users.drafts.create({
      userId: 'me',
      requestBody: {
        message: {
          raw: encodedMessage,
          threadId: originalEmail.threadId,
        },
      },
    });

    return response.data.id || null;
  } catch (error) {
    console.error('[EmailDraftAgent] Failed to create Gmail draft:', error);
    return null;
  }
}

// =========================================================================
// DATABASE OPERATIONS
// =========================================================================

async function storeEmailDraft(
  userEmail: string,
  originalEmail: OriginalEmail,
  draft: GeneratedDraft,
  classification: EmailClassification | null,
  gmailDraftId: string | null,
  userCode?: string
): Promise<string | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('email_drafts')
    .insert({
      user_email: userEmail,
      user_code: userCode || null,
      original_message_id: originalEmail.messageId,
      original_thread_id: originalEmail.threadId,
      original_subject: originalEmail.subject,
      original_from: originalEmail.from,
      original_from_name: originalEmail.fromName || null,
      original_snippet: originalEmail.snippet || null,
      original_received_at: originalEmail.receivedAt.toISOString(),
      original_labels: originalEmail.labels,
      gmail_draft_id: gmailDraftId,
      draft_subject: draft.subject,
      draft_body: draft.body,
      draft_html_body: draft.htmlBody || null,
      email_type: classification?.emailType || null,
      urgency_level: classification?.urgencyLevel || null,
      classification_reasoning: classification?.reasoning || null,
      response_points: classification?.suggestedResponsePoints || [],
      confidence_score: classification?.confidence || null,
      status: gmailDraftId ? 'created' : 'pending',
      reasoning_steps: [draft.reasoning],
      generation_model: 'claude-sonnet-4-20250514',
      gmail_created_at: gmailDraftId ? new Date().toISOString() : null,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
    })
    .select('id')
    .single();

  if (error) {
    console.error('[EmailDraftAgent] Failed to store draft:', error);
    return null;
  }

  return data?.id || null;
}

async function getUserSettings(userEmail: string, userCode?: string): Promise<DraftSettings> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from('email_draft_settings')
    .select('*')
    .eq('user_email', userEmail)
    .maybeSingle();

  if (!data) {
    return {
      autoCreateInGmail: true,
      requireApproval: false,
      maxResponseLength: 500,
      includeSignature: true,
    };
  }

  return {
    autoCreateInGmail: data.auto_draft_enabled ?? true,
    requireApproval: data.require_approval ?? false,
    maxResponseLength: data.max_response_length ?? 500,
    includeSignature: data.include_signature ?? true,
    signatureText: data.signature_text || undefined,
  };
}

async function getUserMemoryContext(userEmail: string): Promise<MemoryContext | null> {
  const supabase = createAdminClient();

  try {
    const { data: facts } = await supabase
      .from('user_learned_facts')
      .select('category, fact_key, fact_value')
      .eq('user_email', userEmail)
      .limit(20);

    if (!facts || facts.length === 0) {
      return null;
    }

    return {
      facts: facts.map((f) => ({
        category: f.category,
        factKey: f.fact_key,
        factValue: f.fact_value,
      })),
    };
  } catch {
    return null;
  }
}

// =========================================================================
// DRAFT GENERATION WITH CLAUDE
// =========================================================================

async function generateDraftWithClaude(
  originalEmail: OriginalEmail,
  classification: EmailClassification,
  emailStyle: EmailStyleProfile | null,
  memoryContext: MemoryContext | null,
  settings: DraftSettings
): Promise<GeneratedDraft> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  // Build style guidance
  let styleGuidance = '';
  if (emailStyle) {
    styleGuidance = `
## User's Writing Style (IMPORTANT - Match this exactly)
- Greeting patterns: ${emailStyle.greetingPatterns.join(', ') || 'Standard greetings'}
- Sign-off patterns: ${emailStyle.signoffPatterns.join(', ') || 'Standard sign-offs'}
- Tone: ${emailStyle.toneProfile.formality > 0.6 ? 'Formal' : emailStyle.toneProfile.formality > 0.4 ? 'Semi-formal' : 'Casual'}
- Warmth: ${emailStyle.toneProfile.warmth > 0.6 ? 'Warm and friendly' : emailStyle.toneProfile.warmth > 0.4 ? 'Professional but personable' : 'Direct and business-like'}
- Verbosity: ${emailStyle.verbosityLevel}
- Average email length: ~${emailStyle.avgEmailLength} words
- Uses emojis: ${emailStyle.usesEmojis ? 'Yes, occasionally' : 'No'}
- Uses bullet points: ${emailStyle.usesBulletPoints ? 'Yes, when listing' : 'Rarely'}
- Common phrases: ${emailStyle.commonPhrases.slice(0, 5).join(', ') || 'N/A'}
`;
  }

  // Build memory context
  let memoryGuidance = '';
  if (memoryContext && memoryContext.facts.length > 0) {
    memoryGuidance = `
## Known Facts About the User
${memoryContext.facts.map((f) => `- ${f.factKey}: ${f.factValue}`).join('\n')}
`;
  }

  // Build signature
  let signatureText = '';
  if (settings.includeSignature && settings.signatureText) {
    signatureText = `\n\n${settings.signatureText}`;
  }

  const prompt = `You are drafting an email response on behalf of the user. Your goal is to sound EXACTLY like the user would write it.

## Original Email to Respond To
FROM: ${originalEmail.from}
SUBJECT: ${originalEmail.subject}
BODY:
${originalEmail.body.slice(0, 2000)}

## Classification
Type: ${classification.emailType}
Urgency: ${classification.urgencyLevel}
Key points to address:
${classification.suggestedResponsePoints.map((p) => `- ${p}`).join('\n')}

${styleGuidance}

${memoryGuidance}

## Instructions
1. Draft a response that addresses ALL the points requiring response
2. Match the user's writing style EXACTLY (greeting, tone, sign-off)
3. Keep the response ${settings.maxResponseLength < 200 ? 'brief' : settings.maxResponseLength < 400 ? 'moderate length' : 'detailed as needed'}
4. Be helpful and complete - don't leave anything unanswered
5. Sound natural and human - avoid AI-like language
${settings.includeSignature ? '6. Do NOT include a signature - it will be added automatically' : ''}

Respond with JSON:
{
  "subject": "Re: [original subject or modified if needed]",
  "body": "The email body text",
  "reasoning": "Brief explanation of your draft approach"
}

Respond with ONLY the JSON object.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Add signature if enabled
    let body = parsed.body || '';
    if (settings.includeSignature && settings.signatureText) {
      body += `\n\n${settings.signatureText}`;
    }

    return {
      subject: parsed.subject || `Re: ${originalEmail.subject}`,
      body,
      reasoning: parsed.reasoning || 'Generated draft response',
    };
  } catch (error) {
    console.error('[EmailDraftAgent] Claude generation failed:', error);
    throw error;
  }
}

// =========================================================================
// AGENT NODES
// =========================================================================

/**
 * Initialize node - Load user style, memory, and settings
 */
async function initializeNode(state: EmailDraftState): Promise<Partial<EmailDraftState>> {
  console.log('[EmailDraftAgent] Initializing...');

  const [emailStyle, memoryContext, settings] = await Promise.all([
    getEmailStyle(state.userEmail, state.userCode),
    getUserMemoryContext(state.userEmail),
    getUserSettings(state.userEmail, state.userCode),
  ]);

  return {
    emailStyle,
    memoryContext,
    settings,
    status: 'classifying',
    reasoning: ['Loaded user email style, memory context, and settings'],
  };
}

/**
 * Classify node - Determine if email needs response
 */
async function classifyNode(state: EmailDraftState): Promise<Partial<EmailDraftState>> {
  console.log('[EmailDraftAgent] Classifying email...');

  const emailToClassify: EmailToClassify = {
    ...state.originalEmail,
    isUnread: true,
  };

  const classification = await classifyEmail(emailToClassify, {
    onlyPrimaryInbox: true,
    minConfidence: 0.5,
  });

  if (!classification.needsResponse) {
    return {
      classification,
      status: 'skipped',
      reasoning: [`Email does not need response: ${classification.reasoning}`],
    };
  }

  return {
    classification,
    status: 'generating',
    reasoning: [`Email classified as ${classification.emailType} with ${classification.urgencyLevel} urgency`],
  };
}

/**
 * Generate node - Create draft response
 */
async function generateNode(state: EmailDraftState): Promise<Partial<EmailDraftState>> {
  console.log('[EmailDraftAgent] Generating draft...');

  if (!state.classification) {
    return {
      status: 'failed',
      error: 'No classification available',
    };
  }

  try {
    const draft = await generateDraftWithClaude(
      state.originalEmail,
      state.classification,
      state.emailStyle,
      state.memoryContext,
      state.settings
    );

    return {
      generatedDraft: draft,
      status: 'creating_draft',
      reasoning: [`Generated draft: ${draft.reasoning}`],
    };
  } catch (error) {
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Draft generation failed',
    };
  }
}

/**
 * Create Gmail Draft node - Save draft to Gmail
 */
async function createDraftNode(state: EmailDraftState): Promise<Partial<EmailDraftState>> {
  console.log('[EmailDraftAgent] Creating Gmail draft...');

  if (!state.generatedDraft) {
    return {
      status: 'failed',
      error: 'No draft to create',
    };
  }

  let gmailDraftId: string | null = null;

  // Create Gmail draft if enabled and not requiring approval
  if (state.settings.autoCreateInGmail && !state.settings.requireApproval) {
    const gmail = await createGmailClient(state.userEmail, state.userCode);
    if (gmail) {
      gmailDraftId = await createGmailDraft(gmail, state.originalEmail, state.generatedDraft);
    }
  }

  // Store in database
  const draftRecordId = await storeEmailDraft(
    state.userEmail,
    state.originalEmail,
    state.generatedDraft,
    state.classification,
    gmailDraftId,
    state.userCode
  );

  return {
    gmailDraftId,
    draftRecordId,
    status: 'completed',
    reasoning: [
      gmailDraftId
        ? `Created Gmail draft (ID: ${gmailDraftId})`
        : 'Stored draft locally (Gmail creation skipped or failed)',
    ],
  };
}

// =========================================================================
// ROUTING LOGIC
// =========================================================================

function routeAfterClassify(state: EmailDraftState): string {
  if (state.status === 'skipped') {
    return END;
  }
  return 'generate';
}

function routeAfterGenerate(state: EmailDraftState): string {
  if (state.status === 'failed') {
    return END;
  }
  return 'create_draft';
}

// =========================================================================
// AGENT CREATION
// =========================================================================

export function createEmailDraftAgent() {
  const workflow = new StateGraph(EmailDraftStateAnnotation)
    .addNode('initialize', initializeNode)
    .addNode('classify', classifyNode)
    .addNode('generate', generateNode)
    .addNode('create_draft', createDraftNode)
    .addEdge(START, 'initialize')
    .addEdge('initialize', 'classify')
    .addConditionalEdges('classify', routeAfterClassify)
    .addConditionalEdges('generate', routeAfterGenerate)
    .addEdge('create_draft', END);

  return workflow.compile();
}

// =========================================================================
// MAIN EXPORT - Run Agent
// =========================================================================

export interface EmailDraftResult {
  success: boolean;
  skipped: boolean;
  draftId?: string;
  gmailDraftId?: string;
  draft?: GeneratedDraft;
  classification?: EmailClassification;
  error?: string;
  reasoning: string[];
}

/**
 * Run the email draft agent to generate a response
 *
 * @param userEmail - User's email
 * @param originalEmail - The email to respond to
 * @param userCode - Optional user code
 * @returns Draft result
 */
export async function runEmailDraftAgent(
  userEmail: string,
  originalEmail: OriginalEmail,
  userCode?: string
): Promise<EmailDraftResult> {
  console.log(`[EmailDraftAgent] Starting for ${userEmail}, email: ${originalEmail.subject}`);

  const agent = createEmailDraftAgent();

  const initialState = {
    taskId: `draft_${originalEmail.messageId}_${Date.now()}`,
    userEmail,
    userCode,
    originalEmail,
  };

  try {
    const result = await agent.invoke(initialState);

    return {
      success: result.status === 'completed',
      skipped: result.status === 'skipped',
      draftId: result.draftRecordId || undefined,
      gmailDraftId: result.gmailDraftId || undefined,
      draft: result.generatedDraft || undefined,
      classification: result.classification || undefined,
      error: result.error || undefined,
      reasoning: result.reasoning,
    };
  } catch (error) {
    console.error('[EmailDraftAgent] Agent execution failed:', error);
    return {
      success: false,
      skipped: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      reasoning: ['Agent execution failed'],
    };
  }
}
