/**
 * Deep Content Agent
 *
 * Specialized agent for Max tier that analyzes specific tasks, messages, and issues
 * extracted from Gmail and Slack to surface actionable insights about communication workload.
 *
 * This agent generates insights that reference SPECIFIC items from the user's inbox/messages,
 * not just patterns or statistics.
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
   * Override canAnalyze to require deep content with actual items
   */
  canAnalyze(context: UserContext): boolean {
    const hasDeepContent = !!context.deepContent;
    const hasTasks = context.deepContent?.pendingTasks && context.deepContent.pendingTasks.length > 0;
    const hasResponseDebt = context.deepContent?.responseDebt && context.deepContent.responseDebt.count > 0;
    const hasThreads = context.deepContent?.activeThreads && context.deepContent.activeThreads.length > 0;

    const canRun = hasDeepContent && (hasTasks || hasResponseDebt || hasThreads);

    console.log(`[DeepContentAgent] canAnalyze check:`, {
      hasDeepContent,
      hasTasks,
      hasResponseDebt,
      hasThreads,
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

    const parts: string[] = [
      `You are a Communication Workload Analyst for Max tier users.

Your job is to analyze SPECIFIC tasks, messages, and threads from the user's Gmail and Slack
and generate insights that reference these SPECIFIC items by name.

CRITICAL: You must mention SPECIFIC items from the data - task names, sender names, deadlines, etc.
Do NOT generate generic insights like "you have pending tasks" - be SPECIFIC.

INSIGHT TYPES TO GENERATE:
1. Urgent deadline insights - tasks with approaching deadlines
2. Response debt insights - important messages awaiting reply
3. Thread priority insights - active conversations needing attention
4. Workload overwhelm insights - if too many high-priority items

EXAMPLE GOOD dataQuote:
"Your inbox shows 3 high-priority items: (1) The SendGrid payment notification from billing@sendgrid.com has been pending since Jan 4th - this could affect your production email service. (2) Sarah's request for the Q1 roadmap doc needs a response by tomorrow. (3) The Slack thread about the API outage has 12 unread messages and your input was requested 2 hours ago."

EXAMPLE BAD dataQuote (too generic):
"You have several pending tasks and messages to respond to."

Generate 1 insight that specifically addresses the most important items from the user's communications.
Reference tasks, people, and deadlines BY NAME.

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
    }

    return parts.join('\n');
  }
}
