/**
 * Travel Context Agent
 *
 * Specialized agent that detects when users are traveling (via timezone changes)
 * and generates contextual recommendations:
 * - Home/hotel workouts (no gym access)
 * - Jet lag management strategies
 * - Sleep schedule adjustments
 * - Hydration and nutrition for travel
 */

import { BaseAgent } from '../base-agent';
import { UserContext, UserPreferences, AgentConfig } from '../types';

const CONFIG: AgentConfig = {
  agentId: 'travel_context_agent',
  agentName: 'TravelContextAgent',
  domain: 'LIFESTYLE',
  requiredDataSources: [], // Can run with just device context
  optionalDataSources: ['apple_health', 'whoop', 'oura'],
  insightCategory: 'LIFESTYLE',
};

// Map timezone to estimated location/region
const TIMEZONE_LOCATIONS: Record<string, string> = {
  'JST': 'Japan',
  'Asia/Tokyo': 'Japan',
  'CST': 'China',
  'Asia/Shanghai': 'China',
  'GMT': 'UK/Western Europe',
  'Europe/London': 'UK',
  'CET': 'Central Europe',
  'Europe/Paris': 'France',
  'Europe/Berlin': 'Germany',
  'PST': 'US West Coast',
  'America/Los_Angeles': 'US West Coast',
  'EST': 'US East Coast',
  'America/New_York': 'US East Coast',
  'IST': 'India',
  'Asia/Kolkata': 'India',
  'AEST': 'Australia',
  'Australia/Sydney': 'Australia',
  'SGT': 'Singapore',
  'Asia/Singapore': 'Singapore',
  'HKT': 'Hong Kong',
  'Asia/Hong_Kong': 'Hong Kong',
  'KST': 'South Korea',
  'Asia/Seoul': 'South Korea',
};

export class TravelContextAgent extends BaseAgent {
  constructor() {
    super(CONFIG);
  }

  /**
   * Override canAnalyze to check for travel context
   */
  canAnalyze(context: UserContext): boolean {
    // Check if we have travel context data
    const hasTravelContext = !!context.travelContext;
    const isCurrentlyTraveling = context.travelContext?.isCurrentlyTraveling;

    console.log(`[TravelContextAgent] canAnalyze: hasTravelContext=${hasTravelContext}, isCurrentlyTraveling=${isCurrentlyTraveling}`);

    return hasTravelContext && isCurrentlyTraveling === true;
  }

  extractRelevantData(context: UserContext): Record<string, unknown> {
    return {
      travelContext: context.travelContext,
      appleHealth: context.appleHealth,
      whoop: context.whoop,
      oura: context.oura,
    };
  }

  /**
   * Override getSystemPrompt for travel-specific insights
   */
  protected getSystemPrompt(): string {
    return `You are a Travel Wellness Advisor for a health optimization app.

Your job is to generate personalized recommendations for users who are CURRENTLY TRAVELING
(detected via timezone change from their home location).

KEY CONSIDERATIONS:
1. No gym access - suggest bodyweight/hotel room exercises
2. Jet lag - light exposure, meal timing, sleep schedule adjustments
3. Different food options - healthy eating while traveling
4. Hydration - travel dehydration is common
5. Maintain fitness momentum despite disruption
6. Time zone adaptation strategies

RESPONSE FORMAT:
Return a JSON object with an "insights" array. Each insight must have:
- id: unique string
- title: concise, actionable title (e.g., "20-Minute Hotel Room Workout")
- finding: what you noticed about their travel situation
- dataQuote: Reference their specific travel context (timezone, duration, etc.)
- recommendation: one clear, actionable recommendation
- scienceExplanation: 1-2 sentences on the science (jet lag, circadian rhythm, etc.)
- actionSteps: array of 3 specific steps they can do TODAY
- impact: "high" | "medium"
- confidence: 0.85
- sources: ["travel_context", "device"]

Generate 1-2 highly relevant insights for their travel situation.`;
  }

  buildPrompt(relevantData: Record<string, unknown>): string {
    const travelContext = relevantData.travelContext as UserContext['travelContext'];
    const appleHealth = relevantData.appleHealth;
    const whoop = relevantData.whoop;

    if (!travelContext) {
      return 'No travel context available.';
    }

    const parts: string[] = [];

    parts.push('=== TRAVEL CONTEXT ===');
    parts.push(`Home Timezone: ${travelContext.homeTimezone || 'Unknown'}`);
    parts.push(`Current Timezone: ${travelContext.currentTimezone}`);
    parts.push(`Timezone Offset Change: ${travelContext.timezoneOffsetChange || 0} hours`);

    // Estimate location from timezone
    const estimatedLocation = TIMEZONE_LOCATIONS[travelContext.currentTimezone] ||
                              this.guessLocationFromTimezone(travelContext.currentTimezone);
    parts.push(`Estimated Location: ${estimatedLocation}`);

    if (travelContext.travelStartDate) {
      const daysTraveling = Math.floor(
        (Date.now() - new Date(travelContext.travelStartDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      parts.push(`Days Traveling: ${daysTraveling}`);
    }

    parts.push('');

    // Add health context if available
    if (appleHealth) {
      parts.push('=== RECENT HEALTH DATA ===');
      const health = appleHealth as Record<string, unknown>;
      if (health.avgSteps) parts.push(`Recent Avg Steps: ${health.avgSteps}`);
      if (health.workoutCount) parts.push(`Recent Workouts: ${health.workoutCount}`);
      if (health.avgSleepHours) parts.push(`Avg Sleep: ${health.avgSleepHours} hours`);
    }

    if (whoop) {
      const whoopData = whoop as Record<string, unknown>;
      if (whoopData.avgRecoveryScore) parts.push(`Recovery Score: ${whoopData.avgRecoveryScore}`);
    }

    parts.push('');
    parts.push('=== INSTRUCTIONS ===');
    parts.push('Generate 1-2 insights that help this traveler maintain their health while away from home.');
    parts.push('Consider: hotel room workouts, jet lag management, healthy eating while traveling, sleep optimization.');

    return parts.join('\n');
  }

  private guessLocationFromTimezone(timezone: string): string {
    // Try to extract region from timezone string like "Asia/Tokyo"
    if (timezone.includes('/')) {
      const parts = timezone.split('/');
      return parts[parts.length - 1].replace(/_/g, ' ');
    }
    return 'Unknown Location';
  }
}
