/**
 * Multi-Agent Orchestrator
 * Coordinates specialist agents to generate insights in parallel
 */

import OpenAI from 'openai';
import {
  AgentFinding,
  AgentInsight,
  CrossDomainInsight,
  ExecutionConfig,
  ExecutionMode,
  EXECUTION_CONFIGS,
  MultiAgentResult,
  StructuredInsight,
  UserContext,
} from './types';
import { BaseAgent } from './base-agent';
import {
  // Health & Recovery Domain
  RecoveryAgent,
  SleepAgent,
  GlucoseAgent,
  BloodAgent,
  // Activity & Fitness Domain
  ActivityAgent,
  CardioAgent,
  MovementAgent,
  // Work & Stress Domain
  StressAgent,
  CalendarAgent,
  DeepContentAgent,
  // Lifestyle Domain
  MusicAgent,
  ContextAgent,
  NutritionAgent,
} from './agents';

export class MultiAgentOrchestrator {
  private agents: BaseAgent[];
  private openai: OpenAI;

  constructor(openaiApiKey: string) {
    this.openai = new OpenAI({ apiKey: openaiApiKey });
    this.agents = this.initializeAgents();
  }

  private initializeAgents(): BaseAgent[] {
    return [
      // Health & Recovery Domain
      new RecoveryAgent(),
      new SleepAgent(),
      new GlucoseAgent(),
      new BloodAgent(),
      // Activity & Fitness Domain
      new ActivityAgent(),
      new CardioAgent(),
      new MovementAgent(),
      // Work & Stress Domain
      new StressAgent(),
      new CalendarAgent(),
      new DeepContentAgent(), // Analyzes specific tasks/messages from Gmail/Slack
      // Lifestyle Domain
      new MusicAgent(),
      new ContextAgent(),
      new NutritionAgent(),
    ];
  }

  /**
   * Generate insights using multi-agent system
   */
  async generateInsights(
    context: UserContext,
    mode: ExecutionMode = 'standard',
    maxInsights: number = 5
  ): Promise<MultiAgentResult> {
    const startTime = Date.now();
    const config = EXECUTION_CONFIGS[mode];
    let apiCallsUsed = 0;

    console.log(`[Orchestrator] Starting multi-agent generation (mode: ${mode})`);
    console.log(`[Orchestrator] Available sources: ${context.availableDataSources.join(', ')}`);

    // Filter agents that can analyze this context
    const applicableAgents = this.agents.filter((agent) => agent.canAnalyze(context));

    if (applicableAgents.length === 0) {
      console.log('[Orchestrator] No applicable agents for available data sources');
      return {
        agentFindings: [],
        conflicts: [],
        resolutions: [],
        crossDomainInsights: [],
        finalInsights: this.getFallbackInsights(),
        totalProcessingTimeMs: Date.now() - startTime,
        apiCallsUsed: 0,
        mode,
      };
    }

    // Limit agents based on config
    const agentsToRun = applicableAgents.slice(0, config.maxAgents);

    console.log(
      `[Orchestrator] Running ${agentsToRun.length} agents: ${agentsToRun.map((a) => a.agentName).join(', ')}`
    );

    // Run agents in parallel
    const agentFindings = await this.runAgentsInParallel(agentsToRun, context);
    apiCallsUsed += agentFindings.length;

    console.log(`[Orchestrator] Collected ${agentFindings.length} agent findings`);

    // Collect all insights from agents
    const allInsights: AgentInsight[] = [];
    for (const finding of agentFindings) {
      allInsights.push(...finding.insights);
    }

    console.log(`[Orchestrator] Total insights from agents: ${allInsights.length}`);

    // Generate cross-domain insights if enabled
    let crossDomainInsights: CrossDomainInsight[] = [];
    if (config.enableCrossDomainSynthesis && agentFindings.length >= 2) {
      crossDomainInsights = await this.generateCrossDomainInsights(agentFindings);
      apiCallsUsed++;
      console.log(`[Orchestrator] Generated ${crossDomainInsights.length} cross-domain insights`);
    }

    // Convert to StructuredInsight and prioritize
    const structuredInsights = this.convertToStructuredInsights(
      allInsights,
      crossDomainInsights,
      agentFindings
    );

    // Prioritize and limit
    const finalInsights = this.prioritizeInsights(structuredInsights, maxInsights);

    console.log(`[Orchestrator] Final insights: ${finalInsights.length}`);
    console.log(`[Orchestrator] Total processing time: ${Date.now() - startTime}ms`);

    return {
      agentFindings,
      conflicts: [],
      resolutions: [],
      crossDomainInsights,
      finalInsights,
      totalProcessingTimeMs: Date.now() - startTime,
      apiCallsUsed,
      mode,
    };
  }

  /**
   * Run all agents in parallel
   */
  private async runAgentsInParallel(
    agents: BaseAgent[],
    context: UserContext
  ): Promise<AgentFinding[]> {
    const promises = agents.map(async (agent) => {
      try {
        console.log(`[Orchestrator] Running ${agent.agentName}...`);
        return await agent.analyze(context, this.openai);
      } catch (e) {
        console.error(`[Orchestrator] Agent ${agent.agentName} failed:`, e);
        return null;
      }
    });

    const results = await Promise.all(promises);
    return results.filter((r): r is AgentFinding => r !== null);
  }

