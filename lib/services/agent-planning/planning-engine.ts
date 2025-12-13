import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { buildPlanningContext, PlanningContext } from './context-builder';
import { assessRisk, RiskAssessment } from './risk-assessor';
import { getAgentPlanningPrompt } from '../../prompts/agent-planning-prompt';

// Types
export interface ReasoningStep {
  thought: string;
  observation: string;
  conclusion: string;
  dataUsed?: string[];
}

export interface DynamicStep {
  id: string;
  description: string;
  detail?: string;
  estimatedDuration?: number; // minutes
  requiresApproval?: boolean;
  serviceUsed?: string;
}

export interface Alternative {
  description: string;
  steps: DynamicStep[];
  tradeoffs: string;
}

export interface Dependency {
  taskType: string;
  reason: string;
  required: boolean;
}

export interface SideEffect {
  description: string;
  affectedService: string;
  reversible: boolean;
}

export interface PlanningResult {
  reasoning: ReasoningStep[];
  dynamicSteps: DynamicStep[];
  riskLevel: 'low' | 'medium' | 'high';
  confidenceScore: number;
  estimatedDuration: number;
  alternatives: Alternative[];
  dependencies: Dependency[];
  sideEffects: SideEffect[];
  planningContext: PlanningContext;
}

export interface AgentTask {
  id: string;
  user_email: string;
  type: string;
  title: string;
  description?: string;
  params?: Record<string, any>;
  source_insight_id?: string;
}

// Initialize clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Main planning function - generates a plan for how an agent should complete its task
 */
export async function planTask(
  task: AgentTask,
  userEmail: string
): Promise<PlanningResult> {
  const startTime = Date.now();

  // 1. Build planning context (gather user data, constraints, etc.)
  const context = await buildPlanningContext(task, userEmail);

  // 2. Generate plan using GPT-4 Chain of Thought
  const planningPrompt = getAgentPlanningPrompt(task.type, task, context);

  const completion = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [
      {
        role: 'system',
        content: planningPrompt.system,
      },
      {
        role: 'user',
        content: planningPrompt.user,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3, // Lower temperature for more consistent planning
    max_tokens: 2000,
  });

  const responseContent = completion.choices[0].message.content;
  if (!responseContent) {
    throw new Error('No response from planning model');
  }

  const planningOutput = JSON.parse(responseContent);

  // 3. Assess risk level
  const riskAssessment = assessRisk(task, planningOutput.dynamicSteps, context);

  // 4. Build final result
  const result: PlanningResult = {
    reasoning: planningOutput.reasoning || [],
    dynamicSteps: planningOutput.dynamicSteps || [],
    riskLevel: riskAssessment.level,
    confidenceScore: planningOutput.confidenceScore || 0.7,
    estimatedDuration: planningOutput.estimatedDuration || 15,
    alternatives: planningOutput.alternatives || [],
    dependencies: planningOutput.dependencies || [],
    sideEffects: planningOutput.sideEffects || [],
    planningContext: context,
  };

  // 5. Store plan in database
  const planningDuration = Date.now() - startTime;
  await storePlan(task.id, result, planningDuration, completion.usage?.total_tokens);

  // 6. Update task with planning status
  await updateTaskPlanningStatus(task.id, result);

  return result;
}

/**
 * Store the generated plan in the database
 */
async function storePlan(
  taskId: string,
  result: PlanningResult,
  planningDurationMs: number,
  tokensUsed?: number
): Promise<void> {
  await supabase.from('agent_task_plans').insert({
    task_id: taskId,
    reasoning: result.reasoning,
    dynamic_steps: result.dynamicSteps,
    risk_level: result.riskLevel,
    confidence_score: result.confidenceScore,
    estimated_duration_minutes: result.estimatedDuration,
    alternatives: result.alternatives,
    dependencies: result.dependencies,
    side_effects: result.sideEffects,
    planning_context: result.planningContext,
    model_used: 'gpt-4-turbo-preview',
    tokens_used: tokensUsed,
    planning_duration_ms: planningDurationMs,
  });
}

