/**
 * Unified User Context Service
 *
 * Fetches and combines all relevant user data based on context selection.
 * Provides a single interface for getting user context for AI agents.
 *
 * Data Sources:
 * - Profile: User preferences, goals, allergies
 * - Insights: AI-generated health insights
 * - Labs: Blood/biomarker results
 * - Oura: Sleep, HRV, readiness
 * - Dexcom: Glucose monitoring
 * - Training: Forge/moccet train data
 * - Nutrition: Sage/moccet chef data
 * - Behavioral: Gmail/Slack patterns
 * - Apple Health: Steps, heart rate, workouts
 * - Conversation: Compacted conversation history
 */

import { createAdminClient } from '@/lib/supabase/server';
import {
  DataSource,
  selectRelevantContext,
  getContextLimits,
  ContextSelectionResult,
} from './context-selector';
import {
  fetchOuraData,
  fetchDexcomData,
  fetchGmailPatterns,
  fetchSlackPatterns,
  fetchBloodBiomarkers,
  EcosystemDataSource,
} from './ecosystem-fetcher';

// ============================================================================
// IN-MEMORY CACHE FOR DATA SOURCES (5 min TTL)
// Reduces redundant fetches during conversation
// ============================================================================

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const DATA_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const dataSourceCache = new Map<string, CacheEntry<any>>();

function getCached<T>(key: string): T | null {
  const entry = dataSourceCache.get(key);
  if (entry && entry.expiresAt > Date.now()) {
    return entry.data as T;
  }
  dataSourceCache.delete(key);
  return null;
}

function setCache<T>(key: string, data: T): void {
  dataSourceCache.set(key, {
    data,
    expiresAt: Date.now() + DATA_CACHE_TTL,
  });
  // Cleanup old entries if cache gets too big
  if (dataSourceCache.size > 500) {
    const now = Date.now();
    for (const [k, v] of dataSourceCache.entries()) {
      if (v.expiresAt < now) dataSourceCache.delete(k);
    }
  }
}

// Cached wrapper for data fetching
async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = getCached<T>(key);
  if (cached !== null) {
    console.log(`[User Context] Cache HIT: ${key}`);
    return cached;
  }
  console.log(`[User Context] Cache MISS: ${key}`);
  const data = await fetcher();
  setCache(key, data);
  return data;
}
import {
  getCompactedHistory,
  formatHistoryForPrompt,
  CompactedHistory,
} from './conversation-compactor';
import {
  getSentimentAnalysis,
  formatSentimentForPrompt,
  AggregatedSentiment,
  getLifeContext,
  formatLifeContextForPrompt,
  LifeContextAnalysis,
} from './content-sentiment-analyzer';
import {
  getHealthAnalysis,
  formatHealthAnalysisForPrompt,
  HealthAnalysis,
} from './health-pattern-analyzer';
import {
  resilientFetch,
  batchResilientFetch,
  FetchResult,
} from './resilient-fetcher';
import {
  getContextHealth,
  getContextHealthForQuery,
  formatContextHealthForPrompt,
  detectQueryType,
  ContextHealthReport,
} from './context-health';
import { buildContextHealthPrompt } from '@/lib/agents/prompts';

// ============================================================================
// TYPES
// ============================================================================

export interface UserProfile {
  email: string;
  name?: string;
  goals?: string[];
  allergies?: string[];
  dietaryPreferences?: string[];
  healthConditions?: string[];
  medications?: string[];
  preferredUnits?: 'imperial' | 'metric';
  timezone?: string;
  subscriptionTier: string;
}

export interface HealthInsight {
  id: string;
  title: string;
  message: string;
  category: string;
  severity: 'info' | 'warning' | 'critical';
  actionable: boolean;
  createdAt: string;
}

export interface LabResult {
  biomarker: string;
  value: string;
  unit: string;
  status: string;
  referenceRange?: string;
  category: string;
}

export interface LearnedFact {
  category: string;
  key: string;
  value: string;
  confidence: number;
  source: string;
  learnedAt: string;
}

// NEW: Rich context types for hyper-personalization
export interface SageContext {
  nutritionPlan: any | null;
  recentFoodLogs: any[];
}

export interface ForgeContext {
  fitnessPlan: any | null;
  workoutPatterns: any | null;
}

export interface HealthGoal {
  id: string;
  category: string;
  target_value: number;
  current_value: number;
  progress_pct: number;
  metric_name: string;
  is_active: boolean;
}

export interface LifeEvent {
  event_type: string;
  title: string;
  description: string;
  start_date: string;
  end_date?: string;
  status: string;
  confidence: number;
}

export interface Intervention {
  id: string;
  intervention_type: string;
  description: string;
  started_at: string;
  status: string;
  target_metric?: string;
}

export interface DailyCheckin {
  date: string;
  mood_score?: number;
  energy_score?: number;
  stress_score?: number;
  notes?: string;
}

export interface AdviceOutcome {
  advice_type: string;
  advice_given: string;
  outcome: 'improved' | 'worsened' | 'no_change' | 'pending';
  metric_name?: string;
  baseline_value?: number;
  current_value?: number;
  improvement_pct?: number;
}

export interface UserContext {
  profile: UserProfile | null;
  insights: HealthInsight[];
  labResults: LabResult[];
  learnedFacts: LearnedFact[]; // Facts learned from user feedback on insights
  sentimentAnalysis: AggregatedSentiment | null; // Sentiment from Slack/Gmail content
  lifeContext: LifeContextAnalysis | null; // Life events & patterns from Gmail (Pro/Max)
  healthAnalysis: HealthAnalysis | null; // Health patterns & correlations (Pro/Max)
  oura: EcosystemDataSource | null;
  dexcom: EcosystemDataSource | null;
  training: any | null;
  nutrition: any | null;
  behavioral: {
    gmail?: EcosystemDataSource;
    slack?: EcosystemDataSource;
  };
  appleHealth: any | null;
  conversationHistory: CompactedHistory | null;
  selectionResult: ContextSelectionResult;
  fetchedAt: string;
  // NEW: Rich context for hyper-personalization
  sage: SageContext | null;
  forge: ForgeContext | null;
  healthGoals: HealthGoal[];
  lifeEvents: LifeEvent[];
  interventions: Intervention[];
  dailyCheckins: DailyCheckin[];
  adviceOutcomes: AdviceOutcome[];
  // NEW: Context health tracking
  contextHealth: ContextHealthReport | null;
  fetchStats: {
    totalSources: number;
    successfulFetches: number;
    failedFetches: number;
    partialFetches: number;
    totalLatencyMs: number;
  };
  // NEW: Location profile for local recommendations
  locationProfile: LocationProfile | null;
}

// Location profile for insight enhancement
export interface LocationProfile {
  email: string;
  city: string | null;
  neighborhood: string | null;
  homeLatitude: number | null;
  homeLongitude: number | null;
  preferredRadiusKm: number;
  inferredActivities: string[];
  primaryActivity: string | null;
}

