/**
 * Outcome Analyzer Service
 * Tracks and analyzes advice outcomes to learn what works for each user.
 * Enables the agent to give better, personalized recommendations over time.
 */

import { createClient } from '@supabase/supabase-js';

// =============================================================================
// TYPES
// =============================================================================

export type AdviceCategory =
  | 'sleep'
  | 'nutrition'
  | 'exercise'
  | 'supplements'
  | 'stress'
  | 'recovery'
  | 'glucose'
  | 'hydration'
  | 'habits'
  | 'other';

export type OutcomeStatus =
  | 'pending'        // Waiting for outcome
  | 'improved'       // Metric improved
  | 'no_change'      // No significant change
  | 'worsened'       // Metric worsened
  | 'abandoned'      // User stopped following advice
  | 'unknown';       // Couldn't determine outcome

export interface AdviceRecord {
  id: string;
  userEmail: string;
  category: AdviceCategory;
  adviceGiven: string;
  adviceSummary: string;          // Short summary for display
  targetMetric?: string;          // e.g., "sleep_hours", "hrv"
  baselineValue?: number;         // Value before advice
  targetValue?: number;           // Goal value
  currentValue?: number;          // Latest value
  difficulty: 'easy' | 'medium' | 'hard';
  createdAt: string;
  followUpDate: string;           // When to check outcome
  outcome: OutcomeStatus;
  outcomeRecordedAt?: string;
  improvementPct?: number;        // % change from baseline
  abandonReason?: string;
  userFeedback?: string;
}

export interface AdviceEffectiveness {
  category: AdviceCategory;
  totalAdvice: number;
  successRate: number;            // % that improved
  averageImprovement: number;     // Avg % improvement when followed
  abandonmentRate: number;        // % that were abandoned
  avgDaysToOutcome: number;       // Typical time to see results
  successfulStrategies: string[]; // Advice that worked
  failedStrategies: string[];     // Advice that didn't work
  commonAbandonReasons: string[];
}

export interface UserAdviceProfile {
  userEmail: string;
  overallSuccessRate: number;
  preferredDifficulty: 'easy' | 'medium' | 'hard';
  bestCategories: AdviceCategory[];
  worstCategories: AdviceCategory[];
  avgFollowThrough: number;       // % of advice they follow
  effectivenessByCategory: Map<AdviceCategory, AdviceEffectiveness>;
  recentOutcomes: AdviceRecord[];
}

// =============================================================================
// CONSTANTS
// =============================================================================

const IMPROVEMENT_THRESHOLD = 0.05;  // 5% improvement = success
const DECLINE_THRESHOLD = -0.05;     // 5% decline = worsened
const DEFAULT_FOLLOWUP_DAYS = 7;
const LOOKBACK_DAYS = 90;

const CATEGORY_METRICS: Record<AdviceCategory, string[]> = {
  sleep: ['sleep_hours', 'sleep_score', 'deep_sleep_pct', 'sleep_efficiency'],
  nutrition: ['calories', 'protein_pct', 'meal_timing_score'],
  exercise: ['workout_frequency', 'steps', 'active_minutes', 'strength_score'],
  supplements: ['relevant_biomarker', 'energy_score', 'recovery_score'],
  stress: ['stress_score', 'hrv', 'resting_hr'],
  recovery: ['readiness_score', 'hrv', 'recovery_score'],
  glucose: ['avg_glucose', 'time_in_range', 'glucose_variability'],
  hydration: ['water_intake', 'hydration_score'],
  habits: ['streak_days', 'consistency_score'],
  other: [],
};

// =============================================================================
// ADVICE RECORDING
// =============================================================================

/**
 * Record advice given to a user
 */
