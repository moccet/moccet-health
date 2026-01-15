/**
 * Agent Hand-off Protocol
 *
 * Enables seamless transitions between specialized agents when queries
 * span multiple health domains. Manages context sharing, priority ordering,
 * and coherent multi-agent responses.
 */

// ============================================================================
// Types
// ============================================================================

export type AgentType =
  | 'health'
  | 'sleep'
  | 'nutrition'
  | 'fitness'
  | 'glucose'
  | 'stress'
  | 'recovery'
  | 'goals'
  | 'social'
  | 'general';

export type HandoffPriority = 'immediate' | 'next_turn' | 'background';
export type HandoffReason =
  | 'domain_expertise'
  | 'data_correlation'
  | 'user_request'
  | 'follow_up_needed'
  | 'conflicting_data'
  | 'multi_factor';

export interface AgentHandoff {
  id: string;
  fromAgent: AgentType;
  toAgent: AgentType;
  reason: HandoffReason;
  reasonDescription: string;
  priority: HandoffPriority;
  sharedContext: SharedContext;
  userQuery: string;
  timestamp: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  result?: HandoffResult;
}

export interface SharedContext {
  // Key findings from the originating agent
  findings: AgentFinding[];

  // Relevant data points to share
  dataPoints: DataPoint[];

  // Questions that need answering by the target agent
  pendingQuestions: string[];

  // Constraints or preferences discovered
  constraints: string[];

  // User's original intent
  userIntent: string;

  // Conversation context summary
  conversationSummary?: string;
}

export interface AgentFinding {
  type: 'observation' | 'correlation' | 'concern' | 'recommendation';
  content: string;
  confidence: number;
  relevantMetrics?: string[];
  requiresFollowUp: boolean;
}

export interface DataPoint {
  metric: string;
  value: number | string;
  unit?: string;
  timestamp?: string;
  trend?: 'improving' | 'stable' | 'declining';
  isAbnormal?: boolean;
}

export interface HandoffResult {
  success: boolean;
  response?: string;
  additionalFindings?: AgentFinding[];
  suggestNextHandoff?: AgentType;
  error?: string;
}

export interface MultiAgentResponse {
  primaryResponse: string;
  agentContributions: Array<{
    agent: AgentType;
    contribution: string;
    confidence: number;
  }>;
  synthesizedInsights: string[];
  conflictsResolved: string[];
  handoffChain: AgentHandoff[];
}

// ============================================================================
// Agent Domain Configuration
// ============================================================================

