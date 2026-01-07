/**
 * Work Coordinator
 *
 * Manages work and productivity domain agents:
 * - StressAgent: Behavioral stress signals, work-life balance
 * - CalendarAgent: Meeting load, focus time, schedule optimization
 *
 * Also integrates deep content analysis for:
 * - Pending tasks from messages
 * - Response debt
 * - Interruption patterns
 */

import OpenAI from 'openai';
import { BaseAgent } from '../base-agent';
import { AgentFinding, UserContext } from '../types';
import { StressAgent, CalendarAgent } from '../agents';
import { BaseCoordinator, CrossDomainFlag, CoordinatorConfig, Conflict } from './base-coordinator';

const WORK_COORDINATOR_CONFIG: CoordinatorConfig = {
  name: 'WorkCoordinator',
  domain: 'WORK',
  description: 'Manages work stress, calendar, productivity, and communication load',
  priority: 2,
};

export class WorkCoordinator extends BaseCoordinator {
  constructor(openai: OpenAI) {
    super(WORK_COORDINATOR_CONFIG, openai);
  }

  protected initializeAgents(): BaseAgent[] {
    return [
      new StressAgent(),
      new CalendarAgent(),
    ];
  }

  /**
   * Generate flags for other coordinators based on work findings
   */
  protected generateCrossDomainFlags(
    findings: AgentFinding[],
    context: UserContext
  ): CrossDomainFlag[] {
    const flags: CrossDomainFlag[] = [];

    // Check for high stress - flag to Health coordinator
    const stressFinding = findings.find(f => f.agentName === 'StressAgent');
    if (stressFinding) {
      const highStress = stressFinding.insights.some(i =>
        i.impact === 'critical' || i.impact === 'high'
      );

      if (highStress) {
        flags.push({
          fromDomain: 'WORK',
          toDomains: ['HEALTH'],
          flag: 'HIGH_WORK_STRESS',
          priority: 'high',
          context: {
            recommendation: 'Stress may impact recovery and sleep - prioritize rest',
          },
        });
      }
    }

    // Check calendar load - flag to Health if overloaded
    const calendarFinding = findings.find(f => f.agentName === 'CalendarAgent');
    if (calendarFinding) {
      const overloaded = calendarFinding.insights.some(i =>
        i.dataQuote.toLowerCase().includes('back-to-back') ||
        i.dataQuote.toLowerCase().includes('no focus time')
      );

      if (overloaded) {
        flags.push({
          fromDomain: 'WORK',
          toDomains: ['HEALTH', 'LIFESTYLE'],
          flag: 'CALENDAR_OVERLOAD',
          priority: 'medium',
          context: {
            recommendation: 'Heavy meeting load may impact meal timing and exercise',
          },
        });
      }
    }

    // Check deep content for urgent tasks
    if (context.deepContent) {
      const urgentTasks = context.deepContent.pendingTasks.filter(t =>
        t.urgency === 'critical' || t.urgency === 'high'
      );

      if (urgentTasks.length > 0) {
        flags.push({
          fromDomain: 'WORK',
          toDomains: ['HEALTH'],
          flag: 'URGENT_DEADLINES',
          priority: 'high',
          context: {
            taskCount: urgentTasks.length,
            tasks: urgentTasks.slice(0, 3).map(t => t.description),
            recommendation: 'Urgent work may require adjusting health routines today',
          },
        });
      }

      // Check response debt
      if (context.deepContent.responseDebt.highPriorityCount > 2) {
        flags.push({
          fromDomain: 'WORK',
          toDomains: ['HEALTH'],
          flag: 'HIGH_RESPONSE_DEBT',
          priority: 'medium',
          context: {
            pendingResponses: context.deepContent.responseDebt.count,
            highPriority: context.deepContent.responseDebt.highPriorityCount,
            recommendation: 'Communication backlog may be causing stress',
          },
        });
      }

      // Check interruption patterns
      if (context.deepContent.interruptionSummary.avgInterruptionsPerDay > 10) {
        flags.push({
          fromDomain: 'WORK',
          toDomains: ['HEALTH', 'LIFESTYLE'],
          flag: 'HIGH_INTERRUPTION_LOAD',
          priority: 'medium',
          context: {
            avgInterruptions: context.deepContent.interruptionSummary.avgInterruptionsPerDay,
            peakHours: context.deepContent.interruptionSummary.peakInterruptionHours,
            recommendation: 'High interruptions fragment focus and increase cognitive load',
          },
        });
      }
    }

    // Check Slack patterns
    if (context.slack) {
      if (context.slack.stressIndicators?.constantAvailability) {
        flags.push({
          fromDomain: 'WORK',
          toDomains: ['HEALTH'],
          flag: 'ALWAYS_ON_PATTERN',
          priority: 'high',
          context: {
            afterHoursPercentage: context.slack.messageVolume?.afterHoursPercentage,
            recommendation: 'Always-on work pattern detected - recovery at risk',
          },
        });
      }
    }

    return flags;
  }