export interface FormattedContext {
  systemPromptAddition: string;
  userContextSummary: string;
  tokenEstimate: number;
}

// ============================================================================
// TOKEN LIMITS PER SOURCE (for truncation)
// ============================================================================

const TOKEN_LIMITS: Record<string, Record<DataSource, number>> = {
  free: {
    profile: 300,
    insights: 500,
    labs: 300,
    oura: 0,
    dexcom: 0,
    training: 0,
    nutrition: 0,
    behavioral: 0,
    apple_health: 0,
    conversation: 500,
    // NEW: Rich context sources (limited for free tier)
    sage: 0,
    forge: 0,
    goals: 400,  // Goals visible to free tier
    life_events: 0,
    interventions: 0,
    checkins: 0,
    outcomes: 0,
  },
  pro: {
    profile: 500,
    insights: 1500,
    labs: 1000,
    oura: 1000,
    dexcom: 800,
    training: 500,
    nutrition: 500,
    behavioral: 500,
    apple_health: 0,
    conversation: 3000,
    // NEW: Rich context sources
    sage: 1000,
    forge: 800,
    goals: 500,
    life_events: 400,
    interventions: 300,
    checkins: 300,
    outcomes: 400,
  },
  max: {
    profile: 800,
    insights: 2000,
    labs: 1500,
    oura: 1500,
    dexcom: 1200,
    training: 800,
    nutrition: 800,
    behavioral: 800,
    apple_health: 800,
    conversation: 5000,
    // NEW: Rich context sources (full access)
    sage: 1500,
    forge: 1200,
    goals: 800,
    life_events: 600,
    interventions: 500,
    checkins: 500,
    outcomes: 600,
  },
};

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

/**
 * Get complete user context based on message and subscription tier
 */
export async function getUserContext(
  email: string,
  message: string,
  options: {
    subscriptionTier?: string;
    threadId?: string;
    includeConversation?: boolean;
    useAISelection?: boolean;
  } = {}
): Promise<UserContext> {
  const {
    subscriptionTier = 'free',
    threadId,
    includeConversation = true,
    useAISelection = false,
  } = options;

  console.log(`[User Context] Fetching context for ${email} (${subscriptionTier} tier)`);
  const startTime = Date.now();

  // Step 1: Determine which sources are relevant
  const selectionResult = await selectRelevantContext(message, {
    subscriptionTier,
    useAI: useAISelection,
    includeConversation,
  });

  console.log(`[User Context] Selected sources: ${selectionResult.sources.join(', ')}`);

  // Step 2: Fetch data from selected sources in parallel (with caching)
  const fetchPromises: Record<string, Promise<any>> = {};

  // Profile and learned facts are always fetched (lightweight but critical for personalization)
  fetchPromises.profile = cachedFetch(`profile:${email}`, () => fetchUserProfile(email));
  fetchPromises.learnedFacts = cachedFetch(`facts:${email}`, () => fetchLearnedFacts(email));

  // Conditional fetches based on selection - all cached for 5 min
  if (selectionResult.sources.includes('insights')) {
    fetchPromises.insights = cachedFetch(`insights:${email}:${subscriptionTier}`, () => fetchUserInsights(email, subscriptionTier));
  }

  if (selectionResult.sources.includes('labs')) {
    fetchPromises.labs = cachedFetch(`labs:${email}`, () => fetchLabResults(email));
  }

  if (selectionResult.sources.includes('oura')) {
    fetchPromises.oura = cachedFetch(`oura:${email}`, () => fetchOuraData(email));
    // Pro/Max: Also fetch health pattern analysis
    if (subscriptionTier === 'pro' || subscriptionTier === 'max') {
      fetchPromises.healthAnalysis = cachedFetch(`healthAnalysis:${email}`, () => getHealthAnalysis(email));
    }
  }

  if (selectionResult.sources.includes('dexcom')) {
    fetchPromises.dexcom = cachedFetch(`dexcom:${email}`, () => fetchDexcomData(email));
  }

  if (selectionResult.sources.includes('training')) {
    fetchPromises.training = cachedFetch(`training:${email}`, () => fetchTrainingData(email));
  }

  if (selectionResult.sources.includes('nutrition')) {
    fetchPromises.nutrition = cachedFetch(`nutrition:${email}`, () => fetchNutritionData(email));
  }

  if (selectionResult.sources.includes('behavioral')) {
    fetchPromises.gmail = cachedFetch(`gmail:${email}`, () => fetchGmailPatterns(email));
    fetchPromises.slack = cachedFetch(`slack:${email}`, () => fetchSlackPatterns(email));
    // Also fetch sentiment analysis if behavioral data is requested
    fetchPromises.sentiment = cachedFetch(`sentiment:${email}`, () => getSentimentAnalysis(email, { days: 7 }));
    // Pro/Max: Also fetch life context (events & patterns from Gmail)
    if (subscriptionTier === 'pro' || subscriptionTier === 'max') {
      fetchPromises.lifeContext = cachedFetch(`lifeContext:${email}`, () => getLifeContext(email));
    }
  }

  if (selectionResult.sources.includes('apple_health')) {
    fetchPromises.appleHealth = cachedFetch(`appleHealth:${email}`, () => fetchAppleHealthData(email));
  }

  if (selectionResult.sources.includes('conversation')) {
    // Don't cache conversation - it changes frequently
    fetchPromises.conversation = getCompactedHistory(email, threadId, subscriptionTier);
  }

  // NEW: Rich context sources for hyper-personalization (all cached)
  if (selectionResult.sources.includes('sage')) {
    fetchPromises.sage = cachedFetch(`sage:${email}`, () => fetchSageContext(email));
  }

  if (selectionResult.sources.includes('forge')) {
    fetchPromises.forge = cachedFetch(`forge:${email}`, () => fetchForgeContext(email));
  }

  if (selectionResult.sources.includes('goals')) {
    fetchPromises.goals = cachedFetch(`goals:${email}`, () => fetchHealthGoals(email));
  }

  if (selectionResult.sources.includes('life_events')) {
    fetchPromises.lifeEvents = cachedFetch(`lifeEvents:${email}`, () => fetchLifeEvents(email));
  }

  if (selectionResult.sources.includes('interventions')) {
    fetchPromises.interventions = cachedFetch(`interventions:${email}`, () => fetchInterventions(email));
  }

  if (selectionResult.sources.includes('checkins')) {
    fetchPromises.checkins = cachedFetch(`checkins:${email}`, () => fetchDailyCheckins(email));
  }

  if (selectionResult.sources.includes('outcomes')) {
    fetchPromises.outcomes = cachedFetch(`outcomes:${email}`, () => fetchAdviceOutcomes(email));
  }

  // Always fetch location profile (lightweight, cached)
  fetchPromises.locationProfile = cachedFetch(`location:${email}`, () => fetchLocationProfile(email));

  // Wait for all fetches with resilient error handling
  let successfulFetches = 0;
  let failedFetches = 0;
  let partialFetches = 0;

  const results = await Promise.all(
    Object.entries(fetchPromises).map(async ([key, promise]) => {
      try {
        // Wrap each fetch with resilient fetching for retry logic
        const result = await resilientFetch(
          key,
          () => promise,
          {
            retries: 2,
            backoffMs: [100, 500],
            timeout: 10000,
            onRetry: (attempt, error) => {
              console.log(`[User Context] Retrying ${key} (attempt ${attempt}): ${error.message}`);
            },
          }
        );

        if (result.status === 'success') {
          successfulFetches++;
          return [key, result.data];
        } else if (result.status === 'partial') {
          partialFetches++;
          console.warn(`[User Context] Partial result for ${key}: ${result.error}`);
          return [key, result.data];
        } else {
          failedFetches++;
          console.error(`[User Context] Failed to fetch ${key}: ${result.error}`);
          return [key, null];
        }
      } catch (error) {
        failedFetches++;
        console.error(`[User Context] Error fetching ${key}:`, error);
        return [key, null];
      }
    })
  );

  // Build context object
  const contextData = Object.fromEntries(results);

  // Fetch context health report
  const queryType = detectQueryType(message);
  let contextHealth: ContextHealthReport | null = null;

  try {
    const supabase = createAdminClient();
    contextHealth = queryType
      ? await getContextHealthForQuery(email, queryType, supabase)
      : await getContextHealth(email, supabase);
  } catch (error) {
    console.error('[User Context] Error fetching context health:', error);
  }

  const duration = Date.now() - startTime;

  const context: UserContext = {
    profile: contextData.profile || null,
    insights: contextData.insights || [],
    labResults: contextData.labs || [],
    learnedFacts: contextData.learnedFacts || [],
    sentimentAnalysis: contextData.sentiment || null,
    lifeContext: contextData.lifeContext || null,
    healthAnalysis: contextData.healthAnalysis || null,
    oura: contextData.oura || null,
    dexcom: contextData.dexcom || null,
    training: contextData.training || null,
    nutrition: contextData.nutrition || null,
    behavioral: {
      gmail: contextData.gmail || undefined,
      slack: contextData.slack || undefined,
    },
    appleHealth: contextData.appleHealth || null,
    conversationHistory: contextData.conversation || null,
    selectionResult,
    fetchedAt: new Date().toISOString(),
    // NEW: Rich context for hyper-personalization
    sage: contextData.sage || null,
    forge: contextData.forge || null,
    healthGoals: contextData.goals || [],
    lifeEvents: contextData.lifeEvents || [],
    interventions: contextData.interventions || [],
    dailyCheckins: contextData.checkins || [],
    adviceOutcomes: contextData.outcomes || [],
    // NEW: Context health tracking
    contextHealth,
    fetchStats: {
      totalSources: Object.keys(fetchPromises).length,
      successfulFetches,
      failedFetches,
      partialFetches,
      totalLatencyMs: duration,
    },
    // NEW: Location profile for insight enhancement
    locationProfile: contextData.locationProfile || null,
  };

  console.log(`[User Context] Context fetched in ${duration}ms (${successfulFetches}/${Object.keys(fetchPromises).length} successful)`);

  return context;
}