const AGENT_DOMAINS: Record<AgentType, {
  expertise: string[];
  dataAccess: string[];
  canHandoffTo: AgentType[];
  correlationPartners: AgentType[];
}> = {
  health: {
    expertise: ['general_health', 'vitals', 'symptoms', 'medications', 'checkups'],
    dataAccess: ['vitals', 'medications', 'symptoms', 'health_records'],
    canHandoffTo: ['sleep', 'nutrition', 'fitness', 'glucose', 'stress', 'recovery'],
    correlationPartners: ['sleep', 'nutrition', 'fitness'],
  },
  sleep: {
    expertise: ['sleep_quality', 'sleep_stages', 'circadian', 'insomnia', 'sleep_hygiene'],
    dataAccess: ['sleep_logs', 'hrv', 'resting_hr', 'sleep_stages'],
    canHandoffTo: ['health', 'stress', 'recovery', 'fitness'],
    correlationPartners: ['stress', 'recovery', 'fitness'],
  },
  nutrition: {
    expertise: ['diet', 'macros', 'meal_planning', 'supplements', 'hydration', 'food_logging'],
    dataAccess: ['meals', 'nutrition_logs', 'supplements', 'hydration'],
    canHandoffTo: ['glucose', 'fitness', 'health', 'goals'],
    correlationPartners: ['glucose', 'fitness', 'goals'],
  },
  fitness: {
    expertise: ['exercise', 'workouts', 'training', 'cardio', 'strength', 'activity'],
    dataAccess: ['workouts', 'activity', 'steps', 'active_minutes', 'calories'],
    canHandoffTo: ['nutrition', 'recovery', 'sleep', 'goals'],
    correlationPartners: ['nutrition', 'recovery', 'sleep'],
  },
  glucose: {
    expertise: ['blood_sugar', 'cgm', 'glycemic_response', 'insulin', 'metabolic_health'],
    dataAccess: ['glucose_readings', 'meals', 'activity'],
    canHandoffTo: ['nutrition', 'fitness', 'health'],
    correlationPartners: ['nutrition', 'fitness'],
  },
  stress: {
    expertise: ['stress_management', 'anxiety', 'mental_health', 'meditation', 'breathing'],
    dataAccess: ['hrv', 'stress_scores', 'mood_logs', 'meditation_logs'],
    canHandoffTo: ['sleep', 'recovery', 'health'],
    correlationPartners: ['sleep', 'recovery'],
  },
  recovery: {
    expertise: ['recovery_optimization', 'rest_days', 'overtraining', 'strain_balance'],
    dataAccess: ['recovery_scores', 'hrv', 'strain', 'sleep_logs'],
    canHandoffTo: ['fitness', 'sleep', 'stress'],
    correlationPartners: ['fitness', 'sleep', 'stress'],
  },
  goals: {
    expertise: ['goal_setting', 'habit_tracking', 'progress', 'motivation', 'planning'],
    dataAccess: ['goals', 'interventions', 'streaks', 'achievements'],
    canHandoffTo: ['fitness', 'nutrition', 'health'],
    correlationPartners: ['fitness', 'nutrition'],
  },
  social: {
    expertise: ['accountability', 'challenges', 'leaderboards', 'community', 'sharing'],
    dataAccess: ['social_connections', 'challenges', 'leaderboards'],
    canHandoffTo: ['goals', 'fitness'],
    correlationPartners: ['goals'],
  },
  general: {
    expertise: ['general_queries', 'app_help', 'data_export', 'settings'],
    dataAccess: ['all'],
    canHandoffTo: ['health', 'sleep', 'nutrition', 'fitness', 'glucose', 'stress', 'recovery', 'goals', 'social'],
    correlationPartners: [],
  },
};

// ============================================================================
// Handoff Detection Patterns
// ============================================================================

interface HandoffPattern {
  fromAgent: AgentType;
  toAgent: AgentType;
  triggers: RegExp[];
  correlationSignals: string[];
  reason: HandoffReason;
}

const HANDOFF_PATTERNS: HandoffPattern[] = [
  // Sleep -> Fitness: Training affecting sleep
  {
    fromAgent: 'sleep',
    toAgent: 'fitness',
    triggers: [
      /late.*workout/i,
      /exercise.*before.*bed/i,
      /training.*affecting.*sleep/i,
      /evening.*activity/i,
    ],
    correlationSignals: ['late_workout_detected', 'high_evening_strain'],
    reason: 'data_correlation',
  },
  // Sleep -> Stress: Stress affecting sleep
  {
    fromAgent: 'sleep',
    toAgent: 'stress',
    triggers: [
      /can't.*stop.*thinking/i,
      /anxious.*at.*night/i,
      /racing.*thoughts/i,
      /stress.*keeping.*awake/i,
    ],
    correlationSignals: ['elevated_evening_hrv', 'high_stress_score'],
    reason: 'data_correlation',
  },
  // Fitness -> Recovery: Overtraining signals
  {
    fromAgent: 'fitness',
    toAgent: 'recovery',
    triggers: [
      /feel.*tired/i,
      /not.*recovering/i,
      /performance.*declining/i,
      /should.*rest/i,
    ],
    correlationSignals: ['low_recovery_score', 'declining_hrv_trend'],
    reason: 'data_correlation',
  },
  // Nutrition -> Glucose: Blood sugar concerns
  {
    fromAgent: 'nutrition',
    toAgent: 'glucose',
    triggers: [
      /blood.*sugar/i,
      /glucose.*spike/i,
      /glycemic/i,
      /after.*eating/i,
    ],
    correlationSignals: ['glucose_spike_after_meal', 'high_glycemic_variability'],
    reason: 'domain_expertise',
  },
  // Glucose -> Nutrition: Meal recommendations
  {
    fromAgent: 'glucose',
    toAgent: 'nutrition',
    triggers: [
      /what.*eat/i,
      /meal.*plan/i,
      /food.*recommendations/i,
      /better.*choices/i,
    ],
    correlationSignals: ['needs_dietary_guidance'],
    reason: 'follow_up_needed',
  },
  // Health -> Sleep: Sleep-related health issues
  {
    fromAgent: 'health',
    toAgent: 'sleep',
    triggers: [
      /tired.*all.*day/i,
      /fatigue/i,
      /no.*energy/i,
      /sleep.*apnea/i,
    ],
    correlationSignals: ['poor_sleep_score', 'fragmented_sleep'],
    reason: 'domain_expertise',
  },
  // Fitness -> Nutrition: Fueling questions
  {
    fromAgent: 'fitness',
    toAgent: 'nutrition',
    triggers: [
      /what.*eat.*before/i,
      /post.*workout.*meal/i,
      /protein.*needs/i,
      /fuel.*training/i,
    ],
    correlationSignals: ['high_training_load'],
    reason: 'follow_up_needed',
  },
  // Recovery -> Sleep: Rest optimization
  {
    fromAgent: 'recovery',
    toAgent: 'sleep',
    triggers: [
      /how.*recover.*faster/i,
      /sleep.*for.*recovery/i,
      /rest.*better/i,
    ],
    correlationSignals: ['sleep_affecting_recovery'],
    reason: 'data_correlation',
  },
  // Goals -> Fitness/Nutrition: Implementation help
  {
    fromAgent: 'goals',
    toAgent: 'fitness',
    triggers: [
      /how.*achieve.*fitness/i,
      /workout.*plan.*for/i,
      /exercise.*goal/i,
    ],
    correlationSignals: ['fitness_goal_active'],
    reason: 'follow_up_needed',
  },
  {
    fromAgent: 'goals',
    toAgent: 'nutrition',
    triggers: [
      /diet.*goal/i,
      /nutrition.*plan/i,
      /eating.*target/i,
    ],
    correlationSignals: ['nutrition_goal_active'],
    reason: 'follow_up_needed',
  },
];