/**
 * Update the task with planning results
 */
async function updateTaskPlanningStatus(
  taskId: string,
  result: PlanningResult
): Promise<void> {
  await supabase
    .from('agent_tasks')
    .update({
      has_plan: true,
      planning_status: 'planned',
      risk_level: result.riskLevel,
      can_auto_execute: result.riskLevel === 'low',
      steps: result.dynamicSteps.map((step) => ({
        id: step.id,
        description: step.description,
        detail: step.detail,
        status: 'pending',
      })),
    })
    .eq('id', taskId);
}

/**
 * Get an existing plan for a task
 */
export async function getTaskPlan(taskId: string): Promise<PlanningResult | null> {
  const { data, error } = await supabase
    .from('agent_task_plans')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    reasoning: data.reasoning,
    dynamicSteps: data.dynamic_steps,
    riskLevel: data.risk_level,
    confidenceScore: data.confidence_score,
    estimatedDuration: data.estimated_duration_minutes,
    alternatives: data.alternatives,
    dependencies: data.dependencies,
    sideEffects: data.side_effects,
    planningContext: data.planning_context,
  };
}

/**
 * Re-plan a task (when original plan fails or needs adjustment)
 */
export async function replanTask(
  task: AgentTask,
  userEmail: string,
  previousPlanId: string,
  failureReason?: string
): Promise<PlanningResult> {
  // Get previous plan for context
  const { data: previousPlan } = await supabase
    .from('agent_task_plans')
    .select('*')
    .eq('id', previousPlanId)
    .single();

  // Update task status
  await supabase
    .from('agent_tasks')
    .update({ planning_status: 'replanning' })
    .eq('id', task.id);

  // Generate new plan with failure context
  const context = await buildPlanningContext(task, userEmail, {
    previousPlan: previousPlan,
    failureReason: failureReason,
  });

  const planningPrompt = getAgentPlanningPrompt(task.type, task, context, {
    isReplanning: true,
    failureReason: failureReason,
  });

  const completion = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [
      { role: 'system', content: planningPrompt.system },
      { role: 'user', content: planningPrompt.user },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.4,
    max_tokens: 2000,
  });

  const planningOutput = JSON.parse(completion.choices[0].message.content || '{}');
  const riskAssessment = assessRisk(task, planningOutput.dynamicSteps, context);

  const result: PlanningResult = {
    reasoning: planningOutput.reasoning || [],
    dynamicSteps: planningOutput.dynamicSteps || [],
    riskLevel: riskAssessment.level,
    confidenceScore: planningOutput.confidenceScore || 0.6,
    estimatedDuration: planningOutput.estimatedDuration || 20,
    alternatives: planningOutput.alternatives || [],
    dependencies: planningOutput.dependencies || [],
    sideEffects: planningOutput.sideEffects || [],
    planningContext: context,
  };

  // Store new plan with reference to previous
  await supabase.from('agent_task_plans').insert({
    task_id: task.id,
    reasoning: result.reasoning,
    dynamic_steps: result.dynamicSteps,
    risk_level: result.riskLevel,
    confidence_score: result.confidenceScore,
    estimated_duration_minutes: result.estimatedDuration,
    alternatives: result.alternatives,
    dependencies: result.dependencies,
    side_effects: result.sideEffects,
    planning_context: result.planningContext,
    model_used: 'gpt-4-turbo-preview',
    tokens_used: completion.usage?.total_tokens,
    previous_plan_id: previousPlanId,
  });

  await updateTaskPlanningStatus(task.id, result);

  return result;
}

/**
 * Check if a task needs planning
 */
export function needsPlanning(task: { has_plan?: boolean; planning_status?: string }): boolean {
  return !task.has_plan || task.planning_status === 'not_started';
}

/**
 * Determine if a task can auto-execute based on risk
 */
export function canAutoExecute(task: { type: string; risk_level?: string }): boolean {
  // Spotify is always low risk and can auto-execute
  if (task.type === 'spotify') return true;

  // Other types need to be explicitly marked as low risk
  return task.risk_level === 'low';
}
