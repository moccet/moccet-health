/**
 * Base Agent Class - Abstract class for all specialist agents
 */

import OpenAI from 'openai';
import {
  AgentConfig,
  AgentFinding,
  AgentInsight,
  DataSource,
  UserContext,
} from './types';

export abstract class BaseAgent {
  protected config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  get agentId(): string {
    return this.config.agentId;
  }

  get agentName(): string {
    return this.config.agentName;
  }

  get domain(): string {
    return this.config.domain;
  }

  get requiredDataSources(): DataSource[] {
    return this.config.requiredDataSources;
  }

  /**
   * Check if this agent can analyze the given context
   */
  canAnalyze(context: UserContext): boolean {
    return this.requiredDataSources.some((source) =>
      context.availableDataSources.includes(source)
    );
  }

  /**
   * Extract relevant data for this agent from the context
   */
  abstract extractRelevantData(context: UserContext): Record<string, unknown>;

  /**
   * Build the agent-specific prompt for analysis
   */
  abstract buildPrompt(relevantData: Record<string, unknown>): string;

  /**
   * Main analysis method - generates findings from context
   */
  async analyze(
    context: UserContext,
    openai: OpenAI
  ): Promise<AgentFinding> {
    const startTime = Date.now();

    // Extract data relevant to this agent
    const relevantData = this.extractRelevantData(context);

    // Build the prompt
    const prompt = this.buildPrompt(relevantData);

    // Generate response from AI
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Fast model for specialists
      messages: [
        {
          role: 'system',
          content: this.getSystemPrompt(),
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content || '{"insights":[]}';
    const insights = this.parseResponse(content);

    return {
      agentId: this.agentId,
      agentName: this.agentName,
      domain: this.config.domain,
      insights,
      confidence: this.calculateConfidence(insights),
      dataPointsUsed: this.extractDataPoints(relevantData),
      potentialConflicts: this.identifyPotentialConflicts(insights),
      analyzedAt: new Date(),
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Get system prompt for this agent type
   */
  protected getSystemPrompt(): string {
    return `You are a ${this.agentName} specializing in ${this.domain} analysis.
Your job is to analyze health data and generate actionable insights.

RESPONSE FORMAT:
Return a JSON object with an "insights" array. Each insight must have:
- id: unique string
- title: concise, positive title (5-10 words)
- finding: what you discovered
- dataQuote: SPECIFIC numbers (e.g., "HRV: 45ms avg, up 8% from 42ms last week")
- recommendation: one actionable recommendation
- scienceExplanation: 2-3 sentences on WHY this matters
- actionSteps: array of 3 specific steps
- impact: "critical" | "high" | "medium" | "low"
- confidence: 0.0-1.0
- sources: array of data source names
- crossDomainRelevance: optional, which other domain this relates to

CRITICAL REQUIREMENTS:
1. dataQuote MUST contain specific numbers, not vague phrases
2. Generate 1-2 high-quality insights, not many low-quality ones
3. Each insight must suggest a NEW action, not maintain status quo
4. Title should be positive and inspiring, not alarming`;
  }

  /**
   * Parse AI response into insights
   */
  protected parseResponse(content: string): AgentInsight[] {
    try {
      const parsed = JSON.parse(content);
      const insights = parsed.insights || [];

      return insights.map((insight: Partial<AgentInsight>, idx: number) => ({
        id: `${this.agentId}_${insight.id || idx}`,
        title: insight.title || 'Insight',
        finding: insight.finding || '',
        dataQuote: insight.dataQuote || '',
        recommendation: insight.recommendation || '',
        scienceExplanation: insight.scienceExplanation || '',
        actionSteps: insight.actionSteps || [],
        impact: insight.impact || 'medium',
        confidence: insight.confidence || 0.7,
        sources: insight.sources || [],
        crossDomainRelevance: insight.crossDomainRelevance,
      }));
    } catch (e) {
      console.error(`[${this.agentName}] Error parsing response:`, e);
      return [];
    }
  }

  /**
   * Calculate overall confidence from individual insights
   */
  protected calculateConfidence(insights: AgentInsight[]): number {
    if (insights.length === 0) return 0;
    const sum = insights.reduce((acc, i) => acc + i.confidence, 0);
    return sum / insights.length;
  }

  /**
   * Extract data point descriptions from relevant data
   */
  protected extractDataPoints(data: Record<string, unknown>): string[] {
    const points: string[] = [];
    this.extractDataPointsRecursive(data, '', points);
    return points.slice(0, 10); // Limit to 10 data points
  }

  private extractDataPointsRecursive(
    data: unknown,
    prefix: string,
    points: string[]
  ): void {
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      for (const [key, value] of Object.entries(data)) {
        const newPrefix = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'number' || typeof value === 'string') {
          points.push(`${newPrefix}: ${value}`);
        } else {
          this.extractDataPointsRecursive(value, newPrefix, points);
        }
      }
    } else if (Array.isArray(data) && data.length > 0) {
      points.push(`${prefix}: ${data.length} items`);
    }
  }

  /**
   * Identify potential conflicts with other domains
   */
  protected identifyPotentialConflicts(insights: AgentInsight[]): string[] {
    const conflicts: string[] = [];
    for (const insight of insights) {
      if (insight.crossDomainRelevance) {
        conflicts.push(insight.crossDomainRelevance);
      }
    }
    return conflicts;
  }

  /**
   * Helper to format data for prompt
   */
  protected formatDataForPrompt(
    data: Record<string, unknown>,
    title: string
  ): string {
    const lines: string[] = [`### ${title}:`];

    for (const [key, value] of Object.entries(data)) {
      if (value === null || value === undefined) continue;

      if (typeof value === 'object' && !Array.isArray(value)) {
        // Nested object
        for (const [subKey, subValue] of Object.entries(value as Record<string, unknown>)) {
          if (subValue !== null && subValue !== undefined) {
            lines.push(`- ${key}.${subKey}: ${subValue}`);
          }
        }
      } else if (Array.isArray(value)) {
        lines.push(`- ${key}: ${value.length} items`);
      } else {
        lines.push(`- ${key}: ${value}`);
      }
    }

    return lines.join('\n');
  }
}
