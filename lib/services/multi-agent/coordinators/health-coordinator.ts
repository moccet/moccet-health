/**
 * Health Coordinator
 *
 * Manages health and recovery domain agents:
 * - RecoveryAgent: HRV, recovery scores, strain
 * - SleepAgent: Sleep quality, sleep debt, circadian rhythm
 * - GlucoseAgent: Blood sugar, CGM data
 * - BloodAgent: Biomarkers, blood tests
 * - ActivityAgent: Steps, calories, movement
 * - CardioAgent: Heart rate, cardio fitness
 */

import OpenAI from 'openai';
import { BaseAgent } from '../base-agent';
import { AgentFinding, UserContext } from '../types';
import {
  RecoveryAgent,
  SleepAgent,
  GlucoseAgent,
  BloodAgent,
  ActivityAgent,
  CardioAgent,
} from '../agents';
import { BaseCoordinator, CrossDomainFlag, CoordinatorConfig } from './base-coordinator';

const HEALTH_COORDINATOR_CONFIG: CoordinatorConfig = {
  name: 'HealthCoordinator',
  domain: 'HEALTH',
  description: 'Manages physical health, recovery, sleep, and physiological metrics',
  priority: 1, // Highest priority - health is foundational
};

export class HealthCoordinator extends BaseCoordinator {
  constructor(openai: OpenAI) {
    super(HEALTH_COORDINATOR_CONFIG, openai);
  }

  protected initializeAgents(): BaseAgent[] {
    return [
      new RecoveryAgent(),
      new SleepAgent(),
      new GlucoseAgent(),
      new BloodAgent(),
      new ActivityAgent(),
      new CardioAgent(),
    ];
  }

  /**
   * Generate flags for other coordinators based on health findings
   */
  protected generateCrossDomainFlags(
    findings: AgentFinding[],
    context: UserContext
  ): CrossDomainFlag[] {
    const flags: CrossDomainFlag[] = [];

    for (const finding of findings) {
      // Check for low recovery - flag to Work coordinator
      if (finding.agentName === 'RecoveryAgent') {
        const lowRecovery = finding.insights.some(i =>
          i.dataQuote.toLowerCase().includes('recovery') &&
          (i.impact === 'critical' || i.impact === 'high')
        );

        if (lowRecovery || (context.whoop?.avgRecoveryScore && context.whoop.avgRecoveryScore < 50)) {
          flags.push({
            fromDomain: 'HEALTH',
            toDomains: ['WORK'],
            flag: 'LOW_RECOVERY_STATE',
            priority: 'high',
            context: {
              recoveryScore: context.whoop?.avgRecoveryScore,
              recommendation: 'Consider reducing work intensity today',
            },
          });
        }
      }

      // Check for sleep debt - flag to Work and Lifestyle
      if (finding.agentName === 'SleepAgent') {
        const sleepDebt = finding.insights.some(i =>
          i.dataQuote.toLowerCase().includes('debt') ||
          i.dataQuote.toLowerCase().includes('deficit')
        );

        if (sleepDebt) {
          flags.push({
            fromDomain: 'HEALTH',
            toDomains: ['WORK', 'LIFESTYLE'],
            flag: 'SLEEP_DEBT_ACCUMULATED',
            priority: 'high',
            context: {
              recommendation: 'Prioritize earlier bedtime, avoid late meetings',
            },
          });
        }
      }

      // Check for glucose issues - flag to Lifestyle (nutrition)
      if (finding.agentName === 'GlucoseAgent') {
        const glucoseIssues = finding.insights.some(i =>
          i.impact === 'critical' || i.impact === 'high'
        );

        if (glucoseIssues) {
          flags.push({
            fromDomain: 'HEALTH',
            toDomains: ['LIFESTYLE'],
            flag: 'GLUCOSE_DYSREGULATION',
            priority: 'high',
            context: {
              recommendation: 'Review meal timing and composition',
            },
          });
        }
      }

      // Check for high strain - flag to Work coordinator
      if (finding.agentName === 'ActivityAgent' || finding.agentName === 'CardioAgent') {
        if (context.whoop?.avgStrainScore && context.whoop.avgStrainScore > 15) {
          flags.push({
            fromDomain: 'HEALTH',
            toDomains: ['WORK'],
            flag: 'HIGH_PHYSICAL_STRAIN',
            priority: 'medium',
            context: {
              strainScore: context.whoop.avgStrainScore,
              recommendation: 'Balance physical and cognitive load',
            },
          });
        }
      }
    }

    return flags;
  }

  /**
   * Assess data quality for health domain
   */
  protected assessDataQuality(context: UserContext): 'high' | 'medium' | 'low' {
    const sources = context.availableDataSources;

    // High quality: Multiple wearables + blood data
    const hasWhoop = sources.includes('whoop');
    const hasOura = sources.includes('oura');
    const hasDexcom = sources.includes('dexcom');
    const hasBlood = sources.includes('blood_biomarkers');
    const hasAppleHealth = sources.includes('apple_health');

    const wearableCount = [hasWhoop, hasOura, hasDexcom, hasAppleHealth].filter(Boolean).length;

    if (wearableCount >= 2 && hasBlood) return 'high';
    if (wearableCount >= 1 || hasBlood) return 'medium';
    return 'low';
  }

  /**
   * Override conflict detection with health-specific rules
   */
  protected async checkForConflict(
    findingA: AgentFinding,
    findingB: AgentFinding
  ): Promise<import('./base-coordinator').Conflict | null> {
    // Check for activity vs recovery conflict
    const aRecommends = findingA.insights.map(i => i.recommendation.toLowerCase()).join(' ');
    const bRecommends = findingB.insights.map(i => i.recommendation.toLowerCase()).join(' ');

    // Recovery says rest, Activity says exercise
    if (
      (findingA.agentName === 'RecoveryAgent' && findingB.agentName === 'ActivityAgent') ||
      (findingA.agentName === 'ActivityAgent' && findingB.agentName === 'RecoveryAgent')
    ) {
      const restKeywords = ['rest', 'recover', 'take it easy', 'light activity only'];
      const exerciseKeywords = ['exercise', 'workout', 'training', 'increase activity'];

      const aWantsRest = restKeywords.some(k => aRecommends.includes(k));
      const bWantsExercise = exerciseKeywords.some(k => bRecommends.includes(k));
      const aWantsExercise = exerciseKeywords.some(k => aRecommends.includes(k));
      const bWantsRest = restKeywords.some(k => bRecommends.includes(k));

      if ((aWantsRest && bWantsExercise) || (aWantsExercise && bWantsRest)) {
        return {
          id: `health_conflict_${Date.now()}`,
          type: 'contradiction',
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

    // Fall back to base implementation
    return super.checkForConflict(findingA, findingB);
  }
}
