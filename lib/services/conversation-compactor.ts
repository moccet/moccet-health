/**
 * Conversation Compactor Service
 *
 * Handles conversation history compaction for Moccet Voice.
 * Summarizes older conversations to maintain context while respecting token limits.
 *
 * Compaction Strategy (like Claude Code):
 * - Recent messages: Keep full text
 * - Older messages: Summarize into paragraphs
 * - Very old: Extract key facts only
 */

import OpenAI from 'openai';
import { createAdminClient } from '@/lib/supabase/server';

const openai = new OpenAI();

// Compaction thresholds based on subscription
interface CompactionLimits {
  keepFullCount: number; // Messages to keep in full
  summaryDepth: number; // How many summary levels
  maxSummaries: number; // Max number of summary entries
}

const COMPACTION_LIMITS: Record<string, CompactionLimits> = {
  free: { keepFullCount: 10, summaryDepth: 1, maxSummaries: 2 },
  pro: { keepFullCount: 50, summaryDepth: 2, maxSummaries: 5 },
  max: { keepFullCount: 100, summaryDepth: 3, maxSummaries: 10 },
};

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  agent?: string;
  created_at: string;
}

interface CompactedHistory {
  recentMessages: Message[];
  summaries: {
    summary: string;
    keyFacts: string[];
    dateRange: { start: string; end: string };
    messageCount: number;
  }[];
  totalMessageCount: number;
}

/**
 * Get compacted conversation history for a user
 */
export async function getCompactedHistory(
  email: string,
  threadId?: string,
  subscriptionTier: string = 'free'
): Promise<CompactedHistory> {
  const supabase = createAdminClient();
  const limits = COMPACTION_LIMITS[subscriptionTier] || COMPACTION_LIMITS.free;

  // Get recent non-compacted messages
  // Build query with optional threadId filter to ensure thread isolation
  let recentQuery = supabase
    .from('conversation_history')
    .select('id, role, content, agent, created_at')
    .eq('user_email', email)
    .eq('is_compacted', false);

  // Filter by threadId if provided to prevent cross-thread context bleed
  if (threadId) {
    recentQuery = recentQuery.eq('thread_id', threadId);
  }

  const { data: recentMessages, error: recentError } = await recentQuery
    .order('created_at', { ascending: false })
    .limit(limits.keepFullCount);

  if (recentError) {
    console.error('[Conversation Compactor] Error fetching recent messages:', recentError);
    return { recentMessages: [], summaries: [], totalMessageCount: 0 };
  }

  // Get existing summaries
  const { data: existingSummaries, error: summaryError } = await supabase
    .from('conversation_summaries')
    .select('summary, key_facts, start_date, end_date, message_count')
    .eq('user_email', email)
    .order('end_date', { ascending: false })
    .limit(limits.maxSummaries);

  if (summaryError) {
    console.error('[Conversation Compactor] Error fetching summaries:', summaryError);
  }

  // Get total message count
  const { count: totalCount } = await supabase
    .from('conversation_history')
    .select('*', { count: 'exact', head: true })
    .eq('user_email', email);

  const summaries = (existingSummaries || []).map((s) => ({
    summary: s.summary,
    keyFacts: s.key_facts || [],
    dateRange: { start: s.start_date, end: s.end_date },
    messageCount: s.message_count,
  }));

  return {
    recentMessages: (recentMessages || []).reverse() as Message[],
    summaries,
    totalMessageCount: totalCount || 0,
  };
}

/**
 * Save a new message to conversation history
 */
export async function saveMessage(
  email: string,
  role: 'user' | 'assistant',
  content: string,
  options: {
    threadId?: string;
    agent?: string;
    tokenCount?: number;
    contextUsed?: Record<string, unknown>;
  } = {}
): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase.from('conversation_history').insert({
    user_email: email,
    thread_id: options.threadId,
    role,
    content,
    agent: options.agent,
    token_count: options.tokenCount,
    context_used: options.contextUsed,
  });

  if (error) {
    console.error('[Conversation Compactor] Error saving message:', error);
  }
}

/**
 * Compact older messages into summaries
 * Should be called periodically (e.g., after N messages or via cron)
 */