export async function recordAdvice(
  userEmail: string,
  advice: {
    category: AdviceCategory;
    adviceGiven: string;
    targetMetric?: string;
    baselineValue?: number;
    targetValue?: number;
    difficulty?: 'easy' | 'medium' | 'hard';
    followUpDays?: number;
  },
  supabase: ReturnType<typeof createClient>
): Promise<string> {
  const followUpDate = new Date();
  followUpDate.setDate(followUpDate.getDate() + (advice.followUpDays || DEFAULT_FOLLOWUP_DAYS));

  // Create short summary (first 100 chars)
  const adviceSummary = advice.adviceGiven.length > 100
    ? advice.adviceGiven.substring(0, 97) + '...'
    : advice.adviceGiven;

  const record = {
    id: crypto.randomUUID(),
    user_email: userEmail,
    category: advice.category,
    advice_given: advice.adviceGiven,
    advice_summary: adviceSummary,
    target_metric: advice.targetMetric,
    baseline_value: advice.baselineValue,
    target_value: advice.targetValue,
    difficulty: advice.difficulty || 'medium',
    created_at: new Date().toISOString(),
    follow_up_date: followUpDate.toISOString(),
    outcome: 'pending',
  };

  const { data, error } = await (supabase.from('advice_outcomes') as any)
    .insert(record)
    .select('id')
    .single();

  if (error) {
    console.error('[OutcomeAnalyzer] Failed to record advice:', error);
    throw error;
  }

  return data.id;
}

/**
 * Record the outcome of previously given advice
 */
export async function recordOutcome(
  adviceId: string,
  outcome: {
    status: OutcomeStatus;
    currentValue?: number;
    abandonReason?: string;
    userFeedback?: string;
  },
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  // Get the original advice record
  const { data: advice } = await supabase
    .from('advice_outcomes')
    .select('baseline_value, target_value')
    .eq('id', adviceId)
    .single();

  const adviceRecord = advice as { baseline_value?: number; target_value?: number } | null;

  // Calculate improvement percentage if we have values
  let improvementPct: number | undefined;
  if (outcome.currentValue !== undefined && adviceRecord?.baseline_value !== undefined) {
    const change = outcome.currentValue - adviceRecord.baseline_value;
    improvementPct = adviceRecord.baseline_value !== 0
      ? (change / Math.abs(adviceRecord.baseline_value)) * 100
      : 0;
  }

  const { error } = await (supabase.from('advice_outcomes') as any)
    .update({
      outcome: outcome.status,
      current_value: outcome.currentValue,
      improvement_pct: improvementPct,
      abandon_reason: outcome.abandonReason,
      user_feedback: outcome.userFeedback,
      outcome_recorded_at: new Date().toISOString(),
    })
    .eq('id', adviceId);

  if (error) {
    console.error('[OutcomeAnalyzer] Failed to record outcome:', error);
  }
}

// =============================================================================
// AUTOMATIC OUTCOME DETECTION
// =============================================================================

/**
 * Check pending advice and auto-detect outcomes based on metric changes
 */
export async function detectPendingOutcomes(
  userEmail: string,
  currentMetrics: Record<string, number>,
  supabase: ReturnType<typeof createClient>
): Promise<Array<{ adviceId: string; detectedOutcome: OutcomeStatus; improvement: number }>> {
  // Get pending advice that's past follow-up date
  const { data: pendingAdvice } = await supabase
    .from('advice_outcomes')
    .select('*')
    .eq('user_email', userEmail)
    .eq('outcome', 'pending')
    .lte('follow_up_date', new Date().toISOString());

  if (!pendingAdvice || pendingAdvice.length === 0) {
    return [];
  }

  const results: Array<{ adviceId: string; detectedOutcome: OutcomeStatus; improvement: number }> = [];

  for (const advice of pendingAdvice as any[]) {
    if (!advice.target_metric || advice.baseline_value === null) {
      continue;
    }

    const currentValue = currentMetrics[advice.target_metric];
    if (currentValue === undefined) {
      continue;
    }

    // Calculate improvement
    const change = currentValue - advice.baseline_value;
    const improvementPct = advice.baseline_value !== 0
      ? change / Math.abs(advice.baseline_value)
      : 0;

    // Determine outcome
    let detectedOutcome: OutcomeStatus;
    if (improvementPct >= IMPROVEMENT_THRESHOLD) {
      detectedOutcome = 'improved';
    } else if (improvementPct <= DECLINE_THRESHOLD) {
      detectedOutcome = 'worsened';
    } else {
      detectedOutcome = 'no_change';
    }

    // Record the outcome
    await recordOutcome(
      advice.id,
      {
        status: detectedOutcome,
        currentValue,
      },
      supabase
    );

    results.push({
      adviceId: advice.id,
      detectedOutcome,
      improvement: improvementPct * 100,
    });
  }

  return results;
}