/**
 * Format user context for inclusion in AI prompt
 */
export function formatContextForPrompt(
  context: UserContext,
  subscriptionTier: string = 'free'
): FormattedContext {
  const parts: string[] = [];
  const limits = TOKEN_LIMITS[subscriptionTier] || TOKEN_LIMITS.free;
  let tokenEstimate = 0;

  // Profile
  if (context.profile) {
    const profileText = formatProfile(context.profile, limits.profile);
    parts.push('## User Profile\n' + profileText);
    tokenEstimate += estimateTokens(profileText);
  }

  // Learned Facts (from user feedback on insights)
  // These are CRITICAL - things the user explicitly told us about themselves
  if (context.learnedFacts && context.learnedFacts.length > 0) {
    const factsText = formatLearnedFacts(context.learnedFacts);
    parts.push('## Important Context From User\n' + factsText);
    tokenEstimate += estimateTokens(factsText);
  }

  // Insights
  if (context.insights.length > 0) {
    const insightsText = formatInsights(context.insights, limits.insights);
    parts.push('## Recent Health Insights\n' + insightsText);
    tokenEstimate += estimateTokens(insightsText);
  }

  // Lab Results
  if (context.labResults.length > 0) {
    const labsText = formatLabResults(context.labResults, limits.labs);
    parts.push('## Lab Results\n' + labsText);
    tokenEstimate += estimateTokens(labsText);
  }

  // Oura Data
  if (context.oura?.available && context.oura.data) {
    const ouraText = formatOuraData(context.oura, limits.oura);
    parts.push('## Sleep & Recovery (Oura)\n' + ouraText);
    tokenEstimate += estimateTokens(ouraText);
  }

  // Dexcom Data
  if (context.dexcom?.available && context.dexcom.data) {
    const dexcomText = formatDexcomData(context.dexcom, limits.dexcom);
    parts.push('## Glucose Data (CGM)\n' + dexcomText);
    tokenEstimate += estimateTokens(dexcomText);
  }

  // Training Data
  if (context.training) {
    const trainingText = formatTrainingData(context.training, limits.training);
    if (trainingText) {
      parts.push('## Fitness & Training\n' + trainingText);
      tokenEstimate += estimateTokens(trainingText);
    }
  }

  // Nutrition Data
  if (context.nutrition) {
    const nutritionText = formatNutritionData(context.nutrition, limits.nutrition);
    if (nutritionText) {
      parts.push('## Nutrition\n' + nutritionText);
      tokenEstimate += estimateTokens(nutritionText);
    }
  }

  // Behavioral Data
  if (context.behavioral.gmail?.available || context.behavioral.slack?.available) {
    const behavioralText = formatBehavioralData(context.behavioral, limits.behavioral);
    parts.push('## Work Patterns\n' + behavioralText);
    tokenEstimate += estimateTokens(behavioralText);
  }

  // Sentiment Analysis (from Slack/Gmail content)
  if (context.sentimentAnalysis) {
    const sentimentText = formatSentimentForPrompt(context.sentimentAnalysis);
    if (sentimentText) {
      parts.push(sentimentText);
      tokenEstimate += estimateTokens(sentimentText);
    }
  }

  // Life Context (Pro/Max - events & patterns from Gmail)
  if (context.lifeContext) {
    const lifeText = formatLifeContextForPrompt(context.lifeContext);
    if (lifeText) {
      parts.push(lifeText);
      tokenEstimate += estimateTokens(lifeText);
    }
  }

  // Health Analysis (Pro/Max - patterns & correlations)
  if (context.healthAnalysis) {
    const healthText = formatHealthAnalysisForPrompt(context.healthAnalysis);
    if (healthText) {
      parts.push(healthText);
      tokenEstimate += estimateTokens(healthText);
    }
  }

  // NEW: Rich Context for Hyper-Personalization

  // Sage Context (full meal plans + food logs)
  if (context.sage) {
    const sageText = formatSageContext(context.sage, limits.sage || 1000);
    if (sageText) {
      parts.push('## Nutrition Plan & Food Log\n' + sageText);
      tokenEstimate += estimateTokens(sageText);
    }
  }

  // Forge Context (workout plans + patterns)
  if (context.forge) {
    const forgeText = formatForgeContext(context.forge, limits.forge || 800);
    if (forgeText) {
      parts.push('## Fitness Program & Patterns\n' + forgeText);
      tokenEstimate += estimateTokens(forgeText);
    }
  }

  // Health Goals with Progress
  if (context.healthGoals && context.healthGoals.length > 0) {
    const goalsText = formatHealthGoals(context.healthGoals, limits.goals || 500);
    if (goalsText) {
      parts.push('## Health Goals\n' + goalsText);
      tokenEstimate += estimateTokens(goalsText);
    }
  }

  // Life Events
  if (context.lifeEvents && context.lifeEvents.length > 0) {
    const eventsText = formatLifeEventsContext(context.lifeEvents, limits.life_events || 400);
    if (eventsText) {
      parts.push('## Life Events\n' + eventsText);
      tokenEstimate += estimateTokens(eventsText);
    }
  }

  // Active Interventions
  if (context.interventions && context.interventions.length > 0) {
    const interventionsText = formatInterventions(context.interventions, limits.interventions || 300);
    if (interventionsText) {
      parts.push('## Active Experiments\n' + interventionsText);
      tokenEstimate += estimateTokens(interventionsText);
    }
  }

  // Daily Check-ins
  if (context.dailyCheckins && context.dailyCheckins.length > 0) {
    const checkinsText = formatDailyCheckins(context.dailyCheckins, limits.checkins || 300);
    if (checkinsText) {
      parts.push('## Recent Check-ins\n' + checkinsText);
      tokenEstimate += estimateTokens(checkinsText);
    }
  }

  // Advice Outcomes
  if (context.adviceOutcomes && context.adviceOutcomes.length > 0) {
    const outcomesText = formatAdviceOutcomes(context.adviceOutcomes, limits.outcomes || 400);
    if (outcomesText) {
      parts.push('## Advice History\n' + outcomesText);
      tokenEstimate += estimateTokens(outcomesText);
    }
  }

  // Conversation History
  if (context.conversationHistory) {
    const historyText = formatHistoryForPrompt(context.conversationHistory);
    if (historyText) {
      parts.push(historyText);
      tokenEstimate += estimateTokens(historyText);
    }
  }

  // Context Health (data freshness and availability)
  if (context.contextHealth) {
    const healthSummary = {
      overall: context.contextHealth.overall,
      freshSources: context.contextHealth.freshSources,
      staleSources: context.contextHealth.sources
        .filter(s => s.staleness === 'warning' || s.staleness === 'critical')
        .map(s => ({
          name: s.displayName,
          timeSinceSync: s.timeSinceSync || 'unknown',
          level: s.staleness as 'warning' | 'critical',
        })),
      unavailableSources: context.contextHealth.unavailableSources,
      requiredSourcesAvailable: context.contextHealth.sources
        .filter(s => s.isRequired)
        .every(s => s.status === 'connected' && s.staleness !== 'critical'),
      completenessScore: context.contextHealth.completenessScore,
    };

    const healthText = buildContextHealthPrompt(healthSummary);
    if (healthText) {
      parts.push(healthText);
      tokenEstimate += estimateTokens(healthText);
    }
  }

  const systemPromptAddition = parts.join('\n\n');

  // Create a brief summary for the user context
  const summaryParts: string[] = [];
  if (context.profile?.name) {
    summaryParts.push(`User: ${context.profile.name}`);
  }
  if (context.insights.length > 0) {
    summaryParts.push(`${context.insights.length} recent insights`);
  }
  if (context.labResults.length > 0) {
    summaryParts.push(`${context.labResults.length} biomarkers`);
  }
  if (context.oura?.available) {
    summaryParts.push('Oura data');
  }
  if (context.dexcom?.available) {
    summaryParts.push('Glucose data');
  }
  if (context.sentimentAnalysis) {
    summaryParts.push('Sentiment analysis');
  }
  if (context.lifeContext && (context.lifeContext.upcomingEvents.length > 0 || context.lifeContext.activePatterns.length > 0)) {
    summaryParts.push(`Life context (${context.lifeContext.upcomingEvents.length} events, ${context.lifeContext.activePatterns.length} patterns)`);
  }
  if (context.healthAnalysis && (context.healthAnalysis.patterns.length > 0 || context.healthAnalysis.correlations.length > 0)) {
    summaryParts.push(`Health patterns (${context.healthAnalysis.patterns.length} trends, ${context.healthAnalysis.correlations.length} correlations)`);
  }
  if (context.conversationHistory?.totalMessageCount) {
    summaryParts.push(`${context.conversationHistory.totalMessageCount} messages in history`);
  }

  // NEW: Rich context summaries
  if (context.sage?.nutritionPlan) {
    summaryParts.push('Nutrition plan');
  }
  if (context.forge?.fitnessPlan) {
    summaryParts.push('Fitness program');
  }
  if (context.healthGoals?.length) {
    summaryParts.push(`${context.healthGoals.length} goals`);
  }
  if (context.lifeEvents?.length) {
    summaryParts.push(`${context.lifeEvents.length} life events`);
  }
  if (context.interventions?.length) {
    summaryParts.push(`${context.interventions.length} experiments`);
  }
  if (context.dailyCheckins?.length) {
    summaryParts.push('Check-ins');
  }
  if (context.adviceOutcomes?.length) {
    summaryParts.push('Advice history');
  }

  return {
    systemPromptAddition,
    userContextSummary: summaryParts.join(', ') || 'No context available',
    tokenEstimate,
  };
}

