/**
 * Health Goals Tools
 * Tools for managing user health goals
 */

import { z } from 'zod';
import { ToolDefinition, ToolContext, ToolResult } from './types';

// =============================================================================
// GOAL READING TOOLS
// =============================================================================

// Get all health goals
export const getHealthGoalsTool: ToolDefinition = {
  name: 'get_health_goals',
  description: `Get the user's health goals with progress tracking.
    Returns active, paused, and recently completed goals.
    Use this to understand what the user is working toward.`,
  riskLevel: 'low',
  parameters: z.object({
    status: z.enum(['active', 'all', 'completed', 'paused']).optional()
      .describe('Filter by status. Defaults to active.'),
    category: z.enum(['SLEEP', 'ACTIVITY', 'RECOVERY', 'GLUCOSE', 'WEIGHT', 'STRESS', 'CUSTOM']).optional()
      .describe('Filter by goal category'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const { status = 'active', category } = params;

      let query = context.supabase
        .from('user_health_goals')
        .select('*')
        .eq('email', context.userEmail)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      if (status !== 'all') {
        query = query.eq('status', status);
      }
      if (category) {
        query = query.eq('category', category);
      }

      const { data: goals, error } = await query.limit(20);

      if (error) throw error;

      // Format goals with progress info
      const formattedGoals = goals?.map((goal: any) => ({
        id: goal.id,
        title: goal.title,
        description: goal.description,
        category: goal.category,
        status: goal.status,
        tracked_metric: goal.tracked_metric || goal.custom_metric_name,
        current_value: goal.current_value,
        target_value: goal.target_value,
        baseline_value: goal.baseline_value,
        unit: goal.unit,
        progress_percent: Math.round(goal.progress_pct || 0),
        direction: goal.direction,
        start_date: goal.start_date,
        target_date: goal.target_date,
        is_ai_suggested: goal.is_ai_suggested,
        days_remaining: goal.target_date
          ? Math.ceil((new Date(goal.target_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : null,
      }));

      // Summary stats
      const activeCount = formattedGoals?.filter(g => g.status === 'active').length || 0;
      const avgProgress = formattedGoals && formattedGoals.length > 0
        ? Math.round(formattedGoals.reduce((sum, g) => sum + (g.progress_percent || 0), 0) / formattedGoals.length)
        : 0;

      return {
        success: true,
        data: {
          goals: formattedGoals,
          summary: {
            total: formattedGoals?.length || 0,
            active: activeCount,
            average_progress: avgProgress,
          },
        },
        metadata: {
          source: 'health_goals',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get health goals: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

// =============================================================================
// GOAL MANAGEMENT TOOLS
// =============================================================================

// Create a health goal
export const createHealthGoalTool: ToolDefinition = {
  name: 'create_health_goal',
  description: `Create a new health goal for the user.
    Use when user wants to set a new goal like "I want to sleep 8 hours" or "help me lose 5kg".
    Categories: SLEEP, ACTIVITY, RECOVERY, GLUCOSE, WEIGHT, STRESS, CUSTOM`,
  riskLevel: 'medium',
  parameters: z.object({
    title: z.string().min(3).max(100)
      .describe('Goal title (e.g., "Get 8 hours of sleep")'),
    category: z.enum(['SLEEP', 'ACTIVITY', 'RECOVERY', 'GLUCOSE', 'WEIGHT', 'STRESS', 'CUSTOM'])
      .describe('Goal category'),
    target_value: z.number()
      .describe('Target value to achieve'),
    tracked_metric: z.string().optional()
      .describe('Metric to track (e.g., "sleep_duration", "daily_steps", "weight_kg")'),
    unit: z.string().optional()
      .describe('Unit of measurement (e.g., "hours", "steps", "kg")'),
    direction: z.enum(['increase', 'decrease', 'maintain']).optional()
      .describe('Goal direction. Defaults to increase.'),
    target_date: z.string().optional()
      .describe('Target date to achieve goal (YYYY-MM-DD)'),
    description: z.string().max(500).optional()
      .describe('Optional description of the goal'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const {
        title,
        category,
        target_value,
        tracked_metric,
        unit,
        direction = 'increase',
        target_date,
        description,
      } = params;

      // Get baseline value from health data if available
      let baseline_value = null;
      let current_value = null;

      if (tracked_metric) {
        // Try to get current value from health baselines
        const { data: baseline } = await context.supabase
          .from('user_health_baselines')
          .select('baseline_value')
          .eq('email', context.userEmail)
          .eq('metric_type', tracked_metric)
          .maybeSingle();

        if (baseline) {
          baseline_value = baseline.baseline_value;
          current_value = baseline.baseline_value;
        }
      }

      // Calculate initial progress
      let progress_pct = 0;
      if (baseline_value !== null && target_value !== baseline_value) {
        if (direction === 'decrease') {
          progress_pct = 0; // Starting point
        } else if (direction === 'maintain') {
          progress_pct = Math.abs(current_value - target_value) / target_value <= 0.05 ? 100 : 50;
        } else {
          progress_pct = 0; // Starting point
        }
      }

      // Create the goal
      const { data: goal, error } = await context.supabase
        .from('user_health_goals')
        .insert({
          email: context.userEmail,
          title,
          description,
          category,
          tracked_metric: category === 'CUSTOM' ? null : tracked_metric,
          custom_metric_name: category === 'CUSTOM' ? tracked_metric : null,
          target_value,
          current_value,
          baseline_value,
          unit,
          direction,
          progress_pct,
          start_date: new Date().toISOString().split('T')[0],
          target_date,
          status: 'active',
          manual_tracking: !tracked_metric,
        })
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        data: {
          goal_id: goal.id,
          title,
          category,
          target: `${target_value} ${unit || ''}`.trim(),
          baseline: baseline_value !== null ? `${baseline_value} ${unit || ''}`.trim() : 'Not set',
          direction,
          target_date,
          message: `Created goal: "${title}" - ${direction} to ${target_value} ${unit || ''}`,
        },
        metadata: {
          source: 'goal_creation',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create goal: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

// Update goal progress manually
export const updateGoalProgressTool: ToolDefinition = {
  name: 'update_goal_progress',
  description: `Update the progress on a health goal.
    Use when user reports progress like "I did 10000 steps today" for their step goal.`,
  riskLevel: 'medium',
  parameters: z.object({
    goal_id: z.string().uuid()
      .describe('ID of the goal to update'),
    current_value: z.number()
      .describe('New current value'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const { goal_id, current_value } = params;

      // Get the goal
      const { data: goal, error: fetchError } = await context.supabase
        .from('user_health_goals')
        .select('*')
        .eq('id', goal_id)
        .eq('email', context.userEmail)
        .single();

      if (fetchError || !goal) {
        return {
          success: false,
          error: 'Goal not found or access denied',
        };
      }

      // Calculate new progress
      let progress_pct = 0;
      const baseline = goal.baseline_value || goal.current_value || 0;

      if (goal.direction === 'decrease') {
        if (baseline === goal.target_value) {
          progress_pct = current_value <= goal.target_value ? 100 : 0;
        } else {
          progress_pct = ((baseline - current_value) / (baseline - goal.target_value)) * 100;
        }
      } else if (goal.direction === 'maintain') {
        const variance = Math.abs(current_value - goal.target_value) / goal.target_value;
        progress_pct = variance <= 0.05 ? 100 : Math.max(0, 100 - variance * 100);
      } else {
        if (baseline === goal.target_value) {
          progress_pct = current_value >= goal.target_value ? 100 : 0;
        } else {
          progress_pct = ((current_value - baseline) / (goal.target_value - baseline)) * 100;
        }
      }

      // Clamp progress between 0 and 100
      progress_pct = Math.max(0, Math.min(100, progress_pct));

      // Check if goal is completed
      const isCompleted = progress_pct >= 100;

      // Update the goal
      const { error: updateError } = await context.supabase
        .from('user_health_goals')
        .update({
          current_value,
          progress_pct: Math.round(progress_pct),
          status: isCompleted ? 'completed' : goal.status,
          completed_at: isCompleted ? new Date().toISOString() : null,
        })
        .eq('id', goal_id);

      if (updateError) throw updateError;

      return {
        success: true,
        data: {
          goal_id,
          title: goal.title,
          previous_value: goal.current_value,
          new_value: current_value,
          progress_percent: Math.round(progress_pct),
          is_completed: isCompleted,
          target_value: goal.target_value,
          unit: goal.unit,
        },
        metadata: {
          source: 'goal_progress_update',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to update goal progress: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

// Pause a goal
export const pauseGoalTool: ToolDefinition = {
  name: 'pause_goal',
  description: `Pause a health goal temporarily.
    Use when user wants to take a break from a goal.`,
  riskLevel: 'medium',
  parameters: z.object({
    goal_id: z.string().uuid()
      .describe('ID of the goal to pause'),
    reason: z.string().max(200).optional()
      .describe('Optional reason for pausing'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const { goal_id, reason } = params;

      // Verify ownership and update
      const { data: goal, error } = await context.supabase
        .from('user_health_goals')
        .update({
          status: 'paused',
          description: reason
            ? `[Paused: ${reason}] ${(await context.supabase.from('user_health_goals').select('description').eq('id', goal_id).single()).data?.description || ''}`
            : undefined,
        })
        .eq('id', goal_id)
        .eq('email', context.userEmail)
        .select('title')
        .single();

      if (error) throw error;

      return {
        success: true,
        data: {
          goal_id,
          title: goal?.title,
          status: 'paused',
          reason,
          message: `Goal "${goal?.title}" has been paused`,
        },
        metadata: {
          source: 'goal_pause',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to pause goal: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

// Resume a paused goal
export const resumeGoalTool: ToolDefinition = {
  name: 'resume_goal',
  description: `Resume a paused health goal.`,
  riskLevel: 'medium',
  parameters: z.object({
    goal_id: z.string().uuid()
      .describe('ID of the goal to resume'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const { goal_id } = params;

      const { data: goal, error } = await context.supabase
        .from('user_health_goals')
        .update({ status: 'active' })
        .eq('id', goal_id)
        .eq('email', context.userEmail)
        .eq('status', 'paused')
        .select('title')
        .single();

      if (error) throw error;

      return {
        success: true,
        data: {
          goal_id,
          title: goal?.title,
          status: 'active',
          message: `Goal "${goal?.title}" is now active again`,
        },
        metadata: {
          source: 'goal_resume',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to resume goal: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

// Complete a goal
export const completeGoalTool: ToolDefinition = {
  name: 'complete_goal',
  description: `Mark a health goal as completed.
    Use when user confirms they've achieved their goal.`,
  riskLevel: 'medium',
  parameters: z.object({
    goal_id: z.string().uuid()
      .describe('ID of the goal to complete'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const { goal_id } = params;

      const { data: goal, error } = await context.supabase
        .from('user_health_goals')
        .update({
          status: 'completed',
          progress_pct: 100,
          completed_at: new Date().toISOString(),
        })
        .eq('id', goal_id)
        .eq('email', context.userEmail)
        .select('title, category')
        .single();

      if (error) throw error;

      return {
        success: true,
        data: {
          goal_id,
          title: goal?.title,
          category: goal?.category,
          status: 'completed',
          message: `🎉 Congratulations! Goal "${goal?.title}" has been completed!`,
        },
        metadata: {
          source: 'goal_completion',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to complete goal: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

// Abandon a goal
export const abandonGoalTool: ToolDefinition = {
  name: 'abandon_goal',
  description: `Abandon a health goal that's no longer relevant.
    Use when user wants to stop tracking a goal permanently.`,
  riskLevel: 'medium',
  parameters: z.object({
    goal_id: z.string().uuid()
      .describe('ID of the goal to abandon'),
    reason: z.string().max(200).optional()
      .describe('Optional reason for abandoning'),
  }),
  execute: async (params, context): Promise<ToolResult> => {
    try {
      const { goal_id, reason } = params;

      const { data: goal, error } = await context.supabase
        .from('user_health_goals')
        .update({
          status: 'abandoned',
        })
        .eq('id', goal_id)
        .eq('email', context.userEmail)
        .select('title')
        .single();

      if (error) throw error;

      return {
        success: true,
        data: {
          goal_id,
          title: goal?.title,
          status: 'abandoned',
          reason,
          message: `Goal "${goal?.title}" has been abandoned`,
        },
        metadata: {
          source: 'goal_abandon',
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to abandon goal: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

// Export all goal tools
export const goalsTools = [
  getHealthGoalsTool,
  createHealthGoalTool,
  updateGoalProgressTool,
  pauseGoalTool,
  resumeGoalTool,
  completeGoalTool,
  abandonGoalTool,
];
