/**
 * Smart Router Service
 * Intelligently routes queries to appropriate agents based on complexity,
 * domain, and cost optimization strategies.
 */

import { DataSource } from '@/lib/services/context-selector';

// =============================================================================
// TYPES
// =============================================================================

export type QueryComplexity = 'low' | 'medium' | 'high';
export type OrchestrationMode = 'simple' | 'coordinated' | 'sequential';
export type ModelTier = 'mini' | 'standard' | 'advanced';

export interface RoutingDecision {
  agents: string[];
  primaryAgent: string;
  orchestrationMode: OrchestrationMode;
  estimatedComplexity: QueryComplexity;
  modelTier: ModelTier;
  contextSources: DataSource[];
  contextBudget: number;           // Token budget for context
  reasoning: string;
  estimatedCost: number;           // Relative cost 1-10
  shouldStream: boolean;
  requiresApproval: boolean;       // Will likely need user approval
}

export interface QueryIntent {
  primaryDomain: string;
  secondaryDomains: string[];
  actionType: 'query' | 'action' | 'multi_step';
  isTimebound: boolean;            // Needs recent/real-time data
  isPersonalized: boolean;         // Needs user-specific context
  hasDependencies: boolean;        // Steps depend on previous results
}

export interface UserContext {
  subscriptionTier: string;
  connectedServices: string[];
  recentTopics: string[];
  preferredVerbosity: 'brief' | 'medium' | 'detailed';
}

// =============================================================================
// AGENT DEFINITIONS
// =============================================================================

interface AgentDefinition {
  name: string;
  domains: string[];
  keywords: string[];
  canHandleActions: boolean;
  typicalComplexity: QueryComplexity;
  requiredSources: DataSource[];
  optionalSources: DataSource[];
}

const AGENT_DEFINITIONS: AgentDefinition[] = [
  {
    name: 'sleep',
    domains: ['sleep', 'recovery', 'rest'],
    keywords: ['sleep', 'tired', 'insomnia', 'nap', 'bedtime', 'wake', 'rest', 'rem', 'deep sleep', 'sleep score', 'hrv'],
    canHandleActions: false,
    typicalComplexity: 'low',
    requiredSources: ['oura'],
    optionalSources: ['whoop', 'fitbit', 'garmin', 'apple_health'],
  },
  {
    name: 'nutrition',
    domains: ['nutrition', 'diet', 'food', 'eating'],
    keywords: ['eat', 'food', 'meal', 'diet', 'nutrition', 'calories', 'protein', 'carbs', 'macro', 'hungry', 'recipe', 'cook'],
    canHandleActions: true,
    typicalComplexity: 'medium',
    requiredSources: ['sage'],
    optionalSources: ['dexcom', 'goals'],
  },
  {
    name: 'glucose',
    domains: ['glucose', 'blood sugar', 'cgm'],
    keywords: ['glucose', 'blood sugar', 'cgm', 'dexcom', 'libre', 'spike', 'insulin', 'diabetic', 'a1c'],
    canHandleActions: false,
    typicalComplexity: 'medium',
    requiredSources: ['dexcom'],
    optionalSources: ['sage', 'oura'],
  },
  {
    name: 'fitness',
    domains: ['fitness', 'exercise', 'training', 'workout'],
    keywords: ['workout', 'exercise', 'gym', 'training', 'run', 'lift', 'strength', 'cardio', 'steps', 'active'],
    canHandleActions: true,
    typicalComplexity: 'medium',
    requiredSources: ['forge'],
    optionalSources: ['oura', 'whoop', 'strava', 'apple_health'],
  },
  {
    name: 'calendar',
    domains: ['calendar', 'schedule', 'meetings'],
    keywords: ['calendar', 'schedule', 'meeting', 'appointment', 'event', 'busy', 'free', 'book', 'reschedule'],
    canHandleActions: true,
    typicalComplexity: 'medium',
    requiredSources: ['calendar'],
    optionalSources: ['google', 'outlook'],
  },
  {
    name: 'supplements',
    domains: ['supplements', 'vitamins', 'minerals'],
    keywords: ['supplement', 'vitamin', 'mineral', 'deficiency', 'pill', 'capsule', 'take', 'dose'],
    canHandleActions: true,
    typicalComplexity: 'low',
    requiredSources: ['labs'],
    optionalSources: ['profile'],
  },
  {
    name: 'music',
    domains: ['music', 'spotify', 'playlist'],
    keywords: ['music', 'spotify', 'playlist', 'song', 'listen', 'focus', 'relax', 'workout music'],
    canHandleActions: true,
    typicalComplexity: 'low',
    requiredSources: [],
    optionalSources: ['spotify'],
  },
  {
    name: 'goals',
    domains: ['goals', 'progress', 'tracking'],
    keywords: ['goal', 'target', 'progress', 'track', 'achieve', 'milestone', 'habit'],
    canHandleActions: true,
    typicalComplexity: 'low',
    requiredSources: ['goals'],
    optionalSources: ['interventions', 'outcomes'],
  },
  {
    name: 'social',
    domains: ['social', 'friends', 'connect'],
    keywords: ['friend', 'connect', 'social', 'meet', 'buddy', 'accountability', 'partner'],
    canHandleActions: true,
    typicalComplexity: 'medium',
    requiredSources: [],
    optionalSources: [],
  },
  {
    name: 'caregiving',
    domains: ['caregiving', 'family', 'monitor'],
    keywords: ['caregiver', 'care', 'monitor', 'family', 'parent', 'elderly', 'check on', 'share'],
    canHandleActions: true,
    typicalComplexity: 'medium',
    requiredSources: [],
    optionalSources: [],
  },
  {
    name: 'general',
    domains: ['general', 'health', 'wellness'],
    keywords: ['health', 'wellness', 'how am i', 'summary', 'overview', 'status', 'check'],
    canHandleActions: false,
    typicalComplexity: 'low',
    requiredSources: ['profile'],
    optionalSources: ['oura', 'dexcom', 'goals', 'checkins'],
  },
];

