/**
 * Intervention Tracking Service
 *
 * Tracks whether insight recommendations were tried and their outcomes.
 * Closes the behavioral loop: insight → user action → outcome → personalization
 *
 * Key responsibilities:
 * 1. Log when an intervention is suggested (from insight generation)
 * 2. Track when user starts trying the intervention
 * 3. Compute improvement after intervention period ends
 * 4. Provide successful interventions for prompt injection
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface InterventionSuggestion {
  interventionType: string;        // e.g. "evening_walk", "magnesium_glycinate"
  interventionDescription?: string; // Human-readable description
  trackedMetric: string;           // e.g. "hrv_ms", "avg_glucose"
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
  expectedOutcome?: string;        // e.g. "+10% HRV improvement"
  durationDays?: number;           // Default 7
}

export interface InterventionExperiment {
  id: string;
  email: string;
  insightId?: string;
  interventionType: string;
  interventionDescription?: string;
  suggestedAt: string;
  startedAt?: string;
  endedAt?: string;
  durationDays: number;
  trackedMetric: string;
  baselineValue?: number;
  resultValue?: number;
  improvementPct?: number;
  userFeedback?: string;
  userRating?: number;
  status: 'SUGGESTED' | 'ONGOING' | 'COMPLETED' | 'ABANDONED';
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  expectedOutcome?: string;
}

export interface InterventionOutcome {
  experimentId: string;
  resultValue: number;
  userFeedback?: string;
  userRating?: number;
}

/**
 * Log a new intervention suggestion from an insight
 */
export async function logInterventionSuggestion(
  email: string,
  insightId: string | null,
  suggestion: InterventionSuggestion
): Promise<string | null> {
  try {
    // Get baseline value for the tracked metric
    const baselineValue = await getBaselineValue(email, suggestion.trackedMetric);

    const { data, error } = await supabase
      .from('user_intervention_experiments')
      .insert({
        email,
        insight_id: insightId,
        intervention_type: suggestion.interventionType,
        intervention_description: suggestion.interventionDescription,
        tracked_metric: suggestion.trackedMetric,
        baseline_value: baselineValue,
        difficulty: suggestion.difficulty || 'MEDIUM',
        expected_outcome: suggestion.expectedOutcome,
        duration_days: suggestion.durationDays || 7,
        status: 'SUGGESTED',
      })
      .select('id')
      .single();

    if (error) {
      console.error('[InterventionTracking] Error logging suggestion:', error);
      return null;
    }

    console.log(`[InterventionTracking] Logged suggestion: ${suggestion.interventionType} for ${email}`);
    return data?.id || null;
  } catch (e) {
    console.error('[InterventionTracking] Exception logging suggestion:', e);
    return null;
  }
}

/**
 * Mark an intervention as started (user tapped "I'll try this")
 */
export async function markInterventionStarted(experimentId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_intervention_experiments')
      .update({
        started_at: new Date().toISOString(),
        status: 'ONGOING',
      })
      .eq('id', experimentId);

    if (error) {
      console.error('[InterventionTracking] Error marking started:', error);
      return false;
    }

    console.log(`[InterventionTracking] Intervention ${experimentId} started`);
    return true;
  } catch (e) {
    console.error('[InterventionTracking] Exception marking started:', e);
    return false;
  }
}

/**
 * Mark an intervention as completed with results
 */
export async function markInterventionCompleted(
  outcome: InterventionOutcome
): Promise<{ success: boolean; improvementPct?: number }> {
  try {
    // Get the experiment to calculate improvement
    const { data: experiment, error: fetchError } = await supabase
      .from('user_intervention_experiments')
      .select('baseline_value, tracked_metric, email')
      .eq('id', outcome.experimentId)
      .single();

    if (fetchError || !experiment) {
      console.error('[InterventionTracking] Error fetching experiment:', fetchError);
      return { success: false };
    }

    // Calculate improvement percentage
    let improvementPct = 0;
    if (experiment.baseline_value && experiment.baseline_value !== 0) {
      improvementPct = ((outcome.resultValue - experiment.baseline_value) / experiment.baseline_value) * 100;
    }

    // Update the experiment
    const { error: updateError } = await supabase
      .from('user_intervention_experiments')
      .update({
        result_value: outcome.resultValue,
        improvement_pct: improvementPct,
        user_feedback: outcome.userFeedback,
        user_rating: outcome.userRating,
        ended_at: new Date().toISOString(),
        status: 'COMPLETED',
      })
      .eq('id', outcome.experimentId);

    if (updateError) {
      console.error('[InterventionTracking] Error completing intervention:', updateError);
      return { success: false };
    }

    console.log(`[InterventionTracking] Intervention ${outcome.experimentId} completed with ${improvementPct.toFixed(1)}% improvement`);
    return { success: true, improvementPct };
  } catch (e) {
    console.error('[InterventionTracking] Exception completing intervention:', e);
    return { success: false };
  }
}

/**
 * Mark an intervention as abandoned
 */
export async function markInterventionAbandoned(
  experimentId: string,
  reason?: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_intervention_experiments')
      .update({
        ended_at: new Date().toISOString(),
        status: 'ABANDONED',
        user_feedback: reason,
      })
      .eq('id', experimentId);

    if (error) {
      console.error('[InterventionTracking] Error abandoning:', error);
      return false;
    }

    console.log(`[InterventionTracking] Intervention ${experimentId} abandoned`);
    return true;
  } catch (e) {
    console.error('[InterventionTracking] Exception abandoning:', e);
    return false;
  }
}

