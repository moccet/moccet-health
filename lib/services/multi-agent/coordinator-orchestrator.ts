/**
 * Coordinator-Based Orchestrator
 *
 * A hierarchical multi-agent system that:
 * 1. Routes to domain coordinators (Health, Work, Lifestyle)
 * 2. Collects cross-domain flags
 * 3. Detects and resolves conflicts through debate
 * 4. Validates through consensus
 * 5. Produces final synthesized insights
 */

import OpenAI from 'openai';
import {
  AgentFinding,
  AgentInsight,
  CrossDomainInsight,
  ExecutionMode,
  EXECUTION_CONFIGS,
  MultiAgentResult,
  StructuredInsight,
  UserContext,
} from './types';
import {
  BaseCoordinator,
  CoordinatorResult,
  Conflict,
  CrossDomainFlag,
  HealthCoordinator,
  WorkCoordinator,
  LifestyleCoordinator,
} from './coordinators';
import { ConsensusValidator, ConsensusResult } from './consensus-validator';
import { AgentMemoryService, HistoricalContext, formatHistoricalContextForPrompt } from './agent-memory';
import { DebateEngine, DebateConflict, DebateResolution as FullDebateResolution, formatDebateResolution } from './debate-engine';

// ============================================================================
// TYPES
// ============================================================================

interface DebateRound {
  roundNumber: 1 | 2 | 3 | 4;
  roundType: 'position' | 'evidence' | 'compromise' | 'validation';
  agentAResponse: string;
  agentBResponse: string;
  moderatorNote?: string;
}

interface DebateResolution {
  conflictId: string;
  originalPositions: {
    agentA: string;
    agentB: string;
  };
  resolution: string;
  compromiseType: 'full_merge' | 'time_split' | 'priority_override' | 'conditional';
  confidenceInResolution: number;
  reasoning: string;
  rounds: DebateRound[];
}

interface ConsensusVote {
  insightId: string;
  votingAgent: string;
  vote: -2 | -1 | 0 | 1 | 2;
  reasoning: string;
}

interface CoordinatorOrchestratorConfig {
  maxCoordinators: number;
  enableDebate: boolean | 'quick' | 'full';  // 'quick' = single AI call, 'full' = multi-round
  enableConsensus: boolean | 'light' | 'full';
  maxApiCalls: number;
  timeoutMs: number;
}

const COORDINATOR_CONFIGS: Record<ExecutionMode, CoordinatorOrchestratorConfig> = {
  quick: {
    maxCoordinators: 1,
    enableDebate: false,
    enableConsensus: false,
    maxApiCalls: 4,
    timeoutMs: 15000,
  },
  standard: {
    maxCoordinators: 2,
    enableDebate: 'quick',  // Single AI call for efficiency
    enableConsensus: 'light',
    maxApiCalls: 15,
    timeoutMs: 45000,
  },
  deep: {
    maxCoordinators: 3,
    enableDebate: 'full',  // Full multi-round debate with argument tracking
    enableConsensus: 'full',
    maxApiCalls: 30,
    timeoutMs: 120000,  // 2 minutes for full debate
  },
};

// ============================================================================
// COORDINATOR ORCHESTRATOR
// ============================================================================

export class CoordinatorOrchestrator {
  private coordinators: BaseCoordinator[];
  private openai: OpenAI;
  private memory: AgentMemoryService;
  private debateEngine: DebateEngine;

  constructor(openaiApiKey: string) {
    this.openai = new OpenAI({ apiKey: openaiApiKey });
    this.coordinators = this.initializeCoordinators();
    this.memory = new AgentMemoryService();
    this.debateEngine = new DebateEngine(this.openai);
  }

  private initializeCoordinators(): BaseCoordinator[] {
    return [
      new HealthCoordinator(this.openai),
      new WorkCoordinator(this.openai),
      new LifestyleCoordinator(this.openai),
    ];
  }

