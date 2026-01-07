/**
 * Deep Content Agent
 *
 * Specialized agent for Max tier that analyzes specific tasks, messages, and issues
 * extracted from Gmail and Slack to surface actionable insights about communication workload.
 *
 * This agent generates insights that reference SPECIFIC items from the user's inbox/messages,
 * not just patterns or statistics.
 *
 * WELLNESS COACHING: Also detects stress/pressure and provides supportive coaching,
 * actionable steps to overcome challenges, and positive affirmations.
 */

import { BaseAgent } from '../base-agent';
import { UserContext, UserPreferences, AgentConfig, DeepContentContext } from '../types';

const CONFIG: AgentConfig = {
  agentId: 'deep_content_agent',
  agentName: 'DeepContentAgent',
  domain: 'WORK',
  requiredDataSources: ['gmail', 'slack'],
  optionalDataSources: ['outlook', 'teams'],
  insightCategory: 'COMMUNICATION',
};

export class DeepContentAgent extends BaseAgent {
  constructor() {
    super(CONFIG);
  }

  /**
   * Override getSystemPrompt to provide communication-focused instructions
   */
  protected getSystemPrompt(
    _userPreferences?: UserPreferences,
    _recentFeedback?: Array<{ taskType: string; action: string; comment: string; timestamp: Date }>,
    _deepContent?: DeepContentContext
  ): string {
    return `You are a Communication Workload Analyst for Max tier users.
Your job is to analyze SPECIFIC tasks, messages, and threads from the user's Gmail and Slack
and generate insights that reference these SPECIFIC items by name.

RESPONSE FORMAT:
Return a JSON object with an "insights" array. Each insight must have:
- id: unique string
- title: concise title referencing the specific issue (e.g., "Address SendGrid Payment Before Deadline")
- finding: what you discovered about specific tasks/messages
- dataQuote: Reference SPECIFIC tasks/messages by name with context. Example: "You have 3 urgent items: the SendGrid payment due Jan 8th has been pending for 4 days, Sarah's Q1 planning doc request needs a response by tomorrow, and the Slack thread about the API outage has your input requested."
- recommendation: one actionable recommendation prioritizing specific items
- scienceExplanation: 1-2 sentences on cognitive load/productivity impact
- actionSteps: array of 3 SPECIFIC steps referencing actual tasks (e.g., "Reply to Sarah's email about the Q1 doc by 2pm today")
- impact: "critical" | "high" | "medium" | "low"
- confidence: 0.0-1.0
- sources: ["gmail", "slack"] or whichever applies

CRITICAL RULES:
1. You MUST mention SPECIFIC items - task names, sender names, deadlines, message topics
2. Do NOT generate generic insights like "you have pending tasks" - be SPECIFIC
3. The dataQuote MUST reference real items from the data provided
4. Generate exactly 1 high-quality insight about the most urgent communication items`;
  }

  /**
   * Override canAnalyze to require deep content with actual items OR stress indicators
   */
  canAnalyze(context: UserContext): boolean {
    const hasDeepContent = !!context.deepContent;
    const hasTasks = context.deepContent?.pendingTasks && context.deepContent.pendingTasks.length > 0;
    const hasResponseDebt = context.deepContent?.responseDebt && context.deepContent.responseDebt.count > 0;
    const hasThreads = context.deepContent?.activeThreads && context.deepContent.activeThreads.length > 0;
    const hasStressIndicators = !!context.deepContent?.stressIndicators;

    const canRun = hasDeepContent && (hasTasks || hasResponseDebt || hasThreads || hasStressIndicators);

    console.log(`[DeepContentAgent] canAnalyze check:`, {
      hasDeepContent,
      hasTasks,
      hasResponseDebt,
      hasThreads,
      hasStressIndicators,
      canRun,
    });

    return canRun;
  }

  extractRelevantData(context: UserContext): Record<string, unknown> {
    return {
      deepContent: context.deepContent,
      gmail: context.gmail,
      slack: context.slack,
    };
  }

