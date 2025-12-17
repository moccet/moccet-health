/**
 * Email Classifier Service
 *
 * Determines if an email requires a response and classifies its type.
 * Uses a combination of heuristics and AI analysis.
 * Maps classifications to Moccet labels for Gmail integration.
 *
 * @module lib/services/email-classifier
 */

import OpenAI from 'openai';
import { MoccetLabelName } from '@/lib/services/gmail-label-manager';

// =========================================================================
// TYPES
// =========================================================================

export interface EmailClassification {
  needsResponse: boolean;
  emailType: 'question' | 'request' | 'action_item' | 'follow_up' | 'informational' | 'spam';
  urgencyLevel: 'low' | 'medium' | 'high';
  keyPoints: string[];
  suggestedResponsePoints: string[];
  confidence: number;
  reasoning: string;
}

export interface LabeledEmailClassification extends EmailClassification {
  moccetLabel: MoccetLabelName;
  labelSource: 'ai' | 'heuristic';
  labelReasoning: string;
}

export interface EmailToClassify {
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
  isUnread: boolean;
}

export interface ClassificationOptions {
  onlyPrimaryInbox?: boolean;
  minConfidence?: number;
  checkKnownSender?: boolean;
  knownSenders?: string[];
}

// =========================================================================
// HEURISTIC CHECKS (Fast pre-filtering)
// =========================================================================

/**
 * Quick heuristic check to determine if email likely needs response
 * Returns early for obvious cases to save API calls
 */
function quickHeuristicCheck(email: EmailToClassify): {
  skip: boolean;
  reason?: string;
} {
  const subject = email.subject.toLowerCase();
  const body = email.body.toLowerCase();
  const from = email.from.toLowerCase();

  // Skip automated/no-reply emails
  if (
    from.includes('noreply') ||
    from.includes('no-reply') ||
    from.includes('donotreply') ||
    from.includes('notifications@') ||
    from.includes('mailer-daemon')
  ) {
    return { skip: true, reason: 'Automated sender' };
  }

  // Skip newsletter/marketing
  if (
    subject.includes('unsubscribe') ||
    body.includes('unsubscribe from this list') ||
    body.includes('click here to unsubscribe')
  ) {
    return { skip: true, reason: 'Newsletter/marketing' };
  }

  // Skip receipts and confirmations
  if (
    subject.includes('order confirmation') ||
    subject.includes('your receipt') ||
    subject.includes('payment received') ||
    subject.includes('shipping notification')
  ) {
    return { skip: true, reason: 'Receipt/confirmation' };
  }

  // Skip calendar notifications
  if (
    subject.includes('invitation:') ||
    subject.includes('event canceled') ||
    subject.includes('event updated')
  ) {
    return { skip: true, reason: 'Calendar notification' };
  }

  return { skip: false };
}

/**
 * Check if email is in Primary inbox (not Promotions, Social, etc.)
 */
function isPrimaryInbox(labels: string[]): boolean {
  // Gmail labels: INBOX, CATEGORY_PERSONAL, CATEGORY_SOCIAL, CATEGORY_PROMOTIONS, CATEGORY_UPDATES, CATEGORY_FORUMS
  const promotionalLabels = [
    'CATEGORY_PROMOTIONS',
    'CATEGORY_SOCIAL',
    'CATEGORY_UPDATES',
    'CATEGORY_FORUMS',
    'SPAM',
    'TRASH',
  ];

  const hasPromotional = labels.some((label) => promotionalLabels.includes(label));
  const hasInbox = labels.includes('INBOX');

  // Primary = in INBOX but not in promotional categories
  // Or explicitly marked as CATEGORY_PERSONAL
  return hasInbox && !hasPromotional;
}

/**
 * Quick check for question indicators
 */
