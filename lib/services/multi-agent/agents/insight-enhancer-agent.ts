/**
 * Insight Enhancer Agent
 *
 * Takes generic action-oriented insights and enhances them with:
 * - Specific local venues/businesses from Google Places
 * - Activity-specific communities (based on Whoop data)
 * - Distance from user's location
 *
 * This agent runs AFTER the main insight generation to add specificity.
 *
 * @module lib/services/multi-agent/agents/insight-enhancer-agent
 */

import OpenAI from 'openai';
import { StructuredInsight } from '../types';
import {
  inferUserActivities,
  ActivityInference,
  formatActivitySummary,
} from '@/lib/services/activity-inference-service';
import {
  searchLocalRecommendations,
  LocalRecommendation,
  formatRecommendationsForInsight,
  getVenueTypesForActivity,
} from '@/lib/services/local-recommendations-service';
import { createAdminClient } from '@/lib/supabase/server';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('InsightEnhancerAgent');

// ============================================================================
// TYPES
// ============================================================================

export interface LocationProfile {
  email: string;
  city: string | null;
  neighborhood: string | null;
  homeLatitude: number | null;
  homeLongitude: number | null;
  preferredRadiusKm: number;
}

export interface EnhancementContext {
  locationProfile: LocationProfile;
  activityInference: ActivityInference;
}

export interface EnhancementResult {
  originalInsight: StructuredInsight;
  enhancedInsight: StructuredInsight;
  wasEnhanced: boolean;
  enhancementType?: 'local_venue' | 'activity_specific' | 'combined';
  localRecommendations?: LocalRecommendation[];
}

// Keywords that indicate an action-oriented insight eligible for enhancement
const ACTION_KEYWORDS = [
  'join',
  'try',
  'visit',
  'find',
  'explore',
  'attend',
  'sign up',
  'participate',
  'enroll',
  'register',
  'start',
  'begin',
  'consider',
  'look for',
  'search for',
];

// Activity-related keywords
const ACTIVITY_KEYWORDS = [
  'running',
  'run',
  'cycling',
  'bike',
  'swimming',
  'swim',
  'gym',
  'workout',
  'exercise',
  'yoga',
  'pilates',
  'crossfit',
  'boxing',
  'martial arts',
  'climbing',
  'tennis',
  'basketball',
  'soccer',
  'football',
  'golf',
  'hiking',
  'club',
  'group',
  'class',
  'studio',
  'center',
  'fitness',
];

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Enhance a list of insights with location and activity data
 */
export async function enhanceInsights(
  email: string,
  insights: StructuredInsight[],
  openai?: OpenAI
): Promise<EnhancementResult[]> {
  logger.info('Starting insight enhancement', { email, insightCount: insights.length });

  // Get enhancement context
  const context = await getEnhancementContext(email);

  if (!context.locationProfile.city) {
    logger.info('No location data available, skipping enhancement', { email });
    return insights.map((insight) => ({
      originalInsight: insight,
      enhancedInsight: insight,
      wasEnhanced: false,
    }));
  }

  const results: EnhancementResult[] = [];

  for (const insight of insights) {
    // Check if this insight is eligible for enhancement
    const eligibility = checkEnhancementEligibility(insight);

    if (!eligibility.eligible) {
      results.push({
        originalInsight: insight,
        enhancedInsight: insight,
        wasEnhanced: false,
      });
      continue;
    }

    try {
      // Enhance the insight
      const enhancedResult = await enhanceSingleInsight(
        insight,
        context,
        eligibility.detectedActivity,
        openai
      );
      results.push(enhancedResult);
    } catch (error) {
      logger.error('Error enhancing insight', error, { insightId: insight.id });
      results.push({
        originalInsight: insight,
        enhancedInsight: insight,
        wasEnhanced: false,
      });
    }
  }

  const enhancedCount = results.filter((r) => r.wasEnhanced).length;
  logger.info('Insight enhancement complete', { email, enhancedCount, total: insights.length });

  return results;
}

/**
 * Get enhancement context for a user
 */
async function getEnhancementContext(email: string): Promise<EnhancementContext> {
  const [locationProfile, activityInference] = await Promise.all([
    getLocationProfile(email),
    inferUserActivities(email),
  ]);

  return { locationProfile, activityInference };
}

/**
 * Get user's location profile
 */
async function getLocationProfile(email: string): Promise<LocationProfile> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('user_location_profile')
    .select('*')
    .eq('email', email)
    .single();

  if (error || !data) {
    // Try to infer from device context
    const { data: deviceData } = await supabase
      .from('user_device_context')
      .select('locale, timezone')
      .eq('email', email)
      .order('synced_at', { ascending: false })
      .limit(1)
      .single();

    // Try to infer from travel context
    const { data: travelData } = await supabase
      .from('user_travel_context')
      .select('estimated_location')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Parse locale if it contains city info (e.g., "London, UK")
    let city: string | null = null;
    if (deviceData?.locale && deviceData.locale.includes(',')) {
      city = deviceData.locale.split(',')[0].trim();
    } else if (travelData?.estimated_location) {
      city = travelData.estimated_location.split(',')[0].trim();
    }

    return {
      email,
      city,
      neighborhood: null,
      homeLatitude: null,
      homeLongitude: null,
      preferredRadiusKm: 10,
    };
  }

  return {
    email: data.email,
    city: data.city,
    neighborhood: data.neighborhood,
    homeLatitude: data.home_latitude,
    homeLongitude: data.home_longitude,
    preferredRadiusKm: data.preferred_radius_km || 10,
  };
}

