/**
 * Agent Memory Service
 *
 * Handles storing and retrieving learning data for the multi-agent system:
 * - Debate outcomes and resolutions
 * - Consensus validation results
 * - Recommendation outcomes
 * - Learned patterns from user feedback
 *
 * Enables the system to learn from past interactions and improve future recommendations.
 */

import { createAdminClient } from '@/lib/supabase/server';
import { Conflict } from './coordinators';
import { ConsensusResult } from './consensus-validator';
import { StructuredInsight, UserContext } from './types';

// ============================================================================
// TYPES
// ============================================================================

export interface DebateOutcome {
  conflictId: string;
  conflictType: Conflict['type'];
  severity: Conflict['severity'];
  agentA: {
    name: string;
    domain: string;
    position: string;
    evidence: string[];
    confidence: number;
  };
  agentB: {
    name: string;
    domain: string;
    position: string;
    evidence: string[];
    confidence: number;
  };
  resolution: string;
  compromiseType: string;
  resolutionConfidence: number;
  resolutionReasoning: string;
}

export interface LearnedPattern {
  patternType: 'conflict_resolution' | 'consensus_predictor' | 'effectiveness_pattern' | 'timing_preference' | 'domain_priority';
  patternKey: string;
  patternData: Record<string, unknown>;
  confidence: number;
  sampleCount: number;
  successRate?: number;
}

export interface HistoricalContext {
  recentDebates: Array<{
    conflictType: string;
    agents: string[];
    resolution: string;
    userAccepted: boolean | null;
  }>;
  learnedPatterns: LearnedPattern[];
  domainPriorities: Record<string, number>;
  effectiveRecommendationTypes: string[];
  avoidedRecommendationTypes: string[];
}

// ============================================================================
// AGENT MEMORY SERVICE
// ============================================================================

export class AgentMemoryService {
  private supabase: ReturnType<typeof createAdminClient>;

  constructor() {
    this.supabase = createAdminClient();
  }

  // ==========================================================================
  // STORE METHODS
  // ==========================================================================

  /**
   * Store debate outcome for future learning
   */
  async storeDebateOutcome(
    userEmail: string,
    debate: DebateOutcome,
    context?: Partial<UserContext>
  ): Promise<void> {
    const { error } = await this.supabase
      .from('agent_debate_history')
      .insert({
        id: debate.conflictId,
        user_email: userEmail,
        conflict_type: debate.conflictType,
        severity: debate.severity,
        agent_a_name: debate.agentA.name,
        agent_a_domain: debate.agentA.domain,
        agent_a_position: debate.agentA.position,
        agent_a_evidence: debate.agentA.evidence,
        agent_a_confidence: debate.agentA.confidence,
        agent_b_name: debate.agentB.name,
        agent_b_domain: debate.agentB.domain,
        agent_b_position: debate.agentB.position,
        agent_b_evidence: debate.agentB.evidence,
        agent_b_confidence: debate.agentB.confidence,
        resolution: debate.resolution,
        compromise_type: debate.compromiseType,
        resolution_confidence: debate.resolutionConfidence,
        resolution_reasoning: debate.resolutionReasoning,
        context_snapshot: context ? {
          availableDataSources: context.availableDataSources,
          hasDeepContent: !!context.deepContent,
          timestamp: new Date().toISOString(),
        } : {},
      });

    if (error) {
      console.error('[AgentMemory] Error storing debate outcome:', error);
    } else {
      console.log(`[AgentMemory] Stored debate outcome: ${debate.conflictId}`);
    }
  }

  /**
   * Store consensus validation result
   */
  async storeConsensusResult(
    userEmail: string,
    result: ConsensusResult,
    insight: { title?: string; recommendation?: string },
    sourceCoordinator: string,
    sourceDomain: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from('agent_consensus_history')
      .insert({
        user_email: userEmail,
        insight_id: result.insightId,
        insight_title: insight.title,
        insight_recommendation: insight.recommendation,
        source_coordinator: sourceCoordinator,
        source_domain: sourceDomain,
        consensus_level: result.consensusLevel,
        consensus_score: result.consensusScore,
        original_confidence: result.originalConfidence,
        adjusted_confidence: result.adjustedConfidence,
        votes: result.votes,
        flags: result.flags,
      });

    if (error) {
      console.error('[AgentMemory] Error storing consensus result:', error);
    }
  }

