/**
 * Smart Goal Suggestion Service
 *
 * Generates personalized goal suggestions based on:
 * 1. User's actual health data and baselines
 * 2. Current patterns and trends
 * 3. What goals they already have
 * 4. Recent insights that indicate areas for improvement
 *
 * Uses AI to create contextual, achievable goals with personalized targets.
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { getCurrentMetrics } from './goal-progress-sync';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================================================
// TYPES
// ============================================================================

export interface GoalSuggestion {
  id: string;
  title: string;
  description: string;
  reason: string;  // Why this goal is suggested (personalized)
  category: 'SLEEP' | 'ACTIVITY' | 'RECOVERY' | 'GLUCOSE' | 'STRESS';
  trackedMetric: string;
  currentValue: number | null;
  targetValue: number;
  unit: string;
  direction: 'increase' | 'decrease' | 'maintain';
  difficulty: 'easy' | 'moderate' | 'challenging';
  estimatedTimeToAchieve: string;  // e.g., "2-3 weeks"
  priority: number;  // 1-5, higher = more important
  relatedInsightIds?: string[];
}

interface UserHealthContext {
  email: string;
  metrics: Record<string, { value: number; source: string } | null>;
  baselines: Record<string, number>;
  activeGoals: Array<{ category: string; trackedMetric: string }>;
  recentInsightCategories: string[];
  trends: Record<string, 'improving' | 'stable' | 'declining'>;
}

// ============================================================================
// BASELINE & CONTEXT FETCHING
// ============================================================================

/**
 * Get user's health baselines from database
 */
async function getUserBaselines(email: string): Promise<Record<string, number>> {
  const { data } = await supabase
    .from('user_health_baselines')
    .select('metric_type, baseline_value')
    .eq('email', email);

  const baselines: Record<string, number> = {};
  if (data) {
    for (const row of data) {
      baselines[row.metric_type] = row.baseline_value;
    }
  }
  return baselines;
}

/**
 * Get user's active goals
 */
async function getUserActiveGoals(email: string): Promise<Array<{ category: string; trackedMetric: string }>> {
  const { data } = await supabase
    .from('user_health_goals')
    .select('category, tracked_metric')
    .eq('email', email)
    .eq('status', 'active');

  return (data || []).map(g => ({
    category: g.category,
    trackedMetric: g.tracked_metric,
  }));
}

/**
 * Get recent insight categories (last 7 days)
 */
async function getRecentInsightCategories(email: string): Promise<string[]> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data } = await supabase
    .from('user_insights')
    .select('category')
    .eq('email', email)
    .gte('created_at', sevenDaysAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(20);

  // Return unique categories
  return [...new Set((data || []).map(i => i.category))];
}

/**
 * Get health trends from forge training data
 */
