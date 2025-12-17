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
import OpenAI from 'openai';
import { google, gmail_v1 } from 'googleapis';
import { createAdminClient } from '@/lib/supabase/server';
import { getAccessToken } from '@/lib/services/token-manager';
import { EmailStyleProfile, getEmailStyle } from '@/lib/services/email-style-learner';
import { EmailClassification, EmailToClassify, classifyEmail } from '@/lib/services/email-classifier';
import { getUserFineTunedModel } from '@/lib/services/email-fine-tuning';

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

  // Model tracking
  modelUsed: Annotation<string>({
    reducer: (_, y) => y,
    default: () => 'gpt-4o-mini',
  }),
  isFineTuned: Annotation<boolean>({
    reducer: (_, y) => y,
    default: () => false,
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
  modelUsed: string,
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
      generation_model: modelUsed,
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

async function getUserSettings(userEmail: string, _userCode?: string): Promise<DraftSettings> {
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
// DRAFT GENERATION WITH OPENAI (Supports Fine-Tuned Models)
// =========================================================================

const BASE_MODEL = 'gpt-4o-mini';

interface GenerationResult extends GeneratedDraft {
  modelUsed: string;
  isFineTuned: boolean;
}

async function generateDraftWithOpenAI(
  userEmail: string,
  originalEmail: OriginalEmail,
  classification: EmailClassification,
  emailStyle: EmailStyleProfile | null,
  memoryContext: MemoryContext | null,
  settings: DraftSettings
): Promise<GenerationResult> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  // Check for fine-tuned model
  const fineTunedModel = await getUserFineTunedModel(userEmail);
  const modelToUse = fineTunedModel || BASE_MODEL;
  const isFineTuned = !!fineTunedModel;

  console.log(`[EmailDraftAgent] Using model: ${modelToUse} (fine-tuned: ${isFineTuned})`);

  // Build system message - shorter for fine-tuned models since style is learned
  let systemMessage: string;
  if (isFineTuned) {
    systemMessage = `You are an email assistant that writes replies in the user's personal style. Write natural, helpful responses.`;
  } else {
    // For base model, include style guidance
    let styleGuidance = '';
    if (emailStyle) {
      styleGuidance = `
Match the user's writing style:
- Greetings: ${emailStyle.greetingPatterns.join(', ') || 'Standard'}
- Sign-offs: ${emailStyle.signoffPatterns.join(', ') || 'Standard'}
- Tone: ${emailStyle.toneProfile.formality > 0.6 ? 'Formal' : emailStyle.toneProfile.formality > 0.4 ? 'Semi-formal' : 'Casual'}
- Warmth: ${emailStyle.toneProfile.warmth > 0.6 ? 'Warm' : emailStyle.toneProfile.warmth > 0.4 ? 'Professional' : 'Direct'}
- Length: ${emailStyle.verbosityLevel} (~${emailStyle.avgEmailLength} words)
- Uses emojis: ${emailStyle.usesEmojis ? 'Yes' : 'No'}`;
    }

    systemMessage = `You are an email assistant that writes replies matching the user's personal style exactly.
${styleGuidance}

Write natural responses that sound like the user wrote them. Avoid AI-like language.`;
  }

  // Build user prompt
  let userPrompt = `Write a reply to this email.

FROM: ${originalEmail.from}
SUBJECT: ${originalEmail.subject}
BODY: ${originalEmail.body.slice(0, 1500)}

Email Type: ${classification.emailType}
Urgency: ${classification.urgencyLevel}
Key points to address:
${classification.suggestedResponsePoints.map((p) => `- ${p}`).join('\n')}`;

  // Add memory context if available
  if (memoryContext && memoryContext.facts.length > 0) {
    userPrompt += `

Context about user:
${memoryContext.facts.slice(0, 5).map((f) => `- ${f.factKey}: ${f.factValue}`).join('\n')}`;
  }

  userPrompt += `

${settings.includeSignature ? 'Do NOT include a signature - it will be added automatically.' : ''}

Respond with JSON only:
{"subject": "Re: ...", "body": "email body", "reasoning": "brief explanation"}`;

  try {
    const response = await openai.chat.completions.create({
      model: modelToUse,
      max_tokens: 1500,
      temperature: 0.7,
      messages: [
        { role: 'system', content: systemMessage },
        { role: 'user', content: userPrompt },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response content');
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
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
      modelUsed: modelToUse,
      isFineTuned,
    };
  } catch (error) {
    console.error('[EmailDraftAgent] OpenAI generation failed:', error);
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
 * Generate node - Create draft response using OpenAI (with fine-tuned model if available)
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
    const result = await generateDraftWithOpenAI(
      state.userEmail,
      state.originalEmail,
      state.classification,
      state.emailStyle,
      state.memoryContext,
      state.settings
    );

    return {
      generatedDraft: {
        subject: result.subject,
        body: result.body,
        reasoning: result.reasoning,
      },
      modelUsed: result.modelUsed,
      isFineTuned: result.isFineTuned,
      status: 'creating_draft',
      reasoning: [
        `Generated draft using ${result.isFineTuned ? 'fine-tuned' : 'base'} model (${result.modelUsed}): ${result.reasoning}`,
      ],
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
    state.modelUsed,
    state.userCode
  );

  return {
    gmailDraftId,
    draftRecordId,
    status: 'completed',
    reasoning: [
      gmailDraftId
        ? `Created Gmail draft (ID: ${gmailDraftId}) using ${state.isFineTuned ? 'fine-tuned' : 'base'} model`
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
  modelUsed?: string;
  isFineTuned?: boolean;
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
      modelUsed: result.modelUsed || undefined,
      isFineTuned: result.isFineTuned || false,
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