  /**
   * Store recommendation for outcome tracking
   */
  async storeRecommendation(
    userEmail: string,
    insight: StructuredInsight,
    wasDebated: boolean,
    debateId?: string,
    consensusLevel?: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from('recommendation_outcomes')
      .upsert({
        id: `${userEmail}_${insight.id}_${Date.now()}`,
        user_email: userEmail,
        insight_id: insight.id,
        insight_title: insight.title,
        insight_category: insight.category,
        recommendation: insight.recommendation,
        outcome: 'pending',
        source_agents: insight.contributingAgents,
        was_debated: wasDebated,
        debate_id: debateId,
        consensus_level: consensusLevel,
        recommended_at: new Date().toISOString(),
      }, { onConflict: 'id' });

    if (error) {
      console.error('[AgentMemory] Error storing recommendation:', error);
    }
  }

  /**
   * Store cross-domain flag for pattern analysis
   */
  async storeCrossDomainFlag(
    userEmail: string,
    fromDomain: string,
    toDomains: string[],
    flagType: string,
    priority: string,
    context: Record<string, unknown>
  ): Promise<void> {
    const { error } = await this.supabase
      .from('cross_domain_flag_history')
      .insert({
        user_email: userEmail,
        from_domain: fromDomain,
        to_domains: toDomains,
        flag_type: flagType,
        priority,
        context,
      });

    if (error) {
      console.error('[AgentMemory] Error storing flag:', error);
    }
  }

  // ==========================================================================
  // RETRIEVE METHODS
  // ==========================================================================

  /**
   * Get historical context for a user to inform agent decisions
   */
  async getHistoricalContext(userEmail: string): Promise<HistoricalContext> {
    const [debates, patterns, outcomes] = await Promise.all([
      this.getRecentDebates(userEmail, 10),
      this.getLearnedPatterns(userEmail),
      this.getRecommendationOutcomes(userEmail, 20),
    ]);

    // Calculate domain priorities from debates
    const domainPriorities = this.calculateDomainPriorities(debates);

    // Calculate effective recommendation types from outcomes
    const { effective, avoided } = this.analyzeOutcomes(outcomes);

    return {
      recentDebates: debates.map(d => ({
        conflictType: d.conflict_type,
        agents: [d.agent_a_name, d.agent_b_name],
        resolution: d.resolution,
        userAccepted: d.user_accepted,
      })),
      learnedPatterns: patterns,
      domainPriorities,
      effectiveRecommendationTypes: effective,
      avoidedRecommendationTypes: avoided,
    };
  }

  /**
   * Get recent debates for a user
   */
  private async getRecentDebates(userEmail: string, limit: number = 10) {
    const { data, error } = await this.supabase
      .from('agent_debate_history')
      .select('*')
      .eq('user_email', userEmail)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[AgentMemory] Error fetching debates:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Get learned patterns for a user
   */
  private async getLearnedPatterns(userEmail: string): Promise<LearnedPattern[]> {
    const { data, error } = await this.supabase
      .from('agent_learned_patterns')
      .select('*')
      .eq('user_email', userEmail)
      .gte('confidence', 0.5) // Only confident patterns
      .order('confidence', { ascending: false });

    if (error) {
      console.error('[AgentMemory] Error fetching patterns:', error);
      return [];
    }

    return (data || []).map(p => ({
      patternType: p.pattern_type,
      patternKey: p.pattern_key,
      patternData: p.pattern_data,
      confidence: p.confidence,
      sampleCount: p.sample_count,
      successRate: p.success_rate,
    }));
  }

  /**
   * Get recommendation outcomes for a user
   */
  private async getRecommendationOutcomes(userEmail: string, limit: number = 20) {
    const { data, error } = await this.supabase
      .from('recommendation_outcomes')
      .select('*')
      .eq('user_email', userEmail)
      .not('outcome', 'eq', 'pending')
      .order('outcome_recorded_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[AgentMemory] Error fetching outcomes:', error);
      return [];
    }

    return data || [];
  }

