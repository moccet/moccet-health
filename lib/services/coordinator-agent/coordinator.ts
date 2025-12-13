import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import {
  resolveExecutionOrder,
  optimizeExecutionOrder,
  getReadyTasks,
  TaskNode,
  ExecutionGroup,
} from './dependency-resolver';
import { buildPlanningContext, PlanningContext } from '../agent-planning/context-builder';
import { getCoordinatorPlanningPrompt } from '../../prompts/agent-planning-prompt';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Types
export interface HealthPlan {
  id: string;
  user_email: string;
  title: string;
  description?: string;
  plan_type: string;
  status: HealthPlanStatus;
  source_insights: string[];
  task_graph: TaskGraphNode[];
  execution_order: string[];
  approval_config: ApprovalConfig;
  current_task_index: number;
  overall_progress: number;
  completed_tasks: string[];
  failed_tasks: string[];
  blocked_tasks: string[];
  estimated_total_duration?: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export type HealthPlanStatus =
  | 'draft'
  | 'planning'
  | 'awaiting_approval'
  | 'approved'
  | 'executing'
  | 'paused'
  | 'completed'
  | 'partially_completed'
  | 'failed'
  | 'cancelled';

export interface TaskGraphNode {
  task_id: string;
  agent_type: string;
  title: string;
  depends_on: string[];
  can_auto_execute: boolean;
  approval_status: 'pending' | 'approved' | 'auto_approved' | 'rejected';
  risk_level: 'low' | 'medium' | 'high';
}

export interface ApprovalConfig {
  auto_approve_low_risk: boolean;
  require_approval_for: string[];
  max_auto_approve_cost: number;
  notify_on_completion: boolean;
}

export interface Insight {
  id: string;
  title: string;
  category: string;
  dataObservation?: string;
  recommendation?: string;
}

export interface CreatePlanResult {
  plan: HealthPlan;
  tasks: any[];
  autoApprovedCount: number;
  needsApprovalCount: number;
}

/**
 * Coordinator Agent - Orchestrates multi-task health plans
 */
export class CoordinatorAgent {
  private userEmail: string;

  constructor(userEmail: string) {
    this.userEmail = userEmail;
  }

