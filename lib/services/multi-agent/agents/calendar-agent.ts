/**
 * CalendarAgent - Analyzes meeting load, focus time, and schedule optimization
 */

import { BaseAgent } from '../base-agent';
import { UserContext, AgentConfig } from '../types';

const CONFIG: AgentConfig = {
  agentId: 'calendar_agent',
  agentName: 'CalendarAgent',
  domain: 'CALENDAR',
  requiredDataSources: ['gmail', 'outlook'],
  optionalDataSources: ['slack'],
  insightCategory: 'PRODUCTIVITY',
};

export class CalendarAgent extends BaseAgent {
  constructor() {
    super(CONFIG);
  }

  extractRelevantData(context: UserContext): Record<string, unknown> {
    const data: Record<string, unknown> = {};

    if (context.gmail) {
      data.gmail = {
        meetingDensity: context.gmail.meetingDensity,
        focusTime: context.gmail.focusTime,
        emailVolume: context.gmail.emailVolume,
      };
    }

    if (context.slack?.focusMetrics) {
      data.slackFocus = {
        deepWorkWindows: context.slack.focusMetrics.deepWorkWindows,
        longestFocusPeriod: context.slack.focusMetrics.longestFocusPeriod,
        contextSwitchingScore: context.slack.focusMetrics.contextSwitchingScore,
      };
    }

    // Recovery context to optimize scheduling
    if (context.whoop) {
      data.recovery = {
        avgRecoveryScore: context.whoop.avgRecoveryScore,
        recoveryTrend: context.whoop.recoveryTrend,
      };
    }

    if (context.oura) {
      data.readiness = {
        avgReadinessScore: context.oura.avgReadinessScore,
      };
    }

    data.sources = {
      gmail: context.availableDataSources.includes('gmail'),
      outlook: context.availableDataSources.includes('outlook'),
      slack: context.availableDataSources.includes('slack'),
      whoop: context.availableDataSources.includes('whoop'),
      oura: context.availableDataSources.includes('oura'),
    };

    return data;
  }

  buildPrompt(relevantData: Record<string, unknown>): string {
    return `You are a PRODUCTIVITY & CALENDAR SPECIALIST analyzing meeting load, focus time, and schedule patterns.

YOUR EXPERTISE:
- Meeting density and back-to-back meeting patterns
- Focus time blocks and deep work opportunities
- Calendar fragmentation and context switching costs
- Peak productivity hours alignment
- Meeting-free day value and implementation
- Energy management through schedule design

AVAILABLE DATA:
${JSON.stringify(relevantData, null, 2)}

ANALYSIS INSTRUCTIONS:
1. Calculate effective meeting load (% of work hours in meetings)
2. Identify back-to-back meeting patterns
3. Assess available focus time blocks (2+ hours uninterrupted)
4. Look for meeting clustering vs. fragmentation
5. Consider recovery/readiness when suggesting schedule changes
6. Recommend specific calendar interventions

KEY INSIGHTS TO PROVIDE:
- Back-to-back meetings prevent mental recovery and reduce effectiveness
- 2+ hour focus blocks are necessary for complex cognitive work
- Meeting-free days improve weekly productivity by 30%+
- Morning meetings can disrupt the highest-productivity hours (9-11am)
- Energy follows recovery - schedule demanding meetings on high-recovery days

Generate 1-2 high-quality insights about schedule optimization with specific meeting metrics.`;
  }
}
