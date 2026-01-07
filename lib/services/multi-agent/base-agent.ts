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
  UserPreferences,
  DeepContentContext,
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

    // Build system prompt with user preferences and deep content
    const systemPrompt = this.getSystemPrompt(context.userPreferences, context.recentFeedbackComments, context.deepContent);

    // Generate response from AI
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Fast model for specialists
      messages: [
        {
          role: 'system',
          content: systemPrompt,
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
  protected getSystemPrompt(
    userPreferences?: UserPreferences,
    recentFeedback?: Array<{ taskType: string; action: string; comment: string; timestamp: Date }>,
    deepContent?: DeepContentContext
  ): string {
    let basePrompt = `You are a ${this.agentName} specializing in ${this.domain} analysis.
Your job is to analyze health data and generate actionable insights.

RESPONSE FORMAT:
Return a JSON object with an "insights" array. Each insight must have:
- id: unique string
- title: concise, positive title (5-10 words)
- finding: what you discovered
- dataQuote: SPECIFIC numbers (e.g., "HRV: 45ms avg, up 8% from 42ms last week")
- recommendation: one actionable recommendation
- scienceExplanation: 2-3 sentences on WHY this matters
- actionSteps: array of 3 HIGHLY SPECIFIC steps (see requirements below)
- impact: "critical" | "high" | "medium" | "low"
- confidence: 0.0-1.0
- sources: array of data source names
- crossDomainRelevance: optional, which other domain this relates to

CRITICAL REQUIREMENTS:
1. dataQuote MUST contain specific numbers, not vague phrases
2. Generate 1-2 high-quality insights, not many low-quality ones
3. Each insight must suggest a NEW action, not maintain status quo
4. Title should be positive and inspiring, not alarming

ACTION STEP REQUIREMENTS - MUST BE SPECIFIC:
Each actionStep MUST include at least one of these specifics:
- EXACT TIME: "At 9pm tonight..." or "30 minutes before bed..."
- EXACT DURATION: "...for 15 minutes" or "...for the next 3 days"
- EXACT BEHAVIOR: "Put phone in another room" NOT "limit screen time"
- EXACT METRIC: "Keep heart rate below 100bpm" NOT "do light exercise"

BAD EXAMPLES (too vague):
- "Establish a wind-down routine" ❌
- "Focus on hydration" ❌
- "Engage in light mobility work" ❌
- "Limit screen time" ❌

GOOD EXAMPLES (specific and actionable):
- "Tonight at 9pm, put your phone in another room and read a physical book for 20 minutes" ✓
- "Drink 500ml water within 30 minutes of waking tomorrow" ✓
- "Do 10 minutes of hip flexor stretches (pigeon pose, 90/90) before your 2pm meeting" ✓
- "Set Slack to DND from 9am-11am tomorrow for a 2-hour deep work block" ✓
- "Take a 15-minute walk outside between 12-1pm today without your phone" ✓`;

    // Add user preferences section if available
    const preferencesSection = this.buildUserPreferencesPrompt(userPreferences, recentFeedback);
    if (preferencesSection) {
      basePrompt += preferencesSection;
    }

    // Add deep content analysis section if available
    const deepContentSection = this.buildDeepContentPrompt(deepContent);
    if (deepContentSection) {
      basePrompt += deepContentSection;
    }

    return basePrompt;
  }

  /**
   * Build deep content analysis section for the prompt
   */
  protected buildDeepContentPrompt(deepContent?: DeepContentContext): string {
    if (!deepContent) {
      return '';
    }

    const sections: string[] = ['\n\n=== COMMUNICATION WORKLOAD CONTEXT ==='];
    sections.push('Analysis of user\'s Gmail/Slack reveals the following workload context:');

    // Pending tasks extracted from messages
    if (deepContent.pendingTasks && deepContent.pendingTasks.length > 0) {
      sections.push('\n📋 PENDING TASKS (extracted from messages):');
      for (const task of deepContent.pendingTasks.slice(0, 5)) {
        const deadline = task.deadline ? ` [Due: ${task.deadline}]` : '';
        const requester = task.requester ? ` from ${task.requester}` : '';
        const role = task.requesterRole && task.requesterRole !== 'unknown' ? ` (${task.requesterRole})` : '';
        sections.push(`- [${task.urgency.toUpperCase()}] ${task.description}${deadline}${requester}${role}`);
      }
      sections.push('→ Consider these pending obligations when suggesting new tasks');
    }

    // Response debt
    if (deepContent.responseDebt && deepContent.responseDebt.count > 0) {
      sections.push('\n📬 RESPONSE DEBT (messages awaiting reply):');
      sections.push(`- ${deepContent.responseDebt.count} messages need responses`);
      sections.push(`- ${deepContent.responseDebt.highPriorityCount} are high priority`);
      if (deepContent.responseDebt.oldestPending) {
        sections.push(`- Oldest unanswered: ${deepContent.responseDebt.oldestPending}`);
      }
      for (const msg of deepContent.responseDebt.messages.slice(0, 3)) {
        sections.push(`  • ${msg.from}: "${msg.summary}" [${msg.urgency}]`);
      }
      sections.push('→ User may be overwhelmed - be mindful of adding more tasks');
    }

    // Interruption patterns
    if (deepContent.interruptionSummary && deepContent.interruptionSummary.totalInterruptions > 0) {
      sections.push('\n🔔 INTERRUPTION PATTERNS:');
      sections.push(`- ${deepContent.interruptionSummary.avgInterruptionsPerDay} interruptions/day`);
      sections.push(`- ${deepContent.interruptionSummary.urgentInterruptions} urgent interruptions recently`);
      if (deepContent.interruptionSummary.peakInterruptionHours.length > 0) {
        sections.push(`- Peak interruption hours: ${deepContent.interruptionSummary.peakInterruptionHours.join(', ')}`);
      }
      if (deepContent.interruptionSummary.topInterrupters.length > 0) {
        sections.push(`- Top interrupters: ${deepContent.interruptionSummary.topInterrupters.join(', ')}`);
      }
      sections.push('→ Schedule focus time OUTSIDE these peak interruption hours');
    }

    // Key people context
    if (deepContent.keyPeople && deepContent.keyPeople.length > 0) {
      sections.push('\n👥 KEY COMMUNICATION PARTNERS:');
      for (const person of deepContent.keyPeople.slice(0, 3)) {
        sections.push(`- ${person.name} (${person.relationship}): ${person.communicationFrequency} contact, urgency avg ${person.avgUrgencyOfRequests}/100`);
      }
      sections.push('→ Manager requests typically need faster response than peer requests');
    }

    // Active threads
    if (deepContent.activeThreads && deepContent.activeThreads.length > 0) {
      sections.push('\n💬 ACTIVE THREADS NEEDING ATTENTION:');
      for (const thread of deepContent.activeThreads.slice(0, 3)) {
        const actions = thread.pendingActions.length > 0 ? ` - Actions: ${thread.pendingActions.join(', ')}` : '';
        sections.push(`- [${thread.urgency}] ${thread.topic}${actions}`);
      }
    }

    sections.push('\n→ Factor this communication workload into your recommendations.');
    sections.push('→ If user has high response debt, suggest ways to batch or manage communication.');
    sections.push('→ If many urgent interruptions, recommend protecting focus time.');

    return sections.join('\n');
  }

  /**
   * Build user preferences section for the prompt
   */
  protected buildUserPreferencesPrompt(
    userPreferences?: UserPreferences,
    recentFeedback?: Array<{ taskType: string; action: string; comment: string; timestamp: Date }>
  ): string {
    if (!userPreferences && (!recentFeedback || recentFeedback.length === 0)) {
      return '';
    }

    const sections: string[] = ['\n\n=== USER PREFERENCES & CONSTRAINTS ==='];
    sections.push('The user has provided feedback on previous recommendations. RESPECT these preferences:');

    // Add avoidances - things the user doesn't want
    if (userPreferences?.avoidances && userPreferences.avoidances.length > 0) {
      sections.push('\n🚫 DO NOT SUGGEST (user consistently rejects these):');
      for (const avoidance of userPreferences.avoidances) {
        const reason = avoidance.reason ? ` - Reason: "${avoidance.reason}"` : '';
        sections.push(`- ${avoidance.taskType} recommendations (${Math.round(avoidance.confidence * 100)}% confidence)${reason}`);
      }
    }

    // Add preferences - things the user likes
    if (userPreferences?.preferences && userPreferences.preferences.length > 0) {
      sections.push('\n✅ USER PREFERS:');
      for (const pref of userPreferences.preferences) {
        const timing = pref.preferredTime ? ` (preferred time: ${pref.preferredTime})` : '';
        sections.push(`- ${pref.taskType} recommendations${timing}`);
      }
    }

    // Add typical modifications - how user usually adjusts recommendations
    if (userPreferences?.typicalModifications && userPreferences.typicalModifications.length > 0) {
      sections.push('\n📝 USER TYPICALLY MODIFIES:');
      for (const mod of userPreferences.typicalModifications) {
        sections.push(`- ${mod.taskType}: "${mod.modification}"`);
      }
      sections.push('→ Pre-apply these modifications to your recommendations');
    }

    // Add explicit constraints
    if (userPreferences?.constraints && userPreferences.constraints.length > 0) {
      sections.push('\n⚠️ EXPLICIT CONSTRAINTS:');
      for (const constraint of userPreferences.constraints) {
        sections.push(`- ${constraint.description}`);
      }
    }

    // Add recent feedback comments for context
    if (recentFeedback && recentFeedback.length > 0) {
      sections.push('\n💬 RECENT USER FEEDBACK (context for your recommendations):');
      const relevantFeedback = recentFeedback.slice(0, 5); // Top 5 most recent
      for (const fb of relevantFeedback) {
        sections.push(`- On ${fb.taskType} (${fb.action}): "${fb.comment}"`);
      }
    }

    sections.push('\n→ Generate recommendations that RESPECT these preferences and constraints.');
    sections.push('→ If the user said they "can\'t" do something, suggest ALTERNATIVES instead.');

    return sections.join('\n');
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
