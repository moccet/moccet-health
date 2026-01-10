/**
 * Cross-Platform Correlator
 *
 * Uses AI to detect related conversations and tasks across platforms:
 * - Links Gmail threads to Slack discussions
 * - Links Notion/Linear tasks to email/chat mentions
 * - Identifies cross-platform project activity
 */

import OpenAI from 'openai';
import { createAdminClient } from '@/lib/supabase/server';
import {
  correlateAllPeople,
  correlateProjectAcrossPlatforms,
  type EntityReference,
  type PersonInput,
} from './entity-correlation-service';

const openai = new OpenAI();

// ============================================================================
// TYPES
// ============================================================================

export interface MessageData {
  id: string;
  source: 'gmail' | 'slack' | 'outlook' | 'teams';
  subject?: string;
  body?: string;
  snippet?: string;
  from?: string;
  fromEmail?: string;
  channel?: string;
  timestamp: string;
  threadId?: string;
}

export interface TaskData {
  id: string;
  source: 'notion' | 'linear';
  title: string;
  status?: string;
  priority?: string;
  dueDate?: string;
  project?: string;
}

export interface CorrelationInput {
  gmail?: MessageData[];
  slack?: MessageData[];
  outlook?: MessageData[];
  teams?: MessageData[];
  notion?: TaskData[];
  linear?: TaskData[];
}

export interface RelatedThread {
  topic: string;
  gmail?: { threadId: string; subject: string };
  slack?: { channelId: string; channelName: string; threadTs?: string };
  outlook?: { conversationId: string; subject: string };
  teams?: { chatId: string; threadId?: string };
  participants: string[];
  urgency: 'critical' | 'high' | 'medium' | 'low';
  confidence: number;
}

export interface LinkedTask {
  taskId: string;
  taskSource: 'notion' | 'linear';
  taskTitle: string;
  mentions: Array<{
    source: 'gmail' | 'slack' | 'outlook' | 'teams';
    id: string;
    snippet?: string;
  }>;
  confidence: number;
}

export interface CrossPlatformCorrelation {
  relatedThreads: RelatedThread[];
  linkedTasks: LinkedTask[];
  unifiedContacts: Array<{
    canonicalName: string;
    platforms: string[];
    communicationScore: number;
    lastInteraction: string;
  }>;
  analyzedAt: string;
}

// ============================================================================
// MAIN CORRELATION FUNCTION
// ============================================================================

/**
 * Correlate data across all platforms
 */
export async function correlateAcrossPlatforms(
  userEmail: string,
  input: CorrelationInput
): Promise<CrossPlatformCorrelation> {
  console.log(`[Cross-Platform Correlator] Starting correlation for ${userEmail}`);

  // 1. Extract and normalize people from all sources
  const people = extractPeopleFromAllSources(input);
  const personCorrelations = await correlateAllPeople(userEmail, people);

  // 2. Extract projects and correlate
  const projects = extractProjectsFromAllSources(input);
  for (const project of projects) {
    await correlateProjectAcrossPlatforms(userEmail, project);
  }

  // 3. Use AI to detect related threads
  const relatedThreads = await detectRelatedThreadsWithAI(input);

  // 4. Link tasks to conversations
  const linkedTasks = await linkTasksToConversations(input);

  // 5. Build unified contacts
  const unifiedContacts = buildUnifiedContacts(personCorrelations);

  // 6. Store correlations in database
  await storeCorrelations(userEmail, relatedThreads, linkedTasks);

  console.log(`[Cross-Platform Correlator] Found ${relatedThreads.length} related threads, ${linkedTasks.length} linked tasks`);

  return {
    relatedThreads,
    linkedTasks,
    unifiedContacts,
    analyzedAt: new Date().toISOString(),
  };
}

// ============================================================================
// PERSON EXTRACTION
// ============================================================================