// ============================================================================
// DATA FETCHING FUNCTIONS
// ============================================================================

async function fetchUserProfile(email: string): Promise<UserProfile | null> {
  const supabase = createAdminClient();

  // Fetch from sage_onboarding_data (contains profile info)
  const { data, error } = await supabase
    .from('sage_onboarding_data')
    .select('form_data, subscription_status')
    .eq('email', email)
    .maybeSingle();

  if (error || !data) {
    // Try user_subscriptions for basic info
    const { data: subData } = await supabase
      .from('user_subscriptions')
      .select('tier')
      .eq('email', email)
      .maybeSingle();

    return {
      email,
      subscriptionTier: subData?.tier || 'free',
    };
  }

  const formData = data.form_data || {};

  return {
    email,
    name: formData.name || formData.firstName,
    goals: formData.goals || [],
    allergies: formData.allergies || [],
    dietaryPreferences: formData.dietaryPreferences || [],
    healthConditions: formData.healthConditions || [],
    medications: formData.medications || [],
    preferredUnits: formData.preferredUnits || 'imperial',
    timezone: formData.timezone,
    subscriptionTier: data.subscription_status || 'free',
  };
}

async function fetchUserInsights(
  email: string,
  subscriptionTier: string
): Promise<HealthInsight[]> {
  const supabase = createAdminClient();

  // Limit based on tier
  const limit = subscriptionTier === 'max' ? 20 : subscriptionTier === 'pro' ? 10 : 5;

  const { data, error } = await supabase
    .from('real_time_insights')
    .select('id, title, message, insight_type, severity, created_at')
    .eq('email', email)
    .eq('dismissed', false)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    title: row.title,
    message: row.message,
    category: row.insight_type,
    severity: row.severity || 'info',
    actionable: true,
    createdAt: row.created_at,
  }));
}