export async function compactOldMessages(
  email: string,
  subscriptionTier: string = 'free'
): Promise<void> {
  const supabase = createAdminClient();
  const limits = COMPACTION_LIMITS[subscriptionTier] || COMPACTION_LIMITS.free;

  // Get messages that should be compacted (older than keepFullCount)
  const { data: allMessages, error: fetchError } = await supabase
    .from('conversation_history')
    .select('id, role, content, agent, created_at')
    .eq('user_email', email)
    .eq('is_compacted', false)
    .order('created_at', { ascending: true });

  if (fetchError || !allMessages) {
    console.error('[Conversation Compactor] Error fetching messages for compaction:', fetchError);
    return;
  }

  // If we don't have enough messages to compact, skip
  if (allMessages.length <= limits.keepFullCount) {
    return;
  }

  // Messages to compact (everything except the most recent keepFullCount)
  const messagesToCompact = allMessages.slice(0, allMessages.length - limits.keepFullCount);

  if (messagesToCompact.length < 10) {
    // Don't compact tiny batches
    return;
  }

  console.log(`[Conversation Compactor] Compacting ${messagesToCompact.length} messages for ${email}`);

  // Generate summary using AI
  const summary = await generateConversationSummary(messagesToCompact);

  if (!summary) {
    console.error('[Conversation Compactor] Failed to generate summary');
    return;
  }

  // Save summary
  const { error: summaryError } = await supabase.from('conversation_summaries').insert({
    user_email: email,
    summary: summary.summary,
    key_facts: summary.keyFacts,
    topics_discussed: summary.topics,
    start_date: messagesToCompact[0].created_at,
    end_date: messagesToCompact[messagesToCompact.length - 1].created_at,
    message_count: messagesToCompact.length,
    token_count: summary.tokenCount,
  });

  if (summaryError) {
    console.error('[Conversation Compactor] Error saving summary:', summaryError);
    return;
  }

  // Mark messages as compacted
  const messageIds = messagesToCompact.map((m) => m.id);
  const { error: updateError } = await supabase
    .from('conversation_history')
    .update({ is_compacted: true })
    .in('id', messageIds);

  if (updateError) {
    console.error('[Conversation Compactor] Error marking messages as compacted:', updateError);
  }

  console.log(`[Conversation Compactor] Successfully compacted ${messagesToCompact.length} messages`);
}

/**
 * Generate a summary of messages using AI
 */
async function generateConversationSummary(
  messages: Message[]
): Promise<{ summary: string; keyFacts: string[]; topics: string[]; tokenCount: number } | null> {
  try {
    const conversationText = messages
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n\n');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a conversation summarizer. Create a concise summary of the conversation history.

Extract:
1. A brief summary (2-3 sentences) of what was discussed
2. Key facts learned about the user (preferences, decisions, action items)
3. Main topics covered

Output as JSON:
{
  "summary": "string",
  "keyFacts": ["fact1", "fact2", ...],
  "topics": ["topic1", "topic2", ...]
}`,
        },
        {
          role: 'user',
          content: `Summarize this conversation:\n\n${conversationText}`,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 500,
    });

    const result = JSON.parse(response.choices[0]?.message?.content || '{}');

    return {
      summary: result.summary || 'No summary available',
      keyFacts: result.keyFacts || [],
      topics: result.topics || [],
      tokenCount: response.usage?.total_tokens || 0,
    };
  } catch (error) {
    console.error('[Conversation Compactor] Error generating summary:', error);
    return null;
  }
}

/**
 * Format compacted history for inclusion in AI prompt
 */
export function formatHistoryForPrompt(history: CompactedHistory): string {
  const parts: string[] = [];

  // Add summaries first (older context)
  if (history.summaries.length > 0) {
    parts.push('## Previous Conversation Summary');
    for (const summary of history.summaries) {
      parts.push(`\n**${summary.dateRange.start.split('T')[0]} to ${summary.dateRange.end.split('T')[0]}** (${summary.messageCount} messages):`);
      parts.push(summary.summary);
      if (summary.keyFacts.length > 0) {
        parts.push(`Key facts: ${summary.keyFacts.join('; ')}`);
      }
    }
    parts.push('');
  }

  // Add recent messages
  if (history.recentMessages.length > 0) {
    parts.push('## Recent Conversation');
    for (const msg of history.recentMessages) {
      const role = msg.role === 'user' ? 'User' : `Moccet${msg.agent ? ` (${msg.agent})` : ''}`;
      parts.push(`${role}: ${msg.content}`);
    }
  }

  return parts.join('\n');
}

/**
 * Get conversation statistics for a user
 */
export async function getConversationStats(email: string): Promise<{
  totalMessages: number;
  uncompactedMessages: number;
  summaryCount: number;
  estimatedTokens: number;
}> {
  const supabase = createAdminClient();

  const [totalResult, uncompactedResult, summaryResult, tokenResult] = await Promise.all([
    supabase
      .from('conversation_history')
      .select('*', { count: 'exact', head: true })
      .eq('user_email', email),
    supabase
      .from('conversation_history')
      .select('*', { count: 'exact', head: true })
      .eq('user_email', email)
      .eq('is_compacted', false),
    supabase
      .from('conversation_summaries')
      .select('*', { count: 'exact', head: true })
      .eq('user_email', email),
    supabase
      .from('conversation_history')
      .select('token_count')
      .eq('user_email', email)
      .eq('is_compacted', false),
  ]);

  const totalTokens = (tokenResult.data || []).reduce(
    (sum, m) => sum + (m.token_count || 0),
    0
  );

  return {
    totalMessages: totalResult.count || 0,
    uncompactedMessages: uncompactedResult.count || 0,
    summaryCount: summaryResult.count || 0,
    estimatedTokens: totalTokens,
  };
}
