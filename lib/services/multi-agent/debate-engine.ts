/**
 * Multi-Round Debate Engine
 *
 * Implements a structured debate protocol for resolving conflicts between agents:
 *
 * ROUND 1 - Position Statement: Each agent states their core position
 * ROUND 2 - Evidence Presentation: Each agent presents supporting evidence
 * ROUND 3 - Rebuttal: Each agent responds to the other's arguments
 * ROUND 4 - Final Arguments: Last chance to strengthen position or offer compromise
 *
 * Features:
 * - Argument tracking with strength scores
 * - Evidence quality assessment
 * - Rebuttal effectiveness scoring
 * - Moderator synthesis after each round
 * - Historical context integration
 * - Final resolution with confidence scoring
 */

import OpenAI from 'openai';
import { HistoricalContext } from './agent-memory';

// ============================================================================
// TYPES
// ============================================================================

export type RoundType = 'position' | 'evidence' | 'rebuttal' | 'final';

export interface Argument {
  id: string;
  content: string;
  strength: number; // 0-1
  supportedBy: string[]; // Evidence IDs
  weakenedBy: string[]; // Rebuttal IDs
  status: 'standing' | 'weakened' | 'conceded' | 'strengthened';
}

export interface Evidence {
  id: string;
  content: string;
  source: string;
  quality: 'strong' | 'moderate' | 'weak' | 'anecdotal';
  relevance: number; // 0-1
  contested: boolean;
}

export interface Rebuttal {
  id: string;
  targetArgumentId: string;
  content: string;
  effectiveness: number; // 0-1
  type: 'direct_counter' | 'evidence_challenge' | 'scope_limitation' | 'alternative_interpretation';
}

export interface AgentDebateState {
  name: string;
  domain: string;
  position: string;
  arguments: Argument[];
  evidence: Evidence[];
  rebuttals: Rebuttal[];
  currentConfidence: number;
  concessionsGiven: string[];
  agreementsFound: string[];
}

export interface DebateRound {
  roundNumber: 1 | 2 | 3 | 4;
  roundType: RoundType;
  agentAResponse: AgentRoundResponse;
  agentBResponse: AgentRoundResponse;
  moderatorSummary: ModeratorSummary;
  stateAfterRound: {
    agentA: AgentDebateState;
    agentB: AgentDebateState;
  };
}

export interface AgentRoundResponse {
  content: string;
  newArguments?: Argument[];
  newEvidence?: Evidence[];
  newRebuttals?: Rebuttal[];
  concessions?: string[];
  proposedCompromise?: string;
}

export interface ModeratorSummary {
  roundSummary: string;
  keyPoints: string[];
  areasOfAgreement: string[];
  remainingDisputes: string[];
  suggestedDirection: string;
  confidenceShift: {
    agentA: number; // Delta
    agentB: number; // Delta
  };
}

export interface DebateConflict {
  id: string;
  type: 'contradiction' | 'resource_competition' | 'priority_clash' | 'causal_disagreement';
  severity: 'blocking' | 'significant' | 'minor';
  agentA: {
    name: string;
    domain: string;
    position: string;
    evidence: string[];
    confidence: number;
  };
  agentB: {
    name: string;
    domain: string;
    position: string;
    evidence: string[];
    confidence: number;
  };
  context?: string;
}

export interface DebateResolution {
  conflictId: string;
  originalPositions: {
    agentA: string;
    agentB: string;
  };
  resolution: string;
  compromiseType: 'full_merge' | 'time_split' | 'priority_override' | 'conditional';
  confidenceInResolution: number;
  reasoning: string;
  rounds: DebateRound[];
  finalScores: {
    agentAFinalConfidence: number;
    agentBFinalConfidence: number;
    argumentsStanding: { agentA: number; agentB: number };
    evidenceQuality: { agentA: number; agentB: number };
    concessionsMade: { agentA: number; agentB: number };
  };
  debateQuality: 'high' | 'medium' | 'low';
  totalApiCalls: number;
}

export interface DebateConfig {
  maxRounds: 2 | 3 | 4;
  enableModerator: boolean;
  earlyResolutionThreshold: number; // If agents agree on this much, end early
  minArgumentStrength: number; // Below this, argument is considered weak
  useHistoricalContext: boolean;
}

