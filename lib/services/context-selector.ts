/**
 * Context Selector Service
 *
 * Analyzes user questions to determine which data sources are relevant.
 * Uses keyword matching for speed, with optional AI for complex queries.
 *
 * Data Sources:
 * - profile: Basic user profile and preferences
 * - insights: AI-generated health insights
 * - labs: Blood/lab results and biomarkers
 * - oura: Sleep, HRV, readiness from Oura Ring
 * - dexcom: Glucose data from CGM
 * - training: Forge/moccet train fitness data
 * - nutrition: Sage/moccet chef nutrition data
 * - behavioral: Gmail, Slack patterns (work stress indicators)
 * - apple_health: Apple Health data
 * - conversation: Conversation history
 */

import OpenAI from 'openai';

const openai = new OpenAI();

// ============================================================================
// TYPES
// ============================================================================

export type DataSource =
  | 'profile'
  | 'insights'
  | 'labs'
  | 'oura'
  | 'dexcom'
  | 'training'
  | 'nutrition'
  | 'behavioral'
  | 'apple_health'
  | 'conversation'
  // NEW: Rich context sources for hyper-personalization
  | 'sage'           // Full Sage nutrition plans + food logs
  | 'forge'          // Full Forge fitness plans + workout patterns
  | 'goals'          // Health goals with auto-progress
  | 'life_events'    // Life events from email analysis
  | 'interventions'  // Active health experiments
  | 'checkins'       // Daily mood/energy check-ins
  | 'outcomes';      // Advice outcomes (what worked/didn't)

export interface ContextSelectionResult {
  sources: DataSource[];
  priority: DataSource[]; // High priority sources (always included if available)
  reasoning?: string;
  estimatedTokens: number;
}

export interface ContextLimits {
  maxTokens: number;
  conversationDepth: number;
  allowedSources: DataSource[];
  enableCompaction: boolean;
  model: string;
}

// ============================================================================
// SUBSCRIPTION TIERS
// ============================================================================

const SUBSCRIPTION_LIMITS: Record<string, ContextLimits> = {
  free: {
    maxTokens: 3000,
    conversationDepth: 10,
    allowedSources: ['profile', 'insights', 'labs', 'conversation', 'goals'],
    enableCompaction: false,
    model: 'gpt-4o-mini',
  },
  pro: {
    maxTokens: 12000, // Increased from 8000 for richer context
    conversationDepth: 50,
    allowedSources: [
      'profile',
      'insights',
      'labs',
      'oura',
      'dexcom',
      'training',
      'nutrition',
      'behavioral',
      'conversation',
      // NEW: Rich context sources
      'sage',
      'forge',
      'goals',
      'life_events',
      'interventions',
      'checkins',
      'outcomes',
    ],
    enableCompaction: true,
    model: 'gpt-4o',
  },
  max: {
    maxTokens: 24000, // Increased from 16000 for full context
    conversationDepth: -1, // Unlimited (with compaction)
    allowedSources: [
      'profile',
      'insights',
      'labs',
      'oura',
      'dexcom',
      'training',
      'nutrition',
      'behavioral',
      'apple_health',
      'conversation',
      // NEW: Rich context sources
      'sage',
      'forge',
      'goals',
      'life_events',
      'interventions',
      'checkins',
      'outcomes',
    ],
    enableCompaction: true,
    model: 'gpt-4o',
  },
};

// Token estimates per source (approximate)
const TOKEN_ESTIMATES: Record<DataSource, number> = {
  profile: 300,
  insights: 800,
  labs: 600,
  oura: 500,
  dexcom: 400,
  training: 400,
  nutrition: 400,
  behavioral: 300,
  apple_health: 500,
  conversation: 1000, // Variable, but base estimate
  // NEW: Rich context sources
  sage: 1000,          // Full meal plans + food logs
  forge: 800,          // Full workout programs + patterns
  goals: 500,          // Health goals with progress
  life_events: 400,    // Recent life events
  interventions: 300,  // Active experiments
  checkins: 300,       // Daily check-ins
  outcomes: 400,       // Advice effectiveness tracking
};

