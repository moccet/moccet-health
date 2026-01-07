/**
 * Base Coordinator Class
 *
 * Coordinators manage a domain of specialist agents:
 * - Run agents in parallel within their domain
 * - Synthesize domain-specific insights
 * - Detect internal conflicts
 * - Flag cross-domain concerns for other coordinators
 */

import OpenAI from 'openai';
import { BaseAgent } from '../base-agent';
import { AgentFinding, AgentInsight, UserContext } from '../types';

// ============================================================================
// TYPES
// ============================================================================

export interface Conflict {
  id: string;
  type: 'contradiction' | 'resource_competition' | 'priority_clash' | 'causal_disagreement';
  agentA: {
    name: string;
    position: string;
    evidence: string[];
    confidence: number;
  };
  agentB: {
    name: string;
    position: string;
    evidence: string[];
    confidence: number;
  };
  severity: 'blocking' | 'significant' | 'minor';
  detectedAt: string;
}

export interface CrossDomainFlag {
  fromDomain: string;
  toDomains: string[];
  flag: string;
  priority: 'high' | 'medium' | 'low';
  context: Record<string, unknown>;
}

export interface CoordinatorResult {
  domain: string;
  coordinatorName: string;
  insights: AgentInsight[];
  agentFindings: AgentFinding[];
  internalConflicts: Conflict[];
  crossDomainFlags: CrossDomainFlag[];
  synthesizedRecommendation?: string;
  confidenceLevel: number;
  dataQuality: 'high' | 'medium' | 'low';
  processingTimeMs: number;
  agentsRun: string[];
}

export interface CoordinatorConfig {
  name: string;
  domain: string;
  description: string;
  priority: number; // Higher = more important
}

// ============================================================================
// BASE COORDINATOR CLASS
// ============================================================================

export abstract class BaseCoordinator {
  protected config: CoordinatorConfig;
  protected agents: BaseAgent[] = [];
  protected openai: OpenAI;

  constructor(config: CoordinatorConfig, openai: OpenAI) {
    this.config = config;
    this.openai = openai;
    this.agents = this.initializeAgents();
  }

  get name(): string {
    return this.config.name;
  }

  get domain(): string {
    return this.config.domain;
  }

  /**
   * Initialize the specialist agents for this coordinator
   */
  protected abstract initializeAgents(): BaseAgent[];

  /**
   * Check if this coordinator can contribute given the available data
   */
  canContribute(context: UserContext): boolean {
    return this.agents.some(agent => agent.canAnalyze(context));
  }

  /**
   * Get agents that can analyze the given context
   */
  getApplicableAgents(context: UserContext): BaseAgent[] {
    return this.agents.filter(agent => agent.canAnalyze(context));
  }

  /**
   * Run all applicable agents and coordinate their outputs
   */
  async coordinate(context: UserContext): Promise<CoordinatorResult> {
    const startTime = Date.now();
    const applicableAgents = this.getApplicableAgents(context);

    if (applicableAgents.length === 0) {
      return this.getEmptyResult(startTime);
    }

    console.log(`[${this.name}] Running ${applicableAgents.length} agents: ${applicableAgents.map(a => a.agentName).join(', ')}`);

    // Run agents in parallel
    const agentFindings = await this.runAgentsInParallel(applicableAgents, context);

    // Collect all insights
    const allInsights: AgentInsight[] = [];
    for (const finding of agentFindings) {
      allInsights.push(...finding.insights);
    }

    // Detect internal conflicts
    const conflicts = await this.detectConflicts(agentFindings);

    // Generate cross-domain flags
    const crossDomainFlags = this.generateCrossDomainFlags(agentFindings, context);

    // Synthesize domain-specific recommendation if multiple insights
    let synthesizedRecommendation: string | undefined;
    if (allInsights.length >= 2) {
      synthesizedRecommendation = await this.synthesizeDomainInsights(agentFindings);
    }

    // Calculate overall confidence and data quality
    const confidenceLevel = this.calculateConfidence(agentFindings);
    const dataQuality = this.assessDataQuality(context);

    return {
      domain: this.domain,
      coordinatorName: this.name,
      insights: allInsights,
      agentFindings,
      internalConflicts: conflicts,
      crossDomainFlags,
      synthesizedRecommendation,
      confidenceLevel,
      dataQuality,
      processingTimeMs: Date.now() - startTime,
      agentsRun: applicableAgents.map(a => a.agentName),
    };
  }

