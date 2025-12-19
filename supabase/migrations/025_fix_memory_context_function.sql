-- Fix get_user_memory_context function
-- The ORDER BY clause needs to be inside jsonb_agg, not outside
-- Author: Claude Code
-- Date: 2024-12-19

CREATE OR REPLACE FUNCTION get_user_memory_context(p_user_email TEXT)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'facts', (
      SELECT COALESCE(jsonb_agg(fact_row ORDER BY fact_row->>'confidence' DESC), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
          'category', category,
          'key', fact_key,
          'value', fact_value,
          'confidence', confidence
        ) as fact_row
        FROM user_learned_facts
        WHERE user_email = p_user_email
          AND (expires_at IS NULL OR expires_at > now())
        ORDER BY confidence DESC
        LIMIT 50
      ) facts_subquery
    ),
    'style', (
      SELECT row_to_json(s)::jsonb
      FROM user_communication_style s
      WHERE user_email = p_user_email
    ),
    'recent_outcomes', (
      SELECT COALESCE(jsonb_agg(outcome_row ORDER BY outcome_row->>'created_at' DESC), '[]'::jsonb)
      FROM (
        SELECT jsonb_build_object(
          'advice_type', advice_type,
          'advice_summary', advice_summary,
          'metric', metric_name,
          'outcome', outcome,
          'baseline', baseline_value,
          'current', current_value,
          'created_at', created_at
        ) as outcome_row
        FROM advice_outcomes
        WHERE user_email = p_user_email
          AND outcome IS NOT NULL
          AND outcome != 'pending'
        ORDER BY created_at DESC
        LIMIT 10
      ) outcomes_subquery
    ),
    'action_preferences', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'action_type', action_type,
        'usually_approves', (
          SELECT COUNT(*) FILTER (WHERE approved) * 100.0 / NULLIF(COUNT(*), 0)
          FROM user_action_preferences p2
          WHERE p2.user_email = p_user_email AND p2.action_type = p.action_type
        ),
        'learned_preference', learned_preference
      )), '[]'::jsonb)
      FROM (
        SELECT DISTINCT ON (action_type) action_type, learned_preference
        FROM user_action_preferences
        WHERE user_email = p_user_email AND learned_preference IS NOT NULL
        ORDER BY action_type, created_at DESC
      ) p
    ),
    'recent_summary', (
      SELECT summary_text
      FROM user_memory_summaries
      WHERE user_email = p_user_email AND summary_type = 'weekly'
      ORDER BY period_end DESC
      LIMIT 1
    )
  ) INTO result;

  RETURN COALESCE(result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql;