const DEFAULT_CONFIG: DebateConfig = {
  maxRounds: 4,
  enableModerator: true,
  earlyResolutionThreshold: 0.8,
  minArgumentStrength: 0.3,
  useHistoricalContext: true,
};

// ============================================================================
// DEBATE ENGINE
// ============================================================================

export class DebateEngine {
  private openai: OpenAI;
  private config: DebateConfig;

  constructor(openai: OpenAI, config: Partial<DebateConfig> = {}) {
    this.openai = openai;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Run a full multi-round debate to resolve a conflict
   */
  async runDebate(
    conflict: DebateConflict,
    historicalContext?: HistoricalContext | null
  ): Promise<DebateResolution> {
    console.log(`[DebateEngine] Starting debate for conflict: ${conflict.id}`);
    console.log(`[DebateEngine] ${conflict.agentA.name} vs ${conflict.agentB.name}`);

    const rounds: DebateRound[] = [];
    let apiCalls = 0;

    // Initialize agent states
    let agentAState = this.initializeAgentState(conflict.agentA);
    let agentBState = this.initializeAgentState(conflict.agentB);

    // Build historical context for prompts
    const historyContext = this.buildHistoricalContext(historicalContext);

    // Run rounds
    const roundTypes: RoundType[] = ['position', 'evidence', 'rebuttal', 'final'];

    for (let i = 0; i < this.config.maxRounds; i++) {
      const roundType = roundTypes[i];
      const roundNumber = (i + 1) as 1 | 2 | 3 | 4;

      console.log(`[DebateEngine] Round ${roundNumber}: ${roundType}`);

      // Get responses from both agents
      const [agentAResponse, agentBResponse] = await Promise.all([
        this.getAgentResponse(agentAState, agentBState, roundType, rounds, historyContext),
        this.getAgentResponse(agentBState, agentAState, roundType, rounds, historyContext),
      ]);
      apiCalls += 2;

      // Update agent states based on responses
      agentAState = this.updateAgentState(agentAState, agentAResponse, agentBResponse);
      agentBState = this.updateAgentState(agentBState, agentBResponse, agentAResponse);

      // Get moderator summary
      let moderatorSummary: ModeratorSummary;
      if (this.config.enableModerator) {
        moderatorSummary = await this.getModeratorSummary(
          roundType,
          roundNumber,
          agentAState,
          agentBState,
          agentAResponse,
          agentBResponse
        );
        apiCalls++;
      } else {
        moderatorSummary = this.createSimpleModeratorSummary(roundType, agentAState, agentBState);
      }

      // Apply confidence shifts from moderator
      agentAState.currentConfidence = Math.max(0.1, Math.min(0.99,
        agentAState.currentConfidence + moderatorSummary.confidenceShift.agentA
      ));
      agentBState.currentConfidence = Math.max(0.1, Math.min(0.99,
        agentBState.currentConfidence + moderatorSummary.confidenceShift.agentB
      ));

      const round: DebateRound = {
        roundNumber,
        roundType,
        agentAResponse,
        agentBResponse,
        moderatorSummary,
        stateAfterRound: {
          agentA: { ...agentAState },
          agentB: { ...agentBState },
        },
      };
      rounds.push(round);

      // Check for early resolution
      if (this.checkEarlyResolution(moderatorSummary, agentAState, agentBState)) {
        console.log(`[DebateEngine] Early resolution detected after round ${roundNumber}`);
        break;
      }
    }

    // Generate final resolution
    const resolution = await this.generateFinalResolution(
      conflict,
      rounds,
      agentAState,
      agentBState,
      historyContext
    );
    apiCalls++;

    console.log(`[DebateEngine] Debate complete: ${resolution.compromiseType}`);
    console.log(`[DebateEngine] Resolution confidence: ${(resolution.confidenceInResolution * 100).toFixed(0)}%`);

    return {
      ...resolution,
      rounds,
      totalApiCalls: apiCalls,
    };
  }

  /**
   * Initialize agent debate state from conflict data
   */
  private initializeAgentState(agent: DebateConflict['agentA']): AgentDebateState {
    return {
      name: agent.name,
      domain: agent.domain,
      position: agent.position,
      arguments: [{
        id: `${agent.name}_initial_arg`,
        content: agent.position,
        strength: agent.confidence,
        supportedBy: [],
        weakenedBy: [],
        status: 'standing',
      }],
      evidence: agent.evidence.map((e, i) => ({
        id: `${agent.name}_evidence_${i}`,
        content: e,
        source: agent.domain,
        quality: 'moderate' as const,
        relevance: 0.7,
        contested: false,
      })),
      rebuttals: [],
      currentConfidence: agent.confidence,
      concessionsGiven: [],
      agreementsFound: [],
    };
  }

  /**
   * Build historical context string for prompts
   */
  private buildHistoricalContext(historicalContext?: HistoricalContext | null): string {
    if (!historicalContext || !this.config.useHistoricalContext) {
      return '';
    }

    const parts: string[] = [];

    // Add past successful resolutions
    const relevantDebates = historicalContext.recentDebates.filter(d =>
      d.userAccepted === true
    );
    if (relevantDebates.length > 0) {
      parts.push('\nPAST SUCCESSFUL RESOLUTIONS FOR THIS USER:');
      for (const debate of relevantDebates.slice(0, 3)) {
        parts.push(`- ${debate.conflictType}: "${debate.resolution.slice(0, 100)}..." (${debate.userAccepted ? 'accepted' : 'rejected'})`);
      }
    }

    // Add domain priorities
    if (historicalContext.domainPriorities) {
      const priorities = Object.entries(historicalContext.domainPriorities)
        .sort((a, b) => b[1] - a[1]);
      if (priorities.length > 0) {
        parts.push('\nUSER DOMAIN PRIORITIES:');
        for (const [domain, priority] of priorities) {
          const level = priority > 0.6 ? 'HIGH' : priority > 0.4 ? 'MEDIUM' : 'LOW';
          parts.push(`- ${domain}: ${level} priority`);
        }
      }
    }

    // Add learned patterns
    if (historicalContext.learnedPatterns.length > 0) {
      parts.push('\nLEARNED PATTERNS:');
      for (const pattern of historicalContext.learnedPatterns.slice(0, 3)) {
        parts.push(`- ${pattern.patternType}: ${pattern.patternKey} (confidence: ${(pattern.confidence * 100).toFixed(0)}%)`);
      }
    }

    return parts.join('\n');
  }

  /**
   * Get agent response for a specific round
   */
  private async getAgentResponse(
    agentState: AgentDebateState,
    opponentState: AgentDebateState,
    roundType: RoundType,
    previousRounds: DebateRound[],
    historyContext: string
  ): Promise<AgentRoundResponse> {
    const prompt = this.buildAgentPrompt(agentState, opponentState, roundType, previousRounds, historyContext);

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are ${agentState.name}, representing the ${agentState.domain} domain in a structured debate.

Your position: ${agentState.position}

Your job is to:
1. Advocate for your domain's perspective based on data and evidence
2. Respond thoughtfully to opponent's arguments
3. Identify areas of genuine agreement
4. Propose practical compromises when appropriate

Be respectful but firm. Concede points when the evidence warrants it.
The user's overall wellbeing is the ultimate goal - not winning the debate.`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5,
      max_tokens: 800,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    return {
      content: parsed.response || 'No response provided',
      newArguments: this.parseArguments(parsed.newArguments, agentState.name),
      newEvidence: this.parseEvidence(parsed.newEvidence, agentState.name),
      newRebuttals: this.parseRebuttals(parsed.rebuttals, agentState.name),
      concessions: parsed.concessions || [],
      proposedCompromise: parsed.proposedCompromise,
    };
  }

  /**
   * Build prompt for agent based on round type
   */
  private buildAgentPrompt(
    agentState: AgentDebateState,
    opponentState: AgentDebateState,
    roundType: RoundType,
    previousRounds: DebateRound[],
    historyContext: string
  ): string {
    const parts: string[] = [];

    // Add round-specific instructions
    switch (roundType) {
      case 'position':
        parts.push(`ROUND 1: POSITION STATEMENT
State your core position clearly and concisely.
Explain WHY this matters for the user's health and wellbeing.`);
        break;

      case 'evidence':
        parts.push(`ROUND 2: EVIDENCE PRESENTATION
Present your strongest supporting evidence.
Use specific data points, metrics, and facts.
Explain how each piece of evidence supports your position.`);
        break;

      case 'rebuttal':
        parts.push(`ROUND 3: REBUTTAL
Address your opponent's arguments directly.
Challenge weak evidence or flawed reasoning.
Acknowledge valid points they've made.
Identify areas where you could find middle ground.`);
        break;

      case 'final':
        parts.push(`ROUND 4: FINAL ARGUMENTS
This is your last chance to strengthen your position.
Summarize your strongest points.
Propose a specific compromise that addresses both domains.
The compromise should be actionable and specific.`);
        break;
    }

    // Add current state
    parts.push(`\nYOUR CURRENT STATE:
- Confidence: ${(agentState.currentConfidence * 100).toFixed(0)}%
- Arguments standing: ${agentState.arguments.filter(a => a.status === 'standing').length}
- Evidence pieces: ${agentState.evidence.length}
- Concessions given: ${agentState.concessionsGiven.length}`);

    // Add opponent's position and recent arguments
    parts.push(`\nOPPONENT (${opponentState.name}):
Position: ${opponentState.position}
Confidence: ${(opponentState.currentConfidence * 100).toFixed(0)}%`);

    if (previousRounds.length > 0) {
      const lastRound = previousRounds[previousRounds.length - 1];
      const opponentResponse = lastRound.agentAResponse.content === agentState.name
        ? lastRound.agentBResponse
        : lastRound.agentAResponse;
      parts.push(`Last statement: "${opponentResponse.content}"`);

      if (lastRound.moderatorSummary.areasOfAgreement.length > 0) {
        parts.push(`\nAreas of agreement found:
${lastRound.moderatorSummary.areasOfAgreement.map(a => `- ${a}`).join('\n')}`);
      }
    }

    // Add history context
    if (historyContext) {
      parts.push(`\n${historyContext}`);
    }

    // Add response format
    parts.push(`\nRespond with JSON:
{
  "response": "Your ${roundType} statement",
  "newArguments": [{"content": "argument text", "strength": 0.0-1.0}],
  "newEvidence": [{"content": "evidence text", "source": "data source", "quality": "strong|moderate|weak"}],
  "rebuttals": [{"targetArgument": "what you're rebutting", "content": "your rebuttal", "type": "direct_counter|evidence_challenge|scope_limitation"}],
  "concessions": ["any points you concede"],
  "proposedCompromise": "optional compromise proposal"
}`);

    return parts.join('\n');
  }

  /**
   * Get moderator summary for a round
   */
  private async getModeratorSummary(
    roundType: RoundType,
    roundNumber: number,
    agentAState: AgentDebateState,
    agentBState: AgentDebateState,
    agentAResponse: AgentRoundResponse,
    agentBResponse: AgentRoundResponse
  ): Promise<ModeratorSummary> {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a neutral moderator summarizing a debate round between health optimization agents.

Your job is to:
1. Summarize what each side said
2. Identify areas of agreement
3. Note remaining disputes
4. Assess how each side's confidence should shift based on the round

Be objective. The goal is helping find the best outcome for the user.`,
        },
        {
          role: 'user',
          content: `ROUND ${roundNumber}: ${roundType.toUpperCase()}

${agentAState.name} (${agentAState.domain}):
"${agentAResponse.content}"
${agentAResponse.concessions?.length ? `Concessions: ${agentAResponse.concessions.join(', ')}` : ''}
${agentAResponse.proposedCompromise ? `Proposed compromise: ${agentAResponse.proposedCompromise}` : ''}

${agentBState.name} (${agentBState.domain}):
"${agentBResponse.content}"
${agentBResponse.concessions?.length ? `Concessions: ${agentBResponse.concessions.join(', ')}` : ''}
${agentBResponse.proposedCompromise ? `Proposed compromise: ${agentBResponse.proposedCompromise}` : ''}

Summarize this round and assess confidence shifts.

Return JSON:
{
  "roundSummary": "2-3 sentence summary",
  "keyPoints": ["key point 1", "key point 2"],
  "areasOfAgreement": ["any agreements found"],
  "remainingDisputes": ["still unresolved"],
  "suggestedDirection": "how the debate should proceed",
  "confidenceShift": {
    "agentA": -0.1 to +0.1 (shift based on round performance),
    "agentB": -0.1 to +0.1
  }
}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    return {
      roundSummary: parsed.roundSummary || 'Round completed',
      keyPoints: parsed.keyPoints || [],
      areasOfAgreement: parsed.areasOfAgreement || [],
      remainingDisputes: parsed.remainingDisputes || [],
      suggestedDirection: parsed.suggestedDirection || '',
      confidenceShift: {
        agentA: this.clampConfidenceShift(parsed.confidenceShift?.agentA || 0),
        agentB: this.clampConfidenceShift(parsed.confidenceShift?.agentB || 0),
      },
    };
  }

  /**
   * Create simple moderator summary without AI call
   */
  private createSimpleModeratorSummary(
    roundType: RoundType,
    agentAState: AgentDebateState,
    agentBState: AgentDebateState
  ): ModeratorSummary {
    return {
      roundSummary: `Round ${roundType} completed`,
      keyPoints: [],
      areasOfAgreement: [],
      remainingDisputes: [agentAState.position, agentBState.position],
      suggestedDirection: 'Continue debate',
      confidenceShift: { agentA: 0, agentB: 0 },
    };
  }

  /**
   * Update agent state based on round responses
   */
  private updateAgentState(
    agentState: AgentDebateState,
    ownResponse: AgentRoundResponse,
    opponentResponse: AgentRoundResponse
  ): AgentDebateState {
    const updated = { ...agentState };

    // Add new arguments
    if (ownResponse.newArguments) {
      updated.arguments = [...updated.arguments, ...ownResponse.newArguments];
    }

    // Add new evidence
    if (ownResponse.newEvidence) {
      updated.evidence = [...updated.evidence, ...ownResponse.newEvidence];
    }

    // Add rebuttals given
    if (ownResponse.newRebuttals) {
      updated.rebuttals = [...updated.rebuttals, ...ownResponse.newRebuttals];
    }

    // Track concessions
    if (ownResponse.concessions) {
      updated.concessionsGiven = [...updated.concessionsGiven, ...ownResponse.concessions];
    }

    // Process opponent's rebuttals against our arguments
    if (opponentResponse.newRebuttals) {
      for (const rebuttal of opponentResponse.newRebuttals) {
        // Find matching argument and weaken it
        for (const arg of updated.arguments) {
          if (arg.content.toLowerCase().includes(rebuttal.targetArgumentId?.toLowerCase() || '')) {
            arg.weakenedBy.push(rebuttal.id);
            arg.strength = Math.max(0.1, arg.strength - rebuttal.effectiveness * 0.2);
            if (arg.strength < this.config.minArgumentStrength) {
              arg.status = 'weakened';
            }
          }
        }
      }
    }

    return updated;
  }

  /**
   * Check if early resolution is possible
   */
  private checkEarlyResolution(
    moderatorSummary: ModeratorSummary,
    agentAState: AgentDebateState,
    agentBState: AgentDebateState
  ): boolean {
    // Check if there's significant agreement
    const agreementCount = moderatorSummary.areasOfAgreement.length;
    const disputeCount = moderatorSummary.remainingDisputes.length;

    if (agreementCount >= 2 && disputeCount <= 1) {
      return true;
    }

    // Check if one agent has clearly conceded
    if (agentAState.concessionsGiven.length >= 2 || agentBState.concessionsGiven.length >= 2) {
      return true;
    }

    // Check if confidence gap is too large (one side clearly winning)
    const confidenceGap = Math.abs(agentAState.currentConfidence - agentBState.currentConfidence);
    if (confidenceGap > 0.4) {
      return true;
    }

    return false;
  }

  /**
   * Generate final resolution based on debate
   */
  private async generateFinalResolution(
    conflict: DebateConflict,
    rounds: DebateRound[],
    agentAState: AgentDebateState,
    agentBState: AgentDebateState,
    historyContext: string
  ): Promise<Omit<DebateResolution, 'rounds' | 'totalApiCalls'>> {
    // Collect all agreements and compromises proposed
    const allAgreements: string[] = [];
    const allCompromises: string[] = [];

    for (const round of rounds) {
      allAgreements.push(...round.moderatorSummary.areasOfAgreement);
      if (round.agentAResponse.proposedCompromise) {
        allCompromises.push(round.agentAResponse.proposedCompromise);
      }
      if (round.agentBResponse.proposedCompromise) {
        allCompromises.push(round.agentBResponse.proposedCompromise);
      }
    }

    // Calculate final scores
    const finalScores = {
      agentAFinalConfidence: agentAState.currentConfidence,
      agentBFinalConfidence: agentBState.currentConfidence,
      argumentsStanding: {
        agentA: agentAState.arguments.filter(a => a.status === 'standing').length,
        agentB: agentBState.arguments.filter(a => a.status === 'standing').length,
      },
      evidenceQuality: {
        agentA: this.calculateEvidenceScore(agentAState.evidence),
        agentB: this.calculateEvidenceScore(agentBState.evidence),
      },
      concessionsMade: {
        agentA: agentAState.concessionsGiven.length,
        agentB: agentBState.concessionsGiven.length,
      },
    };

    // Generate final resolution via AI
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a health optimization moderator producing the final resolution of a debate.

You must produce an actionable compromise that:
1. Acknowledges the valid concerns of both sides
2. Prioritizes the user's overall wellbeing
3. Is specific and immediately actionable
4. Includes concrete time/duration/behavior specifications

The user's health is the priority, but work obligations are real constraints.${historyContext}`,
        },
        {
          role: 'user',
          content: `DEBATE SUMMARY:

CONFLICT TYPE: ${conflict.type}

${agentAState.name} (${agentAState.domain}):
- Original position: ${conflict.agentA.position}
- Final confidence: ${(agentAState.currentConfidence * 100).toFixed(0)}%
- Arguments standing: ${finalScores.argumentsStanding.agentA}
- Concessions made: ${agentAState.concessionsGiven.join('; ') || 'None'}

${agentBState.name} (${agentBState.domain}):
- Original position: ${conflict.agentB.position}
- Final confidence: ${(agentBState.currentConfidence * 100).toFixed(0)}%
- Arguments standing: ${finalScores.argumentsStanding.agentB}
- Concessions made: ${agentBState.concessionsGiven.join('; ') || 'None'}

AREAS OF AGREEMENT FOUND:
${allAgreements.length > 0 ? allAgreements.map(a => `- ${a}`).join('\n') : 'None explicitly stated'}

COMPROMISES PROPOSED:
${allCompromises.length > 0 ? allCompromises.map(c => `- ${c}`).join('\n') : 'None explicitly proposed'}

Produce the final resolution JSON:
{
  "resolution": "The specific, actionable compromise recommendation with exact times/durations",
  "compromiseType": "full_merge" | "time_split" | "priority_override" | "conditional",
  "confidenceInResolution": 0.0-1.0,
  "reasoning": "Why this resolution addresses both concerns"
}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.5,
      max_tokens: 600,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    // Determine debate quality
    const debateQuality = this.assessDebateQuality(rounds, finalScores);

    return {
      conflictId: conflict.id,
      originalPositions: {
        agentA: conflict.agentA.position,
        agentB: conflict.agentB.position,
      },
      resolution: parsed.resolution || 'Unable to resolve conflict',
      compromiseType: parsed.compromiseType || 'conditional',
      confidenceInResolution: parsed.confidenceInResolution || 0.7,
      reasoning: parsed.reasoning || '',
      finalScores,
      debateQuality,
    };
  }

  /**
   * Calculate evidence quality score
   */
  private calculateEvidenceScore(evidence: Evidence[]): number {
    if (evidence.length === 0) return 0;

    const qualityWeights: Record<string, number> = {
      strong: 1.0,
      moderate: 0.7,
      weak: 0.4,
      anecdotal: 0.2,
    };

    const total = evidence.reduce((sum, e) => {
      return sum + (qualityWeights[e.quality] || 0.5) * e.relevance;
    }, 0);

    return total / evidence.length;
  }

  /**
   * Assess overall debate quality
   */
  private assessDebateQuality(
    rounds: DebateRound[],
    finalScores: DebateResolution['finalScores']
  ): 'high' | 'medium' | 'low' {
    let score = 0;

    // Points for completing rounds
    score += rounds.length * 0.15;

    // Points for agreements found
    const totalAgreements = rounds.reduce(
      (sum, r) => sum + r.moderatorSummary.areasOfAgreement.length,
      0
    );
    score += Math.min(totalAgreements * 0.1, 0.3);

    // Points for balanced final confidences
    const confidenceGap = Math.abs(
      finalScores.agentAFinalConfidence - finalScores.agentBFinalConfidence
    );
    score += confidenceGap < 0.2 ? 0.2 : confidenceGap < 0.3 ? 0.1 : 0;

    // Points for evidence quality
    const avgEvidence = (finalScores.evidenceQuality.agentA + finalScores.evidenceQuality.agentB) / 2;
    score += avgEvidence * 0.2;

    if (score >= 0.7) return 'high';
    if (score >= 0.4) return 'medium';
    return 'low';
  }

  /**
   * Parse arguments from AI response
   */
  private parseArguments(rawArgs: unknown, agentName: string): Argument[] {
    if (!Array.isArray(rawArgs)) return [];

    return rawArgs.map((arg, i) => ({
      id: `${agentName}_arg_${Date.now()}_${i}`,
      content: arg.content || '',
      strength: Math.max(0, Math.min(1, arg.strength || 0.5)),
      supportedBy: [],
      weakenedBy: [],
      status: 'standing' as const,
    }));
  }

  /**
   * Parse evidence from AI response
   */
  private parseEvidence(rawEvidence: unknown, agentName: string): Evidence[] {
    if (!Array.isArray(rawEvidence)) return [];

    return rawEvidence.map((e, i) => ({
      id: `${agentName}_ev_${Date.now()}_${i}`,
      content: e.content || '',
      source: e.source || agentName,
      quality: (['strong', 'moderate', 'weak', 'anecdotal'].includes(e.quality)
        ? e.quality
        : 'moderate') as Evidence['quality'],
      relevance: Math.max(0, Math.min(1, e.relevance || 0.7)),
      contested: false,
    }));
  }

  /**
   * Parse rebuttals from AI response
   */
  private parseRebuttals(rawRebuttals: unknown, agentName: string): Rebuttal[] {
    if (!Array.isArray(rawRebuttals)) return [];

    return rawRebuttals.map((r, i) => ({
      id: `${agentName}_reb_${Date.now()}_${i}`,
      targetArgumentId: r.targetArgument || '',
      content: r.content || '',
      effectiveness: Math.max(0, Math.min(1, r.effectiveness || 0.5)),
      type: (['direct_counter', 'evidence_challenge', 'scope_limitation', 'alternative_interpretation']
        .includes(r.type) ? r.type : 'direct_counter') as Rebuttal['type'],
    }));
  }

  /**
   * Clamp confidence shift to valid range
   */
  private clampConfidenceShift(shift: number): number {
    return Math.max(-0.15, Math.min(0.15, shift));
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format debate resolution for logging
 */
export function formatDebateResolution(resolution: DebateResolution): string {
  const lines: string[] = [
    `\n=== DEBATE RESOLUTION: ${resolution.conflictId} ===`,
    `Quality: ${resolution.debateQuality}`,
    `Rounds: ${resolution.rounds.length}`,
    `API Calls: ${resolution.totalApiCalls}`,
    '',
    'Original Positions:',
    `  A: ${resolution.originalPositions.agentA}`,
    `  B: ${resolution.originalPositions.agentB}`,
    '',
    `Resolution: ${resolution.resolution}`,
    `Type: ${resolution.compromiseType}`,
    `Confidence: ${(resolution.confidenceInResolution * 100).toFixed(0)}%`,
    '',
    'Final Scores:',
    `  Agent A: ${(resolution.finalScores.agentAFinalConfidence * 100).toFixed(0)}% confidence, ${resolution.finalScores.argumentsStanding.agentA} arguments standing`,
    `  Agent B: ${(resolution.finalScores.agentBFinalConfidence * 100).toFixed(0)}% confidence, ${resolution.finalScores.argumentsStanding.agentB} arguments standing`,
  ];

  if (resolution.rounds.length > 0) {
    lines.push('', 'Round Summaries:');
    for (const round of resolution.rounds) {
      lines.push(`  Round ${round.roundNumber} (${round.roundType}): ${round.moderatorSummary.roundSummary}`);
      if (round.moderatorSummary.areasOfAgreement.length > 0) {
        lines.push(`    Agreements: ${round.moderatorSummary.areasOfAgreement.join(', ')}`);
      }
    }
  }

  return lines.join('\n');
}