// ============================================================================
// KEYWORD MAPPINGS
// ============================================================================

/**
 * Maps keywords to relevant data sources
 * Multiple keywords can map to the same source
 */
const KEYWORD_SOURCE_MAP: Record<string, DataSource[]> = {
  // Sleep related
  sleep: ['oura', 'insights', 'apple_health'],
  sleeping: ['oura', 'insights', 'apple_health'],
  slept: ['oura', 'insights', 'apple_health'],
  insomnia: ['oura', 'insights', 'labs'],
  tired: ['oura', 'insights', 'labs'],
  fatigue: ['oura', 'insights', 'labs'],
  rest: ['oura', 'insights'],
  restless: ['oura', 'insights'],
  dream: ['oura'],
  rem: ['oura'],
  'deep sleep': ['oura'],
  bedtime: ['oura', 'insights'],
  'wake up': ['oura', 'insights'],

  // HRV / Recovery
  hrv: ['oura', 'insights'],
  'heart rate variability': ['oura', 'insights'],
  recovery: ['oura', 'training', 'insights'],
  readiness: ['oura', 'insights'],
  stress: ['oura', 'behavioral', 'insights'],
  strain: ['oura', 'training'],
  'resting heart rate': ['oura', 'insights'],
  'heart rate': ['oura', 'apple_health', 'insights'],

  // Glucose / Blood sugar
  glucose: ['dexcom', 'labs', 'insights'],
  'blood sugar': ['dexcom', 'labs', 'insights'],
  sugar: ['dexcom', 'labs', 'nutrition'],
  cgm: ['dexcom'],
  dexcom: ['dexcom'],
  spike: ['dexcom', 'nutrition', 'insights'],
  'time in range': ['dexcom', 'insights'],
  a1c: ['labs', 'dexcom'],
  hemoglobin: ['labs'],
  insulin: ['dexcom', 'labs', 'nutrition'],

  // Blood work / Labs
  blood: ['labs', 'insights'],
  biomarker: ['labs', 'insights'],
  biomarkers: ['labs', 'insights'],
  lab: ['labs'],
  labs: ['labs'],
  'test results': ['labs'],
  cholesterol: ['labs', 'nutrition'],
  ldl: ['labs'],
  hdl: ['labs'],
  triglycerides: ['labs', 'nutrition'],
  vitamin: ['labs', 'nutrition'],
  'vitamin d': ['labs', 'nutrition'],
  b12: ['labs', 'nutrition'],
  iron: ['labs', 'nutrition'],
  ferritin: ['labs'],
  testosterone: ['labs', 'training'],
  cortisol: ['labs', 'oura'],
  thyroid: ['labs'],
  tsh: ['labs'],

  // Nutrition / Diet
  diet: ['nutrition', 'insights', 'labs'],
  eat: ['nutrition', 'dexcom'],
  eating: ['nutrition', 'dexcom'],
  food: ['nutrition', 'dexcom'],
  meal: ['nutrition', 'dexcom'],
  nutrition: ['nutrition', 'labs'],
  calorie: ['nutrition', 'training'],
  calories: ['nutrition', 'training'],
  protein: ['nutrition', 'labs'],
  carb: ['nutrition', 'dexcom'],
  carbs: ['nutrition', 'dexcom'],
  fat: ['nutrition', 'labs'],
  macro: ['nutrition'],
  macros: ['nutrition'],
  recipe: ['nutrition'],
  cook: ['nutrition'],
  keto: ['nutrition', 'dexcom'],
  fasting: ['nutrition', 'dexcom', 'labs'],

  // Fitness / Training
  workout: ['training', 'oura', 'apple_health'],
  exercise: ['training', 'oura', 'apple_health'],
  training: ['training', 'oura'],
  gym: ['training'],
  lift: ['training'],
  lifting: ['training'],
  strength: ['training', 'labs'],
  cardio: ['training', 'oura', 'apple_health'],
  run: ['training', 'oura', 'apple_health'],
  running: ['training', 'oura', 'apple_health'],
  steps: ['oura', 'apple_health'],
  activity: ['oura', 'training', 'apple_health'],
  fitness: ['training', 'oura', 'apple_health'],
  performance: ['training', 'oura', 'insights'],

  // Behavioral / Work patterns
  work: ['behavioral', 'insights'],
  email: ['behavioral'],
  meeting: ['behavioral'],
  meetings: ['behavioral'],
  slack: ['behavioral'],
  'after hours': ['behavioral'],
  productivity: ['behavioral', 'oura'],
  focus: ['behavioral', 'oura'],

  // Health general
  health: ['insights', 'labs', 'oura'],
  wellness: ['insights', 'oura'],
  feeling: ['insights', 'oura'],
  energy: ['oura', 'dexcom', 'insights'],
  mood: ['checkins', 'insights', 'oura', 'behavioral'],
  supplement: ['labs', 'nutrition'],
  supplements: ['labs', 'nutrition'],
  medication: ['labs', 'profile'],
  allergy: ['profile', 'nutrition'],
  allergies: ['profile', 'nutrition'],

  // Goals
  goal: ['profile', 'insights', 'training'],
  goals: ['profile', 'insights', 'training'],
  weight: ['profile', 'nutrition', 'training'],
  'lose weight': ['nutrition', 'training', 'insights'],
  'gain muscle': ['training', 'nutrition', 'labs'],

  // Conversation / History
  'last time': ['conversation'],
  remember: ['conversation'],
  'we discussed': ['conversation'],
  'you said': ['conversation'],
  'i told you': ['conversation'],
  before: ['conversation'],
  previously: ['conversation'],

  // NEW: Sage (full nutrition plans + food logs)
  'meal plan': ['sage', 'nutrition'],
  'what to eat': ['sage', 'nutrition', 'dexcom'],
  breakfast: ['sage', 'nutrition'],
  lunch: ['sage', 'nutrition'],
  dinner: ['sage', 'nutrition'],
  snack: ['sage', 'nutrition'],
  'food log': ['sage'],
  'what i ate': ['sage'],
  'eating today': ['sage', 'nutrition'],
  'my meals': ['sage', 'nutrition'],

  // NEW: Forge (full fitness plans + workout patterns)
  'workout plan': ['forge', 'training'],
  'fitness plan': ['forge', 'training'],
  'training plan': ['forge', 'training'],
  'what workout': ['forge', 'training'],
  'exercise today': ['forge', 'training'],
  'my workouts': ['forge', 'training'],
  'training schedule': ['forge', 'training'],
  'workout schedule': ['forge', 'training'],

  // NEW: Goals (health goals with progress)
  'my goals': ['goals', 'profile'],
  progress: ['goals', 'insights'],
  milestone: ['goals'],
  target: ['goals', 'profile'],
  'how am i doing': ['goals', 'insights', 'oura'],
  tracking: ['goals', 'insights'],
  achieving: ['goals'],

  // NEW: Life events
  travel: ['life_events', 'behavioral'],
  traveling: ['life_events', 'behavioral'],
  vacation: ['life_events', 'behavioral'],
  trip: ['life_events', 'behavioral'],
  moving: ['life_events'],
  'new job': ['life_events', 'behavioral'],
  'job change': ['life_events', 'behavioral'],
  'busy week': ['life_events', 'behavioral'],
  'big event': ['life_events'],
  wedding: ['life_events'],
  conference: ['life_events', 'behavioral'],

  // NEW: Interventions (health experiments)
  trying: ['interventions', 'outcomes'],
  experiment: ['interventions'],
  testing: ['interventions'],
  'new supplement': ['interventions', 'nutrition'],
  'new habit': ['interventions'],
  'started taking': ['interventions', 'nutrition'],
  'been doing': ['interventions'],

  // NEW: Check-ins (daily mood/energy)
  'how i feel': ['checkins', 'oura'],
  'energy level': ['checkins', 'oura', 'dexcom'],
  'stress level': ['checkins', 'behavioral', 'oura'],
  today: ['checkins', 'insights'],
  'this morning': ['checkins', 'oura'],
  anxious: ['checkins', 'behavioral'],
  happy: ['checkins'],
  sad: ['checkins'],
  motivated: ['checkins'],

  // NEW: Outcomes (what worked/didn't)
  'did that work': ['outcomes'],
  'did it help': ['outcomes'],
  helped: ['outcomes'],
  improved: ['outcomes', 'insights'],
  worsened: ['outcomes'],
  effective: ['outcomes'],
  'what worked': ['outcomes'],
  'what helped': ['outcomes'],
  'last advice': ['outcomes', 'conversation'],
};

