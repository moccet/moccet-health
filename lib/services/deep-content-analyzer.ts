/**
 * Deep Content Analyzer
 *
 * Advanced analysis of Gmail/Slack content for:
 * - Task extraction (actionable items from messages)
 * - Urgency scoring (AI-ranked priority)
 * - Interruption classification (need now vs FYI)
 * - Response expectation detection
 * - People context (who's asking + relationship)
 *
 * Privacy-conscious: analyzes content, stores structured data, discards raw text.
 */

import OpenAI from 'openai';
import { createAdminClient } from '@/lib/supabase/server';

const openai = new OpenAI();

// ============================================================================
// TYPES
// ============================================================================

export interface ExtractedTask {
  id: string;
  description: string;
  source: 'gmail' | 'slack';
  sourceId?: string; // message ID
  requester?: string; // who asked
  requesterRole?: 'manager' | 'peer' | 'direct_report' | 'external' | 'unknown';
  deadline?: string; // ISO date or relative ("EOD", "Friday")
  urgency: 'critical' | 'high' | 'medium' | 'low';
  urgencyScore: number; // 0-100
  category: 'review' | 'respond' | 'create' | 'meeting' | 'decision' | 'info' | 'other';
  status: 'pending' | 'acknowledged' | 'completed' | 'dismissed';
  extractedAt: string;
  expiresAt?: string; // when task becomes stale
}

export interface MessageUrgency {
  messageId: string;
  source: 'gmail' | 'slack';
  urgencyScore: number; // 0-100
  urgencyLevel: 'critical' | 'high' | 'medium' | 'low' | 'fyi';
  responseExpectation: 'immediate' | 'same_day' | 'within_week' | 'no_response' | 'unknown';
  reasoning: string;
  requester?: string;
  detectedAt: string;
}

export interface InterruptionEvent {
  id: string;
  source: 'gmail' | 'slack';
  timestamp: string;
  channel?: string;
  requester?: string;
  type: 'urgent_request' | 'question' | 'fyi' | 'social' | 'automated';
  requiresResponse: boolean;
  expectedResponseTime?: string; // "immediately", "within hour", "today", "this week"
  interruptionScore: number; // 0-100 (how disruptive)
  content_summary: string; // brief summary, no raw text
}

export interface PersonContext {
  name: string;
  email?: string;
  slackId?: string;
  relationship: 'manager' | 'peer' | 'direct_report' | 'external' | 'unknown';
  communicationFrequency: 'daily' | 'weekly' | 'monthly' | 'rare';
  avgUrgencyOfRequests: number; // 0-100
  typicalResponseExpectation: string;
  lastInteraction?: string;
  messageCount: number;
}

// Stress and emotional context from communications
export interface StressIndicators {
  overallStressLevel: 'low' | 'moderate' | 'high' | 'overwhelming';
  stressScore: number; // 0-100
  pressureSources: Array<{
    source: string; // person, project, or situation
    type: 'deadline' | 'person' | 'workload' | 'conflict' | 'uncertainty';
    intensity: 'low' | 'medium' | 'high';
    description: string;
  }>;
  emotionalTone: 'positive' | 'neutral' | 'stressed' | 'overwhelmed';
  supportiveInsight: string; // empathetic observation
  actionableSteps: string[]; // 2-3 concrete things they can do
  affirmation: string; // positive, encouraging message
}

export interface DeepContentAnalysis {
  // Extracted tasks that need attention
  pendingTasks: ExtractedTask[];

  // Urgency analysis of recent messages
  urgentMessages: MessageUrgency[];

  // Stress and emotional context (wellness coaching)
  stressIndicators?: StressIndicators;

  // Interruption patterns
  interruptionSummary: {
    totalInterruptions: number;
    urgentInterruptions: number;
    avgInterruptionsPerDay: number;
    peakInterruptionHours: string[];
    topInterrupters: string[];
  };

  // People context
  keyPeople: PersonContext[];

  // Active projects/threads
  activeThreads: {
    topic: string;
    participants: string[];
    lastActivity: string;
    urgency: 'high' | 'medium' | 'low';
    pendingActions: string[];
  }[];

  // Response debt (messages awaiting response)
  responseDebt: {
    count: number;
    oldestPending: string;
    highPriorityCount: number;
    messages: Array<{
      from: string;
      summary: string;
      receivedAt: string;
      urgency: string;
    }>;
  };

