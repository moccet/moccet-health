/**
 * Email Classifier Service
 *
 * Determines if an email requires a response and classifies its type.
 * Uses a combination of heuristics and AI analysis.
 *
 * @module lib/services/email-classifier
 */

import Anthropic from '@anthropic-ai/sdk';

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
// AI CLASSIFICATION
// =========================================================================

/**
 * Use Claude to classify email and extract key points
 */
async function classifyWithClaude(email: EmailToClassify): Promise<EmailClassification> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const prompt = `Analyze this email and determine if it requires a response.

FROM: ${email.from}
SUBJECT: ${email.subject}
BODY:
${email.body.slice(0, 2000)}

Provide your analysis as JSON:
{
  "needsResponse": true/false (Does this email require a reply from the recipient?),
  "emailType": "question" | "request" | "action_item" | "follow_up" | "informational" (What type of email is this?),
  "urgencyLevel": "low" | "medium" | "high" (How urgent is a response?),
  "keyPoints": ["List the main points or questions in the email"],
  "suggestedResponsePoints": ["If needs response, what should the response address?"],
  "confidence": 0.0-1.0 (How confident are you in this classification?),
  "reasoning": "Brief explanation of why this email does/doesn't need a response"
}

Consider:
- Automated notifications, newsletters, and receipts don't need responses
- Questions, requests for action, and deadlines typically need responses
- "FYI" or informational emails usually don't need responses
- Personal/professional emails asking for input need responses

Respond with ONLY the JSON object.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to extract JSON');
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('[EmailClassifier] Claude classification failed:', error);
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

  // Use AI classification
  const classification = await classifyWithClaude(email);

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