function extractPeopleFromAllSources(input: CorrelationInput): PersonInput[] {
  const people: PersonInput[] = [];

  // Gmail
  if (input.gmail) {
    for (const msg of input.gmail) {
      if (msg.from || msg.fromEmail) {
        people.push({
          source: 'gmail',
          id: msg.fromEmail || msg.from || '',
          name: msg.from,
          email: msg.fromEmail,
        });
      }
    }
  }

  // Slack
  if (input.slack) {
    for (const msg of input.slack) {
      if (msg.from) {
        people.push({
          source: 'slack',
          id: msg.from,
          name: msg.from,
        });
      }
    }
  }

  // Outlook
  if (input.outlook) {
    for (const msg of input.outlook) {
      if (msg.from || msg.fromEmail) {
        people.push({
          source: 'outlook',
          id: msg.fromEmail || msg.from || '',
          name: msg.from,
          email: msg.fromEmail,
        });
      }
    }
  }

  // Teams
  if (input.teams) {
    for (const msg of input.teams) {
      if (msg.from) {
        people.push({
          source: 'teams',
          id: msg.from,
          name: msg.from,
        });
      }
    }
  }

  // Deduplicate by source+id
  const seen = new Set<string>();
  return people.filter(p => {
    const key = `${p.source}:${p.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ============================================================================
// PROJECT EXTRACTION
// ============================================================================

function extractProjectsFromAllSources(input: CorrelationInput): Array<{
  source: 'notion' | 'linear' | 'slack' | 'teams';
  id: string;
  name: string;
}> {
  const projects: Array<{ source: 'notion' | 'linear' | 'slack' | 'teams'; id: string; name: string }> = [];

  // From Notion tasks
  if (input.notion) {
    const notionProjects = new Map<string, string>();
    for (const task of input.notion) {
      if (task.project && !notionProjects.has(task.project)) {
        notionProjects.set(task.project, task.project);
        projects.push({
          source: 'notion',
          id: task.project,
          name: task.project,
        });
      }
    }
  }

  // From Linear tasks
  if (input.linear) {
    const linearProjects = new Map<string, string>();
    for (const task of input.linear) {
      if (task.project && !linearProjects.has(task.project)) {
        linearProjects.set(task.project, task.project);
        projects.push({
          source: 'linear',
          id: task.project,
          name: task.project,
        });
      }
    }
  }

  // From Slack channels (could be project channels)
  if (input.slack) {
    const slackChannels = new Map<string, string>();
    for (const msg of input.slack) {
      if (msg.channel && !slackChannels.has(msg.channel)) {
        slackChannels.set(msg.channel, msg.channel);
        // Only add channels that look like project channels
        if (isLikelyProjectChannel(msg.channel)) {
          projects.push({
            source: 'slack',
            id: msg.channel,
            name: msg.channel,
          });
        }
      }
    }
  }

  return projects;
}

function isLikelyProjectChannel(channelName: string): boolean {
  // Filter out general channels
  const generalChannels = ['general', 'random', 'announcements', 'team', 'company'];
  if (generalChannels.includes(channelName.toLowerCase())) return false;

  // Look for project-like names
  const projectPatterns = [
    /^proj[-_]?/i,
    /^team[-_]?/i,
    /[-_]project$/i,
    /[-_]dev$/i,
    /[-_]eng$/i,
  ];

  return projectPatterns.some(p => p.test(channelName));
}

// ============================================================================
// AI THREAD DETECTION
// ============================================================================

async function detectRelatedThreadsWithAI(input: CorrelationInput): Promise<RelatedThread[]> {
  // Prepare message summaries for AI
  const messageSummaries: Array<{
    source: string;
    id: string;
    subject?: string;
    snippet: string;
    from?: string;
    channel?: string;
    timestamp: string;
  }> = [];

  const allMessages = [
    ...(input.gmail || []),
    ...(input.slack || []),
    ...(input.outlook || []),
    ...(input.teams || []),
  ];

  // Sample messages for AI analysis (limit to most recent 100)
  const sampledMessages = allMessages
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 100);

  for (const msg of sampledMessages) {
    messageSummaries.push({
      source: msg.source,
      id: msg.id,
      subject: msg.subject,
      snippet: (msg.body || msg.snippet || '').substring(0, 200),
      from: msg.from,
      channel: msg.channel,
      timestamp: msg.timestamp,
    });
  }

  if (messageSummaries.length < 5) {
    return [];
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an expert at identifying related conversations across communication platforms.

Given messages from Gmail, Slack, Outlook, and Teams, identify groups of messages that are about the SAME topic or project.

Look for:
- Same participants discussing the same subject
- References to the same project, task, or deadline
- Follow-up conversations that moved platforms
- Escalations (e.g., email → urgent Slack message)
- Reply chains across platforms

For each group, provide:
1. A topic name (short, descriptive)
2. Which platforms are involved
3. Key participants
4. Urgency level (critical, high, medium, low)
5. Confidence score (0.5-1.0)

Return JSON only:
{
  "relatedThreads": [
    {
      "topic": "Q4 Budget Review",
      "platforms": {
        "gmail": { "threadId": "xxx", "subject": "RE: Q4 Budget" },
        "slack": { "channelId": "finance", "threadTs": "123.456" }
      },
      "participants": ["Sarah Chen", "Mike Johnson"],
      "urgency": "high",
      "confidence": 0.85
    }
  ]
}`,
        },
        {
          role: 'user',
          content: `Find related conversations in these ${messageSummaries.length} messages:\n${JSON.stringify(messageSummaries, null, 2)}`,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 2000,
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    // Normalize the response
    const threads: RelatedThread[] = (parsed.relatedThreads || []).map((t: Record<string, unknown>) => {
      const platforms = t.platforms as Record<string, unknown> || {};
      return {
        topic: (t.topic as string) || 'Unknown topic',
        gmail: platforms.gmail as RelatedThread['gmail'],
        slack: platforms.slack as RelatedThread['slack'],
        outlook: platforms.outlook as RelatedThread['outlook'],
        teams: platforms.teams as RelatedThread['teams'],
        participants: (t.participants as string[]) || [],
        urgency: (t.urgency as RelatedThread['urgency']) || 'medium',
        confidence: typeof t.confidence === 'number' ? t.confidence : 0.7,
      };
    });

    return threads.filter(t => t.confidence >= 0.6);
  } catch (error) {
    console.error('[Cross-Platform Correlator] AI thread detection error:', error);
    return [];
  }
}

// ============================================================================
// TASK-CONVERSATION LINKING
// ============================================================================

async function linkTasksToConversations(input: CorrelationInput): Promise<LinkedTask[]> {
  const tasks = [
    ...(input.notion || []).map(t => ({ ...t, source: 'notion' as const })),
    ...(input.linear || []).map(t => ({ ...t, source: 'linear' as const })),
  ];

  if (tasks.length === 0) {
    return [];
  }

  const allMessages = [
    ...(input.gmail || []),
    ...(input.slack || []),
    ...(input.outlook || []),
    ...(input.teams || []),
  ];

  if (allMessages.length === 0) {
    return [];
  }

  const linkedTasks: LinkedTask[] = [];

  // For each task, search for mentions in messages
  for (const task of tasks.slice(0, 50)) {
    const mentions: LinkedTask['mentions'] = [];

    // Extract key terms from task title
    const titleTerms = extractKeyTerms(task.title);

    for (const msg of allMessages) {
      const content = `${msg.subject || ''} ${msg.body || msg.snippet || ''}`.toLowerCase();

      // Check if message mentions the task
      const matchScore = calculateTaskMentionScore(titleTerms, content);

      if (matchScore > 0.5) {
        mentions.push({
          source: msg.source,
          id: msg.id,
          snippet: (msg.snippet || msg.body || '').substring(0, 100),
        });
      }
    }

    if (mentions.length > 0) {
      linkedTasks.push({
        taskId: task.id,
        taskSource: task.source,
        taskTitle: task.title,
        mentions,
        confidence: Math.min(0.9, 0.5 + mentions.length * 0.1),
      });
    }
  }

  return linkedTasks;
}

function extractKeyTerms(title: string): string[] {
  // Remove common words and extract meaningful terms
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
    'this', 'that', 'these', 'those', 'it', 'its',
  ]);

  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));
}