  /**
   * Generate insights using coordinator-based system
   */
  async generateInsights(
    context: UserContext,
    mode: ExecutionMode = 'standard',
    maxInsights: number = 5
  ): Promise<MultiAgentResult> {
    const startTime = Date.now();
    const config = COORDINATOR_CONFIGS[mode];
    let apiCallsUsed = 0;

    console.log(`[CoordinatorOrchestrator] Starting (mode: ${mode})`);
    console.log(`[CoordinatorOrchestrator] Available sources: ${context.availableDataSources.join(', ')}`);

    // Step 0: Load historical context for learning
    let historicalContext: HistoricalContext | null = null;
    try {
      historicalContext = await this.memory.getHistoricalContext(context.email);
      if (historicalContext.recentDebates.length > 0 || historicalContext.learnedPatterns.length > 0) {
        console.log(`[CoordinatorOrchestrator] Loaded historical context: ${historicalContext.recentDebates.length} debates, ${historicalContext.learnedPatterns.length} patterns`);
      }
    } catch (e) {
      console.log('[CoordinatorOrchestrator] No historical context available');
    }

    // Step 1: Filter coordinators that can contribute
    const applicableCoordinators = this.coordinators
      .filter(c => c.canContribute(context))
      .slice(0, config.maxCoordinators);

    if (applicableCoordinators.length === 0) {
      console.log('[CoordinatorOrchestrator] No applicable coordinators');
      return this.getEmptyResult(startTime, mode);
    }

    console.log(`[CoordinatorOrchestrator] Running ${applicableCoordinators.length} coordinators: ${applicableCoordinators.map(c => c.name).join(', ')}`);

    // Step 2: Run coordinators in parallel
    const coordinatorResults = await this.runCoordinatorsInParallel(applicableCoordinators, context);
    apiCallsUsed += coordinatorResults.reduce((sum, r) => sum + r.agentsRun.length, 0);

    // Step 3: Collect all findings, conflicts, and cross-domain flags
    const allFindings: AgentFinding[] = coordinatorResults.flatMap(r => r.agentFindings);
    const allInsights: AgentInsight[] = coordinatorResults.flatMap(r => r.insights);
    const allConflicts: Conflict[] = coordinatorResults.flatMap(r => r.internalConflicts);
    const allFlags: CrossDomainFlag[] = coordinatorResults.flatMap(r => r.crossDomainFlags);

    console.log(`[CoordinatorOrchestrator] Collected ${allInsights.length} insights, ${allConflicts.length} conflicts, ${allFlags.length} flags`);

    // Step 4: Detect cross-coordinator conflicts
    const crossCoordinatorConflicts = this.detectCrossCoordinatorConflicts(coordinatorResults, allFlags);
    allConflicts.push(...crossCoordinatorConflicts);

    // Step 5: Resolve conflicts through debate (if enabled)
    let resolutions: DebateResolution[] = [];
    let fullDebateResolutions: FullDebateResolution[] = [];
    if (config.enableDebate && allConflicts.length > 0) {
      const debateMode = config.enableDebate === 'full' ? 'full' : 'quick';
      console.log(`[CoordinatorOrchestrator] Running ${debateMode} debate for ${allConflicts.length} conflicts`);

      if (debateMode === 'full') {
        // Use full multi-round debate engine
        fullDebateResolutions = await this.runFullDebate(allConflicts, historicalContext);
        resolutions = fullDebateResolutions.map(r => ({
          conflictId: r.conflictId,
          originalPositions: r.originalPositions,
          resolution: r.resolution,
          compromiseType: r.compromiseType,
          confidenceInResolution: r.confidenceInResolution,
          reasoning: r.reasoning,
          rounds: r.rounds.map(round => ({
            roundNumber: round.roundNumber,
            roundType: round.roundType,
            agentAResponse: round.agentAResponse.content,
            agentBResponse: round.agentBResponse.content,
            moderatorNote: round.moderatorSummary.roundSummary,
          })),
        }));
        apiCallsUsed += fullDebateResolutions.reduce((sum, r) => sum + r.totalApiCalls, 0);
      } else {
        // Use quick single-call debate
        resolutions = await this.runQuickDebate(allConflicts, historicalContext);
        apiCallsUsed += resolutions.length;
      }

      // Store debate outcomes for learning
      for (let i = 0; i < resolutions.length; i++) {
        const resolution = resolutions[i];
        const conflict = allConflicts[i];
        if (conflict) {
          this.memory.storeDebateOutcome(context.email, {
            conflictId: resolution.conflictId,
            conflictType: conflict.type,
            severity: conflict.severity,
            agentA: {
              name: conflict.agentA.name,
              domain: conflict.agentA.name.includes('Coordinator') ? conflict.agentA.name.replace('Coordinator', '').toUpperCase() : 'HEALTH',
              position: conflict.agentA.position,
              evidence: conflict.agentA.evidence,
              confidence: conflict.agentA.confidence,
            },
            agentB: {
              name: conflict.agentB.name,
              domain: conflict.agentB.name.includes('Coordinator') ? conflict.agentB.name.replace('Coordinator', '').toUpperCase() : 'WORK',
              position: conflict.agentB.position,
              evidence: conflict.agentB.evidence,
              confidence: conflict.agentB.confidence,
            },
            resolution: resolution.resolution,
            compromiseType: resolution.compromiseType,
            resolutionConfidence: resolution.confidenceInResolution,
            resolutionReasoning: resolution.reasoning,
          }, context).catch(e => console.error('[Memory] Failed to store debate:', e));
        }
      }
    }

    // Step 6: Generate cross-domain insights
    let crossDomainInsights: CrossDomainInsight[] = [];
    if (coordinatorResults.length >= 2) {
      crossDomainInsights = await this.generateCrossDomainInsights(coordinatorResults, allFlags);
      apiCallsUsed++;
    }

    // Step 7: Validate through consensus (if enabled)
    let consensusResults: ConsensusResult[] = [];
    if (config.enableConsensus) {
      const consensusMode = config.enableConsensus === 'full' ? 'full' : 'light';
      const insightsToValidate = consensusMode === 'full'
        ? allInsights
        : allInsights.filter(i => i.impact === 'critical' || i.impact === 'high');

      if (insightsToValidate.length > 0) {
        console.log(`[CoordinatorOrchestrator] Running ${consensusMode} consensus on ${insightsToValidate.length} insights`);
        consensusResults = await this.runConsensusValidation(insightsToValidate, coordinatorResults, context, consensusMode);
        apiCallsUsed += consensusResults.reduce((sum, r) => sum + r.votes.length, 0);
      }
    }

    // Step 8: Convert to final format and prioritize
    const structuredInsights = this.convertToStructuredInsights(
      allInsights,
      crossDomainInsights,
      allFindings,
      resolutions
    );

    const finalInsights = this.prioritizeInsights(structuredInsights, maxInsights);

    console.log(`[CoordinatorOrchestrator] Final insights: ${finalInsights.length}`);
    console.log(`[CoordinatorOrchestrator] Total time: ${Date.now() - startTime}ms`);

    return {
      agentFindings: allFindings,
      conflicts: allConflicts,
      resolutions: resolutions.map(r => ({
        conflictId: r.conflictId,
        resolution: r.resolution,
        reasoning: r.reasoning,
      })),
      crossDomainInsights,
      finalInsights,
      totalProcessingTimeMs: Date.now() - startTime,
      apiCallsUsed,
      mode,
      // Additional coordinator metadata
      coordinatorResults: coordinatorResults.map(r => ({
        domain: r.domain,
        insightCount: r.insights.length,
        conflictCount: r.internalConflicts.length,
        flagCount: r.crossDomainFlags.length,
        dataQuality: r.dataQuality,
      })),
      // Consensus validation results
      consensusResults: consensusResults.map(r => ({
        insightId: r.insightId,
        consensusLevel: r.consensusLevel,
        consensusScore: r.consensusScore,
        originalConfidence: r.originalConfidence,
        adjustedConfidence: r.adjustedConfidence,
        voteCount: r.votes.length,
        flags: r.flags,
      })),
      // Full debate results (when using 'full' debate mode)
      fullDebateResults: fullDebateResolutions.length > 0 ? fullDebateResolutions.map(r => ({
        conflictId: r.conflictId,
        roundCount: r.rounds.length,
        debateQuality: r.debateQuality,
        apiCallsUsed: r.totalApiCalls,
        finalScores: r.finalScores,
        areasOfAgreement: r.rounds.flatMap(round => round.moderatorSummary.areasOfAgreement),
        compromiseType: r.compromiseType,
        resolution: r.resolution,
      })) : undefined,
    };
  }