// =============================================================================
// COMPLEXITY SCORING
// =============================================================================

interface ComplexityFactors {
  wordCount: number;
  questionCount: number;
  domainCount: number;
  hasConditionals: boolean;
  hasTemporalReferences: boolean;
  hasComparisons: boolean;
  requiresMultipleSteps: boolean;
  requiresCalculation: boolean;
}

function analyzeComplexityFactors(message: string): ComplexityFactors {
  const lowerMessage = message.toLowerCase();
  const words = message.split(/\s+/).filter(w => w.length > 0);

  return {
    wordCount: words.length,
    questionCount: (message.match(/\?/g) || []).length,
    domainCount: countDomains(lowerMessage),
    hasConditionals: /\b(if|when|unless|whether|depends)\b/.test(lowerMessage),
    hasTemporalReferences: /\b(yesterday|today|tomorrow|last week|this week|next week|month|year)\b/.test(lowerMessage),
    hasComparisons: /\b(compare|vs|versus|better|worse|difference|trend|change)\b/.test(lowerMessage),
    requiresMultipleSteps: /\b(and then|after that|first|second|also|plus)\b/.test(lowerMessage) ||
                          (lowerMessage.includes(' and ') && countDomains(lowerMessage) > 1),
    requiresCalculation: /\b(average|total|sum|calculate|how much|how many|percent|ratio)\b/.test(lowerMessage),
  };
}

function countDomains(message: string): number {
  const domains = new Set<string>();
  for (const agent of AGENT_DEFINITIONS) {
    for (const keyword of agent.keywords) {
      if (message.includes(keyword)) {
        domains.add(agent.name);
        break;
      }
    }
  }
  return domains.size;
}

function calculateComplexityScore(factors: ComplexityFactors): number {
  let score = 0;

  // Word count contribution (0-3)
  if (factors.wordCount > 30) score += 3;
  else if (factors.wordCount > 15) score += 2;
  else if (factors.wordCount > 5) score += 1;

  // Question count (0-2)
  score += Math.min(factors.questionCount, 2);

  // Domain count (0-3)
  score += Math.min(factors.domainCount - 1, 3);

  // Boolean factors (0-1 each)
  if (factors.hasConditionals) score += 2;
  if (factors.hasTemporalReferences) score += 1;
  if (factors.hasComparisons) score += 2;
  if (factors.requiresMultipleSteps) score += 3;
  if (factors.requiresCalculation) score += 1;

  return score;
}

function scoreToComplexity(score: number): QueryComplexity {
  if (score <= 3) return 'low';
  if (score <= 7) return 'medium';
  return 'high';
}

// =============================================================================
// INTENT DETECTION
// =============================================================================