/**
 * Check if an insight is eligible for enhancement
 */
function checkEnhancementEligibility(insight: StructuredInsight): {
  eligible: boolean;
  detectedActivity: string | null;
  reason?: string;
} {
  const textToCheck = `${insight.title} ${insight.recommendation} ${insight.actionSteps?.join(' ') || ''}`.toLowerCase();

  // Check for action keywords
  const hasActionKeyword = ACTION_KEYWORDS.some((keyword) =>
    textToCheck.includes(keyword.toLowerCase())
  );

  if (!hasActionKeyword) {
    return { eligible: false, detectedActivity: null, reason: 'No action keywords found' };
  }

  // Check for activity keywords and detect the activity
  let detectedActivity: string | null = null;

  for (const keyword of ACTIVITY_KEYWORDS) {
    if (textToCheck.includes(keyword.toLowerCase())) {
      // Map keyword to normalized activity name
      detectedActivity = normalizeActivityKeyword(keyword);
      break;
    }
  }

  // Also check the insight category
  if (!detectedActivity && insight.category) {
    const categoryLower = insight.category.toLowerCase();
    if (categoryLower.includes('activity') || categoryLower.includes('fitness')) {
      detectedActivity = 'fitness';
    }
  }

  return {
    eligible: true,
    detectedActivity,
    reason: detectedActivity ? `Detected activity: ${detectedActivity}` : 'Generic action insight',
  };
}

/**
 * Normalize activity keyword to activity name
 */
function normalizeActivityKeyword(keyword: string): string {
  const keywordMap: Record<string, string> = {
    run: 'running',
    running: 'running',
    bike: 'cycling',
    cycling: 'cycling',
    swim: 'swimming',
    swimming: 'swimming',
    gym: 'strength_training',
    workout: 'strength_training',
    exercise: 'fitness',
    yoga: 'yoga',
    pilates: 'pilates',
    crossfit: 'crossfit',
    boxing: 'boxing',
    'martial arts': 'martial_arts',
    climbing: 'rock_climbing',
    tennis: 'tennis',
    basketball: 'basketball',
    soccer: 'soccer',
    football: 'football',
    golf: 'golf',
    hiking: 'hiking',
    club: 'fitness',
    group: 'fitness',
    class: 'fitness',
    studio: 'fitness',
    center: 'fitness',
    fitness: 'fitness',
  };

  return keywordMap[keyword.toLowerCase()] || 'fitness';
}

/**
 * Enhance a single insight
 */
async function enhanceSingleInsight(
  insight: StructuredInsight,
  context: EnhancementContext,
  detectedActivity: string | null,
  openai?: OpenAI
): Promise<EnhancementResult> {
  const { locationProfile, activityInference } = context;

  // Determine the activity to search for
  let searchActivity = detectedActivity || 'fitness';

  // If user has a primary activity and it matches, use that
  if (
    activityInference.primaryActivity &&
    (detectedActivity === null || detectedActivity === 'fitness')
  ) {
    searchActivity = activityInference.primaryActivity;
  }

  // Get local recommendations
  let localRecommendations: LocalRecommendation[] = [];

  if (locationProfile.city) {
    try {
      const searchResult = await searchLocalRecommendations({
        activity: searchActivity,
        city: locationProfile.city,
        neighborhood: locationProfile.neighborhood || undefined,
        latitude: locationProfile.homeLatitude || undefined,
        longitude: locationProfile.homeLongitude || undefined,
        radiusKm: locationProfile.preferredRadiusKm,
        limit: 3,
      });
      localRecommendations = searchResult.recommendations;
    } catch (error) {
      logger.error('Error fetching local recommendations', error);
    }
  }

  // Build enhanced insight
  const enhancedInsight = { ...insight };
  let wasEnhanced = false;

  // Enhance action steps with specific venues
  if (localRecommendations.length > 0) {
    const venueSteps = formatRecommendationsForInsight(localRecommendations, searchActivity);

    // Replace generic action steps with specific ones
    enhancedInsight.actionSteps = [
      ...venueSteps,
      ...(insight.actionSteps?.slice(0, 1) || []), // Keep one original step as fallback
    ].slice(0, 3);

    wasEnhanced = true;
  }

  // Enhance recommendation with activity-specific data
  if (activityInference.primaryActivity && activityInference.activityStats.length > 0) {
    const primaryStats = activityInference.activityStats.find(
      (s) => s.activity === activityInference.primaryActivity
    );

    if (primaryStats) {
      // Add activity context to recommendation
      const activityContext = buildActivityContext(primaryStats, activityInference);

      if (activityContext && !enhancedInsight.recommendation.includes(activityContext)) {
        enhancedInsight.recommendation = `${activityContext} ${enhancedInsight.recommendation}`;
        wasEnhanced = true;
      }
    }
  }

  // Enhance data quote with location context
  if (locationProfile.city && !enhancedInsight.dataQuote.includes(locationProfile.city)) {
    const locationContext = locationProfile.neighborhood
      ? `Near ${locationProfile.neighborhood}, ${locationProfile.city}`
      : `In ${locationProfile.city}`;

    // Only add if data quote is short enough
    if (enhancedInsight.dataQuote.length < 200) {
      enhancedInsight.dataQuote = `${enhancedInsight.dataQuote} ${locationContext}.`;
      wasEnhanced = true;
    }
  }

  return {
    originalInsight: insight,
    enhancedInsight,
    wasEnhanced,
    enhancementType: localRecommendations.length > 0 ? 'local_venue' : 'activity_specific',
    localRecommendations: localRecommendations.length > 0 ? localRecommendations : undefined,
  };
}