// Sources that are ALWAYS included (profile is lightweight and essential)
const ALWAYS_INCLUDE: DataSource[] = ['profile'];

// ============================================================================
// FUNCTIONS
// ============================================================================

/**
 * Get context limits based on subscription tier
 */
export function getContextLimits(subscriptionTier: string): ContextLimits {
  return SUBSCRIPTION_LIMITS[subscriptionTier] || SUBSCRIPTION_LIMITS.free;
}

/**
 * Select relevant data sources based on user's message
 * Uses keyword matching for speed, AI for complex queries if enabled
 */
export async function selectRelevantContext(
  message: string,
  options: {
    subscriptionTier?: string;
    useAI?: boolean;
    includeConversation?: boolean;
  } = {}
): Promise<ContextSelectionResult> {
  const {
    subscriptionTier = 'free',
    useAI = false,
    includeConversation = true,
  } = options;

  const limits = getContextLimits(subscriptionTier);
  const lowerMessage = message.toLowerCase();

  // Start with always-included sources
  const selectedSources = new Set<DataSource>(ALWAYS_INCLUDE);
  const prioritySources: DataSource[] = [];

  // Keyword-based selection
  for (const [keyword, sources] of Object.entries(KEYWORD_SOURCE_MAP)) {
    if (lowerMessage.includes(keyword)) {
      for (const source of sources) {
        if (limits.allowedSources.includes(source)) {
          selectedSources.add(source);
          // First match for each keyword is high priority
          if (!prioritySources.includes(source)) {
            prioritySources.push(source);
          }
        }
      }
    }
  }

  // Always include conversation history if enabled
  if (includeConversation && limits.allowedSources.includes('conversation')) {
    selectedSources.add('conversation');
  }

  // If no specific sources matched, include insights as default context
  if (selectedSources.size <= ALWAYS_INCLUDE.length + 1) {
    if (limits.allowedSources.includes('insights')) {
      selectedSources.add('insights');
    }
  }

  // Use AI for complex queries (optional, adds latency but better selection)
  let reasoning: string | undefined;
  if (useAI && selectedSources.size > 3) {
    try {
      const aiResult = await refineWithAI(message, Array.from(selectedSources), limits);
      if (aiResult) {
        reasoning = aiResult.reasoning;
        // AI can narrow down but not expand sources
        const refinedSources = aiResult.sources.filter((s) =>
          selectedSources.has(s) && limits.allowedSources.includes(s)
        );
        if (refinedSources.length > 0) {
          selectedSources.clear();
          for (const s of refinedSources) {
            selectedSources.add(s);
          }
          // Ensure profile is always included
          for (const s of ALWAYS_INCLUDE) {
            selectedSources.add(s);
          }
        }
      }
    } catch (error) {
      console.error('[Context Selector] AI refinement failed:', error);
      // Continue with keyword-based selection
    }
  }

  // Calculate estimated tokens
  const estimatedTokens = Array.from(selectedSources).reduce(
    (sum, source) => sum + (TOKEN_ESTIMATES[source] || 200),
    0
  );

  // Trim if over token limit (remove lowest priority first)
  const finalSources = trimToTokenLimit(
    Array.from(selectedSources),
    prioritySources,
    limits.maxTokens
  );

  return {
    sources: finalSources,
    priority: prioritySources.filter((s) => finalSources.includes(s)),
    reasoning,
    estimatedTokens: finalSources.reduce(
      (sum, source) => sum + (TOKEN_ESTIMATES[source] || 200),
      0
    ),
  };
}