  buildPrompt(relevantData: Record<string, unknown>): string {
    const deepContent = relevantData.deepContent as DeepContentContext | undefined;

    if (!deepContent) {
      return 'No deep content available.';
    }

    // Check stress level to adjust tone
    const stressLevel = deepContent.stressIndicators?.overallStressLevel || 'low';
    const isUnderPressure = stressLevel === 'high' || stressLevel === 'overwhelming' || stressLevel === 'moderate';

    const parts: string[] = [
      `You are a Communication Workload Analyst AND Wellness Coach for Max tier users.

Your job is to:
1. Analyze SPECIFIC tasks, messages, and threads from the user's Gmail and Slack
2. Recognize emotional signals and pressure they're under
3. Provide supportive, empathetic insights with actionable coaching
4. End with an encouraging affirmation that builds confidence

${isUnderPressure ? `⚠️ STRESS DETECTED: The user appears to be under ${stressLevel} pressure. Be especially empathetic and supportive. Acknowledge the challenge before offering solutions.` : ''}

CRITICAL: You must mention SPECIFIC items from the data - task names, sender names, deadlines, etc.
Do NOT generate generic insights like "you have pending tasks" - be SPECIFIC.

INSIGHT TYPES TO GENERATE:
1. Urgent deadline insights - tasks with approaching deadlines (empathetic tone)
2. Response debt insights - important messages awaiting reply
3. Thread priority insights - active conversations needing attention
4. Stress/pressure insights - acknowledge overwhelm and provide coping strategies
5. Positive momentum insights - celebrate wins and manageable workloads

TONE GUIDELINES:
- Be warm and supportive, like a trusted colleague who genuinely cares
- Acknowledge challenges before jumping to solutions
- Frame tasks as achievable, not overwhelming
- Include breathing room in recommendations
- End with genuine encouragement, not generic positivity

EXAMPLE GOOD dataQuote (with empathy):
"I see you're juggling a lot right now - James's deadline for the Q4 report is creating real pressure, and you have 2 other high-priority items competing for attention. That's genuinely challenging. Here's how to tackle this strategically: Start with a quick 15-min block on James's report to show progress, then batch the PR reviews together. You've handled tight deadlines before - one thing at a time."

EXAMPLE BAD dataQuote (cold/generic):
"You have several pending tasks and messages to respond to."

Generate 1 insight that specifically addresses the most important items from the user's communications.
Reference tasks, people, and deadlines BY NAME. Be supportive and actionable.

=== EXTRACTED COMMUNICATION DATA ===
`,
    ];

    // Pending tasks with full details
    if (deepContent.pendingTasks && deepContent.pendingTasks.length > 0) {
      parts.push('📋 PENDING TASKS:');
      for (const task of deepContent.pendingTasks) {
        parts.push(`  - "${task.description}"`);
        parts.push(`    Source: ${task.source}`);
        parts.push(`    Urgency: ${task.urgency}`);
        if (task.deadline) parts.push(`    Deadline: ${task.deadline}`);
        if (task.requester) parts.push(`    From: ${task.requester}${task.requesterRole ? ` (${task.requesterRole})` : ''}`);
        parts.push('');
      }
    }

    // Response debt with specific messages
    if (deepContent.responseDebt && deepContent.responseDebt.count > 0) {
      parts.push('📬 MESSAGES AWAITING RESPONSE:');
      parts.push(`  Total: ${deepContent.responseDebt.count} messages`);
      parts.push(`  High Priority: ${deepContent.responseDebt.highPriorityCount}`);
      if (deepContent.responseDebt.oldestPending) {
        parts.push(`  Oldest: ${deepContent.responseDebt.oldestPending}`);
      }
      parts.push('');
      for (const msg of deepContent.responseDebt.messages) {
        parts.push(`  - From: ${msg.from}`);
        parts.push(`    Summary: "${msg.summary}"`);
        parts.push(`    Urgency: ${msg.urgency}`);
        parts.push(`    Source: ${msg.source}`);
        parts.push('');
      }
    }

    // Active threads
    if (deepContent.activeThreads && deepContent.activeThreads.length > 0) {
      parts.push('💬 ACTIVE THREADS NEEDING ATTENTION:');
      for (const thread of deepContent.activeThreads) {
        parts.push(`  - Topic: "${thread.topic}"`);
        parts.push(`    Urgency: ${thread.urgency}`);
        parts.push(`    Participants: ${thread.participants.join(', ')}`);
        if (thread.pendingActions.length > 0) {
          parts.push(`    Pending Actions: ${thread.pendingActions.join('; ')}`);
        }
        parts.push('');
      }
    }

    // Key people context
    if (deepContent.keyPeople && deepContent.keyPeople.length > 0) {
      parts.push('👥 KEY PEOPLE:');
      for (const person of deepContent.keyPeople.slice(0, 5)) {
        parts.push(`  - ${person.name} (${person.relationship}): ${person.communicationFrequency} contact`);
      }
      parts.push('');
    }

    // Interruption patterns
    if (deepContent.interruptionSummary && deepContent.interruptionSummary.totalInterruptions > 0) {
      parts.push('🔔 INTERRUPTION CONTEXT:');
      parts.push(`  Daily avg: ${deepContent.interruptionSummary.avgInterruptionsPerDay} interruptions`);
      parts.push(`  Urgent: ${deepContent.interruptionSummary.urgentInterruptions}`);
      if (deepContent.interruptionSummary.peakInterruptionHours.length > 0) {
        parts.push(`  Peak hours: ${deepContent.interruptionSummary.peakInterruptionHours.join(', ')}`);
      }
      parts.push('');
    }

    // Stress indicators for wellness coaching
    if (deepContent.stressIndicators) {
      const stress = deepContent.stressIndicators;
      parts.push('🧘 WELLNESS CONTEXT:');
      parts.push(`  Stress Level: ${stress.overallStressLevel} (${stress.stressScore}/100)`);
      parts.push(`  Emotional Tone: ${stress.emotionalTone}`);

      if (stress.pressureSources && stress.pressureSources.length > 0) {
        parts.push('  Pressure Sources:');
        for (const source of stress.pressureSources) {
          parts.push(`    - ${source.source} (${source.type}, ${source.intensity} intensity): ${source.description}`);
        }
      }

      // Include pre-generated coaching if available (for reference)
      if (stress.supportiveInsight) {
        parts.push(`  Pre-analyzed insight: "${stress.supportiveInsight}"`);
      }
      if (stress.actionableSteps && stress.actionableSteps.length > 0) {
        parts.push(`  Suggested actions: ${stress.actionableSteps.join('; ')}`);
      }
      if (stress.affirmation) {
        parts.push(`  Affirmation: "${stress.affirmation}"`);
      }
      parts.push('');
      parts.push('NOTE: Use this wellness context to inform your insight. If the user is under stress,');
      parts.push('acknowledge it empathetically and weave the affirmation naturally into your response.');
    }

    return parts.join('\n');
  }
}