  analyzedAt: string;
  messageCount: number;
  source: 'gmail' | 'slack' | 'combined';
}

// ============================================================================
// MAIN ANALYSIS FUNCTIONS
// ============================================================================

/**
 * Perform deep content analysis on Gmail messages
 */
export async function analyzeGmailDeepContent(
  emails: Array<{
    id: string;
    subject: string;
    snippet?: string;
    from: string;
    timestamp: string;
    isAfterHours: boolean;
    threadId?: string;
    labels?: string[];
  }>,
  userEmail: string
): Promise<DeepContentAnalysis> {
  if (emails.length < 3) {
    return getEmptyDeepAnalysis('gmail', emails.length);
  }

  // Prepare email data for analysis
  const emailsForAnalysis = emails.slice(0, 50).map(e => ({
    id: e.id,
    subject: e.subject,
    snippet: e.snippet?.substring(0, 200) || '',
    from: e.from,
    timestamp: e.timestamp,
    isAfterHours: e.isAfterHours,
  }));

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: getDeepAnalysisSystemPrompt('gmail'),
        },
        {
          role: 'user',
          content: `Analyze these ${emailsForAnalysis.length} emails for the user ${userEmail}:

${JSON.stringify(emailsForAnalysis, null, 2)}

Extract tasks, urgency scores, and interruption patterns. Return JSON only.`,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 2000,
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    return normalizeDeepAnalysis(parsed, 'gmail', emails.length);
  } catch (error) {
    console.error('[Deep Content Analyzer] Gmail analysis error:', error);
    return getEmptyDeepAnalysis('gmail', emails.length);
  }
}

/**
 * Perform deep content analysis on Slack messages
 */
export async function analyzeSlackDeepContent(
  messages: Array<{
    id: string;
    text: string;
    user: string;
    userName?: string;
    channel: string;
    channelName?: string;
    timestamp: string;
    isAfterHours: boolean;
    threadTs?: string;
    mentions?: string[];
  }>,
  currentUserId: string
): Promise<DeepContentAnalysis> {
  if (messages.length < 5) {
    return getEmptyDeepAnalysis('slack', messages.length);
  }

  // Filter to messages that might need response (mentions user or DMs)
  const relevantMessages = messages
    .filter(m =>
      m.mentions?.includes(currentUserId) ||
      m.channel.startsWith('D') || // DMs
      m.text.toLowerCase().includes('?') ||
      m.text.toLowerCase().includes('can you') ||
      m.text.toLowerCase().includes('please')
    )
    .slice(0, 50);

  // Also get a sample of all messages for context
  const contextMessages = messages.slice(0, 30);

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: getDeepAnalysisSystemPrompt('slack'),
        },
        {
          role: 'user',
          content: `Analyze these Slack messages for user ${currentUserId}:

## Messages that may need response:
${JSON.stringify(relevantMessages.map(m => ({
  id: m.id,
  text: m.text.substring(0, 300),
  from: m.userName || m.user,
  channel: m.channelName || m.channel,
  timestamp: m.timestamp,
  isThread: !!m.threadTs,
  isAfterHours: m.isAfterHours,
})), null, 2)}

## Context messages (sample):
${JSON.stringify(contextMessages.map(m => ({
  text: m.text.substring(0, 150),
  from: m.userName || m.user,
  channel: m.channelName || m.channel,
})), null, 2)}

Extract tasks, urgency scores, and interruption patterns. Return JSON only.`,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 2000,
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    return normalizeDeepAnalysis(parsed, 'slack', messages.length);
  } catch (error) {
    console.error('[Deep Content Analyzer] Slack analysis error:', error);
    return getEmptyDeepAnalysis('slack', messages.length);
  }
}

// ============================================================================
// SYSTEM PROMPTS
// ============================================================================