/**
 * Use AI to refine source selection for complex queries
 */
async function refineWithAI(
  message: string,
  sources: DataSource[],
  limits: ContextLimits
): Promise<{ sources: DataSource[]; reasoning: string } | null> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are a context selector for a health assistant. Given a user's question and a list of available data sources, select the most relevant sources to answer the question.

Available sources and what they contain:
- profile: User profile, preferences, goals, allergies
- insights: AI-generated health insights and recommendations
- labs: Blood work, biomarkers, lab results
- oura: Sleep, HRV, readiness, activity from Oura Ring
- dexcom: Continuous glucose monitoring data
- training: Workout plans, exercise history, fitness data
- nutrition: Diet plans, meal logs, nutrition data
- behavioral: Work patterns from Gmail/Slack (stress indicators)
- apple_health: Apple Health data (steps, heart rate, workouts)
- conversation: Previous conversation history

Respond with JSON:
{
  "sources": ["source1", "source2"],
  "reasoning": "Brief explanation"
}

Be selective - only include sources directly relevant to answering the question.`,
      },
      {
        role: 'user',
        content: `Question: "${message}"

Pre-selected sources: ${sources.join(', ')}

Select the most relevant sources (can be fewer than pre-selected):`,
      },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 150,
    temperature: 0,
  });

  try {
    const result = JSON.parse(response.choices[0]?.message?.content || '{}');
    return {
      sources: (result.sources || []) as DataSource[],
      reasoning: result.reasoning || '',
    };
  } catch {
    return null;
  }
}

/**
 * Trim sources to fit within token limit
 * Keeps priority sources, removes others
 */
function trimToTokenLimit(
  sources: DataSource[],
  priority: DataSource[],
  maxTokens: number
): DataSource[] {
  let currentTokens = 0;
  const result: DataSource[] = [];

  // First, add always-include sources
  for (const source of ALWAYS_INCLUDE) {
    if (sources.includes(source)) {
      result.push(source);
      currentTokens += TOKEN_ESTIMATES[source] || 200;
    }
  }

  // Then, add priority sources
  for (const source of priority) {
    if (!result.includes(source) && sources.includes(source)) {
      const tokens = TOKEN_ESTIMATES[source] || 200;
      if (currentTokens + tokens <= maxTokens) {
        result.push(source);
        currentTokens += tokens;
      }
    }
  }

  // Finally, add remaining sources if space allows
  for (const source of sources) {
    if (!result.includes(source)) {
      const tokens = TOKEN_ESTIMATES[source] || 200;
      if (currentTokens + tokens <= maxTokens) {
        result.push(source);
        currentTokens += tokens;
      }
    }
  }

  return result;
}

/**
 * Get all available sources for a subscription tier
 */
export function getAvailableSources(subscriptionTier: string): DataSource[] {
  return getContextLimits(subscriptionTier).allowedSources;
}

/**
 * Check if a source is available for a subscription tier
 */
export function isSourceAvailable(source: DataSource, subscriptionTier: string): boolean {
  return getContextLimits(subscriptionTier).allowedSources.includes(source);
}

/**
 * Get subscription tier info for display
 */
export function getSubscriptionInfo(tier: string): {
  name: string;
  maxTokens: number;
  sourcesCount: number;
  features: string[];
} {
  const limits = getContextLimits(tier);
  const features: string[] = [];

  if (limits.enableCompaction) {
    features.push('Conversation compaction');
  }
  if (limits.conversationDepth === -1) {
    features.push('Unlimited conversation history');
  } else {
    features.push(`Last ${limits.conversationDepth} messages`);
  }
  if (limits.allowedSources.includes('behavioral')) {
    features.push('Work pattern analysis');
  }
  if (limits.allowedSources.includes('apple_health')) {
    features.push('Apple Health integration');
  }

  return {
    name: tier.charAt(0).toUpperCase() + tier.slice(1),
    maxTokens: limits.maxTokens,
    sourcesCount: limits.allowedSources.length,
    features,
  };
}