async function getHealthTrends(email: string): Promise<Record<string, 'improving' | 'stable' | 'declining'>> {
  const { data } = await supabase
    .from('forge_training_data')
    .select('recovery_score, hrv_trends')
    .eq('email', email)
    .eq('provider', 'whoop')
    .order('sync_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  const trends: Record<string, 'improving' | 'stable' | 'declining'> = {};

  if (data) {
    if (data.recovery_score?.trend) {
      trends.recovery = data.recovery_score.trend;
    }
    if (data.hrv_trends?.trend) {
      trends.hrv = data.hrv_trends.trend;
    }
  }

  return trends;
}

/**
 * Build full user health context
 */
async function buildUserHealthContext(email: string): Promise<UserHealthContext> {
  const [metrics, baselines, activeGoals, recentInsights, trends] = await Promise.all([
    getCurrentMetrics(email),
    getUserBaselines(email),
    getUserActiveGoals(email),
    getRecentInsightCategories(email),
    getHealthTrends(email),
  ]);

  return {
    email,
    metrics,
    baselines,
    activeGoals,
    recentInsightCategories: recentInsights,
    trends,
  };
}

// ============================================================================
// TARGET CALCULATION
// ============================================================================

/**
 * Calculate a personalized, achievable target based on current value
 */
function calculatePersonalizedTarget(
  metric: string,
  currentValue: number | null,
  baseline: number | null,
  direction: 'increase' | 'decrease'
): { target: number; difficulty: 'easy' | 'moderate' | 'challenging' } {
  const current = currentValue ?? baseline ?? 0;

  // Default targets if no data
  const defaultTargets: Record<string, { value: number; unit: string }> = {
    sleep_score: { value: 85, unit: 'score' },
    sleep_duration_hours: { value: 8, unit: 'hours' },
    recovery_score: { value: 70, unit: 'score' },
    hrv_ms: { value: 60, unit: 'ms' },
    resting_hr: { value: 55, unit: 'bpm' },
    daily_steps: { value: 10000, unit: 'steps' },
    time_in_range_pct: { value: 80, unit: '%' },
  };

  if (!current || current === 0) {
    return {
      target: defaultTargets[metric]?.value ?? 0,
      difficulty: 'moderate',
    };
  }

  // Calculate improvement percentage based on metric type
  let improvementPercent: number;
  let difficulty: 'easy' | 'moderate' | 'challenging';

  if (direction === 'increase') {
    // For increase goals, suggest 10-20% improvement
    if (metric === 'daily_steps') {
      // Steps: round to nearest 1000
      const improvement = Math.ceil(current * 1.15 / 1000) * 1000;
      const percentIncrease = (improvement - current) / current;
      difficulty = percentIncrease < 0.1 ? 'easy' : percentIncrease < 0.2 ? 'moderate' : 'challenging';
      return { target: Math.min(improvement, 15000), difficulty };
    } else if (metric.includes('score') || metric.includes('pct')) {
      // Scores/percentages: cap at 100
      improvementPercent = current < 60 ? 0.15 : current < 80 ? 0.1 : 0.05;
      const target = Math.min(Math.round(current * (1 + improvementPercent)), 100);
      difficulty = improvementPercent > 0.12 ? 'challenging' : improvementPercent > 0.08 ? 'moderate' : 'easy';
      return { target, difficulty };
    } else if (metric === 'hrv_ms') {
      // HRV: 5-15ms improvement
      const improvement = current < 40 ? 10 : current < 60 ? 8 : 5;
      difficulty = improvement > 8 ? 'challenging' : improvement > 5 ? 'moderate' : 'easy';
      return { target: Math.round(current + improvement), difficulty };
    } else if (metric === 'sleep_duration_hours') {
      // Sleep: target 7.5-8.5 hours
      const target = current < 6.5 ? 7.5 : current < 7.5 ? 8 : 8;
      difficulty = (target - current) > 1 ? 'challenging' : (target - current) > 0.5 ? 'moderate' : 'easy';
      return { target, difficulty };
    }
  } else {
    // For decrease goals (like resting HR)
    if (metric === 'resting_hr') {
      // RHR: 3-5 bpm reduction
      const reduction = current > 70 ? 5 : current > 60 ? 4 : 3;
      difficulty = reduction > 4 ? 'challenging' : reduction > 3 ? 'moderate' : 'easy';
      return { target: Math.max(Math.round(current - reduction), 50), difficulty };
    }
  }

  // Default: 10% improvement
  const target = direction === 'increase'
    ? Math.round(current * 1.1)
    : Math.round(current * 0.9);

  return { target, difficulty: 'moderate' };
}

// ============================================================================
// AI SUGGESTION GENERATION
// ============================================================================

/**
 * Generate smart goal suggestions using AI
 */
export async function generateGoalSuggestions(
  email: string,
  maxSuggestions: number = 3,
  forInsightCategory?: string
): Promise<GoalSuggestion[]> {
  console.log(`[GoalSuggestion] Generating suggestions for ${email}`);

  // Build user context
  const context = await buildUserHealthContext(email);

  // Filter out categories where user already has goals
  const activeCategories = context.activeGoals.map(g => g.category);
  const activeMetrics = context.activeGoals.map(g => g.trackedMetric);

  // Build available metrics with current values
  const availableMetrics: Array<{
    metric: string;
    category: string;
    currentValue: number | null;
    baseline: number | null;
    direction: 'increase' | 'decrease';
    unit: string;
    hasRecentInsight: boolean;
  }> = [];

  // Define metric configurations
  const metricConfigs = [
    { metric: 'sleep_score', category: 'SLEEP', direction: 'increase' as const, unit: 'score' },
    { metric: 'sleep_duration_hours', category: 'SLEEP', direction: 'increase' as const, unit: 'hours' },
    { metric: 'recovery_score', category: 'RECOVERY', direction: 'increase' as const, unit: 'score' },
    { metric: 'hrv_ms', category: 'RECOVERY', direction: 'increase' as const, unit: 'ms' },
    { metric: 'resting_hr', category: 'RECOVERY', direction: 'decrease' as const, unit: 'bpm' },
    { metric: 'daily_steps', category: 'ACTIVITY', direction: 'increase' as const, unit: 'steps' },
    { metric: 'time_in_range_pct', category: 'GLUCOSE', direction: 'increase' as const, unit: '%' },
  ];

  for (const config of metricConfigs) {
    // Skip if user already has goal for this metric
    if (activeMetrics.includes(config.metric)) continue;

    const metricData = context.metrics[config.metric];
    const hasRecentInsight = context.recentInsightCategories.includes(config.category);

    availableMetrics.push({
      ...config,
      currentValue: metricData?.value ?? null,
      baseline: context.baselines[config.metric] ?? null,
      hasRecentInsight,
    });
  }

  // If targeting a specific insight category, prioritize those metrics
  if (forInsightCategory) {
    availableMetrics.sort((a, b) => {
      if (a.category === forInsightCategory && b.category !== forInsightCategory) return -1;
      if (b.category === forInsightCategory && a.category !== forInsightCategory) return 1;
      return 0;
    });
  } else {
    // Sort by: has recent insight > has data > alphabetical
    availableMetrics.sort((a, b) => {
      if (a.hasRecentInsight && !b.hasRecentInsight) return -1;
      if (b.hasRecentInsight && !a.hasRecentInsight) return 1;
      if (a.currentValue && !b.currentValue) return -1;
      if (b.currentValue && !a.currentValue) return 1;
      return 0;
    });
  }

  // Generate suggestions for top metrics
  const suggestions: GoalSuggestion[] = [];
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  for (const metric of availableMetrics.slice(0, maxSuggestions + 2)) {
    const { target, difficulty } = calculatePersonalizedTarget(
      metric.metric,
      metric.currentValue,
      metric.baseline,
      metric.direction
    );

    // Use AI to generate personalized title and reason
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a health coach creating personalized goal suggestions. Be encouraging but realistic. Keep responses concise.`,
          },
          {
            role: 'user',
            content: `Create a goal suggestion for this metric:
- Metric: ${metric.metric.replace(/_/g, ' ')}
- Current value: ${metric.currentValue ?? 'unknown'}
- Target value: ${target} ${metric.unit}
- Direction: ${metric.direction}
- Category: ${metric.category}
- Has recent insight about this: ${metric.hasRecentInsight}
- Trend: ${context.trends[metric.metric.split('_')[0]] || 'unknown'}

Return JSON:
{
  "title": "Short, motivating goal title (5-7 words)",
  "description": "One line with target (e.g., 'Target: 8K steps daily')",
  "reason": "Personalized reason why this goal matters for them (1 sentence, reference their current value if known)",
  "estimatedTime": "Realistic timeframe (e.g., '2-3 weeks')"
}`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 200,
      });

      const content = response.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);

      suggestions.push({
        id: `suggestion_${metric.metric}_${Date.now()}`,
        title: parsed.title || `Improve your ${metric.metric.replace(/_/g, ' ')}`,
        description: parsed.description || `Target: ${target} ${metric.unit}`,
        reason: parsed.reason || `Based on your health data`,
        category: metric.category as GoalSuggestion['category'],
        trackedMetric: metric.metric,
        currentValue: metric.currentValue,
        targetValue: target,
        unit: metric.unit,
        direction: metric.direction,
        difficulty,
        estimatedTimeToAchieve: parsed.estimatedTime || '2-4 weeks',
        priority: metric.hasRecentInsight ? 5 : metric.currentValue ? 3 : 1,
      });
    } catch (e) {
      console.error(`[GoalSuggestion] AI generation failed for ${metric.metric}:`, e);

      // Fallback to template-based suggestion
      suggestions.push({
        id: `suggestion_${metric.metric}_${Date.now()}`,
        title: getDefaultTitle(metric.metric, target, metric.unit),
        description: `Target: ${formatTarget(target, metric.unit)}`,
        reason: getDefaultReason(metric.metric, metric.currentValue),
        category: metric.category as GoalSuggestion['category'],
        trackedMetric: metric.metric,
        currentValue: metric.currentValue,
        targetValue: target,
        unit: metric.unit,
        direction: metric.direction,
        difficulty,
        estimatedTimeToAchieve: '2-4 weeks',
        priority: metric.hasRecentInsight ? 5 : metric.currentValue ? 3 : 1,
      });
    }
  }

  // Sort by priority and return top suggestions
  suggestions.sort((a, b) => b.priority - a.priority);

  console.log(`[GoalSuggestion] Generated ${suggestions.length} suggestions`);
  return suggestions.slice(0, maxSuggestions);
}

/**
 * Get suggestion for a specific insight
 */
export async function getSuggestionForInsight(
  email: string,
  insightCategory: string,
  insightId: string
): Promise<GoalSuggestion | null> {
  const suggestions = await generateGoalSuggestions(email, 1, insightCategory);

  if (suggestions.length > 0) {
    suggestions[0].relatedInsightIds = [insightId];
    return suggestions[0];
  }

  return null;
}

// ============================================================================
// HELPERS
// ============================================================================

function getDefaultTitle(metric: string, target: number, unit: string): string {
  const titles: Record<string, string> = {
    sleep_score: `Reach ${target}+ sleep score`,
    sleep_duration_hours: `Get ${target} hours of quality sleep`,
    recovery_score: `Boost recovery to ${target}%`,
    hrv_ms: `Increase HRV to ${target}ms`,
    resting_hr: `Lower resting HR to ${target} bpm`,
    daily_steps: `Walk ${(target / 1000).toFixed(0)}K steps daily`,
    time_in_range_pct: `Achieve ${target}% time in range`,
  };
  return titles[metric] || `Improve ${metric.replace(/_/g, ' ')}`;
}

function getDefaultReason(metric: string, currentValue: number | null): string {
  if (currentValue) {
    return `Your current ${metric.replace(/_/g, ' ')} is ${currentValue}. Small improvements lead to big health gains.`;
  }
  return `Tracking this metric helps optimize your overall health.`;
}

function formatTarget(target: number, unit: string): string {
  if (unit === 'steps') {
    return `${(target / 1000).toFixed(0)}K ${unit} per day`;
  }
  if (unit === 'hours') {
    return `${target} ${unit} per night`;
  }
  return `${target} ${unit}`;
}