/**
 * Get user's intervention experiments
 */
export async function getUserInterventions(
  email: string,
  options: {
    status?: 'SUGGESTED' | 'ONGOING' | 'COMPLETED' | 'ABANDONED';
    limit?: number;
  } = {}
): Promise<InterventionExperiment[]> {
  try {
    let query = supabase
      .from('user_intervention_experiments')
      .select('*')
      .eq('email', email)
      .order('created_at', { ascending: false });

    if (options.status) {
      query = query.eq('status', options.status);
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[InterventionTracking] Error fetching interventions:', error);
      return [];
    }

    return (data || []).map(mapToInterventionExperiment);
  } catch (e) {
    console.error('[InterventionTracking] Exception fetching interventions:', e);
    return [];
  }
}

/**
 * Get successful interventions for prompt injection
 * Returns interventions that worked well for this user
 */
export async function getSuccessfulInterventions(
  email: string,
  limit: number = 10
): Promise<{ interventionType: string; trackedMetric: string; improvementPct: number }[]> {
  try {
    const { data, error } = await supabase
      .from('user_intervention_experiments')
      .select('intervention_type, tracked_metric, improvement_pct')
      .eq('email', email)
      .eq('status', 'COMPLETED')
      .gt('improvement_pct', 0)
      .order('improvement_pct', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[InterventionTracking] Error fetching successful interventions:', error);
      return [];
    }

    return (data || []).map(d => ({
      interventionType: d.intervention_type,
      trackedMetric: d.tracked_metric,
      improvementPct: d.improvement_pct,
    }));
  } catch (e) {
    console.error('[InterventionTracking] Exception fetching successful interventions:', e);
    return [];
  }
}

/**
 * Get failed/abandoned interventions to avoid suggesting again
 */
export async function getFailedInterventions(
  email: string,
  limit: number = 10
): Promise<{ interventionType: string; reason?: string }[]> {
  try {
    const { data, error } = await supabase
      .from('user_intervention_experiments')
      .select('intervention_type, user_feedback')
      .eq('email', email)
      .or('status.eq.ABANDONED,improvement_pct.lt.0')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[InterventionTracking] Error fetching failed interventions:', error);
      return [];
    }

    return (data || []).map(d => ({
      interventionType: d.intervention_type,
      reason: d.user_feedback,
    }));
  } catch (e) {
    console.error('[InterventionTracking] Exception fetching failed interventions:', e);
    return [];
  }
}

/**
 * Build intervention context for AI prompt injection
 */
export async function buildInterventionContext(email: string): Promise<string> {
  const successful = await getSuccessfulInterventions(email, 5);
  const failed = await getFailedInterventions(email, 5);

  if (successful.length === 0 && failed.length === 0) {
    return '';
  }

  let context = '\n## Historical Interventions:\n';

  if (successful.length > 0) {
    context += '\n### What worked well for this user:\n';
    for (const s of successful) {
      context += `- ${s.interventionType}: +${s.improvementPct.toFixed(1)}% improvement in ${s.trackedMetric}\n`;
    }
  }

  if (failed.length > 0) {
    context += '\n### What did NOT work (avoid suggesting again):\n';
    for (const f of failed) {
      context += `- ${f.interventionType}${f.reason ? ` (${f.reason})` : ''}\n`;
    }
  }

  context += '\nPrefer interventions that previously worked well. Avoid recommending failed interventions.\n';

  return context;
}

/**
 * Get pending interventions that should be evaluated
 * (started > durationDays ago)
 */
export async function getPendingEvaluations(email: string): Promise<InterventionExperiment[]> {
  try {
    const { data, error } = await supabase
      .from('user_intervention_experiments')
      .select('*')
      .eq('email', email)
      .eq('status', 'ONGOING')
      .lt('started_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    if (error) {
      console.error('[InterventionTracking] Error fetching pending evaluations:', error);
      return [];
    }

    return (data || []).map(mapToInterventionExperiment);
  } catch (e) {
    console.error('[InterventionTracking] Exception fetching pending evaluations:', e);
    return [];
  }
}

// ============================================================================
// Helper functions
// ============================================================================

async function getBaselineValue(email: string, metric: string): Promise<number | null> {
  try {
    const { data, error } = await supabase
      .from('user_health_baselines')
      .select('baseline_value')
      .eq('email', email)
      .eq('metric_type', metric)
      .single();

    if (error || !data) {
      return null;
    }

    return data.baseline_value;
  } catch (e) {
    return null;
  }
}

function mapToInterventionExperiment(row: any): InterventionExperiment {
  return {
    id: row.id,
    email: row.email,
    insightId: row.insight_id,
    interventionType: row.intervention_type,
    interventionDescription: row.intervention_description,
    suggestedAt: row.suggested_at,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationDays: row.duration_days,
    trackedMetric: row.tracked_metric,
    baselineValue: row.baseline_value,
    resultValue: row.result_value,
    improvementPct: row.improvement_pct,
    userFeedback: row.user_feedback,
    userRating: row.user_rating,
    status: row.status,
    difficulty: row.difficulty,
    expectedOutcome: row.expected_outcome,
  };
}