// ============================================================================
// Core Functions
// ============================================================================

function generateHandoffId(): string {
  return `handoff_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Detect if a handoff is needed based on agent response and discovered information
 */
export function detectHandoffNeed(
  currentAgent: AgentType,
  agentResponse: string,
  discoveredInfo: Record<string, unknown>,
  userQuery: string
): AgentHandoff | null {
  const agentConfig = AGENT_DOMAINS[currentAgent];

  // Check pattern-based triggers
  for (const pattern of HANDOFF_PATTERNS) {
    if (pattern.fromAgent !== currentAgent) continue;

    // Check if any trigger matches the response or query
    const textToCheck = `${agentResponse} ${userQuery}`.toLowerCase();
    const triggerMatched = pattern.triggers.some(trigger => trigger.test(textToCheck));

    // Check correlation signals in discovered info
    const correlationMatched = pattern.correlationSignals.some(signal =>
      discoveredInfo[signal] !== undefined
    );

    if (triggerMatched || correlationMatched) {
      // Build shared context from discovered info
      const sharedContext = buildSharedContext(
        currentAgent,
        pattern.toAgent,
        agentResponse,
        discoveredInfo,
        userQuery
      );

      return {
        id: generateHandoffId(),
        fromAgent: currentAgent,
        toAgent: pattern.toAgent,
        reason: pattern.reason,
        reasonDescription: getReasonDescription(pattern.reason, currentAgent, pattern.toAgent),
        priority: determinePriority(pattern.reason, discoveredInfo),
        sharedContext,
        userQuery,
        timestamp: new Date().toISOString(),
        status: 'pending',
      };
    }
  }

  // Check for explicit domain mentions that suggest handoff
  const explicitHandoff = detectExplicitDomainMention(currentAgent, userQuery, agentResponse);
  if (explicitHandoff) {
    return explicitHandoff;
  }

  return null;
}

/**
 * Detect explicit mentions of other domains in the query
 */
function detectExplicitDomainMention(
  currentAgent: AgentType,
  userQuery: string,
  agentResponse: string
): AgentHandoff | null {
  const domainKeywords: Record<AgentType, string[]> = {
    sleep: ['sleep', 'bed', 'wake', 'insomnia', 'tired', 'rest'],
    nutrition: ['eat', 'food', 'meal', 'diet', 'nutrition', 'calories'],
    fitness: ['workout', 'exercise', 'training', 'gym', 'run', 'lift'],
    glucose: ['glucose', 'blood sugar', 'cgm', 'insulin', 'diabetic'],
    stress: ['stress', 'anxiety', 'overwhelmed', 'meditation', 'calm'],
    recovery: ['recovery', 'recover', 'strain', 'overtraining'],
    goals: ['goal', 'target', 'achieve', 'habit', 'streak'],
    social: ['friend', 'challenge', 'compete', 'leaderboard'],
    health: ['health', 'doctor', 'medication', 'symptom'],
    general: [],
  };

  const query = userQuery.toLowerCase();
  const agentConfig = AGENT_DOMAINS[currentAgent];

  for (const [agent, keywords] of Object.entries(domainKeywords)) {
    if (agent === currentAgent) continue;
    if (!agentConfig.canHandoffTo.includes(agent as AgentType)) continue;

    const mentionCount = keywords.filter(kw => query.includes(kw)).length;
    if (mentionCount >= 2) {
      return {
        id: generateHandoffId(),
        fromAgent: currentAgent,
        toAgent: agent as AgentType,
        reason: 'domain_expertise',
        reasonDescription: `Query involves ${agent} domain expertise`,
        priority: 'immediate',
        sharedContext: {
          findings: [],
          dataPoints: [],
          pendingQuestions: [userQuery],
          constraints: [],
          userIntent: userQuery,
        },
        userQuery,
        timestamp: new Date().toISOString(),
        status: 'pending',
      };
    }
  }

  return null;
}

/**
 * Build shared context for handoff
 */
function buildSharedContext(
  fromAgent: AgentType,
  toAgent: AgentType,
  agentResponse: string,
  discoveredInfo: Record<string, unknown>,
  userQuery: string
): SharedContext {
  const findings: AgentFinding[] = [];
  const dataPoints: DataPoint[] = [];
  const pendingQuestions: string[] = [];
  const constraints: string[] = [];

  // Extract findings from discovered info
  if (discoveredInfo.findings && Array.isArray(discoveredInfo.findings)) {
    findings.push(...(discoveredInfo.findings as AgentFinding[]));
  }

  // Extract relevant metrics
  const metricKeys = ['sleep_score', 'recovery_score', 'hrv', 'steps', 'glucose_avg', 'strain'];
  for (const key of metricKeys) {
    if (discoveredInfo[key] !== undefined) {
      dataPoints.push({
        metric: key,
        value: discoveredInfo[key] as number | string,
        isAbnormal: (discoveredInfo[`${key}_abnormal`] as boolean) || false,
      });
    }
  }

  // Extract constraints
  if (discoveredInfo.dietary_restrictions) {
    constraints.push(`Dietary: ${discoveredInfo.dietary_restrictions}`);
  }
  if (discoveredInfo.injury) {
    constraints.push(`Injury: ${discoveredInfo.injury}`);
  }
  if (discoveredInfo.medical_conditions) {
    constraints.push(`Medical: ${discoveredInfo.medical_conditions}`);
  }

  // Generate pending questions based on handoff type
  const toAgentConfig = AGENT_DOMAINS[toAgent];
  if (toAgentConfig.expertise.length > 0) {
    pendingQuestions.push(
      `How does ${toAgentConfig.expertise[0]} relate to the user's concern?`
    );
  }

  return {
    findings,
    dataPoints,
    pendingQuestions,
    constraints,
    userIntent: userQuery,
    conversationSummary: agentResponse.slice(0, 500),
  };
}

