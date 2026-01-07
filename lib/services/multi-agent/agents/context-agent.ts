/**
 * ContextAgent - Analyzes life events, travel, major changes, and contextual factors
 */

import { BaseAgent } from '../base-agent';
import { UserContext, AgentConfig } from '../types';

const CONFIG: AgentConfig = {
  agentId: 'context_agent',
  agentName: 'ContextAgent',
  domain: 'CONTEXT',
  requiredDataSources: [],
  optionalDataSources: ['gmail', 'slack', 'outlook'],
  insightCategory: 'CROSS_DOMAIN',
};

export class ContextAgent extends BaseAgent {
  constructor() {
    super(CONFIG);
  }

  extractRelevantData(context: UserContext): Record<string, unknown> {
    const data: Record<string, unknown> = {};

    if (context.lifeContext) {
      data.lifeContext = {
        upcomingEvents: context.lifeContext.upcomingEvents,
        activePatterns: context.lifeContext.activePatterns,
        workContext: context.lifeContext.workContext,
      };
    }

    // Extract calendar-based context from Gmail patterns
    if (context.gmail?.meetingDensity) {
      data.calendarContext = {
        avgMeetingsPerDay: context.gmail.meetingDensity.avgMeetingsPerDay,
        backToBackPercentage: context.gmail.meetingDensity.backToBackPercentage,
        meetingFreeDays: context.gmail.focusTime?.meetingFreeDays,
      };
    }

    // Extract work stress context
    if (context.slack?.stressIndicators || context.gmail?.stressIndicators) {
      data.stressContext = {
        slack: context.slack?.stressIndicators,
        gmail: context.gmail?.stressIndicators,
      };
    }

    data.sources = {
      lifeContext: !!context.lifeContext,
      gmail: context.availableDataSources.includes('gmail'),
      slack: context.availableDataSources.includes('slack'),
    };

    return data;
  }

  buildPrompt(relevantData: Record<string, unknown>): string {
    return `You are a LIFE CONTEXT SPECIALIST analyzing major life events, patterns, and contextual factors that affect health.

YOUR EXPERTISE:
- Major life event impacts on health (travel, moves, job changes)
- Seasonal and cyclical pattern detection
- Work-life balance assessment
- Intervention timing based on life context
- Proactive health recommendations based on upcoming events
- Stress accumulation patterns

AVAILABLE DATA:
${JSON.stringify(relevantData, null, 2)}

ANALYSIS INSTRUCTIONS:
1. Identify any major life events or changes in progress
2. Assess current stress accumulation from multiple sources
3. Look for upcoming events that might require preparation
4. Consider how context should modify other recommendations
5. Identify optimal intervention windows
6. Flag any concerning patterns that need attention

KEY INSIGHTS TO PROVIDE:
- Timing matters: certain health interventions work better when stress is lower
- Travel and time zone changes require proactive recovery planning
- High meeting density periods need compensating self-care
- Major life transitions are both risks and opportunities for health changes

Generate 1-2 insights about how life context should inform health decisions and timing.`;
  }
}
