-- ============================================================================
-- Migration: Fix Mutable search_path in Functions
-- Purpose: Secure all functions by setting search_path to prevent SQL injection
-- Created: 2025-01-01
-- ============================================================================
-- This migration adds SET search_path = '' to all functions that were flagged
-- for having a mutable search_path, preventing potential SQL injection attacks.
-- ============================================================================

DO $$
DECLARE
  func_record RECORD;
BEGIN
  -- Loop through all functions that need to be secured
  FOR func_record IN
    SELECT p.oid, n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND (p.proconfig IS NULL OR NOT EXISTS (
        SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%'
      ))
      AND p.proname IN (
        -- Timestamp update functions
        'update_updated_at_column',
        'update_behavioral_patterns_updated_at',
        'update_integration_tokens_updated_at',
        'update_ecosystem_context_updated_at',
        'update_real_time_insights_updated_at',
        'update_conversation_timestamp',
        'update_communication_style_timestamp',
        'update_connect_timestamp',
        'update_share_timestamp',
        'update_device_tokens_updated_at',
        'update_agent_task_updated_at',
        'update_email_draft_updated_at',
        'update_gmail_labels_updated_at',
        'update_outlook_user_folders_updated_at',
        'update_outlook_categories_updated_at',
        'update_outlook_subscriptions_updated_at',
        'update_email_subscriptions_updated_at',
        'update_health_plan_updated_at',
        'update_forge_updated_at',
        -- Integration token functions
        'revoke_integration_token',
        'get_active_token',
        -- E-commerce functions
        'generate_order_number',
        'record_inventory_transaction',
        'record_price_change',
        -- Ecosystem & context functions
        'invalidate_expired_context_cache',
        'get_valid_context_cache',
        'update_ecosystem_sync_status',
        'needs_ecosystem_refresh',
        'get_sync_status_summary',
        -- Real-time insights functions
        'get_unread_insights',
        'get_insights_by_type',
        'mark_insight_viewed',
        'dismiss_insight',
        'mark_insight_action',
        'get_insight_stats',
        -- Health baseline functions
        'update_health_baseline',
        'check_baseline_deviation',
        -- User memory functions
        'get_user_memory_context',
        'learn_user_fact',
        'get_pending_outcome_checks',
        'is_significant_change',
        -- Agent functions
        'expire_old_approval_requests',
        'cleanup_old_checkpoints',
        -- Moccet Connect functions
        'generate_user_pair_hash',
        'get_user_friends',
        'are_users_connected',
        'get_pending_requests',
        'calculate_isolation_score',
        'set_accepted_at',
        'create_friend_pattern',
        -- Moccet Share functions
        'generate_share_invite_code',
        'get_share_caregivers',
        'get_share_monitored_people',
        'can_caregiver_access_metric',
        'get_caregiver_pending_alerts',
        'generate_invite_on_create',
        'create_share_permissions',
        'track_relationship_status_change',
        -- Subscription functions
        'check_subscription_tier',
        'can_access_feature',
        -- Onboarding functions
        'get_onboarding_dropoff_stats',
        'get_onboarding_funnel',
        -- Auth functions
        'handle_new_user',
        -- Conversation history functions
        'get_conversation_history',
        'get_user_conversation_stats',
        -- Sentiment analysis functions
        'get_user_sentiment_summary',
        'is_sentiment_analysis_enabled',
        'cleanup_old_sentiment_data',
        -- Life context functions
        'get_upcoming_life_events',
        'get_active_life_patterns',
        'cleanup_past_life_events',
        -- Health pattern analysis functions
        'get_latest_health_analysis',
        'get_recent_health_correlations'
      )
  LOOP
    BEGIN
      EXECUTE format(
        'ALTER FUNCTION %I.%I(%s) SET search_path = ''''',
        func_record.nspname,
        func_record.proname,
        func_record.args
      );
      RAISE NOTICE 'Secured function: %.%(%)', func_record.nspname, func_record.proname, func_record.args;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not alter function %.%(%): %', func_record.nspname, func_record.proname, func_record.args, SQLERRM;
    END;
  END LOOP;
END $$;

-- ============================================================================
-- VERIFICATION QUERY (Run manually to verify)
-- ============================================================================
-- To verify all functions now have a fixed search_path, run:
--
-- SELECT
--   n.nspname as schema,
--   p.proname as function_name,
--   pg_get_function_identity_arguments(p.oid) as arguments,
--   CASE
--     WHEN p.proconfig IS NULL THEN 'MUTABLE (needs fix)'
--     WHEN EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%') THEN 'FIXED'
--     ELSE 'MUTABLE (needs fix)'
--   END as search_path_status
-- FROM pg_proc p
-- JOIN pg_namespace n ON p.pronamespace = n.oid
-- WHERE n.nspname = 'public'
--   AND p.prokind = 'f'
-- ORDER BY search_path_status, p.proname;
--
-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
