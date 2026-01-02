/**
 * Goals Service
 *
 * Manages user health goals with auto-tracking from baselines
 * and AI-powered goal suggestions.
 *
 * Part of Phase 3: Goals System
 */

import { createClient } from '@supabase/supabase-js';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('GoalsService');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type GoalCategory = 'SLEEP' | 'ACTIVITY' | 'RECOVERY' | 'GLUCOSE' | 'WEIGHT' | 'STRESS' | 'CUSTOM';
export type GoalStatus = 'active' | 'completed' | 'paused' | 'abandoned';
export type GoalDirection = 'increase' | 'decrease' | 'maintain';

export interface UserHealthGoal {
  id: string;
  email: string;
  title: string;
  description?: string;
  category: GoalCategory;
  trackedMetric?: string;
  targetValue: number;
  currentValue?: number;
  baselineValue?: number;
  unit?: string;
  progressPct: number;
  direction: GoalDirection;
  startDate: string;
  targetDate?: string;
  status: GoalStatus;
  completedAt?: string;
  linkedInsightIds?: string[];
  linkedInterventionIds?: string[];
  isAiSuggested: boolean;
  suggestionReason?: string;
  customMetricName?: string;
  manualTracking: boolean;
  icon?: string;
  color?: string;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGoalInput {
  title: string;
  description?: string;
  category: GoalCategory;
  trackedMetric?: string;
  targetValue: number;
  unit?: string;
  direction?: GoalDirection;
  targetDate?: string;
  customMetricName?: string;
  manualTracking?: boolean;
  icon?: string;
  color?: string;
  isAiSuggested?: boolean;
  suggestionReason?: string;
  linkedInsightIds?: string[];
}

export interface UpdateGoalInput {
  title?: string;
  description?: string;
  targetValue?: number;
  targetDate?: string;
  status?: GoalStatus;
  currentValue?: number;
  priority?: number;
}

// Goal category to available metrics mapping
export const CATEGORY_METRICS: Record<GoalCategory, { metric: string; label: string; unit: string; direction: GoalDirection }[]> = {
  SLEEP: [
    { metric: 'sleep_score', label: 'Sleep Score', unit: 'score', direction: 'increase' },
    { metric: 'sleep_duration_hours', label: 'Sleep Duration', unit: 'hours', direction: 'increase' },
    { metric: 'deep_sleep_minutes', label: 'Deep Sleep', unit: 'minutes', direction: 'increase' },
    { metric: 'rem_sleep_minutes', label: 'REM Sleep', unit: 'minutes', direction: 'increase' },
    { metric: 'sleep_efficiency', label: 'Sleep Efficiency', unit: '%', direction: 'increase' },
  ],
  ACTIVITY: [
    { metric: 'daily_steps', label: 'Daily Steps', unit: 'steps', direction: 'increase' },
    { metric: 'active_calories', label: 'Active Calories', unit: 'cal', direction: 'increase' },
    { metric: 'strain_score', label: 'Strain Score', unit: 'score', direction: 'increase' },
  ],
  RECOVERY: [
    { metric: 'recovery_score', label: 'Recovery Score', unit: 'score', direction: 'increase' },
    { metric: 'hrv_ms', label: 'HRV', unit: 'ms', direction: 'increase' },
    { metric: 'resting_hr', label: 'Resting Heart Rate', unit: 'bpm', direction: 'decrease' },
  ],
  GLUCOSE: [
    { metric: 'avg_glucose', label: 'Average Glucose', unit: 'mg/dL', direction: 'decrease' },
    { metric: 'glucose_variability', label: 'Glucose Variability', unit: '%', direction: 'decrease' },
    { metric: 'time_in_range_pct', label: 'Time in Range', unit: '%', direction: 'increase' },
  ],
  WEIGHT: [],
  STRESS: [],
  CUSTOM: [],
};

// Predefined goal templates
export const GOAL_TEMPLATES: { title: string; category: GoalCategory; trackedMetric?: string; targetValue: number; unit: string; direction: GoalDirection }[] = [
  { title: 'Improve Sleep Score', category: 'SLEEP', trackedMetric: 'sleep_score', targetValue: 85, unit: 'score', direction: 'increase' },
  { title: 'Get 8 Hours Sleep', category: 'SLEEP', trackedMetric: 'sleep_duration_hours', targetValue: 8, unit: 'hours', direction: 'increase' },
  { title: '10K Steps Daily', category: 'ACTIVITY', trackedMetric: 'daily_steps', targetValue: 10000, unit: 'steps', direction: 'increase' },
  { title: 'Boost HRV to 60ms', category: 'RECOVERY', trackedMetric: 'hrv_ms', targetValue: 60, unit: 'ms', direction: 'increase' },
  { title: '80% Time in Range', category: 'GLUCOSE', trackedMetric: 'time_in_range_pct', targetValue: 80, unit: '%', direction: 'increase' },
];

/**
 * Create a new goal
 */
export async function createGoal(
  email: string,
  input: CreateGoalInput
): Promise<string | null> {
  try {
    // Get baseline value for tracked metric
    let baselineValue: number | null = null;
    if (input.trackedMetric) {
      const { data: baseline } = await supabase
        .from('user_health_baselines')
        .select('baseline_value')
        .eq('email', email)
        .eq('metric_type', input.trackedMetric)
        .single();

      baselineValue = baseline?.baseline_value ?? null;
    }

    const { data, error } = await supabase
      .from('user_health_goals')
      .insert({
        email,
        title: input.title,
        description: input.description,
        category: input.category,
        tracked_metric: input.trackedMetric,
        target_value: input.targetValue,
        baseline_value: baselineValue,
        current_value: baselineValue,
        unit: input.unit,
        direction: input.direction || 'increase',
        target_date: input.targetDate,
        custom_metric_name: input.customMetricName,
        manual_tracking: input.manualTracking || false,
        icon: input.icon,
        color: input.color,
        is_ai_suggested: input.isAiSuggested || false,
        suggestion_reason: input.suggestionReason,
        linked_insight_ids: input.linkedInsightIds || [],
        progress_pct: 0,
      })
      .select('id')
      .single();

    if (error) {
      logger.error({ email, error }, 'Error creating goal');
      return null;
    }

    logger.info({ email, goalId: data?.id }, 'Created goal');
    return data?.id || null;
  } catch (e) {
    logger.error({ email, error: e }, 'Exception creating goal');
    return null;
  }
}

/**
 * Get user's goals
 */
export async function getGoals(
  email: string,
  options: {
    status?: GoalStatus;
    category?: GoalCategory;
    limit?: number;
  } = {}
): Promise<UserHealthGoal[]> {
  try {
    let query = supabase
      .from('user_health_goals')
      .select('*')
      .eq('email', email)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (options.status) {
      query = query.eq('status', options.status);
    }
    if (options.category) {
      query = query.eq('category', options.category);
    }
    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      logger.error({ email, error }, 'Error fetching goals');
      return [];
    }

    return (data || []).map(mapToUserHealthGoal);
  } catch (e) {
    logger.error({ email, error: e }, 'Exception fetching goals');
    return [];
  }
}