function detectQueryIntent(message: string): QueryIntent {
  const lowerMessage = message.toLowerCase();

  // Detect primary domain
  let primaryDomain = 'general';
  let maxKeywordMatches = 0;

  for (const agent of AGENT_DEFINITIONS) {
    const matches = agent.keywords.filter(kw => lowerMessage.includes(kw)).length;
    if (matches > maxKeywordMatches) {
      maxKeywordMatches = matches;
      primaryDomain = agent.name;
    }
  }

  // Detect secondary domains
  const secondaryDomains: string[] = [];
  for (const agent of AGENT_DEFINITIONS) {
    if (agent.name === primaryDomain) continue;
    const hasKeyword = agent.keywords.some(kw => lowerMessage.includes(kw));
    if (hasKeyword) {
      secondaryDomains.push(agent.name);
    }
  }

  // Detect action type
  const actionKeywords = ['create', 'add', 'schedule', 'book', 'buy', 'order', 'set', 'update', 'delete', 'cancel', 'play', 'start', 'log'];
  const isAction = actionKeywords.some(kw => lowerMessage.includes(kw));

  const multiStepKeywords = ['and then', 'after that', 'first', 'finally', 'next'];
  const isMultiStep = multiStepKeywords.some(kw => lowerMessage.includes(kw)) ||
                     (secondaryDomains.length > 0 && isAction);

  let actionType: 'query' | 'action' | 'multi_step' = 'query';
  if (isMultiStep) actionType = 'multi_step';
  else if (isAction) actionType = 'action';

  // Detect time-sensitivity
  const timeboundKeywords = ['now', 'today', 'right now', 'current', 'latest', 'recent', 'real-time'];
  const isTimebound = timeboundKeywords.some(kw => lowerMessage.includes(kw));

  // Detect personalization needs
  const personalKeywords = ['my', 'me', 'i ', "i'm", 'mine', 'for me'];
  const isPersonalized = personalKeywords.some(kw => lowerMessage.includes(kw));

  // Detect dependencies
  const hasDependencies = /\b(if|based on|depending on|when|after)\b/.test(lowerMessage) &&
                         secondaryDomains.length > 0;

  return {
    primaryDomain,
    secondaryDomains,
    actionType,
    isTimebound,
    isPersonalized,
    hasDependencies,
  };
}

// =============================================================================
// AGENT SELECTION
// =============================================================================

function selectAgents(intent: QueryIntent, complexity: QueryComplexity): string[] {
  const agents: string[] = [];

  // Always include primary agent
  agents.push(intent.primaryDomain);

  // For complex queries, include secondary agents
  if (complexity === 'high' || intent.actionType === 'multi_step') {
    agents.push(...intent.secondaryDomains.slice(0, 2)); // Max 2 secondary
  } else if (complexity === 'medium' && intent.secondaryDomains.length > 0) {
    agents.push(intent.secondaryDomains[0]); // Only 1 secondary
  }

  return [...new Set(agents)]; // Deduplicate
}

function determineOrchestrationMode(
  agents: string[],
  intent: QueryIntent,
  complexity: QueryComplexity
): OrchestrationMode {
  if (agents.length === 1) return 'simple';

  if (intent.hasDependencies || intent.actionType === 'multi_step') {
    return 'sequential';
  }

  if (agents.length > 1 && complexity === 'high') {
    return 'coordinated';
  }

  return 'simple';
}

// =============================================================================
// MODEL SELECTION
// =============================================================================

function selectModelTier(
  complexity: QueryComplexity,
  orchestrationMode: OrchestrationMode,
  subscriptionTier: string
): ModelTier {
  // Free tier always gets mini
  if (subscriptionTier === 'free') {
    return 'mini';
  }

  // Simple queries use mini for cost savings
  if (complexity === 'low' && orchestrationMode === 'simple') {
    return 'mini';
  }

  // High complexity or coordinated mode uses standard
  if (complexity === 'high' || orchestrationMode === 'coordinated') {
    return subscriptionTier === 'max' ? 'advanced' : 'standard';
  }

  return 'standard';
}

// =============================================================================
// CONTEXT BUDGET
// =============================================================================

function calculateContextBudget(
  complexity: QueryComplexity,
  modelTier: ModelTier,
  subscriptionTier: string
): number {
  const baseBudgets: Record<string, number> = {
    free: 2000,
    pro: 6000,
    max: 12000,
  };

  const base = baseBudgets[subscriptionTier] || baseBudgets.free;

  // Adjust based on complexity
  const complexityMultipliers: Record<QueryComplexity, number> = {
    low: 0.5,
    medium: 0.75,
    high: 1.0,
  };

  // Adjust based on model tier (larger models can handle more context)
  const modelMultipliers: Record<ModelTier, number> = {
    mini: 0.6,
    standard: 1.0,
    advanced: 1.5,
  };

  return Math.round(base * complexityMultipliers[complexity] * modelMultipliers[modelTier]);
}