function hasQuestionIndicators(text: string): boolean {
  const questionPatterns = [
    /\?/,
    /\bwhat\b/i,
    /\bhow\b/i,
    /\bwhen\b/i,
    /\bwhere\b/i,
    /\bwhy\b/i,
    /\bwho\b/i,
    /\bwhich\b/i,
    /\bcan you\b/i,
    /\bcould you\b/i,
    /\bwould you\b/i,
    /\bdo you\b/i,
    /\bare you\b/i,
    /\bis there\b/i,
    /\blet me know\b/i,
    /\bthoughts\??\b/i,
    /\bif that'?s? ok\b/i,
    /\bif that works\b/i,
    /\bdoes that work\b/i,
    /\bsound good\b/i,
    /\bsounds good\?/i,
    /\bwork for you\b/i,
    /\bavailable\b/i,
    /\bconfirm\b/i,
    /\bget back to\b/i,
  ];

  return questionPatterns.some((pattern) => pattern.test(text));
}

/**
 * Quick check for request indicators
 */
function hasRequestIndicators(text: string): boolean {
  const requestPatterns = [
    /\bplease\b/i,
    /\bcould you\b/i,
    /\bcan you\b/i,
    /\bwould you\b/i,
    /\bi need\b/i,
    /\bwould like\b/i,
    /\brequest\b/i,
    /\baction required\b/i,
    /\basap\b/i,
    /\burgent\b/i,
    /\bby (?:today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}\/\d{1,2})\b/i,
    /\bdeadline\b/i,
  ];

  return requestPatterns.some((pattern) => pattern.test(text));
}

/**
 * Check urgency level based on text
 */
function detectUrgencyLevel(text: string, subject: string): 'low' | 'medium' | 'high' {
  const highUrgencyPatterns = [
    /\bURGENT\b/i,
    /\bASAP\b/i,
    /\bimmediate(?:ly)?\b/i,
    /\bcritical\b/i,
    /\bemergency\b/i,
    /\btime.?sensitive\b/i,
    /\bby (?:today|EOD|end of day)\b/i,
  ];

  const mediumUrgencyPatterns = [
    /\bimportant\b/i,
    /\bpriority\b/i,
    /\bby tomorrow\b/i,
    /\bby (?:monday|tuesday|wednesday|thursday|friday)\b/i,
    /\bfollow.?up\b/i,
    /\breminder\b/i,
    /\bpending\b/i,
  ];

  const combinedText = `${subject} ${text}`;

  if (highUrgencyPatterns.some((p) => p.test(combinedText))) {
    return 'high';
  }

  if (mediumUrgencyPatterns.some((p) => p.test(combinedText))) {
    return 'medium';
  }

  return 'low';
}

// =========================================================================
// LABEL-SPECIFIC HEURISTIC DETECTION
// =========================================================================

/**
 * Detect if email is an automated notification
 */
function detectNotificationEmail(email: EmailToClassify): boolean {
  const from = email.from.toLowerCase();
  const subject = email.subject.toLowerCase();

  const notificationSenders = [
    'noreply', 'no-reply', 'donotreply', 'notifications@', 'alert@', 'alerts@',
    'notify@', 'notification@', 'system@', 'automated@', 'mailer-daemon',
    'postmaster@', 'bounce@', 'support@', 'info@', 'admin@',
  ];

  const notificationSubjects = [
    'password reset', 'verify your', 'confirm your', 'your export',
    'security alert', 'login attempt', 'account activity', 'subscription',
    'your order', 'shipping update', 'delivery', 'receipt',
  ];

  const isNotificationSender = notificationSenders.some((s) => from.includes(s));
  const isNotificationSubject = notificationSubjects.some((s) => subject.includes(s));

  return isNotificationSender || isNotificationSubject;
}

/**
 * Detect if email is a comment/mention from collaborative tools
 */
