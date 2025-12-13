import { formatContextForPrompt, PlanningContext } from '../services/agent-planning/context-builder';

interface AgentTask {
  id: string;
  type: string;
  title: string;
  description?: string;
  params?: Record<string, any>;
}

interface PromptOptions {
  isReplanning?: boolean;
  failureReason?: string;
}

interface PlanningPrompt {
  system: string;
  user: string;
}

const AGENT_DESCRIPTIONS: Record<string, string> = {
  calendar: `You are a Calendar Agent that schedules events and manages time blocks.
Your capabilities:
- Check calendar availability
- Create new events with optimal timing
- Consider user's energy patterns and preferences
- Avoid conflicts with existing events`,

  spotify: `You are a Spotify Agent that creates personalized playlists.
Your capabilities:
- Create new playlists with mood-appropriate tracks
- Match music to user's current activity or goal
- Consider tempo, energy, and genre preferences`,

  supplement: `You are a Supplement Agent that analyzes health data and recommends supplements.
Your capabilities:
- Analyze biomarker data for deficiencies
- Match supplements to health needs
- Consider drug interactions and contraindications
- Optionally trigger shopping for recommendations`,

  health_booking: `You are a Health Booking Agent that schedules medical appointments.
Your capabilities:
- Find available appointment slots
- Verify insurance coverage
- Send relevant health summary to provider
- Confirm booking details`,

  shopping: `You are a Shopping Agent that finds and purchases products.
Your capabilities:
- Search for products across multiple retailers
- Compare prices and find best deals
- Add items to cart
- Complete checkout with stored payment methods`,
};

const BASE_PLANNING_INSTRUCTIONS = `
## Your Planning Process

You must reason step-by-step about how to complete the task. For each step:
1. THOUGHT: What are you considering?
2. OBSERVATION: What relevant data or constraints do you see?
3. CONCLUSION: What do you decide based on this?

After reasoning, generate a concrete sequence of executable steps.

## Output Format

You MUST respond with valid JSON in this exact format:
{
  "reasoning": [
    {
      "thought": "string - what you're thinking about",
      "observation": "string - what data/constraint you're looking at",
      "conclusion": "string - what you decided"
    }
  ],
  "dynamicSteps": [
    {
      "id": "step_1",
      "description": "string - human-readable step description",
      "detail": "string - optional additional detail",
      "estimatedDuration": 5,
      "serviceUsed": "string - which service/API this uses"
    }
  ],
  "confidenceScore": 0.85,
  "estimatedDuration": 15,
  "dependencies": [
    {
      "taskType": "string - type of dependent task",
      "reason": "string - why this dependency exists",
      "required": true
    }
  ],
  "alternatives": [
    {
      "description": "string - alternative approach",
      "steps": [],
      "tradeoffs": "string - pros/cons of this alternative"
    }
  ],
  "sideEffects": [
    {
      "description": "string - what side effect this has",
      "affectedService": "string - which service is affected",
      "reversible": true
    }
  ]
}
`;

const REPLANNING_ADDENDUM = `
## Important: This is a RE-PLANNING attempt

The previous plan failed. You must:
1. Understand why the previous attempt failed
2. Avoid the same mistakes
3. Consider alternative approaches
4. Be more conservative in your estimates

Previous Failure Reason: {failureReason}
`;

/**
 * Generate the planning prompt for a specific agent type
 */
export function getAgentPlanningPrompt(
  agentType: string,
  task: AgentTask,
  context: PlanningContext,
  options?: PromptOptions
): PlanningPrompt {
  const agentDescription = AGENT_DESCRIPTIONS[agentType] || AGENT_DESCRIPTIONS['calendar'];

  let systemPrompt = `${agentDescription}

${BASE_PLANNING_INSTRUCTIONS}`;

  if (options?.isReplanning) {
    systemPrompt += REPLANNING_ADDENDUM.replace(
      '{failureReason}',
      options.failureReason || 'Unknown'
    );
  }

  const contextFormatted = formatContextForPrompt(context);

  const userPrompt = `## Task to Plan

**Type:** ${task.type}
**Title:** ${task.title}
**Description:** ${task.description || 'No additional description'}

**Parameters:**
${JSON.stringify(task.params || {}, null, 2)}

---

${contextFormatted}

---

Now, reason step-by-step about how to complete this task, then provide your executable plan as JSON.`;

  return {
    system: systemPrompt,
    user: userPrompt,
  };
}

/**
 * Get prompt for the Coordinator Agent to create a health plan
 */
export function getCoordinatorPlanningPrompt(
  insights: any[],
  context: PlanningContext
): PlanningPrompt {
  const systemPrompt = `You are a Health Plan Coordinator that creates cohesive multi-task health plans.

Your role is to:
1. Analyze multiple health insights together
2. Identify which agent tasks would address these insights
3. Determine the optimal order of tasks (considering dependencies)
4. Identify which tasks can run in parallel
5. Assess overall plan risk and approval requirements

## Available Agent Types
- calendar: Schedule events, time blocks, activities
- spotify: Create mood/activity-based playlists
- supplement: Analyze biomarkers and recommend supplements
- health_booking: Book medical appointments
- shopping: Purchase recommended products

## Output Format

Respond with valid JSON:
{
  "planTitle": "string - descriptive title for the plan",
  "planDescription": "string - what this plan aims to achieve",
  "reasoning": [
    {
      "thought": "string",
      "observation": "string",
      "conclusion": "string"
    }
  ],
  "tasks": [
    {
      "agentType": "string",
      "title": "string",
      "description": "string",
      "params": {},
      "dependsOn": [],
      "canRunParallel": false,
      "estimatedRisk": "low|medium|high",
      "sourceInsightId": "string"
    }
  ],
  "executionOrder": ["task indices in order"],
  "overallRisk": "low|medium|high",
  "estimatedTotalDuration": 60,
  "approvalStrategy": {
    "autoApprove": ["task indices that can auto-execute"],
    "requiresApproval": ["task indices needing approval"]
  }
}`;

  const insightsFormatted = insights
    .map(
      (insight, i) => `
Insight ${i + 1}:
- ID: ${insight.id}
- Title: ${insight.title}
- Category: ${insight.category}
- Data Observation: ${insight.dataObservation}
- Recommendation: ${insight.recommendation}`
    )
    .join('\n');

  const contextFormatted = formatContextForPrompt(context);

  const userPrompt = `## Health Insights to Address

${insightsFormatted}

---

${contextFormatted}

---

Create a coordinated health plan that addresses these insights. Consider:
1. Which insights can be addressed by which agent types
2. Dependencies between tasks (e.g., supplement analysis before shopping)
3. User's calendar availability for scheduling
4. Risk levels of each task
5. Which tasks can safely auto-execute

Provide your plan as JSON.`;

  return {
    system: systemPrompt,
    user: userPrompt,
  };
}