function calculateTaskMentionScore(taskTerms: string[], content: string): number {
  if (taskTerms.length === 0) return 0;

  let matchedTerms = 0;
  for (const term of taskTerms) {
    if (content.includes(term)) {
      matchedTerms++;
    }
  }

  return matchedTerms / taskTerms.length;
}

// ============================================================================
// UNIFIED CONTACTS
// ============================================================================

function buildUnifiedContacts(
  personCorrelations: Map<string, EntityReference>
): CrossPlatformCorrelation['unifiedContacts'] {
  const contactMap = new Map<string, {
    canonicalName: string;
    platforms: Set<string>;
    count: number;
    lastTimestamp: string;
  }>();

  for (const [, ref] of personCorrelations) {
    const existing = contactMap.get(ref.canonicalName);
    const platforms = ref.sources.map(s => s.source);

    if (existing) {
      platforms.forEach(p => existing.platforms.add(p));
      existing.count++;
    } else {
      contactMap.set(ref.canonicalName, {
        canonicalName: ref.canonicalName,
        platforms: new Set(platforms),
        count: 1,
        lastTimestamp: new Date().toISOString(),
      });
    }
  }

  return Array.from(contactMap.values())
    .map(c => ({
      canonicalName: c.canonicalName,
      platforms: Array.from(c.platforms),
      communicationScore: c.count,
      lastInteraction: c.lastTimestamp,
    }))
    .sort((a, b) => b.communicationScore - a.communicationScore)
    .slice(0, 50);
}