/**
 * Get a single goal by ID
 */
export async function getGoal(goalId: string): Promise<UserHealthGoal | null> {
  try {
    const { data, error } = await supabase
      .from('user_health_goals')
      .select('*')
      .eq('id', goalId)
      .single();

    if (error) {
      logger.error({ goalId, error }, 'Error fetching goal');
      return null;
    }

    return data ? mapToUserHealthGoal(data) : null;
  } catch (e) {
    logger.error({ goalId, error: e }, 'Exception fetching goal');
    return null;
  }
}

/**
 * Update a goal
 */
export async function updateGoal(
  goalId: string,
  input: UpdateGoalInput
): Promise<boolean> {
  try {
    const updateData: Record<string, unknown> = {};

    if (input.title !== undefined) updateData.title = input.title;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.targetValue !== undefined) updateData.target_value = input.targetValue;
    if (input.targetDate !== undefined) updateData.target_date = input.targetDate;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.priority !== undefined) updateData.priority = input.priority;

    // For manual tracking updates, use the compute_goal_progress function
    if (input.currentValue !== undefined) {
      const { error: progressError } = await supabase.rpc('compute_goal_progress', {
        p_goal_id: goalId,
        p_new_current_value: input.currentValue,
      });

      if (progressError) {
        logger.error({ goalId, error: progressError }, 'Error computing progress');
      }
    }

    if (Object.keys(updateData).length > 0) {
      const { error } = await supabase
        .from('user_health_goals')
        .update(updateData)
        .eq('id', goalId);

      if (error) {
        logger.error({ goalId, error }, 'Error updating goal');
        return false;
      }
    }

    return true;
  } catch (e) {
    logger.error({ goalId, error: e }, 'Exception updating goal');
    return false;
  }
}

/**
 * Delete a goal
 */
export async function deleteGoal(goalId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_health_goals')
      .delete()
      .eq('id', goalId);

    if (error) {
      logger.error({ goalId, error }, 'Error deleting goal');
      return false;
    }

    return true;
  } catch (e) {
    logger.error({ goalId, error: e }, 'Exception deleting goal');
    return false;
  }
}