async function fetchLabResults(email: string): Promise<LabResult[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('sage_onboarding_data')
    .select('lab_file_analysis')
    .eq('email', email)
    .maybeSingle();

  if (error || !data?.lab_file_analysis) {
    return [];
  }

  const analysis = data.lab_file_analysis;
  const biomarkers = analysis.biomarkers || analysis.results || [];

  return biomarkers.map((b: any) => ({
    biomarker: b.name || b.biomarker,
    value: String(b.value),
    unit: b.unit || '',
    status: b.status || 'normal',
    referenceRange: b.referenceRange || b.reference_range,
    category: b.category || 'general',
  }));
}

async function fetchTrainingData(email: string): Promise<any | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('forge_onboarding_data')
    .select('form_data, training_plan, latest_training_plan')
    .eq('email', email)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    profile: data.form_data,
    currentPlan: data.latest_training_plan || data.training_plan,
  };
}

async function fetchNutritionData(email: string): Promise<any | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('sage_onboarding_data')
    .select('form_data, nutrition_plan, latest_nutrition_plan')
    .eq('email', email)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    profile: data.form_data,
    currentPlan: data.latest_nutrition_plan || data.nutrition_plan,
  };
}

async function fetchAppleHealthData(email: string): Promise<any | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('apple_health_data')
    .select('*')
    .eq('email', email)
    .order('synced_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}

/**
 * Fetch learned facts from user feedback on insights
 * These are facts the user has explicitly told us about themselves
 */
async function fetchLearnedFacts(email: string): Promise<LearnedFact[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('user_learned_facts')
    .select('category, fact_key, fact_value, confidence, source, learned_at')
    .eq('user_email', email)
    .gte('confidence', 0.6) // Only include facts with decent confidence
    .order('learned_at', { ascending: false })
    .limit(50); // Get most recent facts

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    category: row.category,
    key: row.fact_key,
    value: row.fact_value,
    confidence: row.confidence,
    source: row.source,
    learnedAt: row.learned_at,
  }));
}

// ============================================================================
// NEW: RICH CONTEXT FETCHER FUNCTIONS
// ============================================================================

/**
 * Fetch full Sage nutrition context (meal plans + food logs)
 */
async function fetchSageContext(email: string): Promise<SageContext> {
  const supabase = createAdminClient();

  const [nutritionPlanResult, foodLogsResult] = await Promise.all([
    supabase
      .from('sage_nutrition_plans')
      .select('*')
      .eq('user_email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('sage_food_logs')
      .select('*')
      .eq('user_email', email)
      .gte('date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('date', { ascending: false })
      .limit(7),
  ]);

  return {
    nutritionPlan: nutritionPlanResult.data || null,
    recentFoodLogs: foodLogsResult.data || [],
  };
}

/**
 * Fetch full Forge fitness context (workout plans + patterns)
 */
async function fetchForgeContext(email: string): Promise<ForgeContext> {
  const supabase = createAdminClient();

  const [fitnessPlanResult, workoutPatternsResult] = await Promise.all([
    supabase
      .from('forge_fitness_plans')
      .select('*')
      .eq('user_email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('forge_workout_patterns')
      .select('*')
      .eq('user_email', email)
      .order('analyzed_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    fitnessPlan: fitnessPlanResult.data || null,
    workoutPatterns: workoutPatternsResult.data || null,
  };
}

/**
 * Fetch active health goals with progress
 */
async function fetchHealthGoals(email: string): Promise<HealthGoal[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('user_health_goals')
    .select('*')
    .eq('user_email', email)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    category: row.category,
    target_value: row.target_value,
    current_value: row.current_value,
    progress_pct: row.progress_pct || (row.current_value / row.target_value) * 100,
    metric_name: row.metric_name,
    is_active: row.is_active,
  }));
}

/**
 * Fetch recent life events (travel, work changes, etc.)
 */
async function fetchLifeEvents(email: string): Promise<LifeEvent[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('life_events_history')
    .select('*')
    .eq('user_email', email)
    .gte('detected_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .order('detected_at', { ascending: false })
    .limit(10);

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    event_type: row.event_type,
    title: row.title,
    description: row.description,
    start_date: row.start_date,
    end_date: row.end_date,
    status: row.status,
    confidence: row.confidence,
  }));
}

/**
 * Fetch active health interventions/experiments
 */
async function fetchInterventions(email: string): Promise<Intervention[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('user_intervention_experiments')
    .select('*')
    .eq('user_email', email)
    .eq('status', 'active')
    .order('started_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    intervention_type: row.intervention_type,
    description: row.description,
    started_at: row.started_at,
    status: row.status,
    target_metric: row.target_metric,
  }));
}

/**
 * Fetch recent daily check-ins (mood, energy, stress)
 */
async function fetchDailyCheckins(email: string): Promise<DailyCheckin[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('user_daily_checkins')
    .select('*')
    .eq('user_email', email)
    .gte('date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order('date', { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    date: row.date,
    mood_score: row.mood_score,
    energy_score: row.energy_score,
    stress_score: row.stress_score,
    notes: row.notes,
  }));
}

/**
 * Fetch advice outcomes (what worked/didn't)
 */
async function fetchAdviceOutcomes(email: string): Promise<AdviceOutcome[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('advice_outcomes')
    .select('*')
    .eq('user_email', email)
    .in('outcome', ['improved', 'worsened', 'no_change'])
    .order('created_at', { ascending: false })
    .limit(10);

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    advice_type: row.advice_type,
    advice_given: row.advice_given,
    outcome: row.outcome,
    metric_name: row.metric_name,
    baseline_value: row.baseline_value,
    current_value: row.current_value,
    improvement_pct: row.improvement_pct,
  }));
}

/**
 * Fetch user's location profile for insight enhancement
 */