  /**
   * Run coordinators in parallel
   */
  private async runCoordinatorsInParallel(
    coordinators: BaseCoordinator[],
    context: UserContext
  ): Promise<CoordinatorResult[]> {
    const promises = coordinators.map(async (coordinator) => {
      try {
        console.log(`[CoordinatorOrchestrator] Running ${coordinator.name}...`);
        return await coordinator.coordinate(context);
      } catch (e) {
        console.error(`[CoordinatorOrchestrator] ${coordinator.name} failed:`, e);
        return null;
      }
    });

    const results = await Promise.all(promises);
    return results.filter((r): r is CoordinatorResult => r !== null);
  }

  /**
   * Detect conflicts between coordinators using cross-domain flags
   */
  private detectCrossCoordinatorConflicts(
    results: CoordinatorResult[],
    flags: CrossDomainFlag[]
  ): Conflict[] {
    const conflicts: Conflict[] = [];

    // Check for conflicting flags
    const healthFlags = flags.filter(f => f.fromDomain === 'HEALTH');
    const workFlags = flags.filter(f => f.fromDomain === 'WORK');

    // Health says rest, Work says urgent deadlines
    const healthWantsRest = healthFlags.some(f =>
      f.flag === 'LOW_RECOVERY_STATE' || f.flag === 'SLEEP_DEBT_ACCUMULATED'
    );
    const workHasUrgent = workFlags.some(f =>
      f.flag === 'URGENT_DEADLINES' || f.flag === 'HIGH_WORK_STRESS'
    );

    if (healthWantsRest && workHasUrgent) {
      const healthResult = results.find(r => r.domain === 'HEALTH');
      const workResult = results.find(r => r.domain === 'WORK');

      if (healthResult && workResult) {
        conflicts.push({
          id: `cross_conflict_health_work_${Date.now()}`,
          type: 'priority_clash',
          agentA: {
            name: 'HealthCoordinator',
            position: 'User needs rest/recovery based on physiological data',
            evidence: healthResult.insights.slice(0, 2).map(i => i.dataQuote),
            confidence: healthResult.confidenceLevel,
          },
          agentB: {
            name: 'WorkCoordinator',
            position: 'User has urgent work obligations that need attention',
            evidence: workResult.insights.slice(0, 2).map(i => i.dataQuote),
            confidence: workResult.confidenceLevel,
          },
          severity: 'blocking',
          detectedAt: new Date().toISOString(),
        });
      }
    }

    return conflicts;
  }