function getDeepAnalysisSystemPrompt(source: 'gmail' | 'slack'): string {
  const sourceSpecific = source === 'gmail'
    ? `Focus on:
- Email subjects and snippets for task detection
- Sender patterns (who sends urgent requests)
- Thread activity (ongoing conversations needing attention)
- Calendar invites and scheduling requests`
    : `Focus on:
- Direct mentions (@user) as potential tasks
- Questions in channels the user participates in
- DMs that may need response
- Thread replies awaiting user input
- Time-sensitive requests`;

  return `You are an expert at analyzing ${source} communications to extract actionable intelligence AND provide emotional support and wellness coaching.

## Your Goals
1. **Extract Tasks**: Identify actionable items the user needs to handle
2. **Score Urgency**: Rate each message's urgency (0-100) with reasoning
3. **Detect Stress & Pressure**: Identify sources of stress, deadline pressure, and emotional tone
4. **Provide Supportive Coaching**: Offer empathetic insights, actionable steps, and positive affirmations
5. **Classify Interruptions**: Categorize messages as urgent_request, question, fyi, social, or automated
6. **Detect Response Expectations**: When does the sender expect a reply?
7. **Identify Key People**: Who communicates most urgently with this user?

${sourceSpecific}

## Stress Detection Guidelines
Look for signals of pressure and stress:
- **Deadline pressure**: Multiple urgent deadlines, "ASAP" requests, overdue items
- **Person pressure**: Demanding requesters, manager escalations, repeated follow-ups
- **Workload pressure**: High volume of tasks, competing priorities, context switching
- **Conflict signals**: Tense language, disagreements, difficult conversations
- **Uncertainty**: Unclear expectations, ambiguous requests, missing information

## Emotional Tone Detection
- **Positive**: Appreciation, good news, celebrations, supportive messages
- **Neutral**: Normal work communications, informational
- **Stressed**: Urgent language, multiple deadlines, pressure signals
- **Overwhelmed**: Too many urgent items, signs of being underwater

## Coaching Response Guidelines
When providing supportive insights:
- Be empathetic and understanding, not judgmental
- Acknowledge the pressure they're facing
- Provide 2-3 specific, actionable steps they can take RIGHT NOW
- End with a genuine, personalized affirmation that builds confidence

## Urgency Scoring Guidelines
- **90-100 (Critical)**: Production issues, executive requests, hard deadlines today
- **70-89 (High)**: Deadlines within 24-48h, blocking issues, manager requests
- **40-69 (Medium)**: Normal work requests, reviews needed this week
- **20-39 (Low)**: FYI items, can wait, nice-to-have
- **0-19 (Informational)**: Newsletters, automated notifications, social

## Response Expectation Detection
- "ASAP", "urgent", "immediately" → immediate
- "by EOD", "today", "when you get a chance today" → same_day
- "this week", "when you have time" → within_week
- No question, FYI, newsletter → no_response

## Task Categories
- **review**: PR reviews, document reviews, approvals needed
- **respond**: Questions requiring answers, requests for input
- **create**: Create document, write code, build something
- **meeting**: Schedule, attend, or prepare for meetings
- **decision**: Make a choice or provide direction
- **info**: Read and acknowledge information
- **other**: Anything else

## Output JSON Schema:
{
  "pendingTasks": [
    {
      "id": "task_1",
      "description": "Review Q1 budget proposal",
      "requester": "Sarah Chen",
      "requesterRole": "manager",
      "deadline": "Friday EOD",
      "urgency": "high",
      "urgencyScore": 75,
      "category": "review",
      "reasoning": "Manager request with end-of-week deadline"
    }
  ],
  "urgentMessages": [
    {
      "messageId": "msg_123",
      "urgencyScore": 85,
      "urgencyLevel": "high",
      "responseExpectation": "same_day",
      "reasoning": "Direct question from team lead about blocking issue",
      "requester": "Mike Johnson"
    }
  ],
  "stressIndicators": {
    "overallStressLevel": "moderate",
    "stressScore": 55,
    "pressureSources": [
      {
        "source": "James",
        "type": "deadline",
        "intensity": "high",
        "description": "The Q4 report deadline is creating time pressure"
      },
      {
        "source": "Multiple PRs awaiting review",
        "type": "workload",
        "intensity": "medium",
        "description": "3 pending code reviews competing for attention"
      }
    ],
    "emotionalTone": "stressed",
    "supportiveInsight": "I notice you're juggling several deadlines right now, especially pressure from James on the Q4 report. That's a lot on your plate, and it's completely normal to feel stretched.",
    "actionableSteps": [
      "Start with a quick 15-min block on James's Q4 report to show progress and ease that pressure",
      "Batch the 3 PR reviews into one focused 30-min session this afternoon",
      "Send a brief status update to James to buy yourself breathing room"
    ],
    "affirmation": "You've navigated tight deadlines before and delivered. One thing at a time - you've got this."
  },
  "interruptionSummary": {
    "totalInterruptions": 15,
    "urgentInterruptions": 3,
    "avgInterruptionsPerDay": 5,
    "peakInterruptionHours": ["10:00-11:00", "14:00-15:00"],
    "topInterrupters": ["Sarah Chen", "Mike Johnson"]
  },
  "keyPeople": [
    {
      "name": "Sarah Chen",
      "relationship": "manager",
      "communicationFrequency": "daily",
      "avgUrgencyOfRequests": 65,
      "typicalResponseExpectation": "same_day",
      "messageCount": 12
    }
  ],
  "activeThreads": [
    {
      "topic": "Q1 Launch Planning",
      "participants": ["Sarah", "Mike", "Lisa"],
      "lastActivity": "2 hours ago",
      "urgency": "high",
      "pendingActions": ["Review timeline", "Approve budget"]
    }
  ],
  "responseDebt": {
    "count": 3,
    "oldestPending": "2 days ago",
    "highPriorityCount": 1,
    "messages": [
      {
        "from": "Mike Johnson",
        "summary": "Asked about API design decision",
        "receivedAt": "yesterday",
        "urgency": "medium"
      }
    ]
  }
}

IMPORTANT: Always include stressIndicators - even if stress is low, provide a positive affirmation and supportive insight.
Be thorough but only report high-confidence findings. Don't invent tasks or urgency.`;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function normalizeDeepAnalysis(
  parsed: Record<string, unknown>,
  source: 'gmail' | 'slack',
  messageCount: number
): DeepContentAnalysis {
  const now = new Date().toISOString();

  // Valid enum values for validation
  const validRequesterRoles = ['manager', 'peer', 'direct_report', 'external', 'unknown'] as const;
  const validUrgencyLevels = ['critical', 'high', 'medium', 'low'] as const;
  const validCategories = ['review', 'respond', 'create', 'meeting', 'decision', 'info', 'other'] as const;

  return {
    pendingTasks: ((parsed.pendingTasks as unknown[]) || []).map((t: unknown, i: number) => {
      const task = t as Record<string, unknown>;
      // Validate requesterRole - LLM might return invalid values like "automated"
      const rawRole = task.requesterRole as string;
      const requesterRole = validRequesterRoles.includes(rawRole as typeof validRequesterRoles[number])
        ? rawRole as ExtractedTask['requesterRole']
        : 'unknown';
      // Validate urgency
      const rawUrgency = task.urgency as string;
      const urgency = validUrgencyLevels.includes(rawUrgency as typeof validUrgencyLevels[number])
        ? rawUrgency as ExtractedTask['urgency']
        : 'medium';
      // Validate category
      const rawCategory = task.category as string;
      const category = validCategories.includes(rawCategory as typeof validCategories[number])
        ? rawCategory as ExtractedTask['category']
        : 'other';

      return {
        id: (task.id as string) || `task_${i}`,
        description: (task.description as string) || '',
        source,
        requester: task.requester as string | undefined,
        requesterRole,
        deadline: task.deadline as string | undefined,
        urgency,
        urgencyScore: typeof task.urgencyScore === 'number' ? Math.min(100, Math.max(0, task.urgencyScore)) : 50,
        category,
        status: 'pending',
        extractedAt: now,
      };
    }),
    urgentMessages: ((parsed.urgentMessages as unknown[]) || []).map((m: unknown) => {
      const msg = m as Record<string, unknown>;
      return {
        messageId: (msg.messageId as string) || '',
        source,
        urgencyScore: typeof msg.urgencyScore === 'number' ? msg.urgencyScore : 50,
        urgencyLevel: (msg.urgencyLevel as MessageUrgency['urgencyLevel']) || 'medium',
        responseExpectation: (msg.responseExpectation as MessageUrgency['responseExpectation']) || 'unknown',
        reasoning: (msg.reasoning as string) || '',
        requester: msg.requester as string | undefined,
        detectedAt: now,
      };
    }),
    // Parse stress indicators for wellness coaching
    stressIndicators: parsed.stressIndicators ? (() => {
      const stress = parsed.stressIndicators as Record<string, unknown>;
      const validStressLevels = ['low', 'moderate', 'high', 'overwhelming'] as const;
      const validEmotionalTones = ['positive', 'neutral', 'stressed', 'overwhelmed'] as const;
      const validPressureTypes = ['deadline', 'person', 'workload', 'conflict', 'uncertainty'] as const;
      const validIntensities = ['low', 'medium', 'high'] as const;

      const rawStressLevel = stress.overallStressLevel as string;
      const rawTone = stress.emotionalTone as string;

      return {
        overallStressLevel: validStressLevels.includes(rawStressLevel as typeof validStressLevels[number])
          ? rawStressLevel as StressIndicators['overallStressLevel']
          : 'low',
        stressScore: typeof stress.stressScore === 'number'
          ? Math.min(100, Math.max(0, stress.stressScore))
          : 20,
        pressureSources: ((stress.pressureSources as unknown[]) || []).map((p: unknown) => {
          const pressure = p as Record<string, unknown>;
          const rawType = pressure.type as string;
          const rawIntensity = pressure.intensity as string;
          return {
            source: (pressure.source as string) || 'Unknown',
            type: validPressureTypes.includes(rawType as typeof validPressureTypes[number])
              ? rawType as StressIndicators['pressureSources'][0]['type']
              : 'workload',
            intensity: validIntensities.includes(rawIntensity as typeof validIntensities[number])
              ? rawIntensity as StressIndicators['pressureSources'][0]['intensity']
              : 'medium',
            description: (pressure.description as string) || '',
          };
        }),
        emotionalTone: validEmotionalTones.includes(rawTone as typeof validEmotionalTones[number])
          ? rawTone as StressIndicators['emotionalTone']
          : 'neutral',
        supportiveInsight: (stress.supportiveInsight as string) || "You're doing great - keep going!",
        actionableSteps: ((stress.actionableSteps as string[]) || []).slice(0, 5),
        affirmation: (stress.affirmation as string) || "You've got this. One step at a time.",
      };
    })() : undefined,
    interruptionSummary: {
      totalInterruptions: (parsed.interruptionSummary as Record<string, unknown>)?.totalInterruptions as number || 0,
      urgentInterruptions: (parsed.interruptionSummary as Record<string, unknown>)?.urgentInterruptions as number || 0,
      avgInterruptionsPerDay: (parsed.interruptionSummary as Record<string, unknown>)?.avgInterruptionsPerDay as number || 0,
      peakInterruptionHours: ((parsed.interruptionSummary as Record<string, unknown>)?.peakInterruptionHours as string[]) || [],
      topInterrupters: ((parsed.interruptionSummary as Record<string, unknown>)?.topInterrupters as string[]) || [],
    },
    keyPeople: ((parsed.keyPeople as unknown[]) || []).map((p: unknown) => {
      const person = p as Record<string, unknown>;
      return {
        name: (person.name as string) || 'Unknown',
        relationship: (person.relationship as PersonContext['relationship']) || 'unknown',
        communicationFrequency: (person.communicationFrequency as PersonContext['communicationFrequency']) || 'rare',
        avgUrgencyOfRequests: typeof person.avgUrgencyOfRequests === 'number' ? person.avgUrgencyOfRequests : 50,
        typicalResponseExpectation: (person.typicalResponseExpectation as string) || 'unknown',
        messageCount: typeof person.messageCount === 'number' ? person.messageCount : 0,
      };
    }),
    activeThreads: ((parsed.activeThreads as unknown[]) || []).map((t: unknown) => {
      const thread = t as Record<string, unknown>;
      return {
        topic: (thread.topic as string) || 'Unknown topic',
        participants: (thread.participants as string[]) || [],
        lastActivity: (thread.lastActivity as string) || 'Unknown',
        urgency: (thread.urgency as 'high' | 'medium' | 'low') || 'medium',
        pendingActions: (thread.pendingActions as string[]) || [],
      };
    }),
    responseDebt: {
      count: (parsed.responseDebt as Record<string, unknown>)?.count as number || 0,
      oldestPending: (parsed.responseDebt as Record<string, unknown>)?.oldestPending as string || '',
      highPriorityCount: (parsed.responseDebt as Record<string, unknown>)?.highPriorityCount as number || 0,
      messages: (((parsed.responseDebt as Record<string, unknown>)?.messages as unknown[]) || []).map((m: unknown) => {
        const msg = m as Record<string, unknown>;
        return {
          from: (msg.from as string) || 'Unknown',
          summary: (msg.summary as string) || '',
          receivedAt: (msg.receivedAt as string) || '',
          urgency: (msg.urgency as string) || 'medium',
        };
      }),
    },
    analyzedAt: now,
    messageCount,
    source,
  };
}

function getEmptyDeepAnalysis(source: 'gmail' | 'slack' | 'combined', messageCount: number): DeepContentAnalysis {
  return {
    pendingTasks: [],
    urgentMessages: [],
    stressIndicators: {
      overallStressLevel: 'low',
      stressScore: 10,
      pressureSources: [],
      emotionalTone: 'positive',
      supportiveInsight: "Your inbox looks clear - great job staying on top of things!",
      actionableSteps: [],
      affirmation: "You're in control of your day. Keep up the great work!",
    },
    interruptionSummary: {
      totalInterruptions: 0,
      urgentInterruptions: 0,
      avgInterruptionsPerDay: 0,
      peakInterruptionHours: [],
      topInterrupters: [],
    },
    keyPeople: [],
    activeThreads: [],
    responseDebt: {
      count: 0,
      oldestPending: '',
      highPriorityCount: 0,
      messages: [],
    },
    analyzedAt: new Date().toISOString(),
    messageCount,
    source,
  };
}

// ============================================================================
// STORAGE FUNCTIONS
// ============================================================================

/**
 * Store deep content analysis results
 */
export async function storeDeepContentAnalysis(
  email: string,
  analysis: DeepContentAnalysis
): Promise<void> {
  const supabase = createAdminClient();

  // Store main analysis
  const { error: analysisError } = await supabase
    .from('deep_content_analysis')
    .upsert(
      {
        user_email: email,
        source: analysis.source,
        pending_tasks: analysis.pendingTasks,
        urgent_messages: analysis.urgentMessages,
        stress_indicators: analysis.stressIndicators || null,
        interruption_summary: analysis.interruptionSummary,
        key_people: analysis.keyPeople,
        active_threads: analysis.activeThreads,
        response_debt: analysis.responseDebt,
        message_count: analysis.messageCount,
        analyzed_at: analysis.analyzedAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_email,source' }
    );

  if (analysisError) {
    console.error('[Deep Content] Error storing analysis:', analysisError);
  }

  // Store individual tasks for tracking
  for (const task of analysis.pendingTasks) {
    const { error: taskError } = await supabase
      .from('extracted_tasks')
      .upsert(
        {
          id: `${email}_${task.id}`,
          user_email: email,
          description: task.description,
          source: task.source,
          requester: task.requester,
          requester_role: task.requesterRole,
          deadline: task.deadline,
          urgency: task.urgency,
          urgency_score: task.urgencyScore,
          category: task.category,
          status: task.status,
          extracted_at: task.extractedAt,
        },
        { onConflict: 'id' }
      );

    if (taskError) {
      console.error('[Deep Content] Error storing task:', taskError);
    }
  }
}

/**
 * Get deep content analysis for a user
 */
export async function getDeepContentAnalysis(
  email: string,
  source?: 'gmail' | 'slack'
): Promise<DeepContentAnalysis | null> {
  const supabase = createAdminClient();

  let query = supabase
    .from('deep_content_analysis')
    .select('*')
    .eq('user_email', email);

  if (source) {
    query = query.eq('source', source);
  }

  const { data, error } = await query.order('analyzed_at', { ascending: false }).limit(1).single();

  if (error || !data) {
    return null;
  }

  return {
    pendingTasks: data.pending_tasks || [],
    urgentMessages: data.urgent_messages || [],
    stressIndicators: data.stress_indicators || undefined,
    interruptionSummary: data.interruption_summary || {
      totalInterruptions: 0,
      urgentInterruptions: 0,
      avgInterruptionsPerDay: 0,
      peakInterruptionHours: [],
      topInterrupters: [],
    },
    keyPeople: data.key_people || [],
    activeThreads: data.active_threads || [],
    responseDebt: data.response_debt || { count: 0, oldestPending: '', highPriorityCount: 0, messages: [] },
    analyzedAt: data.analyzed_at,
    messageCount: data.message_count,
    source: data.source,
  };
}

/**
 * Get pending tasks for a user
 */
export async function getPendingTasks(
  email: string,
  options: { urgencyMin?: number; category?: string; limit?: number } = {}
): Promise<ExtractedTask[]> {
  const supabase = createAdminClient();
  const { urgencyMin = 0, category, limit = 20 } = options;

  let query = supabase
    .from('extracted_tasks')
    .select('*')
    .eq('user_email', email)
    .eq('status', 'pending')
    .gte('urgency_score', urgencyMin)
    .order('urgency_score', { ascending: false })
    .limit(limit);

  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  return data.map(row => ({
    id: row.id,
    description: row.description,
    source: row.source,
    requester: row.requester,
    requesterRole: row.requester_role,
    deadline: row.deadline,
    urgency: row.urgency,
    urgencyScore: row.urgency_score,
    category: row.category,
    status: row.status,
    extractedAt: row.extracted_at,
    expiresAt: row.expires_at,
  }));
}

/**
 * Format deep content analysis for agent prompts
 */
export function formatDeepContentForPrompt(analysis: DeepContentAnalysis | null): string {
  if (!analysis) {
    return '';
  }

  const parts: string[] = [];
  parts.push('\n## Deep Communication Analysis');
  parts.push(`Source: ${analysis.source} | Messages analyzed: ${analysis.messageCount}`);
  parts.push('');

  // Pending tasks
  if (analysis.pendingTasks.length > 0) {
    parts.push('### Pending Tasks Extracted from Messages');
    for (const task of analysis.pendingTasks.slice(0, 5)) {
      const deadline = task.deadline ? ` (Due: ${task.deadline})` : '';
      const requester = task.requester ? ` - from ${task.requester}` : '';
      parts.push(`- [${task.urgency.toUpperCase()}] ${task.description}${deadline}${requester}`);
    }
    parts.push('');
  }

  // Response debt
  if (analysis.responseDebt.count > 0) {
    parts.push('### Messages Awaiting Response');
    parts.push(`- ${analysis.responseDebt.count} messages need replies`);
    parts.push(`- ${analysis.responseDebt.highPriorityCount} are high priority`);
    if (analysis.responseDebt.oldestPending) {
      parts.push(`- Oldest unanswered: ${analysis.responseDebt.oldestPending}`);
    }
    for (const msg of analysis.responseDebt.messages.slice(0, 3)) {
      parts.push(`  - ${msg.from}: "${msg.summary}" (${msg.urgency})`);
    }
    parts.push('');
  }

  // Interruption patterns
  if (analysis.interruptionSummary.totalInterruptions > 0) {
    parts.push('### Interruption Patterns');
    parts.push(`- ${analysis.interruptionSummary.avgInterruptionsPerDay} interruptions/day average`);
    parts.push(`- ${analysis.interruptionSummary.urgentInterruptions} urgent interruptions`);
    if (analysis.interruptionSummary.peakInterruptionHours.length > 0) {
      parts.push(`- Peak hours: ${analysis.interruptionSummary.peakInterruptionHours.join(', ')}`);
    }
    if (analysis.interruptionSummary.topInterrupters.length > 0) {
      parts.push(`- Top interrupters: ${analysis.interruptionSummary.topInterrupters.join(', ')}`);
    }
    parts.push('');
  }

  // Key people
  if (analysis.keyPeople.length > 0) {
    parts.push('### Key Communication Partners');
    for (const person of analysis.keyPeople.slice(0, 3)) {
      parts.push(`- ${person.name} (${person.relationship}): ${person.communicationFrequency} contact, avg urgency ${person.avgUrgencyOfRequests}/100`);
    }
    parts.push('');
  }

  // Active threads
  if (analysis.activeThreads.length > 0) {
    parts.push('### Active Threads Needing Attention');
    for (const thread of analysis.activeThreads.slice(0, 3)) {
      const actions = thread.pendingActions.length > 0
        ? ` - Actions: ${thread.pendingActions.join(', ')}`
        : '';
      parts.push(`- [${thread.urgency}] ${thread.topic}${actions}`);
    }
    parts.push('');
  }

  return parts.join('\n');
}

// ============================================================================
// COMBINED ANALYSIS
// ============================================================================

/**
 * Combine Gmail and Slack deep analysis into unified view
 */
export async function getCombinedDeepAnalysis(email: string): Promise<DeepContentAnalysis | null> {
  const [gmailAnalysis, slackAnalysis] = await Promise.all([
    getDeepContentAnalysis(email, 'gmail'),
    getDeepContentAnalysis(email, 'slack'),
  ]);

  if (!gmailAnalysis && !slackAnalysis) {
    return null;
  }

  // Merge the analyses
  const combined: DeepContentAnalysis = {
    pendingTasks: [
      ...(gmailAnalysis?.pendingTasks || []),
      ...(slackAnalysis?.pendingTasks || []),
    ].sort((a, b) => b.urgencyScore - a.urgencyScore),

    urgentMessages: [
      ...(gmailAnalysis?.urgentMessages || []),
      ...(slackAnalysis?.urgentMessages || []),
    ].sort((a, b) => b.urgencyScore - a.urgencyScore),

    interruptionSummary: {
      totalInterruptions:
        (gmailAnalysis?.interruptionSummary.totalInterruptions || 0) +
        (slackAnalysis?.interruptionSummary.totalInterruptions || 0),
      urgentInterruptions:
        (gmailAnalysis?.interruptionSummary.urgentInterruptions || 0) +
        (slackAnalysis?.interruptionSummary.urgentInterruptions || 0),
      avgInterruptionsPerDay:
        ((gmailAnalysis?.interruptionSummary.avgInterruptionsPerDay || 0) +
        (slackAnalysis?.interruptionSummary.avgInterruptionsPerDay || 0)),
      peakInterruptionHours: [
        ...(gmailAnalysis?.interruptionSummary.peakInterruptionHours || []),
        ...(slackAnalysis?.interruptionSummary.peakInterruptionHours || []),
      ].filter((v, i, a) => a.indexOf(v) === i).slice(0, 5),
      topInterrupters: [
        ...(gmailAnalysis?.interruptionSummary.topInterrupters || []),
        ...(slackAnalysis?.interruptionSummary.topInterrupters || []),
      ].filter((v, i, a) => a.indexOf(v) === i).slice(0, 5),
    },

    keyPeople: [
      ...(gmailAnalysis?.keyPeople || []),
      ...(slackAnalysis?.keyPeople || []),
    ],

    activeThreads: [
      ...(gmailAnalysis?.activeThreads || []),
      ...(slackAnalysis?.activeThreads || []),
    ].sort((a, b) => {
      const urgencyOrder = { high: 0, medium: 1, low: 2 };
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    }),

    responseDebt: {
      count:
        (gmailAnalysis?.responseDebt.count || 0) +
        (slackAnalysis?.responseDebt.count || 0),
      oldestPending: gmailAnalysis?.responseDebt.oldestPending || slackAnalysis?.responseDebt.oldestPending || '',
      highPriorityCount:
        (gmailAnalysis?.responseDebt.highPriorityCount || 0) +
        (slackAnalysis?.responseDebt.highPriorityCount || 0),
      messages: [
        ...(gmailAnalysis?.responseDebt.messages || []),
        ...(slackAnalysis?.responseDebt.messages || []),
      ].slice(0, 10),
    },

    // Merge stress indicators (take the higher stress level, combine pressure sources)
    stressIndicators: mergeStressIndicators(
      gmailAnalysis?.stressIndicators,
      slackAnalysis?.stressIndicators
    ),

    analyzedAt: new Date().toISOString(),
    messageCount: (gmailAnalysis?.messageCount || 0) + (slackAnalysis?.messageCount || 0),
    source: 'combined',
  };

  return combined;
}

/**
 * Merge stress indicators from multiple sources
 */
function mergeStressIndicators(
  gmail?: StressIndicators,
  slack?: StressIndicators
): StressIndicators | undefined {
  if (!gmail && !slack) return undefined;
  if (!gmail) return slack;
  if (!slack) return gmail;

  // Map stress levels to numeric values for comparison
  const stressLevelOrder: Record<string, number> = {
    low: 0,
    moderate: 1,
    high: 2,
    overwhelming: 3,
  };

  // Take the higher stress level
  const gmailLevel = stressLevelOrder[gmail.overallStressLevel] || 0;
  const slackLevel = stressLevelOrder[slack.overallStressLevel] || 0;
  const higherStress = gmailLevel >= slackLevel ? gmail : slack;

  return {
    overallStressLevel: higherStress.overallStressLevel,
    stressScore: Math.max(gmail.stressScore, slack.stressScore),
    // Combine pressure sources from both, remove duplicates by source name
    pressureSources: [
      ...(gmail.pressureSources || []),
      ...(slack.pressureSources || []),
    ].filter((source, index, self) =>
      index === self.findIndex(s => s.source === source.source)
    ),
    emotionalTone: higherStress.emotionalTone,
    // Use the insight from the more stressed source
    supportiveInsight: higherStress.supportiveInsight,
    // Combine actionable steps
    actionableSteps: [
      ...(gmail.actionableSteps || []),
      ...(slack.actionableSteps || []),
    ].slice(0, 5),
    affirmation: higherStress.affirmation,
  };
}