/**
 * Build activity context string from user's activity data
 */
function buildActivityContext(
  stats: { activity: string; count: number; avgDurationMins: number },
  inference: ActivityInference
): string | null {
  const activityName = stats.activity.replace(/_/g, ' ');

  if (stats.count >= 10) {
    return `Based on your ${activityName} patterns (${stats.count} sessions, avg ${stats.avgDurationMins} mins),`;
  } else if (inference.averageWeeklyFrequency >= 3) {
    return `Given your active lifestyle (${inference.averageWeeklyFrequency} workouts/week),`;
  }

  return null;
}

/**
 * Use AI to enhance an insight with location and activity context
 * (Optional - only used when OpenAI client is provided)
 */
export async function enhanceInsightWithAI(
  insight: StructuredInsight,
  context: EnhancementContext,
  localRecommendations: LocalRecommendation[],
  openai: OpenAI
): Promise<StructuredInsight> {
  const { locationProfile, activityInference } = context;

  const prompt = buildEnhancementPrompt(insight, locationProfile, activityInference, localRecommendations);

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an insight enhancement specialist. Your job is to make health insights more actionable by adding specific local venues and activity-based personalization.

Keep the same structure but enhance with:
1. Specific venue names and distances
2. Activity-based context (user's workout patterns)
3. Location-specific details

Return JSON with the enhanced insight fields: title, dataQuote, recommendation, actionSteps (array of 3).`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.5,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return insight;

    const enhanced = JSON.parse(content);

    return {
      ...insight,
      title: enhanced.title || insight.title,
      dataQuote: enhanced.dataQuote || insight.dataQuote,
      recommendation: enhanced.recommendation || insight.recommendation,
      actionSteps: enhanced.actionSteps || insight.actionSteps,
    };
  } catch (error) {
    logger.error('Error in AI enhancement', error);
    return insight;
  }
}

function buildEnhancementPrompt(
  insight: StructuredInsight,
  location: LocationProfile,
  activity: ActivityInference,
  recommendations: LocalRecommendation[]
): string {
  const parts: string[] = [
    '=== ORIGINAL INSIGHT ===',
    `Title: ${insight.title}`,
    `Data Quote: ${insight.dataQuote}`,
    `Recommendation: ${insight.recommendation}`,
    `Action Steps: ${insight.actionSteps?.join('; ') || 'None'}`,
    '',
    '=== USER CONTEXT ===',
  ];

  if (location.city) {
    parts.push(`Location: ${location.neighborhood ? `${location.neighborhood}, ` : ''}${location.city}`);
  }

  if (activity.primaryActivity) {
    parts.push(`Primary Activity: ${activity.primaryActivity.replace(/_/g, ' ')}`);
    parts.push(`Weekly Frequency: ${activity.averageWeeklyFrequency} workouts/week`);
    parts.push(formatActivitySummary(activity));
  }

  if (recommendations.length > 0) {
    parts.push('');
    parts.push('=== LOCAL VENUES ===');
    for (const rec of recommendations) {
      parts.push(`- ${rec.name} (${rec.distanceKm?.toFixed(1) || '?'}km away, ${rec.rating || 'No'} rating)`);
    }
  }

  parts.push('');
  parts.push('Enhance the insight with these specific venues and activity context. Make action steps specific with venue names and distances.');

  return parts.join('\n');
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if a user has location data available
 */
export async function hasLocationData(email: string): Promise<boolean> {
  const profile = await getLocationProfile(email);
  return profile.city !== null;
}

/**
 * Get enhanced insights array (convenience wrapper)
 */
export async function getEnhancedInsights(
  email: string,
  insights: StructuredInsight[],
  openai?: OpenAI
): Promise<StructuredInsight[]> {
  const results = await enhanceInsights(email, insights, openai);
  return results.map((r) => r.enhancedInsight);
}
