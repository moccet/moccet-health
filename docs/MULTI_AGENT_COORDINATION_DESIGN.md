# Multi-Agent Coordination System Design

## Overview

A hybrid multi-agent system combining:
- **Hierarchical Structure** - Coordinators manage specialist agents
- **Agent Debate** - Conflicting insights are debated and resolved
- **Consensus Voting** - Multiple perspectives validate recommendations
- **Iterative Refinement** - Insights improve through feedback loops

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         MASTER ORCHESTRATOR                             │
│  • Routes requests to appropriate coordinators                          │
│  • Manages execution budget (API calls, time)                           │
│  • Triggers debate when conflicts detected                              │
│  • Produces final synthesized output                                    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
┌───────────────┐          ┌───────────────┐          ┌───────────────┐
│    HEALTH     │          │     WORK      │          │   LIFESTYLE   │
│  COORDINATOR  │          │  COORDINATOR  │          │  COORDINATOR  │
│               │          │               │          │               │
│ • Recovery    │          │ • Stress      │          │ • Nutrition   │
│ • Sleep       │          │ • Calendar    │          │ • Music       │
│ • Glucose     │          │ • Deep Content│          │ • Context     │
│ • Blood       │          │               │          │               │
│ • Activity    │          │               │          │               │
│ • Cardio      │          │               │          │               │
└───────────────┘          └───────────────┘          └───────────────┘
        │                           │                           │
        └───────────────────────────┼───────────────────────────┘
                                    ▼
                    ┌───────────────────────────┐
                    │      DEBATE CHAMBER       │
                    │  • Detects conflicts      │
                    │  • Runs structured debate │
                    │  • Produces resolution    │
                    └───────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────┐
                    │    CONSENSUS VALIDATOR    │
                    │  • Cross-validates claims │
                    │  • Adjusts confidence     │
                    │  • Flags low consensus    │
                    └───────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────┐
                    │      FINAL INSIGHTS       │
                    └───────────────────────────┘
```

---

## Component Details

### 1. Master Orchestrator

**Responsibilities:**
- Receive user request with context
- Determine which coordinators to activate based on available data
- Set execution budget (max API calls, timeout)
- Collect findings from coordinators
- Trigger debate when conflicts detected
- Run consensus validation
- Produce final ranked insights

**Execution Modes:**
| Mode | Coordinators | Debate | Consensus | Timeout |
|------|--------------|--------|-----------|---------|
| Quick | 1 | No | No | 15s |
| Standard | 2-3 | Yes | Light | 30s |
| Deep | All | Yes | Full | 60s |

---

### 2. Domain Coordinators

Each coordinator manages a domain of specialist agents.

**Health Coordinator:**
- Manages: RecoveryAgent, SleepAgent, GlucoseAgent, BloodAgent, ActivityAgent, CardioAgent
- Expertise: Physical health optimization
- Can request data from: Whoop, Oura, Dexcom, Apple Health, blood biomarkers

**Work Coordinator:**
- Manages: StressAgent, CalendarAgent, DeepContentAgent
- Expertise: Work-life balance, productivity, communication load
- Can request data from: Gmail, Slack, calendar, deep content analysis

**Lifestyle Coordinator:**
- Manages: NutritionAgent, MusicAgent, ContextAgent
- Expertise: Habits, mood, personal context
- Can request data from: Spotify, life context, user preferences

**Coordinator Behavior:**
```typescript
interface CoordinatorResult {
  domain: string;
  insights: AgentInsight[];
  internalConflicts: Conflict[];  // Conflicts WITHIN this domain
  crossDomainFlags: string[];     // Flags for other domains to consider
  confidenceLevel: number;
  dataQuality: 'high' | 'medium' | 'low';
}
```

---

### 3. Debate Chamber

When conflicting insights are detected, the Debate Chamber resolves them.

**Conflict Detection Rules:**
1. **Direct Contradiction**: "Exercise today" vs "Take a rest day"
2. **Resource Competition**: Two recommendations for the same time slot
3. **Priority Clash**: Critical health vs critical work deadline
4. **Causal Disagreement**: Different root cause analysis

**Debate Protocol:**
```
ROUND 1: State Position
- Agent A: "User should prioritize sleep tonight because HRV is low"
- Agent B: "User has a critical deadline requiring late work"