function detectCommentEmail(email: EmailToClassify): boolean {
  const from = email.from.toLowerCase();
  const subject = email.subject.toLowerCase();
  const body = email.body.toLowerCase();

  const commentSenders = [
    'docs-noreply@google.com', 'comments-noreply@google.com',
    'notify@figma.com', 'noreply@notion.so', 'notifications@linear.app',
    'noreply@asana.com', 'noreply@monday.com', 'noreply@trello.com',
    'noreply@miro.com', 'no-reply@slack.com', 'notifications@github.com',
    'jira@', 'confluence@', '@atlassian.net', '@clickup.com',
  ];

  const commentPatterns = [
    /mentioned you/i, /commented on/i, /replied to your comment/i,
    /assigned you/i, /tagged you/i, /shared.*with you/i,
    /left a comment/i, /new comment/i, /added a comment/i,
  ];

  const isCommentSender = commentSenders.some((s) => from.includes(s));
  const hasCommentPattern = commentPatterns.some((p) => p.test(subject) || p.test(body));

  return isCommentSender || hasCommentPattern;
}

/**
 * Detect if email is a calendar/meeting update
 */
function detectMeetingUpdateEmail(email: EmailToClassify): boolean {
  const subject = email.subject.toLowerCase();
  const from = email.from.toLowerCase();

  const meetingPatterns = [
    /^invitation:/i, /^updated invitation:/i, /^canceled:/i,
    /^accepted:/i, /^declined:/i, /^tentative:/i,
    /event (updated|canceled|cancelled)/i, /meeting (request|invite)/i,
    /calendar invite/i, /rescheduled/i, /new time/i,
  ];

  const calendarSenders = [
    'calendar-notification@google.com', 'noreply@calendar.google.com',
    '@outlook.com', '@microsoft.com', 'calendly', 'cal.com',
  ];

  const isMeetingSubject = meetingPatterns.some((p) => p.test(subject));
  const isCalendarSender = calendarSenders.some((s) => from.includes(s));

  return isMeetingSubject || isCalendarSender;
}

/**
 * Detect if email is marketing/promotional
 */
function detectMarketingEmail(email: EmailToClassify): boolean {
  const subject = email.subject.toLowerCase();
  const body = email.body.toLowerCase();
  const labels = email.labels;

  // Check Gmail category
  if (labels.includes('CATEGORY_PROMOTIONS')) {
    return true;
  }

  const marketingPatterns = [
    /unsubscribe/i, /opt.?out/i, /manage.*preferences/i,
    /\d+%\s*off/i, /sale/i, /deal/i, /discount/i,
    /limited time/i, /exclusive offer/i, /don't miss/i,
    /newsletter/i, /weekly digest/i, /monthly update/i,
  ];

  return marketingPatterns.some((p) => p.test(subject) || p.test(body));
}

/**
 * Detect if email indicates conversation is finished (Actioned)
 */
function detectActionedEmail(email: EmailToClassify): boolean {
  const body = email.body.toLowerCase().trim();
  const subject = email.subject.toLowerCase();

  // Short acknowledgment patterns (typically < 100 chars)
  const shortAcknowledgments = body.length < 150;

  const closurePatterns = [
    /^thanks?[!.\s]*$/i, /^thank you[!.\s]*$/i, /^cheers[!.\s]*$/i,
    /^got it[!.\s]*$/i, /^will do[!.\s]*$/i, /^sounds good[!.\s]*$/i,
    /^perfect[!.\s]*$/i, /^great[!.\s]*$/i, /^awesome[!.\s]*$/i,
    /all good/i, /no further action/i, /this is resolved/i,
    /issue fixed/i, /problem solved/i, /that's all/i,
    /^approved[!.\s]*$/i, /^confirmed[!.\s]*$/i, /^done[!.\s]*$/i,
    /^completed[!.\s]*$/i, /^noted[!.\s]*$/i, /^received[!.\s]*$/i,
  ];

  // Closure with thanks pattern
  const thanksWithClosure = /thank.*(?:all good|perfect|great|sorted|resolved)/i.test(body);

  // Check for closure patterns
  const hasClosure = closurePatterns.some((p) => p.test(body));

  // Short acknowledgment with closure-like content
  if (shortAcknowledgments && hasClosure) {
    return true;
  }

  if (thanksWithClosure) {
    return true;
  }

  return false;
}

/**
 * Map classification result to Moccet label using heuristics
 */