/**
 * Determine handoff priority
 */
function determinePriority(
  reason: HandoffReason,
  discoveredInfo: Record<string, unknown>
): HandoffPriority {
  // Immediate for user requests or conflicting data
  if (reason === 'user_request' || reason === 'conflicting_data') {
    return 'immediate';
  }

  // Immediate if abnormal values detected
  const hasAbnormal = Object.keys(discoveredInfo).some(key =>
    key.endsWith('_abnormal') && discoveredInfo[key] === true
  );
  if (hasAbnormal) {
    return 'immediate';
  }

  // Next turn for correlations and follow-ups
  if (reason === 'data_correlation' || reason === 'follow_up_needed') {
    return 'next_turn';
  }

  return 'background';
}

/**
 * Get human-readable reason description
 */
function getReasonDescription(
  reason: HandoffReason,
  fromAgent: AgentType,
  toAgent: AgentType
): string {
  switch (reason) {
    case 'domain_expertise':
      return `${toAgent} agent has specialized knowledge needed for this query`;
    case 'data_correlation':
      return `Found correlation between ${fromAgent} and ${toAgent} data`;
    case 'user_request':
      return `User explicitly requested ${toAgent} related information`;
    case 'follow_up_needed':
      return `${toAgent} agent can provide actionable follow-up`;
    case 'conflicting_data':
      return `Need ${toAgent} perspective to resolve conflicting information`;
    case 'multi_factor':
      return `Query spans multiple domains including ${toAgent}`;
    default:
      return `Handoff to ${toAgent} agent`;
  }
}