  /**
   * Calculate domain priorities based on debate outcomes
   */
  private calculateDomainPriorities(debates: Array<{ agent_a_domain: string; agent_b_domain: string; user_accepted: boolean | null; resolution: string }>): Record<string, number> {
    const priorities: Record<string, number> = {
      HEALTH: 0.5,
      WORK: 0.5,
      LIFESTYLE: 0.5,
    };

    // Analyze which domain's position was favored in resolutions
    for (const debate of debates) {
      if (debate.user_accepted === true) {
        // If user accepted, both domains get a small boost
        priorities[debate.agent_a_domain] = (priorities[debate.agent_a_domain] || 0.5) + 0.02;
        priorities[debate.agent_b_domain] = (priorities[debate.agent_b_domain] || 0.5) + 0.02;
      } else if (debate.user_accepted === false) {
        // If rejected, both get a small penalty
        priorities[debate.agent_a_domain] = Math.max(0.1, (priorities[debate.agent_a_domain] || 0.5) - 0.02);
        priorities[debate.agent_b_domain] = Math.max(0.1, (priorities[debate.agent_b_domain] || 0.5) - 0.02);
      }
    }

    return priorities;
  }

  /**
   * Analyze outcomes to find effective and avoided recommendation types
   */
  private analyzeOutcomes(outcomes: Array<{ insight_category: string; outcome: string }>): { effective: string[]; avoided: string[] } {
    const categoryStats: Record<string, { accepted: number; rejected: number }> = {};

    for (const outcome of outcomes) {
      const cat = outcome.insight_category || 'GENERAL';
      if (!categoryStats[cat]) {
        categoryStats[cat] = { accepted: 0, rejected: 0 };
      }

      if (outcome.outcome === 'accepted' || outcome.outcome === 'partially_followed') {
        categoryStats[cat].accepted++;
      } else if (outcome.outcome === 'rejected' || outcome.outcome === 'ignored') {
        categoryStats[cat].rejected++;
      }
    }

    const effective: string[] = [];
    const avoided: string[] = [];

    for (const [category, stats] of Object.entries(categoryStats)) {
      const total = stats.accepted + stats.rejected;
      if (total < 3) continue; // Need enough samples

      const acceptRate = stats.accepted / total;
      if (acceptRate > 0.7) {
        effective.push(category);
      } else if (acceptRate < 0.3) {
        avoided.push(category);
      }
    }

    return { effective, avoided };
  }

  // ==========================================================================
  // LEARNING METHODS
  // ==========================================================================

  /**
   * Record user feedback on a debate resolution
   */
  async recordDebateFeedback(
    debateId: string,
    userAccepted: boolean,
    userFeedback?: string,
    modifiedTo?: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from('agent_debate_history')
      .update({
        user_accepted: userAccepted,
        user_feedback: userFeedback,
        user_modified_to: modifiedTo,
        feedback_received_at: new Date().toISOString(),
      })
      .eq('id', debateId);

    if (error) {
      console.error('[AgentMemory] Error recording debate feedback:', error);
      return;
    }

    // Update learned patterns based on feedback
    await this.learnFromDebateFeedback(debateId, userAccepted);
  }

  /**
   * Record user feedback on a recommendation
   */
  async recordRecommendationOutcome(
    recommendationId: string,
    outcome: 'accepted' | 'rejected' | 'modified' | 'ignored' | 'partially_followed',
    details?: string,
    modification?: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from('recommendation_outcomes')
      .update({
        outcome,
        outcome_details: details,
        modification_made: modification,
        outcome_recorded_at: new Date().toISOString(),
      })
      .eq('id', recommendationId);

    if (error) {
      console.error('[AgentMemory] Error recording outcome:', error);
    }
  }