  /**
   * Run full multi-round debate using DebateEngine
   */
  private async runFullDebate(
    conflicts: Conflict[],
    historicalContext: HistoricalContext | null
  ): Promise<FullDebateResolution[]> {
    const resolutions: FullDebateResolution[] = [];

    for (const conflict of conflicts.filter(c => c.severity !== 'minor')) {
      try {
        // Convert to DebateConflict format
        const debateConflict: DebateConflict = {
          id: conflict.id,
          type: conflict.type,
          severity: conflict.severity,
          agentA: {
            name: conflict.agentA.name,
            domain: conflict.agentA.name.includes('Coordinator')
              ? conflict.agentA.name.replace('Coordinator', '').toUpperCase()
              : 'HEALTH',
            position: conflict.agentA.position,
            evidence: conflict.agentA.evidence,
            confidence: conflict.agentA.confidence,
          },
          agentB: {
            name: conflict.agentB.name,
            domain: conflict.agentB.name.includes('Coordinator')
              ? conflict.agentB.name.replace('Coordinator', '').toUpperCase()
              : 'WORK',
            position: conflict.agentB.position,
            evidence: conflict.agentB.evidence,
            confidence: conflict.agentB.confidence,
          },
        };

        const resolution = await this.debateEngine.runDebate(debateConflict, historicalContext);
        resolutions.push(resolution);

        // Log detailed debate results
        console.log(formatDebateResolution(resolution));
      } catch (e) {
        console.error(`[CoordinatorOrchestrator] Full debate failed for ${conflict.id}:`, e);
      }
    }

    return resolutions;
  }