// ============================================================================
// Multi-Agent Coordination
// ============================================================================

/**
 * Plan multi-agent response for complex queries
 */
export function planMultiAgentResponse(
  userQuery: string,
  primaryAgent: AgentType,
  availableContext: Record<string, unknown>
): {
  agents: AgentType[];
  sequence: 'parallel' | 'sequential';
  coordinationStrategy: string;
} {
  const queryLower = userQuery.toLowerCase();
  const involvedAgents: Set<AgentType> = new Set([primaryAgent]);

  // Detect all domains mentioned
  const domainDetection: Record<AgentType, string[]> = {
    sleep: ['sleep', 'tired', 'rest', 'wake', 'bed'],
    nutrition: ['eat', 'food', 'diet', 'meal', 'nutrition'],
    fitness: ['workout', 'exercise', 'train', 'gym', 'run'],
    glucose: ['glucose', 'sugar', 'cgm'],
    stress: ['stress', 'anxious', 'overwhelm'],
    recovery: ['recover', 'strain', 'overtrain'],
    goals: ['goal', 'target', 'habit'],
    social: ['friend', 'challenge', 'compete'],
    health: ['health', 'doctor', 'medical'],
    general: [],
  };

  for (const [agent, keywords] of Object.entries(domainDetection)) {
    if (keywords.some(kw => queryLower.includes(kw))) {
      involvedAgents.add(agent as AgentType);
    }
  }

  const agents = Array.from(involvedAgents);

  // Determine sequence
  let sequence: 'parallel' | 'sequential' = 'parallel';
  let coordinationStrategy = 'Gather insights from all agents simultaneously';

  // Sequential if there are dependencies
  if (agents.includes('glucose') && agents.includes('nutrition')) {
    sequence = 'sequential';
    coordinationStrategy = 'Analyze glucose data first, then get nutrition recommendations';
  } else if (agents.includes('recovery') && agents.includes('fitness')) {
    sequence = 'sequential';
    coordinationStrategy = 'Check recovery status first, then adjust fitness recommendations';
  } else if (agents.length > 3) {
    sequence = 'sequential';
    coordinationStrategy = 'Process agents in priority order to maintain coherence';
  }

  return { agents, sequence, coordinationStrategy };
}

/**
 * Synthesize responses from multiple agents
 */
export function synthesizeMultiAgentResponse(
  contributions: Array<{
    agent: AgentType;
    response: string;
    findings: AgentFinding[];
  }>,
  userQuery: string
): MultiAgentResponse {
  const primaryResponse = contributions[0]?.response || '';
  const agentContributions = contributions.map(c => ({
    agent: c.agent,
    contribution: c.response,
    confidence: 0.8, // Could be calculated based on data availability
  }));

  // Extract insights
  const synthesizedInsights: string[] = [];
  const allFindings = contributions.flatMap(c => c.findings);

  // Group findings by type
  const correlations = allFindings.filter(f => f.type === 'correlation');
  const concerns = allFindings.filter(f => f.type === 'concern');
  const recommendations = allFindings.filter(f => f.type === 'recommendation');

  if (correlations.length > 0) {
    synthesizedInsights.push(
      `Found ${correlations.length} cross-domain correlation(s): ${correlations.map(c => c.content).join('; ')}`
    );
  }

  if (concerns.length > 0) {
    synthesizedInsights.push(
      `Key concerns identified: ${concerns.map(c => c.content).join('; ')}`
    );
  }

  // Detect and note conflicts
  const conflictsResolved: string[] = [];
  // Simple conflict detection: contradicting recommendations
  for (let i = 0; i < recommendations.length; i++) {
    for (let j = i + 1; j < recommendations.length; j++) {
      if (areConflicting(recommendations[i], recommendations[j])) {
        conflictsResolved.push(
          `Resolved conflict between ${recommendations[i].content} and ${recommendations[j].content}`
        );
      }
    }
  }

  return {
    primaryResponse,
    agentContributions,
    synthesizedInsights,
    conflictsResolved,
    handoffChain: [],
  };
}