// =============================================================================
// CONTEXT SOURCE SELECTION
// =============================================================================

function selectContextSources(
  agents: string[],
  intent: QueryIntent,
  connectedServices: string[]
): DataSource[] {
  const sources = new Set<DataSource>();

  // Add required and optional sources for each agent
  for (const agentName of agents) {
    const agent = AGENT_DEFINITIONS.find(a => a.name === agentName);
    if (!agent) continue;

    // Add required sources
    for (const source of agent.requiredSources) {
      sources.add(source);
    }

    // Add optional sources if connected
    for (const source of agent.optionalSources) {
      if (connectedServices.includes(source)) {
        sources.add(source);
      }
    }
  }

  // Always include conversation history for personalization
  if (intent.isPersonalized) {
    sources.add('conversation' as DataSource);
  }

  // Add profile for personalized queries
  if (intent.isPersonalized) {
    sources.add('profile' as DataSource);
  }

  return Array.from(sources);
}

// =============================================================================
// COST ESTIMATION
// =============================================================================

function estimateCost(
  modelTier: ModelTier,
  contextBudget: number,
  agentCount: number,
  orchestrationMode: OrchestrationMode
): number {
  // Base cost by model tier (1-10 scale)
  const modelCosts: Record<ModelTier, number> = {
    mini: 1,
    standard: 4,
    advanced: 8,
  };

  let cost = modelCosts[modelTier];

  // Adjust for context size
  cost += Math.ceil(contextBudget / 3000);

  // Adjust for agent count
  cost += (agentCount - 1) * 1.5;

  // Adjust for orchestration mode
  if (orchestrationMode === 'coordinated') cost *= 1.3;
  if (orchestrationMode === 'sequential') cost *= 1.5;

  return Math.min(Math.round(cost), 10);
}

// =============================================================================
// MAIN ROUTING FUNCTION
// =============================================================================

/**
 * Route a query to appropriate agents with optimal configuration
 */
export function routeQuery(
  message: string,
  userContext: UserContext
): RoutingDecision {
  // Step 1: Analyze complexity
  const factors = analyzeComplexityFactors(message);
  const complexityScore = calculateComplexityScore(factors);
  const complexity = scoreToComplexity(complexityScore);

  // Step 2: Detect intent
  const intent = detectQueryIntent(message);

  // Step 3: Select agents
  const agents = selectAgents(intent, complexity);
  const primaryAgent = agents[0];

  // Step 4: Determine orchestration mode
  const orchestrationMode = determineOrchestrationMode(agents, intent, complexity);

  // Step 5: Select model tier
  const modelTier = selectModelTier(complexity, orchestrationMode, userContext.subscriptionTier);

  // Step 6: Calculate context budget
  const contextBudget = calculateContextBudget(complexity, modelTier, userContext.subscriptionTier);

  // Step 7: Select context sources
  const contextSources = selectContextSources(agents, intent, userContext.connectedServices);

  // Step 8: Estimate cost
  const estimatedCost = estimateCost(modelTier, contextBudget, agents.length, orchestrationMode);

  // Step 9: Determine if approval likely needed
  const requiresApproval = intent.actionType !== 'query' &&
    AGENT_DEFINITIONS.find(a => a.name === primaryAgent)?.canHandleActions === true;

  // Build reasoning string
  const reasoning = buildReasoningString(factors, intent, agents, complexity, modelTier);

  return {
    agents,
    primaryAgent,
    orchestrationMode,
    estimatedComplexity: complexity,
    modelTier,
    contextSources,
    contextBudget,
    reasoning,
    estimatedCost,
    shouldStream: true, // Always stream for better UX
    requiresApproval,
  };
}

function buildReasoningString(
  factors: ComplexityFactors,
  intent: QueryIntent,
  agents: string[],
  complexity: QueryComplexity,
  modelTier: ModelTier
): string {
  const parts: string[] = [];

  parts.push(`Complexity: ${complexity} (${factors.domainCount} domain(s), ${factors.wordCount} words)`);
  parts.push(`Primary: ${intent.primaryDomain}`);

  if (intent.secondaryDomains.length > 0) {
    parts.push(`Secondary: ${intent.secondaryDomains.join(', ')}`);
  }

  parts.push(`Action type: ${intent.actionType}`);
  parts.push(`Model: ${modelTier}`);

  if (agents.length > 1) {
    parts.push(`Multi-agent: ${agents.join(' + ')}`);
  }

  return parts.join(' | ');
}

// =============================================================================
// QUICK ROUTE (for simple classification without full analysis)
// =============================================================================

/**
 * Quick route for simple queries that don't need full analysis
 */