function mapToLabelHeuristic(
  email: EmailToClassify,
  classification: EmailClassification
): { label: MoccetLabelName; reasoning: string } {
  // Check specific types first (order matters - more specific first)

  // 1. Meeting updates
  if (detectMeetingUpdateEmail(email)) {
    return { label: 'meeting_update', reasoning: 'Calendar/meeting related email' };
  }

  // 2. Comments from collaborative tools
  if (detectCommentEmail(email)) {
    return { label: 'comment', reasoning: 'Comment/mention from collaborative tool' };
  }

  // 3. Marketing/promotional
  if (detectMarketingEmail(email)) {
    return { label: 'marketing', reasoning: 'Marketing/promotional content' };
  }

  // 4. Automated notifications
  if (detectNotificationEmail(email)) {
    return { label: 'notifications', reasoning: 'Automated system notification' };
  }

  // 5. Actioned/closed conversation
  if (detectActionedEmail(email)) {
    return { label: 'actioned', reasoning: 'Conversation appears resolved' };
  }

  // 6. Based on classification result
  if (classification.needsResponse) {
    return { label: 'to_respond', reasoning: 'Requires reply or action' };
  }

  // 7. Default to FYI
  return { label: 'fyi', reasoning: 'Informational, no response needed' };
}

// =========================================================================
// AI CLASSIFICATION
// =========================================================================

/**
 * Use OpenAI to classify email and extract key points
 */