/**
 * Check if two findings conflict
 */
function areConflicting(finding1: AgentFinding, finding2: AgentFinding): boolean {
  const content1 = finding1.content.toLowerCase();
  const content2 = finding2.content.toLowerCase();

  // Simple heuristic: check for opposing action words
  const opposites = [
    ['increase', 'decrease'],
    ['more', 'less'],
    ['add', 'reduce'],
    ['start', 'stop'],
    ['higher', 'lower'],
  ];

  for (const [word1, word2] of opposites) {
    if ((content1.includes(word1) && content2.includes(word2)) ||
        (content1.includes(word2) && content2.includes(word1))) {
      // Check if they're about the same topic
      const words1 = new Set(content1.split(/\s+/));
      const words2 = new Set(content2.split(/\s+/));
      const overlap = Array.from(words1).filter(w => words2.has(w) && w.length > 4);
      if (overlap.length > 0) {
        return true;
      }
    }
  }

  return false;
}

// ============================================================================
// Handoff Execution
// ============================================================================

/**
 * Execute a handoff by preparing context for the target agent
 */
export function prepareHandoffPrompt(handoff: AgentHandoff): string {
  const lines = [
    `## Handoff Context from ${handoff.fromAgent} Agent`,
    '',
    `**Reason**: ${handoff.reasonDescription}`,
    `**User Query**: ${handoff.userQuery}`,
    '',
  ];

  if (handoff.sharedContext.findings.length > 0) {
    lines.push('### Key Findings');
    for (const finding of handoff.sharedContext.findings) {
      const icon = finding.type === 'concern' ? '⚠️' :
                   finding.type === 'correlation' ? '🔗' :
                   finding.type === 'recommendation' ? '💡' : 'ℹ️';
      lines.push(`${icon} ${finding.content} (${Math.round(finding.confidence * 100)}% confidence)`);
    }
    lines.push('');
  }

  if (handoff.sharedContext.dataPoints.length > 0) {
    lines.push('### Relevant Data');
    for (const dp of handoff.sharedContext.dataPoints) {
      const flag = dp.isAbnormal ? ' ⚠️' : '';
      lines.push(`- ${dp.metric}: ${dp.value}${dp.unit ? ` ${dp.unit}` : ''}${flag}`);
    }
    lines.push('');
  }

  if (handoff.sharedContext.constraints.length > 0) {
    lines.push('### Constraints');
    for (const constraint of handoff.sharedContext.constraints) {
      lines.push(`- ${constraint}`);
    }
    lines.push('');
  }

  if (handoff.sharedContext.pendingQuestions.length > 0) {
    lines.push('### Questions to Address');
    for (const q of handoff.sharedContext.pendingQuestions) {
      lines.push(`- ${q}`);
    }
    lines.push('');
  }

  lines.push('Please provide your specialized perspective considering the above context.');

  return lines.join('\n');
}

/**
 * Format handoff chain for logging/debugging
 */
export function formatHandoffChain(handoffs: AgentHandoff[]): string {
  if (handoffs.length === 0) return 'No handoffs';

  const chain = handoffs.map((h, i) =>
    `${i + 1}. ${h.fromAgent} → ${h.toAgent} (${h.reason})`
  ).join('\n');

  return `Handoff Chain:\n${chain}`;
}

// ============================================================================
// Exports
// ============================================================================

export {
  AGENT_DOMAINS,
  HANDOFF_PATTERNS,
};
