import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  planTask,
  getTaskPlan,
  replanTask,
  needsPlanning,
  PlanningResult,
} from '@/lib/services/agent-planning/planning-engine';
import { explainRisk } from '@/lib/services/agent-planning/risk-assessor';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/agent/plan
 * Trigger planning for a task
 *
 * Body: { taskId: string, email: string }
 * Optional: { force?: boolean } - Force re-planning even if plan exists
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, email, force = false } = body;

    if (!taskId || !email) {
      return NextResponse.json(
        { error: 'Missing required fields: taskId, email' },
        { status: 400 }
      );
    }

    // Fetch the task
    const { data: task, error: taskError } = await supabase
      .from('agent_tasks')
      .select('*')
      .eq('id', taskId)
      .eq('user_email', email)
      .single();

    if (taskError || !task) {
      return NextResponse.json(
        { error: 'Task not found', details: taskError?.message },
        { status: 404 }
      );
    }

    // Check if planning is needed
    if (!force && !needsPlanning(task)) {
      // Return existing plan
      const existingPlan = await getTaskPlan(taskId);
      if (existingPlan) {
        return NextResponse.json({
          success: true,
          plan: existingPlan,
          cached: true,
          riskExplanation: explainRisk({
            level: existingPlan.riskLevel,
            score: existingPlan.confidenceScore * 100,
            factors: [],
            requiresApproval: existingPlan.riskLevel !== 'low',
            autoExecuteAllowed: existingPlan.riskLevel === 'low',
          }),
        });
      }
    }

    // Update task status to planning
    await supabase
      .from('agent_tasks')
      .update({
        planning_status: 'planning',
        status: 'analyzing',
      })
      .eq('id', taskId);

    // Generate the plan
    const plan = await planTask(task, email);

    // Determine next status based on risk
    const nextStatus = plan.riskLevel === 'low' && task.type === 'spotify'
      ? 'executing' // Auto-execute low-risk Spotify tasks
      : 'awaiting_approval';

    // Update task status
    await supabase
      .from('agent_tasks')
      .update({
        status: nextStatus,
        can_auto_execute: plan.riskLevel === 'low',
      })
      .eq('id', taskId);

    return NextResponse.json({
      success: true,
      plan,
      cached: false,
      autoExecuting: nextStatus === 'executing',
      riskExplanation: explainRisk({
        level: plan.riskLevel,
        score: plan.confidenceScore * 100,
        factors: [],
        requiresApproval: plan.riskLevel !== 'low',
        autoExecuteAllowed: plan.riskLevel === 'low',
      }),
    });
  } catch (error) {
    console.error('Error in planning:', error);
    return NextResponse.json(
      {
        error: 'Planning failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/agent/plan
 * Get the plan for a task
 *
 * Query: ?taskId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (!taskId) {
      return NextResponse.json(
        { error: 'Missing taskId parameter' },
        { status: 400 }
      );
    }

    const plan = await getTaskPlan(taskId);

    if (!plan) {
      return NextResponse.json(
        { error: 'No plan found for this task' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      plan,
    });
  } catch (error) {
    console.error('Error fetching plan:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch plan',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/agent/plan
 * Re-plan a task (when previous plan failed)
 *
 * Body: { taskId: string, email: string, previousPlanId: string, failureReason?: string }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, email, previousPlanId, failureReason } = body;

    if (!taskId || !email || !previousPlanId) {
      return NextResponse.json(
        { error: 'Missing required fields: taskId, email, previousPlanId' },
        { status: 400 }
      );
    }

    // Fetch the task
    const { data: task, error: taskError } = await supabase
      .from('agent_tasks')
      .select('*')
      .eq('id', taskId)
      .eq('user_email', email)
      .single();

    if (taskError || !task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Generate new plan with failure context
    const newPlan = await replanTask(task, email, previousPlanId, failureReason);

    return NextResponse.json({
      success: true,
      plan: newPlan,
      isReplan: true,
      previousPlanId,
    });
  } catch (error) {
    console.error('Error in replanning:', error);
    return NextResponse.json(
      {
        error: 'Replanning failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