  /**
   * Run agents in parallel
   */
  protected async runAgentsInParallel(
    agents: BaseAgent[],
    context: UserContext
  ): Promise<AgentFinding[]> {
    const promises = agents.map(async (agent) => {
      try {
        console.log(`[${this.name}] Running ${agent.agentName}...`);
        return await agent.analyze(context, this.openai);
      } catch (e) {
        console.error(`[${this.name}] Agent ${agent.agentName} failed:`, e);
        return null;
      }
    });

    const results = await Promise.all(promises);
    return results.filter((r): r is AgentFinding => r !== null);
  }

  /**
   * Detect conflicts between agent findings within this domain
   */
  protected async detectConflicts(findings: AgentFinding[]): Promise<Conflict[]> {
    if (findings.length < 2) return [];

    const conflicts: Conflict[] = [];

    // Compare each pair of findings for conflicts
    for (let i = 0; i < findings.length; i++) {
      for (let j = i + 1; j < findings.length; j++) {
        const findingA = findings[i];
        const findingB = findings[j];

        // Check for contradictions in recommendations
        const conflict = await this.checkForConflict(findingA, findingB);
        if (conflict) {
          conflicts.push(conflict);
        }
      }
    }

    return conflicts;
  }

  /**
   * Check if two findings conflict
   */
  protected async checkForConflict(
    findingA: AgentFinding,
    findingB: AgentFinding
  ): Promise<Conflict | null> {
    // Get the primary recommendations from each
    const recsA = findingA.insights.map(i => i.recommendation).join('; ');
    const recsB = findingB.insights.map(i => i.recommendation).join('; ');

    if (!recsA || !recsB) return null;

    // Use simple heuristics first before AI
    const conflictKeywords = [
      ['rest', 'exercise'],
      ['sleep early', 'work late'],
      ['avoid caffeine', 'have coffee'],
      ['reduce activity', 'increase activity'],
      ['skip workout', 'do workout'],
    ];

    for (const [keyA, keyB] of conflictKeywords) {
      const aHasFirst = recsA.toLowerCase().includes(keyA);
      const bHasSecond = recsB.toLowerCase().includes(keyB);
      const aHasSecond = recsA.toLowerCase().includes(keyB);
      const bHasFirst = recsB.toLowerCase().includes(keyA);

      if ((aHasFirst && bHasSecond) || (aHasSecond && bHasFirst)) {
        return {
          id: `conflict_${findingA.agentId}_${findingB.agentId}`,
          type: 'contradiction',
          agentA: {
            name: findingA.agentName,
            position: recsA,
            evidence: findingA.insights.map(i => i.dataQuote),
            confidence: findingA.confidence,
          },
          agentB: {
            name: findingB.agentName,
            position: recsB,
            evidence: findingB.insights.map(i => i.dataQuote),
            confidence: findingB.confidence,
          },
          severity: 'significant',
          detectedAt: new Date().toISOString(),
        };
      }
    }

    return null;
  }

  /**
   * Generate flags for other domain coordinators
   */
  protected abstract generateCrossDomainFlags(
    findings: AgentFinding[],
    context: UserContext
  ): CrossDomainFlag[];

  /**
   * Synthesize insights from multiple agents into domain recommendation
   */
  protected async synthesizeDomainInsights(findings: AgentFinding[]): Promise<string> {
    const insightSummaries = findings
      .flatMap(f => f.insights)
      .map(i => `- ${i.title}: ${i.recommendation}`)
      .join('\n');

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a ${this.domain} domain coordinator. Synthesize multiple insights into one cohesive recommendation. Be concise (2-3 sentences max).`,
          },
          {
            role: 'user',
            content: `Synthesize these ${this.domain} insights:\n${insightSummaries}`,
          },
        ],
        max_tokens: 200,
        temperature: 0.5,
      });

      return response.choices[0]?.message?.content || '';
    } catch (e) {
      console.error(`[${this.name}] Synthesis failed:`, e);
      return '';
    }
  }

  /**
   * Calculate overall confidence from agent findings
   */
  protected calculateConfidence(findings: AgentFinding[]): number {
    if (findings.length === 0) return 0;

    const confidences = findings.map(f => f.confidence);
    const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;

    // Boost confidence if multiple agents agree
    const agreementBonus = findings.length >= 2 ? 0.05 : 0;

    return Math.min(1, avgConfidence + agreementBonus);
  }

  /**
   * Assess data quality based on available sources
   */
  protected abstract assessDataQuality(context: UserContext): 'high' | 'medium' | 'low';

  /**
   * Get empty result when no agents can run
   */
  protected getEmptyResult(startTime: number): CoordinatorResult {
    return {
      domain: this.domain,
      coordinatorName: this.name,
      insights: [],
      agentFindings: [],
      internalConflicts: [],
      crossDomainFlags: [],
      confidenceLevel: 0,
      dataQuality: 'low',
      processingTimeMs: Date.now() - startTime,
      agentsRun: [],
    };
  }
}