/**
 * Link an insight to a goal
 */
export async function linkInsightToGoal(
  goalId: string,
  insightId: string
): Promise<boolean> {
  try {
    const { data: goal, error: fetchError } = await supabase
      .from('user_health_goals')
      .select('linked_insight_ids')
      .eq('id', goalId)
      .single();

    if (fetchError) return false;

    const currentIds = goal?.linked_insight_ids || [];
    if (currentIds.includes(insightId)) return true;

    const { error } = await supabase
      .from('user_health_goals')
      .update({
        linked_insight_ids: [...currentIds, insightId],
      })
      .eq('id', goalId);

    return !error;
  } catch (e) {
    logger.error({ goalId, insightId, error: e }, 'Exception linking insight');
    return false;
  }
}

/**
 * Get goals relevant to an insight (by category)
 */
export async function getGoalsForInsight(
  email: string,
  insightCategory: string
): Promise<UserHealthGoal[]> {
  // Map insight categories to goal categories
  const categoryMapping: Record<string, GoalCategory[]> = {
    'SLEEP': ['SLEEP'],
    'GLUCOSE': ['GLUCOSE'],
    'RECOVERY': ['RECOVERY'],
    'ACTIVITY': ['ACTIVITY'],
    'STRESS': ['STRESS'],
    'BLOOD': ['GLUCOSE', 'RECOVERY'],
    'CROSS_DOMAIN': ['SLEEP', 'ACTIVITY', 'RECOVERY', 'GLUCOSE'],
    'GENERAL': [],
  };

  const goalCategories = categoryMapping[insightCategory.toUpperCase()] || [];
  if (goalCategories.length === 0) return [];

  const allGoals = await getGoals(email, { status: 'active' });
  return allGoals.filter(g => goalCategories.includes(g.category));
}

/**
 * Build context for AI prompt injection
 */
export async function buildGoalsContext(email: string): Promise<string> {
  const activeGoals = await getGoals(email, { status: 'active', limit: 5 });

  if (activeGoals.length === 0) {
    return '';
  }

  let context = '\n## USER\'S ACTIVE HEALTH GOALS:\n';

  for (const goal of activeGoals) {
    context += `- **${goal.title}** (${goal.category}): `;
    context += `${goal.progressPct.toFixed(0)}% progress`;
    if (goal.currentValue !== undefined && goal.unit) {
      context += ` (currently ${goal.currentValue} ${goal.unit}`;
      context += `, target: ${goal.targetValue} ${goal.unit})`;
    }
    if (goal.targetDate) {
      const targetDate = new Date(goal.targetDate);
      const daysRemaining = Math.ceil((targetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysRemaining > 0) {
        context += ` - ${daysRemaining} days remaining`;
      }
    }
    context += '\n';
  }

  context += '\nWhen generating insights, prioritize recommendations that help the user progress toward their active goals.\n';

  return context;
}

/**
 * Get goal templates for a category
 */
export function getTemplatesForCategory(category: GoalCategory): typeof GOAL_TEMPLATES {
  return GOAL_TEMPLATES.filter(t => t.category === category);
}

/**
 * Get available metrics for a category
 */
export function getMetricsForCategory(category: GoalCategory) {
  return CATEGORY_METRICS[category] || [];
}

// Helper function to map database row to TypeScript interface
function mapToUserHealthGoal(row: Record<string, unknown>): UserHealthGoal {
  return {
    id: row.id as string,
    email: row.email as string,
    title: row.title as string,
    description: row.description as string | undefined,
    category: row.category as GoalCategory,
    trackedMetric: row.tracked_metric as string | undefined,
    targetValue: Number(row.target_value),
    currentValue: row.current_value !== null ? Number(row.current_value) : undefined,
    baselineValue: row.baseline_value !== null ? Number(row.baseline_value) : undefined,
    unit: row.unit as string | undefined,
    progressPct: Number(row.progress_pct) || 0,
    direction: (row.direction as GoalDirection) || 'increase',
    startDate: row.start_date as string,
    targetDate: row.target_date as string | undefined,
    status: (row.status as GoalStatus) || 'active',
    completedAt: row.completed_at as string | undefined,
    linkedInsightIds: row.linked_insight_ids as string[] | undefined,
    linkedInterventionIds: row.linked_intervention_ids as string[] | undefined,
    isAiSuggested: Boolean(row.is_ai_suggested),
    suggestionReason: row.suggestion_reason as string | undefined,
    customMetricName: row.custom_metric_name as string | undefined,
    manualTracking: Boolean(row.manual_tracking),
    icon: row.icon as string | undefined,
    color: row.color as string | undefined,
    priority: Number(row.priority) || 0,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}
