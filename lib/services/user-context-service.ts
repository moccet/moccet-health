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
  },
  pro: {
    profile: 500,
    insights: 1500,
    labs: 1000,
    oura: 800,
    dexcom: 600,
    training: 500,
    nutrition: 500,
    behavioral: 400,
    apple_health: 0,
    conversation: 2000,
  },
  max: {
    profile: 800,
    insights: 2000,
    labs: 1500,
    oura: 1200,
    dexcom: 1000,
    training: 800,
    nutrition: 800,
    behavioral: 600,
    apple_health: 800,
    conversation: 3000,
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

  // Step 2: Fetch data from selected sources in parallel
  const fetchPromises: Record<string, Promise<any>> = {};

  // Profile and learned facts are always fetched (lightweight but critical for personalization)
  fetchPromises.profile = fetchUserProfile(email);
  fetchPromises.learnedFacts = fetchLearnedFacts(email);

  // Conditional fetches based on selection
  if (selectionResult.sources.includes('insights')) {
    fetchPromises.insights = fetchUserInsights(email, subscriptionTier);
  }

  if (selectionResult.sources.includes('labs')) {
    fetchPromises.labs = fetchLabResults(email);
  }

  if (selectionResult.sources.includes('oura')) {
    fetchPromises.oura = fetchOuraData(email);
    // Pro/Max: Also fetch health pattern analysis
    if (subscriptionTier === 'pro' || subscriptionTier === 'max') {
      fetchPromises.healthAnalysis = getHealthAnalysis(email);
    }
  }

  if (selectionResult.sources.includes('dexcom')) {
    fetchPromises.dexcom = fetchDexcomData(email);
  }

  if (selectionResult.sources.includes('training')) {
    fetchPromises.training = fetchTrainingData(email);
  }

  if (selectionResult.sources.includes('nutrition')) {
    fetchPromises.nutrition = fetchNutritionData(email);
  }

  if (selectionResult.sources.includes('behavioral')) {
    fetchPromises.gmail = fetchGmailPatterns(email);
    fetchPromises.slack = fetchSlackPatterns(email);
    // Also fetch sentiment analysis if behavioral data is requested
    fetchPromises.sentiment = getSentimentAnalysis(email, { days: 7 });
    // Pro/Max: Also fetch life context (events & patterns from Gmail)
    if (subscriptionTier === 'pro' || subscriptionTier === 'max') {
      fetchPromises.lifeContext = getLifeContext(email);
    }
  }

  if (selectionResult.sources.includes('apple_health')) {
    fetchPromises.appleHealth = fetchAppleHealthData(email);
  }

  if (selectionResult.sources.includes('conversation')) {
    fetchPromises.conversation = getCompactedHistory(email, threadId, subscriptionTier);
  }

  // Wait for all fetches
  const results = await Promise.all(
    Object.entries(fetchPromises).map(async ([key, promise]) => {
      try {
        const data = await promise;
        return [key, data];
      } catch (error) {
        console.error(`[User Context] Error fetching ${key}:`, error);
        return [key, null];
      }
    })
  );

  // Build context object
  const contextData = Object.fromEntries(results);

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
  };

  const duration = Date.now() - startTime;
  console.log(`[User Context] Context fetched in ${duration}ms`);

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

  // Conversation History
  if (context.conversationHistory) {
    const historyText = formatHistoryForPrompt(context.conversationHistory);
    if (historyText) {
      parts.push(historyText);
      tokenEstimate += estimateTokens(historyText);
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
    if (gmail.workHours) {
      parts.push(`Work hours: ${gmail.workHours.start} - ${gmail.workHours.end}`);
    }
    if (gmail.meetingDensity?.avgMeetingsPerDay) {
      parts.push(`Avg meetings/day: ${gmail.meetingDensity.avgMeetingsPerDay}`);
    }
    if (gmail.stressIndicators) {
      const stressors: string[] = [];
      if (gmail.stressIndicators.highEmailVolume) stressors.push('high email volume');
      if (gmail.stressIndicators.frequentAfterHoursWork) stressors.push('after-hours work');
      if (stressors.length) parts.push(`Stress indicators: ${stressors.join(', ')}`);
    }
  }

  if (behavioral.slack?.available && behavioral.slack.data) {
    const slack = behavioral.slack.data as any;
    if (slack.collaborationIntensity) {
      parts.push(`Collaboration intensity: ${slack.collaborationIntensity}`);
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