  /**
   * Run quick single-call debate to resolve conflicts
   */
  private async runQuickDebate(
    conflicts: Conflict[],
    historicalContext: HistoricalContext | null
  ): Promise<DebateResolution[]> {
    const resolutions: DebateResolution[] = [];

    for (const conflict of conflicts.filter(c => c.severity !== 'minor')) {
      try {
        const resolution = await this.debateSingleConflict(conflict, historicalContext);
        resolutions.push(resolution);
      } catch (e) {
        console.error(`[CoordinatorOrchestrator] Debate failed for ${conflict.id}:`, e);
      }
    }

    return resolutions;
  }

  /**
   * Run debate for a single conflict
   */
  private async debateSingleConflict(
    conflict: Conflict,
    historicalContext: HistoricalContext | null
  ): Promise<DebateResolution> {
    const rounds: DebateRound[] = [];

    // Build historical context section for prompt
    let historySection = '';
    if (historicalContext) {
      const relevantDebates = historicalContext.recentDebates.filter(d =>
        d.userAccepted === true || d.userAccepted === false
      );
      if (relevantDebates.length > 0) {
        historySection = `\n\nPAST SUCCESSFUL RESOLUTIONS FOR THIS USER:
${relevantDebates.slice(0, 3).map(d =>
  `- ${d.conflictType}: "${d.resolution.slice(0, 80)}..." (${d.userAccepted ? 'accepted' : 'rejected'})`
).join('\n')}
→ Learn from these past outcomes when proposing your resolution.`;
      }

      // Add domain priority hints
      if (historicalContext.domainPriorities) {
        const priorities = Object.entries(historicalContext.domainPriorities)
          .sort((a, b) => b[1] - a[1]);
        if (priorities.length > 0) {
          historySection += `\n\nUSER DOMAIN PRIORITIES (from history):
${priorities.map(([d, p]) => `- ${d}: ${p > 0.6 ? 'HIGH' : p > 0.4 ? 'MEDIUM' : 'LOW'} priority`).join('\n')}`;
        }
      }
    }

    // Single AI call to simulate full debate (more efficient)
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a health optimization moderator resolving a conflict between two perspectives.

Your job is to:
1. Understand both positions
2. Find a practical compromise that addresses both concerns
3. Produce an actionable resolution

The user's health is the priority, but work obligations are real constraints.
Good compromises often involve: time-boxing, sequencing, or conditional actions.${historySection}`,
        },
        {
          role: 'user',
          content: `CONFLICT: ${conflict.type}

POSITION A (${conflict.agentA.name}):
"${conflict.agentA.position}"
Evidence: ${conflict.agentA.evidence.join('; ')}
Confidence: ${Math.round(conflict.agentA.confidence * 100)}%

POSITION B (${conflict.agentB.name}):
"${conflict.agentB.position}"
Evidence: ${conflict.agentB.evidence.join('; ')}
Confidence: ${Math.round(conflict.agentB.confidence * 100)}%

Produce a JSON response:
{
  "resolution": "The actionable compromise recommendation",
  "compromiseType": "time_split" | "priority_override" | "conditional" | "full_merge",
  "reasoning": "Why this compromise works",
  "confidenceInResolution": 0.0-1.0
}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    return {
      conflictId: conflict.id,
      originalPositions: {
        agentA: conflict.agentA.position,
        agentB: conflict.agentB.position,
      },
      resolution: parsed.resolution || 'Unable to resolve conflict',
      compromiseType: parsed.compromiseType || 'conditional',
      confidenceInResolution: parsed.confidenceInResolution || 0.7,
      reasoning: parsed.reasoning || '',
      rounds,
    };
  }