async function fetchLocationProfile(email: string): Promise<LocationProfile | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('user_location_profile')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (error || !data) {
    // Try to infer from device context
    const { data: deviceData } = await supabase
      .from('user_device_context')
      .select('locale, timezone')
      .eq('email', email)
      .order('synced_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Try to infer from travel context
    const { data: travelData } = await supabase
      .from('user_travel_context')
      .select('estimated_location')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Parse locale if it contains city info (e.g., "London, UK")
    let city: string | null = null;
    if (deviceData?.locale && deviceData.locale.includes(',')) {
      city = deviceData.locale.split(',')[0].trim();
    } else if (travelData?.estimated_location) {
      city = travelData.estimated_location.split(',')[0].trim();
    }

    if (!city) return null;

    return {
      email,
      city,
      neighborhood: null,
      homeLatitude: null,
      homeLongitude: null,
      preferredRadiusKm: 10,
      inferredActivities: [],
      primaryActivity: null,
    };
  }

  return {
    email: data.email,
    city: data.city,
    neighborhood: data.neighborhood,
    homeLatitude: data.home_latitude,
    homeLongitude: data.home_longitude,
    preferredRadiusKm: data.preferred_radius_km || 10,
    inferredActivities: data.inferred_activities || [],
    primaryActivity: data.primary_activity,
  };
}

// ============================================================================
// FORMATTING FUNCTIONS
// ============================================================================

function formatProfile(profile: UserProfile, maxTokens: number): string {
  const parts: string[] = [];

  if (profile.name) parts.push(`Name: ${profile.name}`);
  if (profile.goals?.length) parts.push(`Goals: ${profile.goals.join(', ')}`);
  if (profile.allergies?.length) parts.push(`Allergies: ${profile.allergies.join(', ')}`);
  if (profile.dietaryPreferences?.length) {
    parts.push(`Dietary preferences: ${profile.dietaryPreferences.join(', ')}`);
  }
  if (profile.healthConditions?.length) {
    parts.push(`Health conditions: ${profile.healthConditions.join(', ')}`);
  }
  if (profile.medications?.length) {
    parts.push(`Current medications: ${profile.medications.join(', ')}`);
  }
  parts.push(`Subscription: ${profile.subscriptionTier}`);

  return truncateToTokens(parts.join('\n'), maxTokens);
}

/**
 * Format learned facts from user feedback
 * These are things the user has explicitly told us about themselves
 */
function formatLearnedFacts(facts: LearnedFact[]): string {
  if (!facts || facts.length === 0) return '';

  // Group facts by category for better organization
  const byCategory: Record<string, LearnedFact[]> = {};
  for (const fact of facts) {
    const cat = fact.category || 'other';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(fact);
  }

  const parts: string[] = [];
  parts.push('**The user has explicitly told us the following - ALWAYS respect these:**');

  const categoryLabels: Record<string, string> = {
    schedule: 'Schedule & Lifestyle',
    medical: 'Medical Conditions',
    lifestyle: 'Lifestyle',
    preference: 'Preferences',
    constraint: 'Constraints',
    goal: 'Goals',
    dietary: 'Dietary',
    supplement: 'Supplements',
    other: 'Other',
  };

  for (const [category, categoryFacts] of Object.entries(byCategory)) {
    const label = categoryLabels[category] || category;
    parts.push(`\n### ${label}`);
    for (const fact of categoryFacts) {
      const confidence = fact.confidence >= 0.9 ? '✓' : fact.confidence >= 0.7 ? '~' : '?';
      parts.push(`- ${fact.value} ${confidence}`);
    }
  }

  return parts.join('\n');
}

function formatInsights(insights: HealthInsight[], maxTokens: number): string {
  const formatted = insights
    .map((i) => `- [${i.severity.toUpperCase()}] ${i.title}: ${i.message}`)
    .join('\n');

  return truncateToTokens(formatted, maxTokens);
}

function formatLabResults(labs: LabResult[], maxTokens: number): string {
  // Group by category
  const byCategory: Record<string, LabResult[]> = {};
  for (const lab of labs) {
    const cat = lab.category || 'general';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(lab);
  }

  const parts: string[] = [];
  for (const [category, results] of Object.entries(byCategory)) {
    parts.push(`### ${category}`);
    for (const r of results) {
      const statusEmoji = r.status === 'normal' ? '✓' : r.status === 'high' ? '↑' : '↓';
      parts.push(`- ${r.biomarker}: ${r.value} ${r.unit} ${statusEmoji}`);
    }
  }

  return truncateToTokens(parts.join('\n'), maxTokens);
}

function formatOuraData(oura: EcosystemDataSource, maxTokens: number): string {
  const data = oura.data as any;
  const parts: string[] = [];

  if (data.avgSleepHours) {
    parts.push(`Average sleep: ${data.avgSleepHours.toFixed(1)} hours`);
  }
  if (data.avgReadinessScore) {
    parts.push(`Readiness score: ${Math.round(data.avgReadinessScore)}`);
  }
  if (data.avgHRV) {
    parts.push(`Average HRV: ${Math.round(data.avgHRV)}ms`);
  }
  if (data.sleepQuality) {
    parts.push(`Sleep quality: ${data.sleepQuality}`);
  }
  if (data.hrvTrend) {
    parts.push(`HRV trend: ${data.hrvTrend}`);
  }

  // Add insights
  if (oura.insights?.length) {
    parts.push('\nKey observations:');
    parts.push(...oura.insights.slice(0, 3).map((i) => `- ${i}`));
  }

  return truncateToTokens(parts.join('\n'), maxTokens);
}

function formatDexcomData(dexcom: EcosystemDataSource, maxTokens: number): string {
  const data = dexcom.data as any;
  const parts: string[] = [];

  if (data.avgGlucose) {
    parts.push(`Average glucose: ${Math.round(data.avgGlucose)} mg/dL`);
  }
  if (data.timeInRange) {
    parts.push(`Time in range: ${Math.round(data.timeInRange)}%`);
  }
  if (data.glucoseVariability) {
    parts.push(`Glucose variability: ${Math.round(data.glucoseVariability)}%`);
  }
  if (data.spikeEvents?.length) {
    parts.push(`Recent spikes: ${data.spikeEvents.length}`);
  }

  // Add insights
  if (dexcom.insights?.length) {
    parts.push('\nKey observations:');
    parts.push(...dexcom.insights.slice(0, 3).map((i) => `- ${i}`));
  }

  return truncateToTokens(parts.join('\n'), maxTokens);
}

function formatTrainingData(training: any, maxTokens: number): string {
  if (!training) return '';

  const parts: string[] = [];
  const profile = training.profile || {};
  const plan = training.currentPlan;

  if (profile.fitnessLevel) {
    parts.push(`Fitness level: ${profile.fitnessLevel}`);
  }
  if (profile.fitnessGoals?.length) {
    parts.push(`Goals: ${profile.fitnessGoals.join(', ')}`);
  }
  if (plan?.summary) {
    parts.push(`Current plan: ${plan.summary}`);
  }

  return truncateToTokens(parts.join('\n'), maxTokens);
}

