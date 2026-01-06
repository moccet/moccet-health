/**
 * StressAgent - Analyzes work stress, communication patterns, and work-life balance
 */

import { BaseAgent } from '../base-agent';
import { UserContext, AgentConfig } from '../types';

const CONFIG: AgentConfig = {
  agentId: 'stress_agent',
  agentName: 'StressAgent',
  domain: 'STRESS',
  requiredDataSources: ['gmail', 'slack', 'outlook', 'teams'],
  optionalDataSources: [],
  insightCategory: 'STRESS',
};

export class StressAgent extends BaseAgent {
  constructor() {
    super(CONFIG);
  }

  extractRelevantData(context: UserContext): Record<string, unknown> {
    const data: Record<string, unknown> = {};

    // Extract Gmail patterns
    if (context.gmail) {
      data.gmail = {
        meetingDensity: context.gmail.meetingDensity,
        emailVolume: context.gmail.emailVolume,
        focusTime: context.gmail.focusTime,
        stressIndicators: context.gmail.stressIndicators,
      };
    }

    // Extract Slack patterns
    if (context.slack) {
      data.slack = {
        messageVolume: context.slack.messageVolume,
        collaborationIntensity: context.slack.collaborationIntensity,
        stressIndicators: context.slack.stressIndicators,
        focusMetrics: context.slack.focusMetrics,
      };
    }

    // Life context for deep analysis
    if (context.lifeContext) {
      data.lifeContext = {
        workContext: context.lifeContext.workContext,
        activePatterns: context.lifeContext.activePatterns,
      };
    }

    data.sources = {
      gmail: context.availableDataSources.includes('gmail'),
      slack: context.availableDataSources.includes('slack'),
      outlook: context.availableDataSources.includes('outlook'),
      teams: context.availableDataSources.includes('teams'),
    };

    return data;
  }

  buildPrompt(relevantData: Record<string, unknown>): string {
    return `You are a STRESS & WORK-LIFE BALANCE SPECIALIST analyzing communication patterns.

YOUR EXPERTISE:
- Work stress detection from digital communication patterns
- Meeting density and calendar health
- After-hours work patterns and boundary violations
- Focus time and deep work capacity
- Communication overload indicators
- Work-life balance optimization

AVAILABLE DATA:
${this.formatAllData(relevantData)}

ANALYSIS INSTRUCTIONS:
1. Calculate overall stress score from communication patterns
2. Identify after-hours work patterns and their frequency
3. Analyze meeting density and its impact on focus time
4. Detect boundary violations (work bleeding into personal time)
5. Assess deep work capacity and context-switching burden
6. Recommend specific interventions for stress reduction

IMPORTANT: Connect findings to physiological impact:
- High after-hours activity → poor sleep → low HRV
- Meeting overload → decision fatigue → low recovery
- Constant availability → chronic stress → elevated cortisol

Generate 1-2 high-quality insights with specific numbers.`;
  }

  private formatAllData(data: Record<string, unknown>): string {
    const sections: string[] = [];

    if (data.gmail) {
      const gmail = data.gmail as Record<string, unknown>;
      const lines: string[] = ['### Gmail/Calendar Patterns:'];

      if (gmail.meetingDensity) {
        const md = gmail.meetingDensity as Record<string, unknown>;
        lines.push(`- Avg Meetings/Day: ${md.avgMeetingsPerDay}`);
        lines.push(`- Back-to-Back Meetings: ${md.backToBackPercentage}%`);
        if (md.peakHours) lines.push(`- Peak Meeting Hours: ${(md.peakHours as string[]).join(', ')}`);
      }

      if (gmail.emailVolume) {
        const ev = gmail.emailVolume as Record<string, unknown>;
        lines.push(`- Avg Emails/Day: ${ev.avgPerDay}`);
        lines.push(`- After-Hours Email: ${ev.afterHoursPercentage}%`);
      }

      if (gmail.focusTime) {
        const ft = gmail.focusTime as Record<string, unknown>;
        lines.push(`- Focus Blocks/Day: ${ft.avgFocusBlocksPerDay}`);
        lines.push(`- Longest Focus Block: ${ft.longestFocusBlock} min`);
        lines.push(`- Meeting-Free Days: ${ft.meetingFreeDays}`);
        lines.push(`- Focus Score: ${ft.focusScore}`);
      }

      if (gmail.stressIndicators) {
        const si = gmail.stressIndicators as Record<string, boolean>;
        const indicators = [];
        if (si.highEmailVolume) indicators.push('High email volume');
        if (si.frequentAfterHoursWork) indicators.push('Frequent after-hours work');
        if (si.shortMeetingBreaks) indicators.push('Short meeting breaks');
        if (indicators.length > 0) {
          lines.push(`- Stress Signals: ${indicators.join(', ')}`);
        }
      }

      sections.push(lines.join('\n'));
    }

    if (data.slack) {
      const slack = data.slack as Record<string, unknown>;
      const lines: string[] = ['### Slack Communication Patterns:'];

      if (slack.messageVolume) {
        const mv = slack.messageVolume as Record<string, unknown>;
        lines.push(`- Avg Messages/Day: ${mv.avgPerDay}`);
        lines.push(`- After-Hours Messages: ${mv.afterHoursPercentage}%`);
      }

      if (slack.collaborationIntensity) {
        lines.push(`- Collaboration Intensity: ${slack.collaborationIntensity}`);
      }

      if (slack.focusMetrics) {
        const fm = slack.focusMetrics as Record<string, unknown>;
        lines.push(`- Deep Work Windows: ${fm.deepWorkWindows}`);
        lines.push(`- Context Switching: ${fm.contextSwitchingScore}`);
      }

      if (slack.stressIndicators) {
        const si = slack.stressIndicators as Record<string, boolean>;
        const indicators = [];
        if (si.constantAvailability) indicators.push('Constant availability');
        if (si.lateNightMessages) indicators.push('Late night messages');
        if (si.noBreakPeriods) indicators.push('No break periods');
        if (indicators.length > 0) {
          lines.push(`- Stress Signals: ${indicators.join(', ')}`);
        }
      }

      sections.push(lines.join('\n'));
    }

    if (data.lifeContext) {
      const lc = data.lifeContext as Record<string, unknown>;
      const lines: string[] = ['### Life Context:'];

      if (lc.workContext) {
        const wc = lc.workContext as Record<string, unknown>;
        if (wc.ongoingChallenges && (wc.ongoingChallenges as string[]).length > 0) {
          lines.push(`- Ongoing Challenges: ${(wc.ongoingChallenges as string[]).join(', ')}`);
        }
        if (wc.teamDynamics) {
          lines.push(`- Team Dynamics: ${wc.teamDynamics}`);
        }
      }

      sections.push(lines.join('\n'));
    }

    if (sections.length === 0) {
      sections.push('No work/communication data available. Connect Gmail or Slack for stress analysis.');
    }

    return sections.join('\n\n');
  }
}