  /**
   * Create a health plan from multiple insights
   */
  async createHealthPlan(insights: Insight[]): Promise<CreatePlanResult> {
    // 1. Build context for planning
    const context = await buildPlanningContext(
      { type: 'planning', params: {} },
      this.userEmail
    );

    // 2. Use GPT-4 to analyze insights and create plan
    const planningPrompt = getCoordinatorPlanningPrompt(insights, context);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: planningPrompt.system },
        { role: 'user', content: planningPrompt.user },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 3000,
    });

    const planOutput = JSON.parse(completion.choices[0].message.content || '{}');

    // 3. Create tasks for each planned item
    const tasks = await this.createTasksForPlan(planOutput.tasks || []);

    // 4. Build task graph with dependencies
    const taskGraph = this.buildTaskGraph(tasks, planOutput.tasks || []);

    // 5. Resolve execution order
    const taskNodes: TaskNode[] = taskGraph.map((node) => ({
      taskId: node.task_id,
      agentType: node.agent_type,
      dependsOn: node.depends_on,
      canRunParallel: false, // Default to sequential for safety
      riskLevel: node.risk_level,
    }));

    const resolution = resolveExecutionOrder(taskNodes);

    if (!resolution.success) {
      throw new Error(`Dependency cycle detected in plan: ${resolution.cycleNodes?.join(', ')}`);
    }

    const optimizedOrder = optimizeExecutionOrder(taskNodes, resolution.executionOrder);

    // 6. Determine approval requirements
    const approvalConfig = this.getDefaultApprovalConfig();
    let autoApprovedCount = 0;
    let needsApprovalCount = 0;

    for (const node of taskGraph) {
      if (this.canAutoApprove(node, approvalConfig)) {
        node.approval_status = 'auto_approved';
        autoApprovedCount++;
      } else {
        node.approval_status = 'pending';
        needsApprovalCount++;
      }
    }

    // 7. Create health plan
    const planId = `plan_${uuidv4()}`;
    const healthPlan: HealthPlan = {
      id: planId,
      user_email: this.userEmail,
      title: planOutput.planTitle || 'Health Optimization Plan',
      description: planOutput.planDescription,
      plan_type: 'custom',
      status: needsApprovalCount > 0 ? 'awaiting_approval' : 'approved',
      source_insights: insights.map((i) => i.id),
      task_graph: taskGraph,
      execution_order: optimizedOrder,
      approval_config: approvalConfig,
      current_task_index: 0,
      overall_progress: 0,
      completed_tasks: [],
      failed_tasks: [],
      blocked_tasks: [],
      estimated_total_duration: planOutput.estimatedTotalDuration,
      created_at: new Date().toISOString(),
    };

    // 8. Save to database
    await this.saveHealthPlan(healthPlan);
    await this.linkTasksToPlan(planId, taskGraph);

    return {
      plan: healthPlan,
      tasks,
      autoApprovedCount,
      needsApprovalCount,
    };
  }

  /**
   * Execute a health plan
   */
  async executeHealthPlan(planId: string): Promise<void> {
    // Update status
    await supabase
      .from('health_plans')
      .update({ status: 'executing', started_at: new Date().toISOString() })
      .eq('id', planId);

    const { data: plan } = await supabase
      .from('health_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (!plan) {
      throw new Error('Plan not found');
    }

    const completedTasks = new Set<string>(plan.completed_tasks || []);
    const failedTasks = new Set<string>(plan.failed_tasks || []);

    for (const taskId of plan.execution_order) {
      const taskNode = plan.task_graph.find((n: TaskGraphNode) => n.task_id === taskId);

      if (!taskNode) continue;

      // Skip completed or failed tasks
      if (completedTasks.has(taskId) || failedTasks.has(taskId)) {
        continue;
      }

      // Check if dependencies are met
      const depsMet = taskNode.depends_on.every(
        (depId: string) => completedTasks.has(depId)
      );

      if (!depsMet) {
        // Mark as blocked
        await this.updatePlanProgress(planId, { blockedTasks: [taskId] });
        continue;
      }

      // Check approval
      if (taskNode.approval_status === 'pending') {
        // Pause and wait for approval
        await supabase
          .from('health_plans')
          .update({ status: 'awaiting_approval' })
          .eq('id', planId);
        return;
      }

      // Execute task
      try {
        await this.executeTask(taskId);
        completedTasks.add(taskId);
        await this.updatePlanProgress(planId, {
          completedTasks: Array.from(completedTasks),
        });
      } catch (error) {
        failedTasks.add(taskId);
        await this.updatePlanProgress(planId, {
          failedTasks: Array.from(failedTasks),
        });

        // Continue with remaining tasks if possible
        console.error(`Task ${taskId} failed:`, error);
      }
    }

    // Determine final status
    const allCompleted = plan.execution_order.every((id: string) =>
      completedTasks.has(id)
    );
    const hasFailures = failedTasks.size > 0;

    const finalStatus: HealthPlanStatus = allCompleted
      ? 'completed'
      : hasFailures
        ? 'partially_completed'
        : 'completed';

    await supabase
      .from('health_plans')
      .update({
        status: finalStatus,
        completed_at: new Date().toISOString(),
        overall_progress: 100,
      })
      .eq('id', planId);
  }

  /**
   * Approve a specific task in the plan
   */
  async approveTask(planId: string, taskId: string): Promise<void> {
    const { data: plan } = await supabase
      .from('health_plans')
      .select('task_graph')
      .eq('id', planId)
      .single();

    if (!plan) throw new Error('Plan not found');

    const taskGraph = plan.task_graph.map((node: TaskGraphNode) =>
      node.task_id === taskId
        ? { ...node, approval_status: 'approved' }
        : node
    );

    await supabase
      .from('health_plans')
      .update({ task_graph: taskGraph })
      .eq('id', planId);

    // Also update the health_plan_tasks table
    await supabase
      .from('health_plan_tasks')
      .update({
        approval_status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: 'user',
      })
      .eq('plan_id', planId)
      .eq('task_id', taskId);
  }

  /**
   * Approve all pending tasks in the plan
   */
  async approveAllTasks(planId: string): Promise<void> {
    const { data: plan } = await supabase
      .from('health_plans')
      .select('task_graph')
      .eq('id', planId)
      .single();

    if (!plan) throw new Error('Plan not found');

    const taskGraph = plan.task_graph.map((node: TaskGraphNode) => ({
      ...node,
      approval_status: node.approval_status === 'pending' ? 'approved' : node.approval_status,
    }));

    await supabase
      .from('health_plans')
      .update({ task_graph: taskGraph, status: 'approved' })
      .eq('id', planId);

    // Update health_plan_tasks
    await supabase
      .from('health_plan_tasks')
      .update({
        approval_status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: 'user',
      })
      .eq('plan_id', planId)
      .eq('approval_status', 'pending');
  }

  // Private helper methods

  private async createTasksForPlan(plannedTasks: any[]): Promise<any[]> {
    const tasks = [];

    for (const planned of plannedTasks) {
      const taskId = `task_${uuidv4()}`;

      const task = {
        id: taskId,
        user_email: this.userEmail,
        type: planned.agentType,
        title: planned.title,
        description: planned.description,
        status: 'pending',
        params: planned.params || {},
        source_insight_id: planned.sourceInsightId,
        risk_level: planned.estimatedRisk || 'medium',
        has_plan: false,
        planning_status: 'not_started',
      };

      await supabase.from('agent_tasks').insert(task);
      tasks.push({ ...task, taskId });
    }

    return tasks;
  }

  private buildTaskGraph(tasks: any[], plannedTasks: any[]): TaskGraphNode[] {
    const taskGraph: TaskGraphNode[] = [];

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const planned = plannedTasks[i];

      // Map dependency indices to task IDs
      const dependsOn = (planned.dependsOn || [])
        .map((idx: number) => tasks[idx]?.id)
        .filter(Boolean);

      taskGraph.push({
        task_id: task.id,
        agent_type: task.type,
        title: task.title,
        depends_on: dependsOn,
        can_auto_execute: planned.estimatedRisk === 'low',
        approval_status: 'pending',
        risk_level: planned.estimatedRisk || 'medium',
      });
    }

    return taskGraph;
  }

  private canAutoApprove(node: TaskGraphNode, config: ApprovalConfig): boolean {
    if (!config.auto_approve_low_risk) return false;
    if (config.require_approval_for.includes(node.agent_type)) return false;
    return node.risk_level === 'low';
  }

  private getDefaultApprovalConfig(): ApprovalConfig {
    return {
      auto_approve_low_risk: true,
      require_approval_for: ['calendar', 'health_booking', 'shopping'],
      max_auto_approve_cost: 50,
      notify_on_completion: true,
    };
  }

  private async saveHealthPlan(plan: HealthPlan): Promise<void> {
    await supabase.from('health_plans').insert({
      id: plan.id,
      user_email: plan.user_email,
      title: plan.title,
      description: plan.description,
      plan_type: plan.plan_type,
      status: plan.status,
      source_insights: plan.source_insights,
      task_graph: plan.task_graph,
      execution_order: plan.execution_order,
      approval_config: plan.approval_config,
      current_task_index: plan.current_task_index,
      overall_progress: plan.overall_progress,
      completed_tasks: plan.completed_tasks,
      failed_tasks: plan.failed_tasks,
      blocked_tasks: plan.blocked_tasks,
      estimated_total_duration: plan.estimated_total_duration,
    });
  }

  private async linkTasksToPlan(
    planId: string,
    taskGraph: TaskGraphNode[]
  ): Promise<void> {
    const planTasks = taskGraph.map((node, index) => ({
      plan_id: planId,
      task_id: node.task_id,
      sequence_number: index,
      depends_on_task_ids: node.depends_on,
      requires_approval: !node.can_auto_execute,
      approval_status: node.approval_status,
      risk_level: node.risk_level,
    }));

    await supabase.from('health_plan_tasks').insert(planTasks);

    // Update tasks with plan_id
    for (const node of taskGraph) {
      await supabase
        .from('agent_tasks')
        .update({ plan_id: planId })
        .eq('id', node.task_id);
    }
  }

  private async executeTask(taskId: string): Promise<void> {
    // Call the agent execute API
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL}/api/agent/execute`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          email: this.userEmail,
          skipPlanning: false, // Let planning phase run
        }),
      }
    );

    const result = await response.json();

    if (!result.success && result.status !== 'awaiting_approval') {
      throw new Error(result.error || 'Task execution failed');
    }
  }

  private async updatePlanProgress(
    planId: string,
    updates: {
      completedTasks?: string[];
      failedTasks?: string[];
      blockedTasks?: string[];
    }
  ): Promise<void> {
    const { data: plan } = await supabase
      .from('health_plans')
      .select('execution_order, completed_tasks, failed_tasks, blocked_tasks')
      .eq('id', planId)
      .single();

    if (!plan) return;

    const totalTasks = plan.execution_order.length;
    const completedCount = updates.completedTasks?.length || plan.completed_tasks?.length || 0;
    const progress = Math.round((completedCount / totalTasks) * 100);

    await supabase
      .from('health_plans')
      .update({
        ...(updates.completedTasks && { completed_tasks: updates.completedTasks }),
        ...(updates.failedTasks && { failed_tasks: updates.failedTasks }),
        ...(updates.blockedTasks && { blocked_tasks: updates.blockedTasks }),
        overall_progress: progress,
        updated_at: new Date().toISOString(),
      })
      .eq('id', planId);
  }
}

/**
 * Create a coordinator agent instance
 */
export function createCoordinator(userEmail: string): CoordinatorAgent {
  return new CoordinatorAgent(userEmail);
}