// =============================================================================
// EFFECTIVENESS ANALYSIS
// =============================================================================

/**
 * Get effectiveness stats for a specific advice category
 */
export async function getCategoryEffectiveness(
  userEmail: string,
  category: AdviceCategory,
  supabase: ReturnType<typeof createClient>
): Promise<AdviceEffectiveness> {
  const since = new Date();
  since.setDate(since.getDate() - LOOKBACK_DAYS);

  const { data: advice } = await supabase
    .from('advice_outcomes')
    .select('*')
    .eq('user_email', userEmail)
    .eq('category', category)
    .gte('created_at', since.toISOString())
    .neq('outcome', 'pending');

  const records = (advice as any[]) || [];

  if (records.length === 0) {
    return {
      category,
      totalAdvice: 0,
      successRate: 0,
      averageImprovement: 0,
      abandonmentRate: 0,
      avgDaysToOutcome: 0,
      successfulStrategies: [],
      failedStrategies: [],
      commonAbandonReasons: [],
    };
  }

  const improved = records.filter(r => r.outcome === 'improved');
  const abandoned = records.filter(r => r.outcome === 'abandoned');
  const worsened = records.filter(r => r.outcome === 'worsened');

  // Calculate rates
  const successRate = records.length > 0 ? improved.length / records.length : 0;
  const abandonmentRate = records.length > 0 ? abandoned.length / records.length : 0;

  // Calculate average improvement for successful advice
  const improvements = improved
    .filter(r => r.improvement_pct !== null)
    .map(r => r.improvement_pct);
  const averageImprovement = improvements.length > 0
    ? improvements.reduce((a, b) => a + b, 0) / improvements.length
    : 0;

  // Calculate average days to outcome
  const daysToOutcome = records
    .filter(r => r.outcome_recorded_at)
    .map(r => {
      const created = new Date(r.created_at);
      const recorded = new Date(r.outcome_recorded_at);
      return (recorded.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
    });
  const avgDaysToOutcome = daysToOutcome.length > 0
    ? daysToOutcome.reduce((a, b) => a + b, 0) / daysToOutcome.length
    : DEFAULT_FOLLOWUP_DAYS;

  // Get successful and failed strategies
  const successfulStrategies = improved
    .map(r => r.advice_summary)
    .slice(0, 5);

  const failedStrategies = worsened
    .map(r => r.advice_summary)
    .slice(0, 3);

  // Get common abandon reasons
  const abandonReasons = abandoned
    .filter(r => r.abandon_reason)
    .map(r => r.abandon_reason);
  const reasonCounts = new Map<string, number>();
  for (const reason of abandonReasons) {
    reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
  }
  const commonAbandonReasons = Array.from(reasonCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([reason]) => reason);

  return {
    category,
    totalAdvice: records.length,
    successRate,
    averageImprovement,
    abandonmentRate,
    avgDaysToOutcome,
    successfulStrategies,
    failedStrategies,
    commonAbandonReasons,
  };
}

/**
 * Get full advice effectiveness profile for a user
 */
export async function getAdviceProfile(
  userEmail: string,
  supabase: ReturnType<typeof createClient>
): Promise<UserAdviceProfile> {
  const categories: AdviceCategory[] = [
    'sleep', 'nutrition', 'exercise', 'supplements', 'stress',
    'recovery', 'glucose', 'hydration', 'habits', 'other'
  ];

  const effectivenessByCategory = new Map<AdviceCategory, AdviceEffectiveness>();
  let totalAdvice = 0;
  let totalSuccess = 0;
  let totalFollowed = 0;

  for (const category of categories) {
    const effectiveness = await getCategoryEffectiveness(userEmail, category, supabase);
    effectivenessByCategory.set(category, effectiveness);

    if (effectiveness.totalAdvice > 0) {
      totalAdvice += effectiveness.totalAdvice;
      totalSuccess += effectiveness.successRate * effectiveness.totalAdvice;
      totalFollowed += (1 - effectiveness.abandonmentRate) * effectiveness.totalAdvice;
    }
  }

  const overallSuccessRate = totalAdvice > 0 ? totalSuccess / totalAdvice : 0;
  const avgFollowThrough = totalAdvice > 0 ? totalFollowed / totalAdvice : 0;

  // Determine best and worst categories
  const categoryStats = Array.from(effectivenessByCategory.entries())
    .filter(([_, e]) => e.totalAdvice >= 3)
    .sort((a, b) => b[1].successRate - a[1].successRate);

  const bestCategories = categoryStats
    .filter(([_, e]) => e.successRate >= 0.6)
    .slice(0, 3)
    .map(([cat]) => cat);

  const worstCategories = categoryStats
    .filter(([_, e]) => e.successRate < 0.4)
    .slice(-3)
    .map(([cat]) => cat);

  // Determine preferred difficulty based on what's been successful
  const { data: successfulAdvice } = await supabase
    .from('advice_outcomes')
    .select('difficulty')
    .eq('user_email', userEmail)
    .eq('outcome', 'improved')
    .limit(20);

  const difficultyCounts: Record<string, number> = { easy: 0, medium: 0, hard: 0 };
  for (const a of (successfulAdvice as any[]) || []) {
    difficultyCounts[a.difficulty] = (difficultyCounts[a.difficulty] || 0) + 1;
  }
  const preferredDifficulty = Object.entries(difficultyCounts)
    .sort((a, b) => b[1] - a[1])[0]?.[0] as 'easy' | 'medium' | 'hard' || 'medium';

  // Get recent outcomes
  const { data: recentData } = await supabase
    .from('advice_outcomes')
    .select('*')
    .eq('user_email', userEmail)
    .neq('outcome', 'pending')
    .order('outcome_recorded_at', { ascending: false })
    .limit(10);

  const recentOutcomes: AdviceRecord[] = ((recentData as any[]) || []).map(r => ({
    id: r.id,
    userEmail: r.user_email,
    category: r.category,
    adviceGiven: r.advice_given,
    adviceSummary: r.advice_summary,
    targetMetric: r.target_metric,
    baselineValue: r.baseline_value,
    targetValue: r.target_value,
    currentValue: r.current_value,
    difficulty: r.difficulty,
    createdAt: r.created_at,
    followUpDate: r.follow_up_date,
    outcome: r.outcome,
    outcomeRecordedAt: r.outcome_recorded_at,
    improvementPct: r.improvement_pct,
    abandonReason: r.abandon_reason,
    userFeedback: r.user_feedback,
  }));

  return {
    userEmail,
    overallSuccessRate,
    preferredDifficulty,
    bestCategories,
    worstCategories,
    avgFollowThrough,
    effectivenessByCategory,
    recentOutcomes,
  };
}

// =============================================================================
// RECOMMENDATION ENHANCEMENT
// =============================================================================

/**
 * Get advice adjustments based on past effectiveness
 */
export async function getAdviceAdjustments(
  userEmail: string,
  proposedCategory: AdviceCategory,
  supabase: ReturnType<typeof createClient>
): Promise<{
  shouldSimplify: boolean;
  suggestedDifficulty: 'easy' | 'medium' | 'hard';
  avoidStrategies: string[];
  preferStrategies: string[];
  warningMessage?: string;
}> {
  const effectiveness = await getCategoryEffectiveness(userEmail, proposedCategory, supabase);
  const profile = await getAdviceProfile(userEmail, supabase);

  // Determine if we should simplify
  const shouldSimplify = effectiveness.abandonmentRate > 0.5 ||
    profile.preferredDifficulty === 'easy';

  // Suggest difficulty
  let suggestedDifficulty: 'easy' | 'medium' | 'hard' = 'medium';
  if (effectiveness.abandonmentRate > 0.6) {
    suggestedDifficulty = 'easy';
  } else if (effectiveness.successRate > 0.7 && effectiveness.abandonmentRate < 0.2) {
    suggestedDifficulty = profile.preferredDifficulty === 'hard' ? 'hard' : 'medium';
  } else {
    suggestedDifficulty = profile.preferredDifficulty;
  }

  // Build warning message if needed
  let warningMessage: string | undefined;
  if (effectiveness.successRate < 0.3 && effectiveness.totalAdvice >= 3) {
    warningMessage = `Past ${proposedCategory} advice has had low success (${Math.round(effectiveness.successRate * 100)}%). Consider trying a different approach.`;
  } else if (effectiveness.abandonmentRate > 0.5) {
    const reason = effectiveness.commonAbandonReasons[0];
    warningMessage = `User often abandons ${proposedCategory} advice${reason ? ` (common reason: "${reason}")` : ''}. Keep advice simple.`;
  }

  return {
    shouldSimplify,
    suggestedDifficulty,
    avoidStrategies: effectiveness.failedStrategies,
    preferStrategies: effectiveness.successfulStrategies,
    warningMessage,
  };
}

// =============================================================================
// FORMAT FOR PROMPTS
// =============================================================================

/**
 * Format advice effectiveness for agent prompts
 */
export function formatEffectivenessForPrompt(profile: UserAdviceProfile): string {
  const sections: string[] = ['## What Works for This User\n'];
  sections.push('Based on tracked outcomes from past advice:\n');

  // Overall stats
  sections.push(`**Overall Success Rate**: ${Math.round(profile.overallSuccessRate * 100)}%`);
  sections.push(`**Follow-Through Rate**: ${Math.round(profile.avgFollowThrough * 100)}%`);
  sections.push(`**Preferred Difficulty**: ${profile.preferredDifficulty}\n`);

  // Best categories
  if (profile.bestCategories.length > 0) {
    sections.push('### High Success Categories');
    sections.push(`User responds well to: ${profile.bestCategories.join(', ')}`);
    sections.push('');
  }

  // Worst categories
  if (profile.worstCategories.length > 0) {
    sections.push('### Low Success Categories');
    sections.push(`Consider simplifying: ${profile.worstCategories.join(', ')}`);
    sections.push('');
  }

  // Category-specific details
  sections.push('### By Category');
  for (const [category, effectiveness] of profile.effectivenessByCategory) {
    if (effectiveness.totalAdvice < 2) continue;

    const successEmoji = effectiveness.successRate >= 0.6 ? '✓' :
      effectiveness.successRate >= 0.4 ? '~' : '✗';

    sections.push(`${successEmoji} **${category}**: ${Math.round(effectiveness.successRate * 100)}% success, ${Math.round(effectiveness.abandonmentRate * 100)}% abandoned`);

    if (effectiveness.successfulStrategies.length > 0) {
      sections.push(`  - What worked: "${effectiveness.successfulStrategies[0]}"`);
    }
    if (effectiveness.failedStrategies.length > 0) {
      sections.push(`  - What didn't: "${effectiveness.failedStrategies[0]}"`);
    }
  }

  // Recommendations
  sections.push('\n### Recommendations');
  sections.push('- Reference past successes: "Last time we tried X and it helped by Y%"');
  sections.push('- Avoid repeating failed strategies');
  if (profile.preferredDifficulty === 'easy') {
    sections.push('- Keep advice simple - user prefers easy wins');
  }
  sections.push('');

  return sections.join('\n');
}

/**
 * Quick summary for limited context
 */
export function getQuickEffectivenessSummary(profile: UserAdviceProfile): string {
  const parts: string[] = [];

  parts.push(`Success: ${Math.round(profile.overallSuccessRate * 100)}%`);

  if (profile.bestCategories.length > 0) {
    parts.push(`Best: ${profile.bestCategories.slice(0, 2).join(', ')}`);
  }

  if (profile.worstCategories.length > 0) {
    parts.push(`Simplify: ${profile.worstCategories.slice(0, 2).join(', ')}`);
  }

  parts.push(`Difficulty: ${profile.preferredDifficulty}`);

  return parts.join(' | ');
}