ROUND 2: Evidence
- Agent A: "HRV 45ms (15% below baseline), recovery 55%"
- Agent B: "Deadline in 12 hours, 3 tasks pending, manager is requester"

ROUND 3: Compromise Proposal
- Moderator synthesizes: "Work until 10pm max, then strict sleep protocol"

ROUND 4: Validation
- Both agents rate the compromise (accept/reject with reason)
```

**Debate Output:**
```typescript
interface DebateResolution {
  conflictId: string;
  originalPositions: {
    agentA: string;
    agentB: string;
  };
  resolution: string;
  compromiseType: 'full_merge' | 'time_split' | 'priority_override' | 'conditional';
  winningPerspective?: string;
  confidenceInResolution: number;
  reasoning: string;
}
```

---

### 4. Consensus Validator

Cross-validates insights by asking other agents to evaluate them.

**Process:**
1. Take each high-impact insight
2. Ask 2-3 other agents: "Do you agree with this recommendation?"
3. Collect votes and reasoning
4. Adjust confidence based on consensus

**Voting Scale:**
- **Strong Agree (+2)**: This aligns with my domain expertise
- **Agree (+1)**: Reasonable recommendation
- **Neutral (0)**: Outside my expertise / no opinion
- **Disagree (-1)**: Minor concerns
- **Strong Disagree (-2)**: Contradicts my analysis

**Confidence Adjustment:**
```
Original Confidence: 85%
Votes: [+2, +1, 0, -1]
Consensus Score: +2/4 = +0.5
Adjusted Confidence: 85% + (0.5 * 10%) = 90%
```

**Low Consensus Flag:**
If consensus score < -0.5, flag the insight:
> "⚠️ Low consensus: Other agents have concerns about this recommendation"

---

## Execution Flow

### Standard Mode Flow

```
1. USER REQUEST
   └── Context: Whoop, Gmail, Slack data available

2. MASTER ORCHESTRATOR
   ├── Activates: Health Coordinator, Work Coordinator
   └── Budget: 8 API calls, 30s timeout

3. PARALLEL EXECUTION
   ├── Health Coordinator
   │   ├── RecoveryAgent → "Rest day recommended"
   │   ├── SleepAgent → "Sleep debt detected"
   │   └── Internal synthesis → 2 insights
   │
   └── Work Coordinator
       ├── StressAgent → "High stress from Slack volume"
       ├── CalendarAgent → "Meeting-free day available"
       └── Internal synthesis → 2 insights

4. CONFLICT DETECTION
   └── Detected: None (recommendations compatible)

5. CONSENSUS VALIDATION (Light)
   ├── "Rest day" validated by StressAgent: +1 (high stress supports rest)
   └── Confidence adjusted: 85% → 90%

6. FINAL OUTPUT
   └── 4 insights, ranked by impact × confidence
```

### Deep Mode Flow (with Debate)

```
1. USER REQUEST
   └── Context: All sources available

2. MASTER ORCHESTRATOR
   └── Activates: All coordinators, full debate enabled

3. PARALLEL EXECUTION
   └── All coordinators produce insights

4. CONFLICT DETECTION
   └── CONFLICT: RecoveryAgent says "rest" but CalendarAgent says "important meeting at 7am"

5. DEBATE CHAMBER
   ├── Round 1: RecoveryAgent argues rest, CalendarAgent argues meeting importance
   ├── Round 2: Evidence presented (HRV data vs meeting criticality)
   ├── Round 3: Compromise: "Attend meeting but block afternoon for recovery"
   └── Round 4: Both agents accept compromise

6. CONSENSUS VALIDATION (Full)
   └── All insights cross-validated

7. FINAL OUTPUT
   └── Resolved insights with high confidence
