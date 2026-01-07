/**
 * Consensus Validator
 *
 * Cross-validates insights by asking other agents/coordinators to evaluate them.
 * Adjusts confidence based on consensus and flags low-consensus recommendations.
 *
 * Voting Scale:
 * +2: Strong Agree - Aligns with my domain expertise
 * +1: Agree - Reasonable recommendation
 *  0: Neutral - Outside my expertise / no opinion
 * -1: Disagree - Minor concerns
 * -2: Strong Disagree - Contradicts my analysis
 */

import OpenAI from 'openai';
import { AgentInsight, UserContext } from './types';
import { CoordinatorResult } from './coordinators';

// ============================================================================
// TYPES
// ============================================================================

export type VoteScore = -2 | -1 | 0 | 1 | 2;

export interface ConsensusVote {
  insightId: string;
  votingAgent: string;
  votingDomain: string;
  vote: VoteScore;
  reasoning: string;
  concerns?: string[];
  supportingEvidence?: string[];
  timestamp: string;
}

export interface ConsensusResult {
  insightId: string;
  originalConfidence: number;
  adjustedConfidence: number;
  consensusScore: number; // -2 to +2 average
  consensusLevel: 'strong' | 'moderate' | 'weak' | 'contested';
  votes: ConsensusVote[];
  flags: ConsensusFlag[];
  validatedAt: string;
}

export interface ConsensusFlag {
  type: 'low_consensus' | 'domain_conflict' | 'evidence_gap' | 'expertise_mismatch';
  severity: 'warning' | 'caution' | 'info';
  message: string;
  fromAgent?: string;
}

export interface ValidationConfig {
  mode: 'light' | 'full';
  minVoters: number;
  confidenceAdjustmentFactor: number;
  lowConsensusThreshold: number;
}

const DEFAULT_CONFIG: ValidationConfig = {
  mode: 'full',
  minVoters: 1, // Allow validation with just 1 other coordinator
  confidenceAdjustmentFactor: 0.05, // ±5% per vote point
  lowConsensusThreshold: -0.5,
};

// ============================================================================
// CONSENSUS VALIDATOR
// ============================================================================

export class ConsensusValidator {
  private openai: OpenAI;
  private config: ValidationConfig;

