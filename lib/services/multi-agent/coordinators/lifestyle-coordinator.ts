/**
 * Lifestyle Coordinator
 *
 * Manages lifestyle and habit domain agents:
 * - NutritionAgent: Meal timing, dietary patterns, glucose correlation
 * - MusicAgent: Spotify mood patterns, emotional state inference
 * - ContextAgent: User goals, preferences, life context
 */

import OpenAI from 'openai';
import { BaseAgent } from '../base-agent';
import { AgentFinding, UserContext } from '../types';
import { NutritionAgent, MusicAgent, ContextAgent } from '../agents';
import { BaseCoordinator, CrossDomainFlag, CoordinatorConfig, Conflict } from './base-coordinator';

const LIFESTYLE_COORDINATOR_CONFIG: CoordinatorConfig = {
  name: 'LifestyleCoordinator',
  domain: 'LIFESTYLE',
  description: 'Manages nutrition, mood, habits, and personal context',
  priority: 3,
};

export class LifestyleCoordinator extends BaseCoordinator {
  constructor(openai: OpenAI) {
    super(LIFESTYLE_COORDINATOR_CONFIG, openai);
  }

  protected initializeAgents(): BaseAgent[] {
    return [
      new NutritionAgent(),
      new MusicAgent(),
      new ContextAgent(),
    ];
  }

  /**
   * Generate flags for other coordinators based on lifestyle findings
   */
  protected generateCrossDomainFlags(
    findings: AgentFinding[],
    context: UserContext
  ): CrossDomainFlag[] {
    const flags: CrossDomainFlag[] = [];

    // Check for nutrition issues - flag to Health
    const nutritionFinding = findings.find(f => f.agentName === 'NutritionAgent');
    if (nutritionFinding) {
      const mealTimingIssues = nutritionFinding.insights.some(i =>
        i.dataQuote.toLowerCase().includes('late meal') ||
        i.dataQuote.toLowerCase().includes('irregular eating')
      );

      if (mealTimingIssues) {
        flags.push({
          fromDomain: 'LIFESTYLE',
          toDomains: ['HEALTH'],
          flag: 'MEAL_TIMING_ISSUES',
          priority: 'medium',
          context: {
            recommendation: 'Irregular meals may impact sleep and glucose regulation',
          },
        });
      }
    }

    // Check for mood patterns - flag to Health and Work
    const musicFinding = findings.find(f => f.agentName === 'MusicAgent');
    if (musicFinding) {
      const lowMoodIndicators = musicFinding.insights.some(i =>
        i.dataQuote.toLowerCase().includes('low energy') ||
        i.dataQuote.toLowerCase().includes('sad') ||
        i.dataQuote.toLowerCase().includes('melancholy')
      );

      if (lowMoodIndicators) {
        flags.push({
          fromDomain: 'LIFESTYLE',
          toDomains: ['HEALTH', 'WORK'],
          flag: 'LOW_MOOD_DETECTED',
          priority: 'medium',
          context: {
            recommendation: 'Music listening suggests low energy - consider mood-supporting activities',
          },
        });
      }
    }

    // Check life context for major events
    if (context.lifeContext) {
      const upcomingEvents = context.lifeContext.upcomingEvents || [];
      const highUrgencyEvents = upcomingEvents.filter(e => e.urgency === 'high');

      if (highUrgencyEvents.length > 0) {
        flags.push({
          fromDomain: 'LIFESTYLE',
          toDomains: ['WORK', 'HEALTH'],
          flag: 'MAJOR_LIFE_EVENTS',
          priority: 'high',
          context: {
            events: highUrgencyEvents.map(e => e.description),
            recommendation: 'Major life events may require schedule adjustments',
          },
        });
      }
    }

    return flags;
  }

  /**
   * Assess data quality for lifestyle domain
   */
  protected assessDataQuality(context: UserContext): 'high' | 'medium' | 'low' {
    const sources = context.availableDataSources;

    const hasSpotify = sources.includes('spotify');
    const hasLifeContext = !!context.lifeContext;
    const hasUserPreferences = !!context.userPreferences;
    const hasDexcom = sources.includes('dexcom'); // For nutrition correlation

    const dataPoints = [hasSpotify, hasLifeContext, hasUserPreferences, hasDexcom].filter(Boolean).length;

    if (dataPoints >= 3) return 'high';
    if (dataPoints >= 1) return 'medium';
    return 'low';
  }

  /**
   * Lifestyle-specific conflict detection
   */
  protected async checkForConflict(
    findingA: AgentFinding,
    findingB: AgentFinding
  ): Promise<Conflict | null> {
    // Nutrition says eat now, Context says user is fasting
    // Music suggests upbeat activity, but Context says user prefers quiet

    const aRecommends = findingA.insights.map(i => i.recommendation.toLowerCase()).join(' ');
    const bRecommends = findingB.insights.map(i => i.recommendation.toLowerCase()).join(' ');

    // Check for timing conflicts
    if (
      (findingA.agentName === 'NutritionAgent' && findingB.agentName === 'ContextAgent') ||
      (findingA.agentName === 'ContextAgent' && findingB.agentName === 'NutritionAgent')
    ) {
      const eatKeywords = ['eat', 'meal', 'snack', 'breakfast', 'lunch', 'dinner'];
      const fastKeywords = ['fasting', 'intermittent', 'skip meal', 'eating window'];

      const aWantsEat = eatKeywords.some(k => aRecommends.includes(k));
      const bWantsFast = fastKeywords.some(k => bRecommends.includes(k));

      if (aWantsEat && bWantsFast) {
        return {
          id: `lifestyle_conflict_${Date.now()}`,
          type: 'priority_clash',
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
          severity: 'minor',
          detectedAt: new Date().toISOString(),
        };
      }
    }

    return super.checkForConflict(findingA, findingB);
  }
}