export function quickRoute(message: string): { isSimple: boolean; suggestedAgent: string } {
  const lowerMessage = message.toLowerCase().trim();

  // Very short queries are simple
  if (lowerMessage.split(/\s+/).length <= 5) {
    // Match to first agent with a keyword hit
    for (const agent of AGENT_DEFINITIONS) {
      if (agent.keywords.some(kw => lowerMessage.includes(kw))) {
        return { isSimple: true, suggestedAgent: agent.name };
      }
    }
    return { isSimple: true, suggestedAgent: 'general' };
  }

  // Greetings are simple
  if (/^(hi|hello|hey|good morning|good evening|what's up)/i.test(lowerMessage)) {
    return { isSimple: true, suggestedAgent: 'general' };
  }

  // Single-domain queries without actions are simple
  const domainCount = countDomains(lowerMessage);
  const hasAction = /\b(create|add|schedule|book|buy|set|update|delete)\b/.test(lowerMessage);

  if (domainCount === 1 && !hasAction) {
    const intent = detectQueryIntent(message);
    return { isSimple: true, suggestedAgent: intent.primaryDomain };
  }

  return { isSimple: false, suggestedAgent: 'general' };
}

// =============================================================================
// AGENT HAND-OFF PROTOCOL
// =============================================================================

export interface AgentHandoff {
  fromAgent: string;
  toAgent: string;
  reason: string;
  sharedContext: Record<string, any>;
  priority: 'immediate' | 'next_turn';
}

/**
 * Determine if an agent should hand off to another agent
 */
export function shouldHandoff(
  currentAgent: string,
  agentResponse: string,
  discoveredInfo: Record<string, any>
): AgentHandoff | null {
  const lowerResponse = agentResponse.toLowerCase();

  // Check for cross-domain discoveries
  const handoffPatterns: Array<{
    fromAgents: string[];
    toAgent: string;
    patterns: RegExp[];
    reason: string;
  }> = [
    {
      fromAgents: ['sleep'],
      toAgent: 'fitness',
      patterns: [/late.*training/i, /evening.*workout/i, /exercise.*affect.*sleep/i],
      reason: 'Sleep analysis suggests training schedule may need adjustment',
    },
    {
      fromAgents: ['sleep'],
      toAgent: 'nutrition',
      patterns: [/late.*eating/i, /caffeine/i, /alcohol.*sleep/i],
      reason: 'Sleep quality may be affected by eating patterns',
    },
    {
      fromAgents: ['glucose'],
      toAgent: 'nutrition',
      patterns: [/spike.*after/i, /food.*cause/i, /meal.*glucose/i],
      reason: 'Glucose patterns suggest dietary adjustments needed',
    },
    {
      fromAgents: ['fitness'],
      toAgent: 'sleep',
      patterns: [/recovery.*poor/i, /overtrain/i, /rest.*needed/i],
      reason: 'Training load suggests recovery/sleep focus needed',
    },
    {
      fromAgents: ['nutrition'],
      toAgent: 'supplements',
      patterns: [/deficien/i, /low.*vitamin/i, /lack.*mineral/i],
      reason: 'Nutrition analysis suggests supplementation may help',
    },
  ];

  for (const pattern of handoffPatterns) {
    if (!pattern.fromAgents.includes(currentAgent)) continue;

    for (const regex of pattern.patterns) {
      if (regex.test(lowerResponse)) {
        return {
          fromAgent: currentAgent,
          toAgent: pattern.toAgent,
          reason: pattern.reason,
          sharedContext: discoveredInfo,
          priority: 'next_turn',
        };
      }
    }
  }

  return null;
}

// =============================================================================
// ROUTING CACHE (for repeated queries)
// =============================================================================

const routingCache = new Map<string, { decision: RoutingDecision; timestamp: number }>();
const CACHE_TTL_MS = 60000; // 1 minute

/**
 * Get cached routing decision or compute new one
 */
export function routeQueryCached(
  message: string,
  userContext: UserContext
): RoutingDecision {
  const cacheKey = `${message.toLowerCase().trim()}:${userContext.subscriptionTier}`;

  const cached = routingCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.decision;
  }

  const decision = routeQuery(message, userContext);
  routingCache.set(cacheKey, { decision, timestamp: Date.now() });

  // Clean old cache entries
  if (routingCache.size > 100) {
    const cutoff = Date.now() - CACHE_TTL_MS;
    for (const [key, value] of routingCache) {
      if (value.timestamp < cutoff) {
        routingCache.delete(key);
      }
    }
  }

  return decision;
}
