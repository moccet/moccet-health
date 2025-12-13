import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createCoordinator } from '@/lib/services/coordinator-agent/coordinator';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/coordinator/plans
 * Create a new health plan from insights
 *
 * Body: {
 *   email: string,
 *   insights: Array<{ id, title, category, dataObservation?, recommendation? }>
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, insights } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    if (!insights || !Array.isArray(insights) || insights.length === 0) {
      return NextResponse.json(
        { error: 'At least one insight is required' },
        { status: 400 }
      );
    }

    const coordinator = createCoordinator(email);

    const result = await coordinator.createHealthPlan(insights);

    return NextResponse.json({
      success: true,
      plan: result.plan,
      tasks: result.tasks,
      summary: {
        totalTasks: result.tasks.length,
        autoApproved: result.autoApprovedCount,
        needsApproval: result.needsApprovalCount,
      },
    });
  } catch (error) {
    console.error('Error creating health plan:', error);
    return NextResponse.json(
      {
        error: 'Failed to create health plan',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/coordinator/plans
 * Get all health plans for a user
 *
 * Query: ?email=xxx&status=xxx (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const status = searchParams.get('status');
    const planId = searchParams.get('planId');

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // If specific plan requested
    if (planId) {
      const { data: plan, error } = await supabase
        .from('health_plans')
        .select('*')
        .eq('id', planId)
        .eq('user_email', email)
        .single();

      if (error || !plan) {
        return NextResponse.json(
          { error: 'Plan not found' },
          { status: 404 }
        );
      }

      // Also fetch associated tasks
      const { data: tasks } = await supabase
        .from('agent_tasks')
        .select('*')
        .eq('plan_id', planId);

      return NextResponse.json({
        success: true,
        plan,
        tasks: tasks || [],
      });
    }

    // Get all plans
    let query = supabase
      .from('health_plans')
      .select('*')
      .eq('user_email', email)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data: plans, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      plans: plans || [],
    });
  } catch (error) {
    console.error('Error fetching health plans:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch health plans',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/coordinator/plans
 * Update a health plan (approve, start, pause, cancel)
 *
 * Body: {
 *   planId: string,
 *   email: string,
 *   action: 'approve' | 'approve_task' | 'start' | 'pause' | 'cancel',
 *   taskId?: string (required for approve_task)
 * }
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { planId, email, action, taskId } = body;

    if (!planId || !email || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: planId, email, action' },
        { status: 400 }
      );
    }

    const coordinator = createCoordinator(email);

    switch (action) {
      case 'approve':
        // Approve all pending tasks
        await coordinator.approveAllTasks(planId);
        break;

      case 'approve_task':
        if (!taskId) {
          return NextResponse.json(
            { error: 'taskId is required for approve_task action' },
            { status: 400 }
          );
        }
        await coordinator.approveTask(planId, taskId);
        break;

      case 'start':
        // Start executing the plan
        // This runs async - don't await full execution
        coordinator.executeHealthPlan(planId).catch(console.error);

        await supabase
          .from('health_plans')
          .update({ status: 'executing' })
          .eq('id', planId);
        break;

      case 'pause':
        await supabase
          .from('health_plans')
          .update({ status: 'paused' })
          .eq('id', planId);
        break;

      case 'cancel':
        await supabase
          .from('health_plans')
          .update({ status: 'cancelled' })
          .eq('id', planId);
        break;

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    // Fetch updated plan
    const { data: updatedPlan } = await supabase
      .from('health_plans')
      .select('*')
      .eq('id', planId)
      .single();

    return NextResponse.json({
      success: true,
      plan: updatedPlan,
    });
  } catch (error) {
    console.error('Error updating health plan:', error);
    return NextResponse.json(
      {
        error: 'Failed to update health plan',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/coordinator/plans
 * Delete a draft health plan
 *
 * Body: { planId: string, email: string }
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { planId, email } = body;

    if (!planId || !email) {
      return NextResponse.json(
        { error: 'Missing required fields: planId, email' },
        { status: 400 }
      );
    }

    // Only allow deleting draft or cancelled plans
    const { data: plan } = await supabase
      .from('health_plans')
      .select('status')
      .eq('id', planId)
      .eq('user_email', email)
      .single();

    if (!plan) {
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      );
    }

    if (!['draft', 'cancelled'].includes(plan.status)) {
      return NextResponse.json(
        { error: 'Can only delete draft or cancelled plans' },
        { status: 400 }
      );
    }

    // Delete associated tasks first
    await supabase
      .from('agent_tasks')
      .delete()
      .eq('plan_id', planId);

    // Delete plan tasks junction
    await supabase
      .from('health_plan_tasks')
      .delete()
      .eq('plan_id', planId);

    // Delete the plan
    await supabase
      .from('health_plans')
      .delete()
      .eq('id', planId);

    return NextResponse.json({
      success: true,
      message: 'Plan deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting health plan:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete health plan',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
