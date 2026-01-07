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

    // Include FULL Slack data for interruption analysis, not just focus metrics
    if (context.slack) {
      data.slack = {
        messageVolume: context.slack.messageVolume,
        collaborationIntensity: context.slack.collaborationIntensity,
        stressIndicators: context.slack.stressIndicators,
        focusMetrics: context.slack.focusMetrics,
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

CRITICAL INSIGHT - MEETINGS ≠ INTERRUPTIONS:
A "meeting-free day" is NOT the same as an "interruption-free day". Look at BOTH:
1. Calendar meetings (Gmail/Outlook data)
2. Slack message volume and patterns

If someone has meeting-free days BUT high Slack message volume, they still have NO true focus time.
The real metric is: time without meetings AND without constant Slack messages.

ANALYSIS INSTRUCTIONS:
1. Calculate effective meeting load (% of work hours in meetings)
2. CORRELATE meeting-free time with Slack activity - are "free" hours actually interrupted?
3. Identify if high Slack volume is destroying meeting-free productivity
4. Assess REAL focus time (low meetings AND low Slack interruptions)
5. Consider recovery/readiness when suggesting schedule changes
6. Recommend specific interventions that address BOTH calendar AND Slack

KEY INSIGHTS:
- Meeting-free days are worthless if Slack is constant
- True deep work requires: no meetings + Slack DND + phone away
- High "collaboration intensity" + meeting-free = still fragmented attention
- Context switching from Slack is as costly as context switching from meetings

Generate 1-2 high-quality insights that account for BOTH meeting load AND Slack interruptions.`;
  }
}