  /**
   * Generate cross-domain insights that connect multiple agent findings
   */
  private async generateCrossDomainInsights(
    agentFindings: AgentFinding[]
  ): Promise<CrossDomainInsight[]> {
    if (agentFindings.length < 2) return [];

    const prompt = this.buildCrossDomainPrompt(agentFindings);

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o', // Use stronger model for synthesis
        messages: [
          {
            role: 'system',
            content: `You are a CROSS-DOMAIN HEALTH ANALYST synthesizing insights from multiple specialists.
Your job is to identify NON-OBVIOUS connections between different health domains.

Return a JSON object with a "crossDomainInsights" array. Each insight should connect 2+ domains.`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content || '{"crossDomainInsights":[]}';
      return this.parseCrossDomainResponse(content);
    } catch (e) {
      console.error('[Orchestrator] Cross-domain synthesis failed:', e);
      return [];
    }
  }

  private buildCrossDomainPrompt(findings: AgentFinding[]): string {
    const sections = findings.map((finding) => {
      const insightSummaries = finding.insights
        .map((i) => `- ${i.title}: ${i.dataQuote}`)
        .join('\n');
      return `### ${finding.agentName} (${finding.domain}):\n${insightSummaries}`;
    });

    return `SPECIALIST FINDINGS:

${sections.join('\n\n')}

ANALYSIS INSTRUCTIONS:
1. Look for CORRELATIONS between domains (e.g., poor sleep → low recovery)
2. Identify CAUSAL CHAINS (e.g., high work stress → poor sleep → low HRV)
3. Find OPTIMIZATION OPPORTUNITIES across domains
4. Generate 1-2 cross-domain insights that connect 2+ domains

Each cross-domain insight should have:
- id: unique string
- title: connecting insight title
- dataQuote: specific numbers from multiple sources
- recommendation: action addressing the cross-domain pattern
- scienceExplanation: how these domains connect physiologically
- actionSteps: array of 3 steps
- contributingAgents: array of agent names that contributed
- sources: array of data sources
- correlation: how the domains are connected
- confidence: 0.0-1.0
- impact: "critical" | "high" | "medium" | "low"`;
  }

  private parseCrossDomainResponse(content: string): CrossDomainInsight[] {
    try {
      const parsed = JSON.parse(content);
      return (parsed.crossDomainInsights || []).map(
        (insight: Partial<CrossDomainInsight>, idx: number) => ({
          id: `cross_domain_${insight.id || idx}`,
          title: insight.title || 'Cross-Domain Insight',
          dataQuote: insight.dataQuote || '',
          recommendation: insight.recommendation || '',
          scienceExplanation: insight.scienceExplanation || '',
          actionSteps: insight.actionSteps || [],
          contributingAgents: insight.contributingAgents || [],
          sources: insight.sources || [],
          correlation: insight.correlation || '',
          confidence: insight.confidence || 0.7,
          impact: insight.impact || 'medium',
        })
      );
    } catch (e) {
      console.error('[Orchestrator] Error parsing cross-domain response:', e);
      return [];
    }
  }

  /**
   * Convert agent insights to StructuredInsight format
   */
  private convertToStructuredInsights(
    agentInsights: AgentInsight[],
    crossDomainInsights: CrossDomainInsight[],
    agentFindings: AgentFinding[]
  ): StructuredInsight[] {
    const insights: StructuredInsight[] = [];

    // Convert agent insights
    for (const insight of agentInsights) {
      const finding = agentFindings.find((f) => insight.id.startsWith(f.agentId));

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
        searchTerms: this.generateSearchTerms(insight),
        contributingAgents: finding ? [finding.agentName] : [],
      });
    }

    // Convert cross-domain insights
    for (const crossInsight of crossDomainInsights) {
      insights.push({
        id: crossInsight.id,
        category: 'CROSS_DOMAIN',
        designCategory: 'ANALYSIS',
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

    return insights;
  }

  private generateSearchTerms(insight: AgentInsight): string {
    // Generate PubMed search terms from insight content
    const keywords = insight.title.toLowerCase().split(' ').filter((w) => w.length > 3);
    return keywords.slice(0, 5).join(' ');
  }

  /**
   * Prioritize insights by impact and confidence
   */
  private prioritizeInsights(
    insights: StructuredInsight[],
    maxInsights: number
  ): StructuredInsight[] {
    // Sort by impact priority then confidence
    const impactPriority: Record<string, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };

    insights.sort((a, b) => {
      const impactCompare =
        (impactPriority[b.impact] || 0) - (impactPriority[a.impact] || 0);
      if (impactCompare !== 0) return impactCompare;
      return b.confidence - a.confidence;
    });

    // Ensure category diversity - no more than 2 per category
    const selected: StructuredInsight[] = [];
    const categoryCount: Record<string, number> = {};

    for (const insight of insights) {
      const count = categoryCount[insight.category] || 0;
      if (count < 2 && selected.length < maxInsights) {
        selected.push(insight);
        categoryCount[insight.category] = count + 1;
      }
    }

    // If we don't have enough, add more regardless of category
    if (selected.length < maxInsights) {
      for (const insight of insights) {
        if (!selected.includes(insight) && selected.length < maxInsights) {
          selected.push(insight);
        }
      }
    }

    return selected;
  }

  /**
   * Fallback insights when no agents can run
   */
  private getFallbackInsights(): StructuredInsight[] {
    return [
      {
        id: 'fallback_1',
        category: 'GENERAL',
        title: 'Connect Your Health Data',
        dataQuote: 'No wearable data available yet',
        recommendation:
          'Connect a wearable device like Whoop or Oura to get personalized recovery and sleep insights.',
        sources: [],
        impact: 'medium',
        confidence: 1.0,
        scienceExplanation:
          'Wearable devices track physiological metrics like HRV, sleep stages, and recovery scores that enable personalized health optimization.',
        actionSteps: [
          'Connect Whoop for recovery and strain tracking',
          'Connect Oura Ring for detailed sleep analysis',
          'Link Apple Health for activity metrics',
        ],
      },
    ];
  }
}