function formatNutritionData(nutrition: any, maxTokens: number): string {
  if (!nutrition) return '';

  const parts: string[] = [];
  const profile = nutrition.profile || {};
  const plan = nutrition.currentPlan;

  if (profile.dietType) {
    parts.push(`Diet type: ${profile.dietType}`);
  }
  if (profile.calorieTarget) {
    parts.push(`Calorie target: ${profile.calorieTarget}`);
  }
  if (plan?.summary) {
    parts.push(`Current plan: ${plan.summary}`);
  }

  return truncateToTokens(parts.join('\n'), maxTokens);
}

function formatBehavioralData(
  behavioral: { gmail?: EcosystemDataSource; slack?: EcosystemDataSource },
  maxTokens: number
): string {
  const parts: string[] = [];

  if (behavioral.gmail?.available && behavioral.gmail.data) {
    const gmail = behavioral.gmail.data as any;
    parts.push('### Gmail Activity');

    // Show stress score if available (from unified data)
    if (gmail.stressIndicators?.workloadStressScore !== undefined) {
      const score = gmail.stressIndicators.workloadStressScore;
      const level = score >= 70 ? 'high' : score >= 40 ? 'moderate' : 'low';
      parts.push(`- Workload stress score: ${score}/100 (${level})`);
    }

    // Show email volume
    if (gmail.emailVolume?.total) {
      parts.push(`- Recent emails analyzed: ${gmail.emailVolume.total}`);
      if (gmail.emailVolume.afterHoursPercentage > 20) {
        parts.push(`- After-hours email activity: ${gmail.emailVolume.afterHoursPercentage}%`);
      }
    }

    // Show work hours if available
    if (gmail.workHours) {
      parts.push(`- Work hours: ${gmail.workHours.start} - ${gmail.workHours.end}`);
    }

    // Show meeting density
    if (gmail.meetingDensity?.avgMeetingsPerDay) {
      parts.push(`- Avg meetings/day: ${gmail.meetingDensity.avgMeetingsPerDay}`);
    }

    // Show focus time
    if (gmail.focusTime?.avgFocusMinutesPerDay) {
      parts.push(`- Avg focus time: ${gmail.focusTime.avgFocusMinutesPerDay} min/day`);
    }

    // Legacy stress indicators (boolean flags)
    if (gmail.stressIndicators) {
      const stressors: string[] = [];
      if (gmail.stressIndicators.highEmailVolume) stressors.push('high email volume');
      if (gmail.stressIndicators.frequentAfterHoursWork) stressors.push('after-hours work');
      if (stressors.length) parts.push(`- Stress patterns: ${stressors.join(', ')}`);
    }
  }

  if (behavioral.slack?.available && behavioral.slack.data) {
    const slack = behavioral.slack.data as any;
    parts.push('### Slack Activity');

    // Show stress score if available (from unified data)
    if (slack.metrics?.stressScore !== undefined) {
      const score = slack.metrics.stressScore;
      const level = score >= 70 ? 'high' : score >= 40 ? 'moderate' : 'low';
      parts.push(`- Communication stress score: ${score}/100 (${level})`);
    }

    // Show message volume
    if (slack.messageVolume?.total) {
      parts.push(`- Recent messages: ${slack.messageVolume.total}`);
    }

    // Show focus metrics
    if (slack.focusMetrics?.longestFocusPeriod) {
      const mins = Math.round(slack.focusMetrics.longestFocusPeriod / 60);
      parts.push(`- Longest focus period: ${mins} min`);
    }

    // Legacy fields
    if (slack.collaborationIntensity) {
      parts.push(`- Collaboration intensity: ${slack.collaborationIntensity}`);
    }
  }

  if (parts.length === 0) {
    return 'No work pattern data available';
  }

  return truncateToTokens(parts.join('\n'), maxTokens);
}

// ============================================================================
// NEW: RICH CONTEXT FORMATTING FUNCTIONS
// ============================================================================

/**
 * Format Sage nutrition context (meal plans + food logs)
 */
function formatSageContext(sage: SageContext, maxTokens: number): string {
  const parts: string[] = [];

  if (sage.nutritionPlan) {
    const plan = sage.nutritionPlan;
    parts.push('### Current Nutrition Plan');
    if (plan.calorie_target) parts.push(`Daily calorie target: ${plan.calorie_target}`);
    if (plan.macro_targets) {
      parts.push(`Macros: ${plan.macro_targets.protein}g protein, ${plan.macro_targets.carbs}g carbs, ${plan.macro_targets.fat}g fat`);
    }
    if (plan.meal_plan) {
      parts.push('\n**Today\'s Meals:**');
      const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const todayPlan = plan.meal_plan[today] || plan.meal_plan.monday;
      if (todayPlan) {
        if (todayPlan.breakfast) parts.push(`- Breakfast: ${todayPlan.breakfast.name || todayPlan.breakfast}`);
        if (todayPlan.lunch) parts.push(`- Lunch: ${todayPlan.lunch.name || todayPlan.lunch}`);
        if (todayPlan.dinner) parts.push(`- Dinner: ${todayPlan.dinner.name || todayPlan.dinner}`);
        if (todayPlan.snacks?.length) parts.push(`- Snacks: ${todayPlan.snacks.map((s: any) => s.name || s).join(', ')}`);
      }
    }
  }

  if (sage.recentFoodLogs?.length > 0) {
    parts.push('\n### Recent Food Log (Last 7 Days)');
    let totalCalories = 0;
    let totalProtein = 0;
    for (const log of sage.recentFoodLogs.slice(0, 3)) {
      totalCalories += log.calories || 0;
      totalProtein += log.protein || 0;
      parts.push(`- ${log.date}: ${log.calories || 0} cal, ${log.protein || 0}g protein`);
    }
    if (sage.recentFoodLogs.length > 0) {
      const avgCalories = Math.round(totalCalories / Math.min(3, sage.recentFoodLogs.length));
      parts.push(`Average: ~${avgCalories} cal/day`);
    }
  }

  return truncateToTokens(parts.join('\n'), maxTokens);
}

/**
 * Format Forge fitness context (workout plans + patterns)
 */
function formatForgeContext(forge: ForgeContext, maxTokens: number): string {
  const parts: string[] = [];

  if (forge.fitnessPlan) {
    const plan = forge.fitnessPlan;
    parts.push('### Current Fitness Program');
    if (plan.program_name) parts.push(`Program: ${plan.program_name}`);
    if (plan.goal) parts.push(`Goal: ${plan.goal}`);
    if (plan.weekly_schedule) {
      parts.push('\n**This Week\'s Schedule:**');
      const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      for (const [day, workout] of Object.entries(plan.weekly_schedule)) {
        const isToday = day.toLowerCase() === today;
        const label = isToday ? `${day} (TODAY)` : day;
        const workoutDesc = typeof workout === 'string' ? workout : (workout as any)?.name || 'Rest';
        parts.push(`- ${label}: ${workoutDesc}`);
      }
    }
  }

  if (forge.workoutPatterns) {
    const patterns = forge.workoutPatterns;
    parts.push('\n### Workout Patterns');
    if (patterns.weekly_frequency) parts.push(`Weekly frequency: ${patterns.weekly_frequency} workouts/week`);
    if (patterns.preferred_times) parts.push(`Preferred times: ${patterns.preferred_times}`);
    if (patterns.consistency_score) parts.push(`Consistency: ${Math.round(patterns.consistency_score * 100)}%`);
    if (patterns.strength_progress) parts.push(`Strength trend: ${patterns.strength_progress}`);
  }

  return truncateToTokens(parts.join('\n'), maxTokens);
}