```

---

## Implementation Plan

### Phase 1: Coordinator Layer
- [ ] Create `HealthCoordinator`, `WorkCoordinator`, `LifestyleCoordinator`
- [ ] Each coordinator runs its agents and produces domain-specific synthesis
- [ ] Coordinators can flag cross-domain concerns

### Phase 2: Conflict Detection
- [ ] Implement conflict detection rules
- [ ] Detect: contradictions, resource competition, priority clashes
- [ ] Pass conflicts to Debate Chamber

### Phase 3: Debate Chamber
- [ ] Structured debate protocol (4 rounds)
- [ ] GPT-4o as debate moderator
- [ ] Produce compromise resolutions

### Phase 4: Consensus Validation
- [ ] Cross-agent voting system
- [ ] Confidence adjustment algorithm
- [ ] Low consensus flagging

### Phase 5: Memory & Learning
- [ ] Store debate outcomes
- [ ] Learn which resolutions user accepted
- [ ] Improve future conflict resolution based on history

---

## Example Scenarios

### Scenario 1: Sleep vs Deadline

**Input:**
- RecoveryAgent: "HRV 40ms, need 9 hours sleep tonight"
- CalendarAgent: "Critical deadline tomorrow, 4 hours work remaining"
- DeepContentAgent: "Manager expecting deliverable by 9am"

**Debate:**
- Health argues: Low HRV = poor cognitive function = lower quality work
- Work argues: Missing deadline = stress tomorrow = worse recovery
- Compromise: "Work for 2 more hours max, then sleep. Send update to manager about timeline."

**Resolution:**
```json
{
  "recommendation": "Complete critical tasks by 10pm, send progress update to manager, sleep by 10:30pm",
  "actionSteps": [
    "Prioritize the most critical 2 hours of work right now",
    "At 9:45pm, send manager an update on progress and revised timeline",
    "Begin wind-down routine at 10pm, in bed by 10:30pm"
  ],
  "tradeoff": "Accepting slightly delayed delivery for significantly better cognitive function tomorrow"
}
```

### Scenario 2: Exercise Timing

**Input:**
- RecoveryAgent: "Recovery 75%, good for moderate exercise"
- CalendarAgent: "Only free slot is 6am or 8pm"
- SleepAgent: "8pm exercise will delay sleep onset"

**Debate:**
- Recovery + Calendar prefer 8pm (user not a morning person)
- Sleep argues 8pm exercise increases core temp, delays melatonin

**Resolution:**
```json
{
  "recommendation": "Exercise at 6pm by blocking calendar, or light yoga at 8pm",
  "compromise": "If 8pm is only option, do yoga/stretching instead of cardio"
}
```

### Scenario 3: Unanimous Agreement

**Input:**
- All agents agree: "User needs a recovery day"

**No Debate Needed:**
- Consensus validation: +2 from all agents
- Confidence: 95%
- Output directly

---

## Data Structures

### Conflict

```typescript
interface Conflict {
  id: string;
  type: 'contradiction' | 'resource_competition' | 'priority_clash' | 'causal_disagreement';
  agentA: {
    name: string;
    position: string;
    evidence: string[];
    confidence: number;
  };
  agentB: {
    name: string;
    position: string;
    evidence: string[];
    confidence: number;
  };
  severity: 'blocking' | 'significant' | 'minor';
  detectedAt: string;
}
```

### DebateRound

```typescript
interface DebateRound {
  roundNumber: 1 | 2 | 3 | 4;
  roundType: 'position' | 'evidence' | 'compromise' | 'validation';
  agentAResponse: string;
  agentBResponse: string;
  moderatorNote?: string;
}
```

### ConsensusVote

```typescript
interface ConsensusVote {
  insightId: string;
  votingAgent: string;
  vote: -2 | -1 | 0 | 1 | 2;
  reasoning: string;
  timestamp: string;
}
```

---

## Configuration

```typescript
const COORDINATION_CONFIG = {
  quick: {
    maxCoordinators: 1,
    enableDebate: false,
    enableConsensus: false,
    maxApiCalls: 4,
    timeoutMs: 15000,
  },
  standard: {
    maxCoordinators: 2,
    enableDebate: true,
    enableConsensus: 'light', // Only high-impact insights
    maxApiCalls: 10,
    timeoutMs: 30000,
  },
  deep: {
    maxCoordinators: 3,
    enableDebate: true,
    enableConsensus: 'full',
    maxApiCalls: 20,
    timeoutMs: 60000,
  },
};
```

---

## Success Metrics

1. **Conflict Resolution Rate**: % of conflicts successfully resolved
2. **User Acceptance Rate**: % of debated recommendations user follows
3. **Consensus Accuracy**: Correlation between consensus score and user satisfaction
4. **Processing Time**: Stay within timeout budgets
5. **API Efficiency**: Insights per API call

---

## Next Steps

1. Review and approve design
2. Implement Phase 1 (Coordinators)
3. Test with real user scenarios
4. Iterate based on feedback