// ============================================================================
// STORAGE
// ============================================================================

async function storeCorrelations(
  userEmail: string,
  threads: RelatedThread[],
  tasks: LinkedTask[]
): Promise<void> {
  const supabase = createAdminClient();

  // Store thread correlations
  for (const thread of threads) {
    const messages: Array<{ source: string; id: string }> = [];

    if (thread.gmail) messages.push({ source: 'gmail', id: thread.gmail.threadId });
    if (thread.slack) messages.push({ source: 'slack', id: thread.slack.channelId });
    if (thread.outlook) messages.push({ source: 'outlook', id: thread.outlook.conversationId });
    if (thread.teams) messages.push({ source: 'teams', id: thread.teams.chatId });

    await supabase.from('message_correlations').upsert({
      user_email: userEmail,
      correlation_id: `thread_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      topic: thread.topic,
      messages,
      participants: thread.participants,
      urgency: thread.urgency,
      confidence: thread.confidence,
      detected_at: new Date().toISOString(),
    }, { ignoreDuplicates: true });
  }

  // Store task correlations
  for (const task of tasks) {
    await supabase.from('task_correlations').upsert({
      user_email: userEmail,
      task_source: task.taskSource,
      task_id: task.taskId,
      task_title: task.taskTitle,
      mentions: task.mentions,
      confidence: task.confidence,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_email,task_source,task_id' });
  }
}

// ============================================================================
// RETRIEVAL
// ============================================================================

/**
 * Get stored correlations for a user
 */
export async function getStoredCorrelations(userEmail: string): Promise<{
  threads: RelatedThread[];
  tasks: LinkedTask[];
}> {
  const supabase = createAdminClient();

  // Get recent thread correlations (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: threadData } = await supabase
    .from('message_correlations')
    .select('*')
    .eq('user_email', userEmail)
    .gte('detected_at', sevenDaysAgo)
    .order('detected_at', { ascending: false })
    .limit(50);

  const threads: RelatedThread[] = (threadData || []).map(row => ({
    topic: row.topic,
    participants: row.participants || [],
    urgency: row.urgency || 'medium',
    confidence: row.confidence || 0.7,
  }));

  // Get task correlations
  const { data: taskData } = await supabase
    .from('task_correlations')
    .select('*')
    .eq('user_email', userEmail)
    .order('updated_at', { ascending: false })
    .limit(50);

  const tasks: LinkedTask[] = (taskData || []).map(row => ({
    taskId: row.task_id,
    taskSource: row.task_source,
    taskTitle: row.task_title,
    mentions: row.mentions || [],
    confidence: row.confidence || 0.7,
  }));

  return { threads, tasks };
}