/**
 * Format health goals with progress
 */
function formatHealthGoals(goals: HealthGoal[], maxTokens: number): string {
  if (!goals || goals.length === 0) return '';

  const parts: string[] = ['### Active Health Goals'];

  for (const goal of goals) {
    const progressBar = getProgressBar(goal.progress_pct);
    const status = goal.progress_pct >= 100 ? '✓' : goal.progress_pct >= 75 ? '→' : '○';
    parts.push(`${status} **${goal.metric_name}**: ${goal.current_value}/${goal.target_value} ${progressBar} ${Math.round(goal.progress_pct)}%`);
  }

  return truncateToTokens(parts.join('\n'), maxTokens);
}

function getProgressBar(pct: number): string {
  const filled = Math.round(pct / 10);
  const empty = 10 - filled;
  return '[' + '█'.repeat(Math.min(filled, 10)) + '░'.repeat(Math.max(empty, 0)) + ']';
}

/**
 * Format life events (travel, work changes, etc.)
 */
function formatLifeEventsContext(events: LifeEvent[], maxTokens: number): string {
  if (!events || events.length === 0) return '';

  const parts: string[] = ['### Life Events & Context'];

  const upcoming = events.filter(e => e.status === 'upcoming');
  const recent = events.filter(e => e.status === 'occurred' || e.status === 'ongoing');

  if (upcoming.length > 0) {
    parts.push('**Upcoming:**');
    for (const event of upcoming.slice(0, 3)) {
      parts.push(`- ${event.title} (${event.event_type}) - ${event.start_date}`);
    }
  }

  if (recent.length > 0) {
    parts.push('**Recent:**');
    for (const event of recent.slice(0, 3)) {
      parts.push(`- ${event.title} (${event.event_type})`);
    }
  }

  return truncateToTokens(parts.join('\n'), maxTokens);
}

/**
 * Format active interventions/experiments
 */
function formatInterventions(interventions: Intervention[], maxTokens: number): string {
  if (!interventions || interventions.length === 0) return '';

  const parts: string[] = ['### Active Health Experiments'];

  for (const intervention of interventions) {
    const duration = getDaysSince(intervention.started_at);
    parts.push(`- **${intervention.intervention_type}**: ${intervention.description} (Day ${duration})`);
    if (intervention.target_metric) {
      parts.push(`  Tracking: ${intervention.target_metric}`);
    }
  }

  return truncateToTokens(parts.join('\n'), maxTokens);
}

function getDaysSince(dateStr: string): number {
  const date = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Format daily check-ins (mood, energy, stress)
 */
function formatDailyCheckins(checkins: DailyCheckin[], maxTokens: number): string {
  if (!checkins || checkins.length === 0) return '';

  const parts: string[] = ['### Recent Check-ins'];

  // Calculate averages
  const avgMood = checkins.reduce((sum, c) => sum + (c.mood_score || 0), 0) / checkins.length;
  const avgEnergy = checkins.reduce((sum, c) => sum + (c.energy_score || 0), 0) / checkins.length;
  const avgStress = checkins.reduce((sum, c) => sum + (c.stress_score || 0), 0) / checkins.length;

  parts.push(`7-day averages: Mood ${avgMood.toFixed(1)}/10, Energy ${avgEnergy.toFixed(1)}/10, Stress ${avgStress.toFixed(1)}/10`);

  // Today's check-in
  const today = checkins[0];
  if (today) {
    parts.push(`\n**Today**: Mood ${today.mood_score || '-'}/10, Energy ${today.energy_score || '-'}/10, Stress ${today.stress_score || '-'}/10`);
    if (today.notes) parts.push(`Notes: "${today.notes}"`);
  }

  return truncateToTokens(parts.join('\n'), maxTokens);
}

/**
 * Format advice outcomes (what worked/didn't)
 */
function formatAdviceOutcomes(outcomes: AdviceOutcome[], maxTokens: number): string {
  if (!outcomes || outcomes.length === 0) return '';

  const parts: string[] = ['### Past Advice Outcomes'];
  parts.push('Use this to inform recommendations - repeat what worked, avoid what didn\'t:');

  const improved = outcomes.filter(o => o.outcome === 'improved');
  const worsened = outcomes.filter(o => o.outcome === 'worsened');

  if (improved.length > 0) {
    parts.push('\n**What Worked ✓**');
    for (const outcome of improved.slice(0, 3)) {
      const change = outcome.improvement_pct ? ` (+${Math.round(outcome.improvement_pct)}%)` : '';
      parts.push(`- ${outcome.advice_given.substring(0, 80)}...${change}`);
    }
  }

  if (worsened.length > 0) {
    parts.push('\n**What Didn\'t Work ✗**');
    for (const outcome of worsened.slice(0, 2)) {
      parts.push(`- ${outcome.advice_given.substring(0, 80)}...`);
    }
  }

  return truncateToTokens(parts.join('\n'), maxTokens);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function truncateToTokens(text: string, maxTokens: number): string {
  if (maxTokens <= 0) return '';

  // Rough estimate: 1 token ≈ 4 characters
  const maxChars = maxTokens * 4;

  if (text.length <= maxChars) {
    return text;
  }

  // Truncate at a word boundary
  const truncated = text.substring(0, maxChars);
  const lastSpace = truncated.lastIndexOf(' ');
  return lastSpace > 0 ? truncated.substring(0, lastSpace) + '...' : truncated + '...';
}

function estimateTokens(text: string): number {
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4);
}

/**
 * Get user's subscription tier from database
 */
export async function getUserSubscriptionTier(email: string): Promise<string> {
  const supabase = createAdminClient();

  // Check user_subscriptions table (uses user_email column, not email)
  const { data, error } = await supabase
    .from('user_subscriptions')
    .select('tier, status, current_period_end')
    .eq('user_email', email)
    .maybeSingle();

  // If found and active with valid period, use it
  if (data?.tier && data?.status === 'active') {
    const periodEnd = data.current_period_end ? new Date(data.current_period_end) : null;
    if (!periodEnd || periodEnd > new Date()) {
      return data.tier;
    }
  }

  if (error || !data) {
    // Check sage_onboarding_data as fallback
    const { data: sageData } = await supabase
      .from('sage_onboarding_data')
      .select('subscription_status')
      .eq('email', email)
      .maybeSingle();

    return sageData?.subscription_status || 'free';
  }

  return data.tier || 'free';
}
