/**
 * Goals API
 *
 * CRUD operations for user health goals
 * Part of Phase 3: Goals System
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createGoal,
  getGoals,
  getGoal,
  updateGoal,
  deleteGoal,
  getGoalsForInsight,
  buildGoalsContext,
  getTemplatesForCategory,
  getMetricsForCategory,
  GOAL_TEMPLATES,
  CreateGoalInput,
  UpdateGoalInput,
  GoalStatus,
  GoalCategory,
} from '@/lib/services/goals-service';

/**
 * GET /api/user/goals
 *
 * Query params:
 * - email (required): User's email
 * - status: Filter by status (active, completed, paused, abandoned)
 * - category: Filter by category
 * - insight_category: Get goals relevant to an insight category
 * - context: If 'true', return AI prompt context instead of goals
 * - templates: If 'true', return goal templates for a category
 * - metrics: If 'true', return available metrics for a category
 * - limit: Max number of goals to return
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');
    const status = searchParams.get('status') as GoalStatus | null;
    const category = searchParams.get('category') as GoalCategory | null;
    const insightCategory = searchParams.get('insight_category');
    const limit = parseInt(searchParams.get('limit') || '20');
    const getContext = searchParams.get('context') === 'true';
    const getTemplates = searchParams.get('templates') === 'true';
    const getMetrics = searchParams.get('metrics') === 'true';

    // Return goal templates
    if (getTemplates) {
      if (category) {
        return NextResponse.json({
          success: true,
          templates: getTemplatesForCategory(category),
        });
      }
      return NextResponse.json({
        success: true,
        templates: GOAL_TEMPLATES,
      });
    }

    // Return available metrics for a category
    if (getMetrics && category) {
      return NextResponse.json({
        success: true,
        metrics: getMetricsForCategory(category),
      });
    }

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Return context for AI prompt injection
    if (getContext) {
      const context = await buildGoalsContext(email);
      return NextResponse.json({
        success: true,
        context,
      });
    }

    // Get goals relevant to an insight category
    if (insightCategory) {
      const goals = await getGoalsForInsight(email, insightCategory);
      return NextResponse.json({
        success: true,
        goals,
        count: goals.length,
      });
    }

    // Standard query
    const goals = await getGoals(email, {
      status: status || undefined,
      category: category || undefined,
      limit,
    });

    return NextResponse.json({
      success: true,
      goals,
      count: goals.length,
    });
  } catch (error) {
    console.error('[Goals API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch goals' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/goals
 *
 * Body:
 * - action: 'create' | 'update' | 'delete'
 * - email: User's email (for create)
 * - goalId: Goal ID (for update/delete)
 * - ...goal fields (for create/update)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, email, goalId, ...data } = body;

    switch (action) {
      case 'create': {
        if (!email) {
          return NextResponse.json(
            { error: 'Email is required' },
            { status: 400 }
          );
        }

        if (!data.title || !data.category || data.targetValue === undefined) {
          return NextResponse.json(
            { error: 'title, category, and targetValue are required' },
            { status: 400 }
          );
        }

        const input: CreateGoalInput = {
          title: data.title,
          description: data.description,
          category: data.category,
          trackedMetric: data.trackedMetric,
          targetValue: data.targetValue,
          unit: data.unit,
          direction: data.direction,
          targetDate: data.targetDate,
          customMetricName: data.customMetricName,
          manualTracking: data.manualTracking,
          icon: data.icon,
          color: data.color,
          isAiSuggested: data.isAiSuggested,
          suggestionReason: data.suggestionReason,
          linkedInsightIds: data.linkedInsightIds,
        };

        const id = await createGoal(email, input);
        if (!id) {
          return NextResponse.json(
            { error: 'Failed to create goal' },
            { status: 500 }
          );
        }

        // Fetch the created goal to return it
        const createdGoal = await getGoal(id);

        return NextResponse.json({
          success: true,
          goalId: id,
          goal: createdGoal,
        });
      }

      case 'update': {
        if (!goalId) {
          return NextResponse.json(
            { error: 'goalId is required' },
            { status: 400 }
          );
        }

        const input: UpdateGoalInput = {};
        if (data.title !== undefined) input.title = data.title;
        if (data.description !== undefined) input.description = data.description;
        if (data.targetValue !== undefined) input.targetValue = data.targetValue;
        if (data.targetDate !== undefined) input.targetDate = data.targetDate;
        if (data.status !== undefined) input.status = data.status;
        if (data.currentValue !== undefined) input.currentValue = data.currentValue;
        if (data.priority !== undefined) input.priority = data.priority;

        const success = await updateGoal(goalId, input);
        if (!success) {
          return NextResponse.json(
            { error: 'Failed to update goal' },
            { status: 500 }
          );
        }

        // Fetch updated goal
        const updatedGoal = await getGoal(goalId);

        return NextResponse.json({
          success: true,
          goal: updatedGoal,
        });
      }

      case 'delete': {
        if (!goalId) {
          return NextResponse.json(
            { error: 'goalId is required' },
            { status: 400 }
          );
        }

        const success = await deleteGoal(goalId);
        if (!success) {
          return NextResponse.json(
            { error: 'Failed to delete goal' },
            { status: 500 }
          );
        }

        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Goals API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to process goal request' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