  constructor(openai: OpenAI, config: Partial<ValidationConfig> = {}) {
    this.openai = openai;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Validate insights through cross-agent consensus
   */
  async validateInsights(
    insights: AgentInsight[],
    coordinatorResults: CoordinatorResult[],
    context: UserContext
  ): Promise<ConsensusResult[]> {
    const results: ConsensusResult[] = [];

    // Determine which insights to validate based on mode
    const insightsToValidate = this.config.mode === 'full'
      ? insights
      : insights.filter(i => i.impact === 'critical' || i.impact === 'high');

    console.log(`[ConsensusValidator] Validating ${insightsToValidate.length} insights (mode: ${this.config.mode})`);

    // Group insights by source coordinator
    const insightsBySource = this.groupInsightsBySource(insightsToValidate, coordinatorResults);

    // Validate each insight
    for (const insight of insightsToValidate) {
      const sourceCoordinator = this.findSourceCoordinator(insight, coordinatorResults);
      const otherCoordinators = coordinatorResults.filter(r => r !== sourceCoordinator);

      if (otherCoordinators.length < this.config.minVoters) {
        // Not enough voters - skip validation but note it
        results.push(this.createSkippedResult(insight, 'insufficient_voters'));
        continue;
      }

      // Get votes from other coordinators
      const votes = await this.collectVotes(insight, otherCoordinators, context);

      // Calculate consensus
      const consensusResult = this.calculateConsensus(insight, votes);

      // Adjust the insight's confidence
      insight.confidence = consensusResult.adjustedConfidence;

      results.push(consensusResult);
    }

    return results;
  }

  /**
   * Collect votes from coordinators
   */
  private async collectVotes(
    insight: AgentInsight,
    coordinators: CoordinatorResult[],
    context: UserContext
  ): Promise<ConsensusVote[]> {
    const votes: ConsensusVote[] = [];

    // Use AI to get structured votes from each coordinator's perspective
    const votingPromises = coordinators.map(async (coordinator) => {
      try {
        return await this.getCoordinatorVote(insight, coordinator, context);
      } catch (e) {
        console.error(`[ConsensusValidator] Vote failed from ${coordinator.coordinatorName}:`, e);
        return null;
      }
    });

    const voteResults = await Promise.all(votingPromises);

    for (const vote of voteResults) {
      if (vote) {
        votes.push(vote);
      }
    }

    return votes;
  }

  /**
   * Get a vote from a coordinator's perspective
   */
  private async getCoordinatorVote(
    insight: AgentInsight,
    coordinator: CoordinatorResult,
    context: UserContext
  ): Promise<ConsensusVote> {
    // Build context about what this coordinator knows
    const coordinatorContext = this.buildCoordinatorContext(coordinator, context);

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are the ${coordinator.coordinatorName} evaluating a recommendation from another domain.

Your domain expertise: ${coordinator.domain}
Your recent findings: ${coordinator.insights.slice(0, 3).map(i => i.title).join(', ')}

Evaluate whether this recommendation aligns with or contradicts your domain's analysis.

VOTING SCALE:
+2: Strong Agree - This recommendation strongly aligns with my domain's findings
+1: Agree - This is reasonable and doesn't conflict with my analysis
 0: Neutral - This is outside my domain expertise, no strong opinion
-1: Disagree - I have minor concerns based on my domain analysis
-2: Strong Disagree - This contradicts my domain's findings

Be objective. Only vote negatively if there's a genuine conflict with your domain's data.`,
        },
        {
          role: 'user',
          content: `RECOMMENDATION TO EVALUATE:
Title: ${insight.title}
Recommendation: ${insight.recommendation}
Data Quote: ${insight.dataQuote}
Impact: ${insight.impact}
Confidence: ${Math.round(insight.confidence * 100)}%

YOUR DOMAIN CONTEXT:
${coordinatorContext}

Evaluate this recommendation from your domain's perspective.

Return JSON:
{
  "vote": -2 to +2,
  "reasoning": "Why you voted this way",
  "concerns": ["any specific concerns"] or [],
  "supportingEvidence": ["evidence from your domain that supports/contradicts"] or []
}`,
        },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 300,
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    return {
      insightId: insight.id,
      votingAgent: coordinator.coordinatorName,
      votingDomain: coordinator.domain,
      vote: this.clampVote(parsed.vote || 0),
      reasoning: parsed.reasoning || 'No reasoning provided',
      concerns: parsed.concerns || [],
      supportingEvidence: parsed.supportingEvidence || [],
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Calculate consensus from votes
   */
  private calculateConsensus(
    insight: AgentInsight,
    votes: ConsensusVote[]
  ): ConsensusResult {
    const originalConfidence = insight.confidence;

    if (votes.length === 0) {
      return {
        insightId: insight.id,
        originalConfidence,
        adjustedConfidence: originalConfidence,
        consensusScore: 0,
        consensusLevel: 'weak',
        votes: [],
        flags: [{
          type: 'evidence_gap',
          severity: 'info',
          message: 'No cross-domain validation available',
        }],
        validatedAt: new Date().toISOString(),
      };
    }

    // Calculate average vote
    const totalVote = votes.reduce((sum, v) => sum + v.vote, 0);
    const consensusScore = totalVote / votes.length;

    // Determine consensus level
    let consensusLevel: ConsensusResult['consensusLevel'];
    if (consensusScore >= 1.5) consensusLevel = 'strong';
    else if (consensusScore >= 0.5) consensusLevel = 'moderate';
    else if (consensusScore >= -0.5) consensusLevel = 'weak';
    else consensusLevel = 'contested';

    // Calculate confidence adjustment
    const adjustment = consensusScore * this.config.confidenceAdjustmentFactor;
    const adjustedConfidence = Math.max(0.1, Math.min(0.99, originalConfidence + adjustment));

    // Generate flags
    const flags = this.generateFlags(votes, consensusScore, consensusLevel);

    return {
      insightId: insight.id,
      originalConfidence,
      adjustedConfidence,
      consensusScore,
      consensusLevel,
      votes,
      flags,
      validatedAt: new Date().toISOString(),
    };
  }

  /**
   * Generate flags based on voting results
   */
  private generateFlags(
    votes: ConsensusVote[],
    consensusScore: number,
    consensusLevel: ConsensusResult['consensusLevel']
  ): ConsensusFlag[] {
    const flags: ConsensusFlag[] = [];

    // Low consensus flag
    if (consensusScore < this.config.lowConsensusThreshold) {
      const dissenters = votes.filter(v => v.vote < 0);
      const concerns = dissenters.flatMap(v => v.concerns || []);

      flags.push({
        type: 'low_consensus',
        severity: 'warning',
        message: `Low consensus: ${dissenters.length} domain(s) have concerns. ${concerns[0] || ''}`,
        fromAgent: dissenters[0]?.votingAgent,
      });
    }

    // Domain conflict flag (strong disagreement from specific domain)
    const strongDisagree = votes.filter(v => v.vote === -2);
    for (const vote of strongDisagree) {
      flags.push({
        type: 'domain_conflict',
        severity: 'caution',
        message: `${vote.votingDomain} strongly disagrees: ${vote.reasoning}`,
        fromAgent: vote.votingAgent,
      });
    }

    // Mixed signals flag (both strong agree and strong disagree)
    const strongAgree = votes.filter(v => v.vote === 2);
    if (strongAgree.length > 0 && strongDisagree.length > 0) {
      flags.push({
        type: 'expertise_mismatch',
        severity: 'caution',
        message: 'Conflicting expert opinions - recommendation may be context-dependent',
      });
    }

    return flags;
  }

  /**
   * Build context string for a coordinator
   */
  private buildCoordinatorContext(
    coordinator: CoordinatorResult,
    context: UserContext
  ): string {
    const parts: string[] = [];

    // Add recent insights
    if (coordinator.insights.length > 0) {
      parts.push('Recent findings:');
      for (const insight of coordinator.insights.slice(0, 3)) {
        parts.push(`- ${insight.title}: ${insight.dataQuote}`);
      }
    }

    // Add cross-domain flags this coordinator raised
    if (coordinator.crossDomainFlags.length > 0) {
      parts.push('\nCross-domain concerns raised:');
      for (const flag of coordinator.crossDomainFlags) {
        parts.push(`- ${flag.flag}: ${flag.context.recommendation || ''}`);
      }
    }

    // Add domain-specific data
    switch (coordinator.domain) {
      case 'HEALTH':
        if (context.whoop) {
          parts.push(`\nHealth metrics: Recovery ${context.whoop.avgRecoveryScore}%, HRV ${context.whoop.avgHRV}ms`);
        }
        break;
      case 'WORK':
        if (context.deepContent) {
          parts.push(`\nWork context: ${context.deepContent.pendingTasks.length} pending tasks, ${context.deepContent.responseDebt.count} messages awaiting response`);
        }
        break;
      case 'LIFESTYLE':
        if (context.lifeContext) {
          const events = context.lifeContext.upcomingEvents?.length || 0;
          parts.push(`\nLife context: ${events} upcoming events`);
        }
        break;
    }

    return parts.join('\n');
  }

  /**
   * Group insights by their source coordinator
   */
  private groupInsightsBySource(
    insights: AgentInsight[],
    coordinators: CoordinatorResult[]
  ): Map<string, AgentInsight[]> {
    const grouped = new Map<string, AgentInsight[]>();

    for (const insight of insights) {
      const source = this.findSourceCoordinator(insight, coordinators);
      const key = source?.coordinatorName || 'unknown';

      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(insight);
    }

    return grouped;
  }

  /**
   * Find which coordinator produced an insight
   */
  private findSourceCoordinator(
    insight: AgentInsight,
    coordinators: CoordinatorResult[]
  ): CoordinatorResult | undefined {
    return coordinators.find(c =>
      c.insights.some(i => i.id === insight.id)
    );
  }

  /**
   * Create result for skipped validation
   */
  private createSkippedResult(
    insight: AgentInsight,
    reason: string
  ): ConsensusResult {
    return {
      insightId: insight.id,
      originalConfidence: insight.confidence,
      adjustedConfidence: insight.confidence,
      consensusScore: 0,
      consensusLevel: 'weak',
      votes: [],
      flags: [{
        type: 'evidence_gap',
        severity: 'info',
        message: `Validation skipped: ${reason}`,
      }],
      validatedAt: new Date().toISOString(),
    };
  }

  /**
   * Clamp vote to valid range
   */
  private clampVote(vote: number): VoteScore {
    if (vote >= 2) return 2;
    if (vote >= 1) return 1;
    if (vote <= -2) return -2;
    if (vote <= -1) return -1;
    return 0;
  }

  /**
   * Format consensus results for display
   */
  static formatConsensusForDisplay(results: ConsensusResult[]): string {
    const lines: string[] = ['## Consensus Validation Results\n'];

    for (const result of results) {
      const confidenceChange = result.adjustedConfidence - result.originalConfidence;
      const changeStr = confidenceChange >= 0 ? `+${(confidenceChange * 100).toFixed(1)}%` : `${(confidenceChange * 100).toFixed(1)}%`;

      lines.push(`### ${result.insightId}`);
      lines.push(`- Consensus: **${result.consensusLevel}** (score: ${result.consensusScore.toFixed(2)})`);
      lines.push(`- Confidence: ${(result.originalConfidence * 100).toFixed(0)}% → ${(result.adjustedConfidence * 100).toFixed(0)}% (${changeStr})`);

      if (result.votes.length > 0) {
        lines.push(`- Votes:`);
        for (const vote of result.votes) {
          const voteEmoji = vote.vote >= 1 ? '👍' : vote.vote <= -1 ? '👎' : '➖';
          lines.push(`  - ${voteEmoji} ${vote.votingDomain}: ${vote.reasoning}`);
        }
      }

      if (result.flags.length > 0) {
        lines.push(`- Flags:`);
        for (const flag of result.flags) {
          const flagEmoji = flag.severity === 'warning' ? '⚠️' : flag.severity === 'caution' ? '⚡' : 'ℹ️';
          lines.push(`  - ${flagEmoji} ${flag.message}`);
        }
      }

      lines.push('');
    }

    return lines.join('\n');
  }
}