  /**
   * Learn from debate feedback to improve future resolutions
   */
  private async learnFromDebateFeedback(debateId: string, userAccepted: boolean): Promise<void> {
    // Get the debate details
    const { data: debate } = await this.supabase
      .from('agent_debate_history')
      .select('*')
      .eq('id', debateId)
      .single();

    if (!debate) return;

    // Update conflict resolution pattern
    const patternKey = `${debate.agent_a_domain}_vs_${debate.agent_b_domain}`;

    await this.updateLearnedPattern(
      debate.user_email,
      'conflict_resolution',
      patternKey,
      {
        conflictType: debate.conflict_type,
        compromiseType: debate.compromise_type,
        lastResolution: debate.resolution,
        lastAccepted: userAccepted,
      },
      userAccepted
    );

    // Update domain priority pattern
    await this.updateLearnedPattern(
      debate.user_email,
      'domain_priority',
      debate.agent_a_domain,
      { domain: debate.agent_a_domain },
      userAccepted
    );

    await this.updateLearnedPattern(
      debate.user_email,
      'domain_priority',
      debate.agent_b_domain,
      { domain: debate.agent_b_domain },
      userAccepted
    );
  }

  /**
   * Update or create a learned pattern
   */
  private async updateLearnedPattern(
    userEmail: string,
    patternType: LearnedPattern['patternType'],
    patternKey: string,
    patternData: Record<string, unknown>,
    wasSuccessful: boolean
  ): Promise<void> {
    // Try to update existing pattern
    const { data: existing } = await this.supabase
      .from('agent_learned_patterns')
      .select('confidence, sample_count, pattern_data')
      .eq('user_email', userEmail)
      .eq('pattern_type', patternType)
      .eq('pattern_key', patternKey)
      .single();

    const learningRate = 0.1;

    if (existing) {
      // Update with exponential moving average
      let newConfidence = existing.confidence;
      if (wasSuccessful) {
        newConfidence = existing.confidence + learningRate * (1.0 - existing.confidence);
      } else {
        newConfidence = existing.confidence - learningRate * existing.confidence;
      }
      newConfidence = Math.max(0.1, Math.min(0.95, newConfidence));

      // Merge pattern data
      const mergedData = { ...existing.pattern_data, ...patternData };

      await this.supabase
        .from('agent_learned_patterns')
        .update({
          confidence: newConfidence,
          sample_count: existing.sample_count + 1,
          pattern_data: mergedData,
          updated_at: new Date().toISOString(),
          last_used_at: new Date().toISOString(),
        })
        .eq('user_email', userEmail)
        .eq('pattern_type', patternType)
        .eq('pattern_key', patternKey);
    } else {
      // Create new pattern
      await this.supabase
        .from('agent_learned_patterns')
        .insert({
          user_email: userEmail,
          pattern_type: patternType,
          pattern_key: patternKey,
          pattern_data: patternData,
          confidence: wasSuccessful ? 0.6 : 0.4,
          sample_count: 1,
        });
    }
  }

  // ==========================================================================
  // QUERY METHODS FOR AGENTS
  // ==========================================================================

  /**
   * Get similar past debates to inform current conflict resolution
   */
  async getSimilarDebates(
    userEmail: string,
    conflictType: string,
    agentNames: string[]
  ): Promise<Array<{ resolution: string; wasAccepted: boolean | null; compromiseType: string }>> {
    const { data, error } = await this.supabase
      .from('agent_debate_history')
      .select('resolution, user_accepted, compromise_type')
      .eq('user_email', userEmail)
      .eq('conflict_type', conflictType)
      .or(`agent_a_name.in.(${agentNames.join(',')}),agent_b_name.in.(${agentNames.join(',')})`)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('[AgentMemory] Error fetching similar debates:', error);
      return [];
    }