  /**
   * Run consensus validation on insights using the ConsensusValidator
   */
  private async runConsensusValidation(
    insights: AgentInsight[],
    coordinatorResults: CoordinatorResult[],
    context: UserContext,
    mode: 'light' | 'full'
  ): Promise<ConsensusResult[]> {
    const validator = new ConsensusValidator(this.openai, { mode });
    const results = await validator.validateInsights(insights, coordinatorResults, context);

    console.log(`[CoordinatorOrchestrator] Consensus validation complete:`);
    for (const result of results) {
      const levelEmoji = result.consensusLevel === 'strong' ? '✅' :
                         result.consensusLevel === 'moderate' ? '👍' :
                         result.consensusLevel === 'weak' ? '➖' : '⚠️';
      console.log(`  ${levelEmoji} ${result.insightId}: ${result.consensusLevel} consensus (${result.consensusScore.toFixed(2)}), confidence ${(result.originalConfidence * 100).toFixed(0)}% → ${(result.adjustedConfidence * 100).toFixed(0)}%`);

      if (result.flags.length > 0) {
        for (const flag of result.flags) {
          console.log(`    ⚡ ${flag.type}: ${flag.message}`);
        }
      }
    }

    return results;
  }

  /**
   * Generate cross-domain insights from coordinator results
   */
  private async generateCrossDomainInsights(
    results: CoordinatorResult[],
    flags: CrossDomainFlag[]
  ): Promise<CrossDomainInsight[]> {
    if (results.length < 2) return [];

    const summaries = results.map(r => ({
      domain: r.domain,
      insights: r.insights.map(i => `${i.title}: ${i.dataQuote}`).join('; '),
      flags: r.crossDomainFlags.map(f => f.flag).join(', '),
    }));

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a cross-domain health analyst. Find NON-OBVIOUS connections between health, work, and lifestyle domains.

Generate insights that connect 2+ domains with causal relationships.
Be specific with data and actionable with recommendations.`,
          },
          {
            role: 'user',
            content: `Domain Summaries:
${summaries.map(s => `${s.domain}: ${s.insights}\nFlags: ${s.flags}`).join('\n\n')}

Generate 1-2 cross-domain insights as JSON:
{
  "crossDomainInsights": [
    {
      "id": "string",
      "title": "string",
      "dataQuote": "specific numbers from multiple domains",
      "recommendation": "actionable",
      "scienceExplanation": "how domains connect",
      "actionSteps": ["step1", "step2", "step3"],
      "contributingAgents": ["agent1", "agent2"],
      "sources": ["source1", "source2"],
      "correlation": "how domains relate",
      "confidence": 0.0-1.0,
      "impact": "critical|high|medium|low"
    }
  ]
}`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content || '{"crossDomainInsights":[]}';
      const parsed = JSON.parse(content);

      return (parsed.crossDomainInsights || []).map((i: CrossDomainInsight, idx: number) => ({
        id: i.id || `cross_${idx}`,
        title: i.title || 'Cross-Domain Insight',
        dataQuote: i.dataQuote || '',
        recommendation: i.recommendation || '',
        scienceExplanation: i.scienceExplanation || '',
        actionSteps: i.actionSteps || [],
        contributingAgents: i.contributingAgents || [],
        sources: i.sources || [],
        correlation: i.correlation || '',
        confidence: i.confidence || 0.7,
        impact: i.impact || 'medium',
      }));
    } catch (e) {
      console.error('[CoordinatorOrchestrator] Cross-domain synthesis failed:', e);
      return [];
    }
  }

  /**
   * Convert all insights to structured format
   */
  private convertToStructuredInsights(
    agentInsights: AgentInsight[],
    crossDomainInsights: CrossDomainInsight[],
    agentFindings: AgentFinding[],
    resolutions: DebateResolution[]
  ): StructuredInsight[] {
    const insights: StructuredInsight[] = [];

    // Add agent insights
    for (const insight of agentInsights) {
      const finding = agentFindings.find(f =>
        f.insights.some(i => i.id === insight.id)
      );

      insights.push({
        id: insight.id,
        category: finding?.domain || 'GENERAL',
        title: insight.title,
        dataQuote: insight.dataQuote,
        recommendation: insight.recommendation,
        sources: insight.sources,
        impact: insight.impact,
        confidence: insight.confidence,
        scienceExplanation: insight.scienceExplanation,
        actionSteps: insight.actionSteps,
        searchTerms: insight.title.toLowerCase().split(' ').slice(0, 5).join(' '),
        contributingAgents: finding ? [finding.agentName] : [],
      });
    }

    // Add cross-domain insights
    for (const crossInsight of crossDomainInsights) {
      insights.push({
        id: crossInsight.id,
        category: 'CROSS_DOMAIN',
        title: crossInsight.title,
        dataQuote: crossInsight.dataQuote,
        recommendation: crossInsight.recommendation,
        sources: crossInsight.sources,
        impact: crossInsight.impact,
        confidence: crossInsight.confidence,
        scienceExplanation: crossInsight.scienceExplanation,
        actionSteps: crossInsight.actionSteps,
        contributingAgents: crossInsight.contributingAgents,
      });
    }

    // Add debate resolutions as insights
    for (const resolution of resolutions) {
      insights.push({
        id: `resolution_${resolution.conflictId}`,
        category: 'RESOLUTION',
        title: 'Balanced Recommendation',
        dataQuote: `Resolved conflict: ${resolution.originalPositions.agentA.slice(0, 50)}... vs ${resolution.originalPositions.agentB.slice(0, 50)}...`,
        recommendation: resolution.resolution,
        sources: [],
        impact: 'high',
        confidence: resolution.confidenceInResolution,
        scienceExplanation: resolution.reasoning,
        actionSteps: [],
        contributingAgents: [],
      });
    }

    return insights;
  }

  /**
   * Prioritize insights by impact and confidence
   */
  private prioritizeInsights(
    insights: StructuredInsight[],
    maxInsights: number
  ): StructuredInsight[] {
    const impactPriority: Record<string, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };

    // Sort by impact then confidence
    insights.sort((a, b) => {
      const impactCompare = (impactPriority[b.impact] || 0) - (impactPriority[a.impact] || 0);
      if (impactCompare !== 0) return impactCompare;
      return b.confidence - a.confidence;
    });

    // Ensure diversity - prioritize resolutions and cross-domain
    const selected: StructuredInsight[] = [];
    const categoryCount: Record<string, number> = {};

    // First, add any resolutions (they're important)
    for (const insight of insights) {
      if (insight.category === 'RESOLUTION' && selected.length < maxInsights) {
        selected.push(insight);
      }
    }

    // Then add cross-domain insights
    for (const insight of insights) {
      if (insight.category === 'CROSS_DOMAIN' && selected.length < maxInsights && !selected.includes(insight)) {
        selected.push(insight);
      }
    }

    // Then fill with other insights, max 2 per category
    for (const insight of insights) {
      if (selected.includes(insight)) continue;
      if (selected.length >= maxInsights) break;

      const count = categoryCount[insight.category] || 0;
      if (count < 2) {
        selected.push(insight);
        categoryCount[insight.category] = count + 1;
      }
    }

    return selected;
  }

  /**
   * Get empty result when no coordinators can run
   */
  private getEmptyResult(startTime: number, mode: ExecutionMode): MultiAgentResult {
    return {
      agentFindings: [],
      conflicts: [],
      resolutions: [],
      crossDomainInsights: [],
      finalInsights: [{
        id: 'fallback_1',
        category: 'GENERAL',
        title: 'Connect Your Health Data',
        dataQuote: 'No wearable data available yet',
        recommendation: 'Connect a wearable device to get personalized insights.',
        sources: [],
        impact: 'medium',
        confidence: 1.0,
        scienceExplanation: 'Wearable devices track HRV, sleep, and recovery metrics.',
        actionSteps: [
          'Connect Whoop for recovery tracking',
          'Connect Oura for sleep analysis',
          'Connect Gmail/Slack for work-life insights',
        ],
      }],
      totalProcessingTimeMs: Date.now() - startTime,
      apiCallsUsed: 0,
      mode,
    };
  }
}