  /**
   * Assess data quality for work domain
   */
  protected assessDataQuality(context: UserContext): 'high' | 'medium' | 'low' {
    const sources = context.availableDataSources;

    const hasGmail = sources.includes('gmail');
    const hasSlack = sources.includes('slack');
    const hasDeepContent = !!context.deepContent;

    if (hasGmail && hasSlack && hasDeepContent) return 'high';
    if (hasGmail || hasSlack) return 'medium';
    return 'low';
  }

  /**
   * Work-specific conflict detection
   */
  protected async checkForConflict(
    findingA: AgentFinding,
    findingB: AgentFinding
  ): Promise<Conflict | null> {
    const aRecommends = findingA.insights.map(i => i.recommendation.toLowerCase()).join(' ');
    const bRecommends = findingB.insights.map(i => i.recommendation.toLowerCase()).join(' ');

    // Stress says take break, Calendar says important meetings
    if (
      (findingA.agentName === 'StressAgent' && findingB.agentName === 'CalendarAgent') ||
      (findingA.agentName === 'CalendarAgent' && findingB.agentName === 'StressAgent')
    ) {
      const breakKeywords = ['break', 'disconnect', 'reduce meetings', 'block time'];
      const meetingKeywords = ['attend', 'important meeting', 'don\'t miss'];

      const aWantsBreak = breakKeywords.some(k => aRecommends.includes(k));
      const bHasMeetings = meetingKeywords.some(k => bRecommends.includes(k));

      if (aWantsBreak && bHasMeetings) {
        return {
          id: `work_conflict_${Date.now()}`,
          type: 'resource_competition',
          agentA: {
            name: findingA.agentName,
            position: findingA.insights[0]?.recommendation || aRecommends,
            evidence: findingA.insights.map(i => i.dataQuote),
            confidence: findingA.confidence,
          },
          agentB: {
            name: findingB.agentName,
            position: findingB.insights[0]?.recommendation || bRecommends,
            evidence: findingB.insights.map(i => i.dataQuote),
            confidence: findingB.confidence,
          },
          severity: 'significant',
          detectedAt: new Date().toISOString(),
        };
      }
    }

    return super.checkForConflict(findingA, findingB);
  }

  /**
   * Override synthesis to include deep content context
   */
  protected async synthesizeDomainInsights(findings: AgentFinding[]): Promise<string> {
    // Get context from the agent findings
    const insightSummaries = findings
      .flatMap(f => f.insights)
      .map(i => `- ${i.title}: ${i.recommendation}`)
      .join('\n');

    // Add task context if available
    let taskContext = '';
    // Note: We don't have direct access to context here, so we rely on what's in the insights

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a Work & Productivity coordinator. Synthesize insights about stress, calendar, and communication load into actionable guidance. Be concise (2-3 sentences).`,
          },
          {
            role: 'user',
            content: `Synthesize these work insights:\n${insightSummaries}${taskContext}`,
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
}