    return (data || []).map(d => ({
      resolution: d.resolution,
      wasAccepted: d.user_accepted,
      compromiseType: d.compromise_type,
    }));
  }

  /**
   * Get consensus prediction based on historical data
   */
  async predictConsensus(
    userEmail: string,
    insightCategory: string,
    sourceCoordinator: string
  ): Promise<{ predictedLevel: string; confidence: number } | null> {
    const { data, error } = await this.supabase
      .from('agent_consensus_history')
      .select('consensus_level, consensus_score')
      .eq('user_email', userEmail)
      .eq('source_domain', insightCategory)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error || !data || data.length < 3) {
      return null; // Not enough data to predict
    }

    // Calculate average consensus level
    const levelCounts: Record<string, number> = {};
    let totalScore = 0;

    for (const item of data) {
      levelCounts[item.consensus_level] = (levelCounts[item.consensus_level] || 0) + 1;
      totalScore += item.consensus_score;
    }

    // Find most common level
    let predictedLevel = 'weak';
    let maxCount = 0;
    for (const [level, count] of Object.entries(levelCounts)) {
      if (count > maxCount) {
        maxCount = count;
        predictedLevel = level;
      }
    }

    return {
      predictedLevel,
      confidence: maxCount / data.length,
    };
  }

  /**
   * Check if a recommendation type is typically effective for this user
   */
  async isRecommendationTypeEffective(
    userEmail: string,
    category: string
  ): Promise<{ effective: boolean; sampleSize: number; successRate: number } | null> {
    const { data, error } = await this.supabase
      .from('recommendation_outcomes')
      .select('outcome')
      .eq('user_email', userEmail)
      .eq('insight_category', category)
      .not('outcome', 'eq', 'pending');

    if (error || !data || data.length < 3) {
      return null; // Not enough data
    }

    const accepted = data.filter(d =>
      d.outcome === 'accepted' || d.outcome === 'partially_followed'
    ).length;

    const successRate = accepted / data.length;

    return {
      effective: successRate > 0.5,
      sampleSize: data.length,
      successRate,
    };
  }
}

/**
 * Format historical context for agent prompts
 */
export function formatHistoricalContextForPrompt(context: HistoricalContext): string {
  if (!context.recentDebates.length && !context.learnedPatterns.length) {
    return '';
  }

  const parts: string[] = ['\n\n=== LEARNED FROM PAST INTERACTIONS ==='];

  // Domain priorities
  if (Object.keys(context.domainPriorities).length > 0) {
    parts.push('\n📊 User Domain Priorities:');
    const sorted = Object.entries(context.domainPriorities)
      .sort((a, b) => b[1] - a[1]);
    for (const [domain, priority] of sorted) {
      const priorityLabel = priority > 0.6 ? 'HIGH' : priority > 0.4 ? 'MEDIUM' : 'LOW';
      parts.push(`- ${domain}: ${priorityLabel} priority`);
    }
  }

  // Effective recommendations
  if (context.effectiveRecommendationTypes.length > 0) {
    parts.push('\n✅ Recommendations that work well for this user:');
    parts.push(`- ${context.effectiveRecommendationTypes.join(', ')}`);
  }

  // Avoided recommendations
  if (context.avoidedRecommendationTypes.length > 0) {
    parts.push('\n⚠️ Recommendation types to avoid (low acceptance):');
    parts.push(`- ${context.avoidedRecommendationTypes.join(', ')}`);
  }

  // Recent debate patterns
  const acceptedDebates = context.recentDebates.filter(d => d.userAccepted === true);
  if (acceptedDebates.length > 0) {
    parts.push('\n🤝 Compromise styles that worked:');
    for (const debate of acceptedDebates.slice(0, 3)) {
      parts.push(`- ${debate.conflictType}: "${debate.resolution.slice(0, 100)}..."`);
    }
  }

  // Learned patterns
  const highConfPatterns = context.learnedPatterns.filter(p => p.confidence > 0.7);
  if (highConfPatterns.length > 0) {
    parts.push('\n🧠 Strong learned patterns:');
    for (const pattern of highConfPatterns.slice(0, 3)) {
      parts.push(`- ${pattern.patternType}: ${pattern.patternKey} (${Math.round(pattern.confidence * 100)}% confident)`);
    }
  }

  parts.push('\n→ Use this history to make better recommendations for this user.');

  return parts.join('\n');
}
