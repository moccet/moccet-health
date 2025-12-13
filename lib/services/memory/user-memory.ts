/**
 * User Memory Service
 *
 * Manages the user's long-term memory for hyper-personalization:
 * - Episodic: Conversation history
 * - Semantic: Learned facts
 * - Outcome: Advice effectiveness tracking
 * - Preference: Action approval patterns
 * - Style: Communication preferences
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// =============================================================================
// TYPES
// =============================================================================

export interface LearnedFact {
  id: string;
  category: string;
  fact_key: string;
  fact_value: string;
  confidence: number;
  source: string;
  learned_at: string;
}

export interface AdviceOutcome {
  id: string;
  advice_type: string;
  advice_given: string;
  advice_summary?: string;
  metric_name: string;
  baseline_value: number | null;
  target_value: number | null;
  current_value: number | null;
  outcome: 'improved' | 'no_change' | 'worsened' | 'pending' | 'unknown';
  improvement_percentage?: number;
  created_at: string;
}

export interface ActionPreference {
  action_type: string;
  approval_rate: number;
  learned_preference: string | null;
  recent_decisions: Array<{
    approved: boolean;
    feedback?: string;
  }>;
}

export interface CommunicationStyle {
  verbosity: 'brief' | 'medium' | 'detailed';
  tone: 'casual' | 'professional' | 'scientific' | 'encouraging';
  emoji_usage: boolean;
  prefers_lists: boolean;
  prefers_explanations: boolean;
  prefers_research_citations: boolean;
  prefers_action_items: boolean;
  preferred_time_format: '12h' | '24h';
  preferred_units: 'imperial' | 'metric';
  response_length_preference: 'short' | 'medium' | 'long';
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  tool_calls?: any[];
}

export interface Conversation {
  id: string;
  thread_id: string;
  messages: ConversationMessage[];
  summary?: string;
  topic?: string;
  created_at: string;
  updated_at: string;
}

export interface MemoryContext {
  facts: LearnedFact[];
  style: CommunicationStyle | null;
  outcomes: AdviceOutcome[];
  preferences: ActionPreference[];
  recentSummary: string | null;
  recentConversations: Array<{
    topic: string;
    summary: string;
    date: string;
  }>;
}

export interface AdviceRecord {
  advice_type: string;
  advice_given: string;
  advice_summary?: string;
  metric_name: string;
  baseline_value?: number;
  target_value?: number;
  target_direction?: 'increase' | 'decrease' | 'maintain';
  check_after_days?: number;
  related_task_id?: string;
}

// =============================================================================
// USER MEMORY SERVICE
// =============================================================================

export class UserMemoryService {
  // ---------------------------------------------------------------------------
  // MEMORY CONTEXT
  // ---------------------------------------------------------------------------

  /**
   * Get full memory context for agent personalization
   */
  async getMemoryContext(userEmail: string): Promise<MemoryContext> {
    // Use the database function for efficient retrieval
    const { data, error } = await supabase.rpc('get_user_memory_context', {
      p_user_email: userEmail,
    });

    if (error) {
      console.error('Error fetching memory context:', error);
      // Return empty context on error
      return {
        facts: [],
        style: null,
        outcomes: [],
        preferences: [],
        recentSummary: null,
        recentConversations: [],
      };
    }

    // Get recent conversations separately
    const conversations = await this.getRecentConversations(userEmail, 5);

    return {
      facts: data?.facts || [],
      style: data?.style || null,
      outcomes: data?.recent_outcomes || [],
      preferences: data?.action_preferences || [],
      recentSummary: data?.recent_summary || null,
      recentConversations: conversations.map((c) => ({
        topic: c.topic || 'General',
        summary: c.summary || 'No summary available',
        date: c.updated_at,
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // CONVERSATIONS (Episodic Memory)
  // ---------------------------------------------------------------------------

  /**
   * Save or update a conversation
   */
  async saveConversation(
    userEmail: string,
    threadId: string,
    messages: ConversationMessage[],
    topic?: string
  ): Promise<string> {
    const { data, error } = await supabase
      .from('user_conversations')
      .upsert(
        {
          user_email: userEmail,
          thread_id: threadId,
          messages,
          topic,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'thread_id',
        }
      )
      .select('id')
      .single();

    if (error) {
      console.error('Error saving conversation:', error);
      throw error;
    }

    return data.id;
  }

  /**
   * Get a conversation by thread ID
   */
  async getConversation(threadId: string): Promise<Conversation | null> {
    const { data, error } = await supabase
      .from('user_conversations')
      .select('*')
      .eq('thread_id', threadId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      console.error('Error fetching conversation:', error);
      throw error;
    }

    return data;
  }

  /**
   * Get recent conversations for a user
   */
  async getRecentConversations(
    userEmail: string,
    limit: number = 10
  ): Promise<Conversation[]> {
    const { data, error } = await supabase
      .from('user_conversations')
      .select('*')
      .eq('user_email', userEmail)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching recent conversations:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Update conversation summary (called after conversation ends)
   */
  async updateConversationSummary(
    threadId: string,
    summary: string,
    insightsDiscussed?: string[],
    actionsTaken?: string[]
  ): Promise<void> {
    const { error } = await supabase
      .from('user_conversations')
      .update({
        summary,
        insights_discussed: insightsDiscussed,
        actions_taken: actionsTaken,
      })
      .eq('thread_id', threadId);

    if (error) {
      console.error('Error updating conversation summary:', error);
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // LEARNED FACTS (Semantic Memory)
  // ---------------------------------------------------------------------------

  /**
   * Learn a fact about the user
   */
  async learnFact(
    userEmail: string,
    category: string,
    key: string,
    value: string,
    source: string,
    confidence: number = 0.5,
    evidence?: any
  ): Promise<string> {
    // Use the database function for upsert logic
    const { data, error } = await supabase.rpc('learn_user_fact', {
      p_user_email: userEmail,
      p_category: category,
      p_key: key,
      p_value: value,
      p_source: source,
      p_confidence: confidence,
    });

    if (error) {
      console.error('Error learning fact:', error);
      throw error;
    }

    // If evidence provided, update separately
    if (evidence) {
      await supabase
        .from('user_learned_facts')
        .update({ evidence })
        .eq('id', data);
    }

    return data;
  }

  /**
   * Get all facts for a user
   */
  async getFacts(
    userEmail: string,
    category?: string
  ): Promise<LearnedFact[]> {
    let query = supabase
      .from('user_learned_facts')
      .select('*')
      .eq('user_email', userEmail)
      .or('expires_at.is.null,expires_at.gt.now()')
      .order('confidence', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching facts:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Update fact confidence
   */
  async updateFactConfidence(
    factId: string,
    newConfidence: number
  ): Promise<void> {
    const { error } = await supabase
      .from('user_learned_facts')
      .update({
        confidence: Math.min(1, Math.max(0, newConfidence)),
        last_confirmed_at: new Date().toISOString(),
      })
      .eq('id', factId);

    if (error) {
      console.error('Error updating fact confidence:', error);
      throw error;
    }
  }

  /**
   * Delete a learned fact
   */
  async forgetFact(factId: string): Promise<void> {
    const { error } = await supabase
      .from('user_learned_facts')
      .delete()
      .eq('id', factId);

    if (error) {
      console.error('Error deleting fact:', error);
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // ADVICE OUTCOMES (Outcome Memory)
  // ---------------------------------------------------------------------------

  /**
   * Track advice for outcome monitoring
   */
  async trackAdvice(
    userEmail: string,
    advice: AdviceRecord
  ): Promise<string> {
    const { data, error } = await supabase
      .from('advice_outcomes')
      .insert({
        user_email: userEmail,
        advice_type: advice.advice_type,
        advice_given: advice.advice_given,
        advice_summary: advice.advice_summary,
        metric_name: advice.metric_name,
        baseline_value: advice.baseline_value,
        target_value: advice.target_value,
        target_direction: advice.target_direction,
        check_after_days: advice.check_after_days || 14,
        related_task_id: advice.related_task_id,
        outcome: 'pending',
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error tracking advice:', error);
      throw error;
    }

    return data.id;
  }

  /**
   * Update advice outcome
   */
  async updateAdviceOutcome(
    adviceId: string,
    currentValue: number,
    outcome: 'improved' | 'no_change' | 'worsened' | 'unknown'
  ): Promise<void> {
    // Get original advice to calculate improvement
    const { data: advice } = await supabase
      .from('advice_outcomes')
      .select('baseline_value, target_value, target_direction')
      .eq('id', adviceId)
      .single();

    let improvementPercentage: number | null = null;
    if (advice?.baseline_value && currentValue) {
      const change = currentValue - advice.baseline_value;
      improvementPercentage = (change / Math.abs(advice.baseline_value)) * 100;
    }

    const { error } = await supabase
      .from('advice_outcomes')
      .update({
        current_value: currentValue,
        outcome,
        improvement_percentage: improvementPercentage,
        checked_at: new Date().toISOString(),
      })
      .eq('id', adviceId);

    if (error) {
      console.error('Error updating advice outcome:', error);
      throw error;
    }
  }

  /**
   * Get pending outcome checks
   */
  async getPendingOutcomeChecks(): Promise<AdviceOutcome[]> {
    const { data, error } = await supabase.rpc('get_pending_outcome_checks');

    if (error) {
      console.error('Error getting pending checks:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get advice history for a user
   */
  async getAdviceHistory(
    userEmail: string,
    type?: string,
    limit: number = 20
  ): Promise<AdviceOutcome[]> {
    let query = supabase
      .from('advice_outcomes')
      .select('*')
      .eq('user_email', userEmail)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (type) {
      query = query.eq('advice_type', type);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching advice history:', error);
      return [];
    }

    return data || [];
  }

  // ---------------------------------------------------------------------------
  // ACTION PREFERENCES (Preference Memory)
  // ---------------------------------------------------------------------------

  /**
   * Record action approval/rejection
   */
  async recordActionPreference(
    userEmail: string,
    actionType: string,
    actionPattern: any,
    approved: boolean,
    feedback?: string,
    context?: any
  ): Promise<void> {
    const { error } = await supabase.from('user_action_preferences').insert({
      user_email: userEmail,
      action_type: actionType,
      action_pattern: actionPattern,
      approved,
      user_feedback: feedback,
      context,
    });

    if (error) {
      console.error('Error recording action preference:', error);
      throw error;
    }
  }

  /**
   * Update learned preference for an action type
   */
  async updateLearnedPreference(
    userEmail: string,
    actionType: string,
    learnedPreference: string
  ): Promise<void> {
    // Update the most recent entry with the learned preference
    const { data: recent } = await supabase
      .from('user_action_preferences')
      .select('id')
      .eq('user_email', userEmail)
      .eq('action_type', actionType)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (recent) {
      await supabase
        .from('user_action_preferences')
        .update({ learned_preference: learnedPreference })
        .eq('id', recent.id);
    }
  }

  /**
   * Get action preferences for a user
   */
  async getActionPreferences(userEmail: string): Promise<ActionPreference[]> {
    const { data, error } = await supabase
      .from('user_action_preferences')
      .select('action_type, approved, learned_preference, user_feedback')
      .eq('user_email', userEmail)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching action preferences:', error);
      return [];
    }

    // Group by action type and calculate approval rate
    const grouped = new Map<string, {
      approvals: number;
      total: number;
      learned_preference: string | null;
      decisions: Array<{ approved: boolean; feedback?: string }>;
    }>();

    for (const row of data || []) {
      const existing = grouped.get(row.action_type) || {
        approvals: 0,
        total: 0,
        learned_preference: null,
        decisions: [],
      };

      existing.total++;
      if (row.approved) existing.approvals++;
      if (row.learned_preference) existing.learned_preference = row.learned_preference;
      existing.decisions.push({
        approved: row.approved,
        feedback: row.user_feedback,
      });

      grouped.set(row.action_type, existing);
    }

    return Array.from(grouped.entries()).map(([type, data]) => ({
      action_type: type,
      approval_rate: (data.approvals / data.total) * 100,
      learned_preference: data.learned_preference,
      recent_decisions: data.decisions.slice(0, 5),
    }));
  }

  // ---------------------------------------------------------------------------
  // COMMUNICATION STYLE
  // ---------------------------------------------------------------------------

  /**
   * Get communication style for a user
   */
  async getCommunicationStyle(userEmail: string): Promise<CommunicationStyle | null> {
    const { data, error } = await supabase
      .from('user_communication_style')
      .select('*')
      .eq('user_email', userEmail)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      console.error('Error fetching communication style:', error);
      return null;
    }

    return {
      verbosity: data.verbosity,
      tone: data.tone,
      emoji_usage: data.emoji_usage,
      prefers_lists: data.prefers_lists,
      prefers_explanations: data.prefers_explanations,
      prefers_research_citations: data.prefers_research_citations,
      prefers_action_items: data.prefers_action_items,
      preferred_time_format: data.preferred_time_format,
      preferred_units: data.preferred_units,
      response_length_preference: data.response_length_preference,
    };
  }

  /**
   * Update communication style
   */
  async updateCommunicationStyle(
    userEmail: string,
    updates: Partial<CommunicationStyle>
  ): Promise<void> {
    const { error } = await supabase
      .from('user_communication_style')
      .upsert({
        user_email: userEmail,
        ...updates,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_email',
      });

    if (error) {
      console.error('Error updating communication style:', error);
      throw error;
    }
  }

  /**
   * Increment interaction count for style inference
   */
  async incrementStyleInteractions(userEmail: string): Promise<void> {
    const { error } = await supabase.rpc('increment', {
      table_name: 'user_communication_style',
      column_name: 'inferred_from_interactions',
      row_id: userEmail,
      id_column: 'user_email',
    });

    // Silently fail - this is not critical
    if (error) {
      console.warn('Could not increment style interactions:', error);
    }
  }

  // ---------------------------------------------------------------------------
  // MEMORY SUMMARIES
  // ---------------------------------------------------------------------------

  /**
   * Create a memory summary
   */
  async createMemorySummary(
    userEmail: string,
    summaryType: 'weekly' | 'monthly' | 'quarterly' | 'journey',
    periodStart: Date,
    periodEnd: Date,
    summary: string,
    details?: {
      keyEvents?: any[];
      metricChanges?: any;
      successfulInterventions?: any[];
      unsuccessfulInterventions?: any[];
    }
  ): Promise<string> {
    const { data, error } = await supabase
      .from('user_memory_summaries')
      .insert({
        user_email: userEmail,
        summary_type: summaryType,
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
        summary_text: summary,
        key_events: details?.keyEvents,
        metric_changes: details?.metricChanges,
        successful_interventions: details?.successfulInterventions,
        unsuccessful_interventions: details?.unsuccessfulInterventions,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating memory summary:', error);
      throw error;
    }

    return data.id;
  }

  /**
   * Get recent summary of a specific type
   */
  async getRecentSummary(
    userEmail: string,
    type: 'weekly' | 'monthly' | 'quarterly' | 'journey'
  ): Promise<string | null> {
    const { data, error } = await supabase
      .from('user_memory_summaries')
      .select('summary_text')
      .eq('user_email', userEmail)
      .eq('summary_type', type)
      .order('period_end', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      return null;
    }

    return data?.summary_text || null;
  }
}

// Export singleton instance
export const userMemory = new UserMemoryService();