async function classifyWithAI(email: EmailToClassify): Promise<EmailClassification> {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const systemPrompt = `You are an email classifier. Analyze emails and determine if they require a response.

IMPORTANT - Be LIBERAL about what needs a response:
- If there's ANY question mark (?), it needs a response
- If someone is confirming something ("is that ok?", "does that work?", "if that's ok"), it needs a response
- Short emails with questions still need responses
- Calendar invite confirmations asking for confirmation need a response
- Simple yes/no questions still need a response
- Only skip OBVIOUS automated emails (receipts, shipping notifications, newsletters, noreply senders)
- When in doubt, mark needsResponse as TRUE

Respond with ONLY a JSON object.`;

  const userPrompt = `Analyze this email:

FROM: ${email.from}
SUBJECT: ${email.subject}
BODY:
${email.body.slice(0, 2000)}

Respond with JSON:
{
  "needsResponse": true/false,
  "emailType": "question" | "request" | "action_item" | "follow_up" | "informational",
  "urgencyLevel": "low" | "medium" | "high",
  "keyPoints": ["main points"],
  "suggestedResponsePoints": ["what to address in response"],
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 1000,
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response content');
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON');
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('[EmailClassifier] OpenAI classification failed:', error);
    // Fall back to heuristic-only classification
    return heuristicClassification(email);
  }
}

/**
 * Fallback heuristic classification when AI is unavailable
 */
function heuristicClassification(email: EmailToClassify): EmailClassification {
  const combinedText = `${email.subject} ${email.body}`;
  const hasQuestions = hasQuestionIndicators(combinedText);
  const hasRequests = hasRequestIndicators(combinedText);
  const urgency = detectUrgencyLevel(email.body, email.subject);

  let emailType: EmailClassification['emailType'] = 'informational';
  if (hasQuestions) emailType = 'question';
  else if (hasRequests) emailType = 'request';

  const needsResponse = hasQuestions || hasRequests;

  return {
    needsResponse,
    emailType,
    urgencyLevel: urgency,
    keyPoints: [],
    suggestedResponsePoints: [],
    confidence: 0.6, // Lower confidence for heuristic-only
    reasoning: `Heuristic analysis: ${hasQuestions ? 'Contains questions. ' : ''}${hasRequests ? 'Contains requests. ' : ''}${!hasQuestions && !hasRequests ? 'No clear action items detected.' : ''}`,
  };
}

// =========================================================================
// MAIN EXPORT
// =========================================================================

/**
 * Classify an email to determine if it needs a response
 *
 * @param email - Email to classify
 * @param options - Classification options
 * @returns Classification result
 */
export async function classifyEmail(
  email: EmailToClassify,
  options?: ClassificationOptions
): Promise<EmailClassification> {
  const {
    onlyPrimaryInbox = true,
    minConfidence = 0.5,
    checkKnownSender = false,
    knownSenders = [],
  } = options || {};

  console.log(`[EmailClassifier] Classifying email: ${email.subject}`);

  // Quick heuristic pre-filter
  const heuristic = quickHeuristicCheck(email);
  if (heuristic.skip) {
    console.log(`[EmailClassifier] Skipped: ${heuristic.reason}`);
    return {
      needsResponse: false,
      emailType: 'informational',
      urgencyLevel: 'low',
      keyPoints: [],
      suggestedResponsePoints: [],
      confidence: 0.95,
      reasoning: heuristic.reason || 'Automated/marketing email',
    };
  }

  // Check if in Primary inbox
  if (onlyPrimaryInbox && !isPrimaryInbox(email.labels)) {
    console.log('[EmailClassifier] Skipped: Not in Primary inbox');
    return {
      needsResponse: false,
      emailType: 'informational',
      urgencyLevel: 'low',
      keyPoints: [],
      suggestedResponsePoints: [],
      confidence: 0.9,
      reasoning: 'Email is not in Primary inbox (promotional/social/updates)',
    };
  }

  // Check known sender if required
  if (checkKnownSender && knownSenders.length > 0) {
    const fromEmail = email.from.match(/<(.+)>/)?.[1] || email.from;
    const isKnown = knownSenders.some(
      (sender) =>
        fromEmail.toLowerCase().includes(sender.toLowerCase()) ||
        sender.toLowerCase().includes(fromEmail.toLowerCase())
    );
    if (!isKnown) {
      console.log('[EmailClassifier] Skipped: Unknown sender');
      return {
        needsResponse: false,
        emailType: 'informational',
        urgencyLevel: 'low',
        keyPoints: [],
        suggestedResponsePoints: [],
        confidence: 0.8,
        reasoning: 'Sender is not in known contacts list',
      };
    }
  }

  // Use AI classification (OpenAI)
  const classification = await classifyWithAI(email);

  // Check confidence threshold
  if (classification.confidence < minConfidence) {
    console.log(`[EmailClassifier] Low confidence (${classification.confidence}), defaulting to no response`);
    return {
      ...classification,
      needsResponse: false,
      reasoning: `${classification.reasoning} (Low confidence: ${classification.confidence})`,
    };
  }

  console.log(`[EmailClassifier] Result: needsResponse=${classification.needsResponse}, type=${classification.emailType}`);

  return classification;
}

/**
 * Batch classify multiple emails
 */
export async function classifyEmails(
  emails: EmailToClassify[],
  options?: ClassificationOptions
): Promise<Map<string, EmailClassification>> {
  const results = new Map<string, EmailClassification>();

  // Process in parallel batches
  const batchSize = 5;
  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);
    const classifications = await Promise.all(
      batch.map((email) => classifyEmail(email, options))
    );

    batch.forEach((email, index) => {
      results.set(email.messageId, classifications[index]);
    });

    // Small delay between batches
    if (i + batchSize < emails.length) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  return results;
}

// =========================================================================
// LABELED CLASSIFICATION (with Moccet label mapping)
// =========================================================================

/**
 * Classify an email and return with Moccet label
 * This is the main function to use for the labeling system
 */
export async function classifyEmailWithLabeling(
  email: EmailToClassify,
  options?: ClassificationOptions
): Promise<LabeledEmailClassification> {
  // Get base classification
  const classification = await classifyEmail(email, options);

  // Map to Moccet label using heuristics
  const { label, reasoning } = mapToLabelHeuristic(email, classification);

  console.log(`[EmailClassifier] Label: ${label} - ${reasoning}`);

  return {
    ...classification,
    moccetLabel: label,
    labelSource: 'heuristic',
    labelReasoning: reasoning,
  };
}

/**
 * Re-export label detection functions for external use
 */
export {
  detectNotificationEmail,
  detectCommentEmail,
  detectMeetingUpdateEmail,
  detectMarketingEmail,
  detectActionedEmail,
};
