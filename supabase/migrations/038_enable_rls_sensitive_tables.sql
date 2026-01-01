-- ============================================================================
-- Migration: Enable RLS on All Sensitive Tables
-- Purpose: Add Row Level Security policies to protect user data
-- Created: 2025-01-01
-- ============================================================================
-- This migration ensures RLS is enabled on all sensitive tables and creates
-- appropriate policies for user data access control.
-- ============================================================================

-- ============================================================================
-- SECTION 1: USER-SPECIFIC TABLES (users can only access their own data)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- user_device_tokens
-- ----------------------------------------------------------------------------
ALTER TABLE user_device_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own device tokens" ON user_device_tokens;
DROP POLICY IF EXISTS "Users can insert own device tokens" ON user_device_tokens;
DROP POLICY IF EXISTS "Users can update own device tokens" ON user_device_tokens;
DROP POLICY IF EXISTS "Users can delete own device tokens" ON user_device_tokens;

CREATE POLICY "Users can view own device tokens"
  ON user_device_tokens FOR SELECT
  USING (auth.jwt() ->> 'email' = email);

CREATE POLICY "Users can insert own device tokens"
  ON user_device_tokens FOR INSERT
  WITH CHECK (auth.jwt() ->> 'email' = email);

CREATE POLICY "Users can update own device tokens"
  ON user_device_tokens FOR UPDATE
  USING (auth.jwt() ->> 'email' = email);

CREATE POLICY "Users can delete own device tokens"
  ON user_device_tokens FOR DELETE
  USING (auth.jwt() ->> 'email' = email);

-- ----------------------------------------------------------------------------
-- user_health_baselines
-- ----------------------------------------------------------------------------
ALTER TABLE user_health_baselines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own health baselines" ON user_health_baselines;
DROP POLICY IF EXISTS "Users can insert own health baselines" ON user_health_baselines;
DROP POLICY IF EXISTS "Users can update own health baselines" ON user_health_baselines;
DROP POLICY IF EXISTS "Users can delete own health baselines" ON user_health_baselines;

CREATE POLICY "Users can view own health baselines"
  ON user_health_baselines FOR SELECT
  USING (auth.jwt() ->> 'email' = email);

CREATE POLICY "Users can insert own health baselines"
  ON user_health_baselines FOR INSERT
  WITH CHECK (auth.jwt() ->> 'email' = email);

CREATE POLICY "Users can update own health baselines"
  ON user_health_baselines FOR UPDATE
  USING (auth.jwt() ->> 'email' = email);

CREATE POLICY "Users can delete own health baselines"
  ON user_health_baselines FOR DELETE
  USING (auth.jwt() ->> 'email' = email);

-- ----------------------------------------------------------------------------
-- user_oauth_connections
-- ----------------------------------------------------------------------------
ALTER TABLE user_oauth_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own oauth connections" ON user_oauth_connections;
DROP POLICY IF EXISTS "Users can insert own oauth connections" ON user_oauth_connections;
DROP POLICY IF EXISTS "Users can update own oauth connections" ON user_oauth_connections;
DROP POLICY IF EXISTS "Users can delete own oauth connections" ON user_oauth_connections;

CREATE POLICY "Users can view own oauth connections"
  ON user_oauth_connections FOR SELECT
  USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Users can insert own oauth connections"
  ON user_oauth_connections FOR INSERT
  WITH CHECK (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Users can update own oauth connections"
  ON user_oauth_connections FOR UPDATE
  USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Users can delete own oauth connections"
  ON user_oauth_connections FOR DELETE
  USING (auth.jwt() ->> 'email' = user_email);

-- ----------------------------------------------------------------------------
-- behavioral_patterns
-- ----------------------------------------------------------------------------
ALTER TABLE behavioral_patterns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own behavioral patterns" ON behavioral_patterns;
DROP POLICY IF EXISTS "Users can insert own behavioral patterns" ON behavioral_patterns;
DROP POLICY IF EXISTS "Users can update own behavioral patterns" ON behavioral_patterns;
DROP POLICY IF EXISTS "Users can delete own behavioral patterns" ON behavioral_patterns;

CREATE POLICY "Users can view own behavioral patterns"
  ON behavioral_patterns FOR SELECT
  USING (auth.jwt() ->> 'email' = email);

CREATE POLICY "Users can insert own behavioral patterns"
  ON behavioral_patterns FOR INSERT
  WITH CHECK (auth.jwt() ->> 'email' = email);

CREATE POLICY "Users can update own behavioral patterns"
  ON behavioral_patterns FOR UPDATE
  USING (auth.jwt() ->> 'email' = email);

CREATE POLICY "Users can delete own behavioral patterns"
  ON behavioral_patterns FOR DELETE
  USING (auth.jwt() ->> 'email' = email);

-- ----------------------------------------------------------------------------
-- ecosystem_context_cache
-- ----------------------------------------------------------------------------
ALTER TABLE ecosystem_context_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own ecosystem context" ON ecosystem_context_cache;
DROP POLICY IF EXISTS "Users can insert own ecosystem context" ON ecosystem_context_cache;
DROP POLICY IF EXISTS "Users can update own ecosystem context" ON ecosystem_context_cache;
DROP POLICY IF EXISTS "Users can delete own ecosystem context" ON ecosystem_context_cache;

CREATE POLICY "Users can view own ecosystem context"
  ON ecosystem_context_cache FOR SELECT
  USING (auth.jwt() ->> 'email' = email);

CREATE POLICY "Users can insert own ecosystem context"
  ON ecosystem_context_cache FOR INSERT
  WITH CHECK (auth.jwt() ->> 'email' = email);

CREATE POLICY "Users can update own ecosystem context"
  ON ecosystem_context_cache FOR UPDATE
  USING (auth.jwt() ->> 'email' = email);

CREATE POLICY "Users can delete own ecosystem context"
  ON ecosystem_context_cache FOR DELETE
  USING (auth.jwt() ->> 'email' = email);

-- ----------------------------------------------------------------------------
-- real_time_insights
-- ----------------------------------------------------------------------------
ALTER TABLE real_time_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own insights" ON real_time_insights;
DROP POLICY IF EXISTS "Users can insert own insights" ON real_time_insights;
DROP POLICY IF EXISTS "Users can update own insights" ON real_time_insights;
DROP POLICY IF EXISTS "Users can delete own insights" ON real_time_insights;

CREATE POLICY "Users can view own insights"
  ON real_time_insights FOR SELECT
  USING (auth.jwt() ->> 'email' = email);

CREATE POLICY "Users can insert own insights"
  ON real_time_insights FOR INSERT
  WITH CHECK (auth.jwt() ->> 'email' = email);

CREATE POLICY "Users can update own insights"
  ON real_time_insights FOR UPDATE
  USING (auth.jwt() ->> 'email' = email);

CREATE POLICY "Users can delete own insights"
  ON real_time_insights FOR DELETE
  USING (auth.jwt() ->> 'email' = email);

-- ============================================================================
-- SECTION 2: E-COMMERCE TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- shopping_carts
-- ----------------------------------------------------------------------------
ALTER TABLE shopping_carts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own carts" ON shopping_carts;
DROP POLICY IF EXISTS "Users can insert own carts" ON shopping_carts;
DROP POLICY IF EXISTS "Users can update own carts" ON shopping_carts;
DROP POLICY IF EXISTS "Users can delete own carts" ON shopping_carts;

CREATE POLICY "Users can view own carts"
  ON shopping_carts FOR SELECT
  USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Users can insert own carts"
  ON shopping_carts FOR INSERT
  WITH CHECK (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Users can update own carts"
  ON shopping_carts FOR UPDATE
  USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Users can delete own carts"
  ON shopping_carts FOR DELETE
  USING (auth.jwt() ->> 'email' = user_email);

-- ----------------------------------------------------------------------------
-- cart_items (linked to shopping_carts)
-- ----------------------------------------------------------------------------
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own cart items" ON cart_items;
DROP POLICY IF EXISTS "Users can insert own cart items" ON cart_items;
DROP POLICY IF EXISTS "Users can update own cart items" ON cart_items;
DROP POLICY IF EXISTS "Users can delete own cart items" ON cart_items;

CREATE POLICY "Users can view own cart items"
  ON cart_items FOR SELECT
  USING (
    cart_id IN (
      SELECT id FROM shopping_carts
      WHERE user_email = auth.jwt() ->> 'email'
    )
  );

CREATE POLICY "Users can insert own cart items"
  ON cart_items FOR INSERT
  WITH CHECK (
    cart_id IN (
      SELECT id FROM shopping_carts
      WHERE user_email = auth.jwt() ->> 'email'
    )
  );

CREATE POLICY "Users can update own cart items"
  ON cart_items FOR UPDATE
  USING (
    cart_id IN (
      SELECT id FROM shopping_carts
      WHERE user_email = auth.jwt() ->> 'email'
    )
  );

CREATE POLICY "Users can delete own cart items"
  ON cart_items FOR DELETE
  USING (
    cart_id IN (
      SELECT id FROM shopping_carts
      WHERE user_email = auth.jwt() ->> 'email'
    )
  );

-- ----------------------------------------------------------------------------
-- orders
-- ----------------------------------------------------------------------------
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own orders" ON orders;
DROP POLICY IF EXISTS "Users can insert own orders" ON orders;

CREATE POLICY "Users can view own orders"
  ON orders FOR SELECT
  USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Users can insert own orders"
  ON orders FOR INSERT
  WITH CHECK (auth.jwt() ->> 'email' = user_email);

-- Note: Orders should not be updatable/deletable by users (admin only)

-- ----------------------------------------------------------------------------
-- order_items (linked to orders)
-- ----------------------------------------------------------------------------
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own order items" ON order_items;

CREATE POLICY "Users can view own order items"
  ON order_items FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM orders
      WHERE user_email = auth.jwt() ->> 'email'
    )
  );

-- Note: Order items should not be insertable/updatable/deletable by users

-- ----------------------------------------------------------------------------
-- shipping_addresses
-- ----------------------------------------------------------------------------
ALTER TABLE shipping_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own addresses" ON shipping_addresses;
DROP POLICY IF EXISTS "Users can insert own addresses" ON shipping_addresses;
DROP POLICY IF EXISTS "Users can update own addresses" ON shipping_addresses;
DROP POLICY IF EXISTS "Users can delete own addresses" ON shipping_addresses;

CREATE POLICY "Users can view own addresses"
  ON shipping_addresses FOR SELECT
  USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Users can insert own addresses"
  ON shipping_addresses FOR INSERT
  WITH CHECK (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Users can update own addresses"
  ON shipping_addresses FOR UPDATE
  USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Users can delete own addresses"
  ON shipping_addresses FOR DELETE
  USING (auth.jwt() ->> 'email' = user_email);

-- ============================================================================
-- SECTION 3: PRODUCT CATALOG (Public Read, Service Role Write)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- supplement_products (public read access)
-- ----------------------------------------------------------------------------
ALTER TABLE supplement_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active products" ON supplement_products;

CREATE POLICY "Anyone can view active products"
  ON supplement_products FOR SELECT
  USING (is_active = true);

-- Note: Insert/Update/Delete only via service role (bypasses RLS)

-- ----------------------------------------------------------------------------
-- supplement_name_mappings (public read access)
-- ----------------------------------------------------------------------------
ALTER TABLE supplement_name_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view supplement mappings" ON supplement_name_mappings;

CREATE POLICY "Anyone can view supplement mappings"
  ON supplement_name_mappings FOR SELECT
  USING (true);

-- Note: Insert/Update/Delete only via service role (bypasses RLS)

-- ----------------------------------------------------------------------------
-- discount_codes (public read for valid codes)
-- ----------------------------------------------------------------------------
ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active discount codes" ON discount_codes;

CREATE POLICY "Anyone can view active discount codes"
  ON discount_codes FOR SELECT
  USING (is_active = true AND (valid_until IS NULL OR valid_until > NOW()));

-- Note: Insert/Update/Delete only via service role (bypasses RLS)

-- ============================================================================
-- SECTION 4: ADMIN-ONLY TABLES (No direct user access)
-- ============================================================================
-- These tables are only accessible via service role which bypasses RLS.
-- Enabling RLS with no policies effectively blocks all direct user access.

-- ----------------------------------------------------------------------------
-- inventory_transactions (admin only)
-- ----------------------------------------------------------------------------
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
-- No policies = service role only access

-- ----------------------------------------------------------------------------
-- price_history (admin only)
-- ----------------------------------------------------------------------------
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
-- No policies = service role only access

-- ----------------------------------------------------------------------------
-- unmatched_supplements_log (admin only, if exists)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'unmatched_supplements_log') THEN
    EXECUTE 'ALTER TABLE unmatched_supplements_log ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

-- ============================================================================
-- SECTION 5: AGENT TABLES (ensure RLS is properly configured)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- agent_checkpoints (linked through thread to execution)
-- Note: Checkpoints are internal system state, service role access only
-- ----------------------------------------------------------------------------
ALTER TABLE agent_checkpoints ENABLE ROW LEVEL SECURITY;
-- No user policies - service role only

-- ----------------------------------------------------------------------------
-- agent_approval_decisions (linked to execution)
-- ----------------------------------------------------------------------------
ALTER TABLE agent_approval_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own approval decisions" ON agent_approval_decisions;
DROP POLICY IF EXISTS "Users can insert own approval decisions" ON agent_approval_decisions;

CREATE POLICY "Users can view own approval decisions"
  ON agent_approval_decisions FOR SELECT
  USING (
    execution_id IN (
      SELECT id FROM agent_executions
      WHERE user_email = auth.jwt() ->> 'email'
    )
  );

CREATE POLICY "Users can insert own approval decisions"
  ON agent_approval_decisions FOR INSERT
  WITH CHECK (
    execution_id IN (
      SELECT id FROM agent_executions
      WHERE user_email = auth.jwt() ->> 'email'
    )
  );

-- ============================================================================
-- SECTION 6: HEALTH DATA TABLES (if they exist)
-- ============================================================================
-- Note: vital_data, dexcom_data, oura_data may be external or not yet created
-- This section handles them gracefully if they exist

DO $$
BEGIN
  -- vital_data
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vital_data' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE vital_data ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Users can view own vital data" ON vital_data';
    EXECUTE 'DROP POLICY IF EXISTS "Users can insert own vital data" ON vital_data';
    EXECUTE 'DROP POLICY IF EXISTS "Users can update own vital data" ON vital_data';
    EXECUTE 'DROP POLICY IF EXISTS "Users can delete own vital data" ON vital_data';
    EXECUTE 'CREATE POLICY "Users can view own vital data" ON vital_data FOR SELECT USING (auth.jwt() ->> ''email'' = email)';
    EXECUTE 'CREATE POLICY "Users can insert own vital data" ON vital_data FOR INSERT WITH CHECK (auth.jwt() ->> ''email'' = email)';
    EXECUTE 'CREATE POLICY "Users can update own vital data" ON vital_data FOR UPDATE USING (auth.jwt() ->> ''email'' = email)';
    EXECUTE 'CREATE POLICY "Users can delete own vital data" ON vital_data FOR DELETE USING (auth.jwt() ->> ''email'' = email)';
  END IF;

  -- dexcom_data
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'dexcom_data' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE dexcom_data ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Users can view own dexcom data" ON dexcom_data';
    EXECUTE 'DROP POLICY IF EXISTS "Users can insert own dexcom data" ON dexcom_data';
    EXECUTE 'DROP POLICY IF EXISTS "Users can update own dexcom data" ON dexcom_data';
    EXECUTE 'DROP POLICY IF EXISTS "Users can delete own dexcom data" ON dexcom_data';
    EXECUTE 'CREATE POLICY "Users can view own dexcom data" ON dexcom_data FOR SELECT USING (auth.jwt() ->> ''email'' = email)';
    EXECUTE 'CREATE POLICY "Users can insert own dexcom data" ON dexcom_data FOR INSERT WITH CHECK (auth.jwt() ->> ''email'' = email)';
    EXECUTE 'CREATE POLICY "Users can update own dexcom data" ON dexcom_data FOR UPDATE USING (auth.jwt() ->> ''email'' = email)';
    EXECUTE 'CREATE POLICY "Users can delete own dexcom data" ON dexcom_data FOR DELETE USING (auth.jwt() ->> ''email'' = email)';
  END IF;

  -- oura_data
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'oura_data' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE oura_data ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Users can view own oura data" ON oura_data';
    EXECUTE 'DROP POLICY IF EXISTS "Users can insert own oura data" ON oura_data';
    EXECUTE 'DROP POLICY IF EXISTS "Users can update own oura data" ON oura_data';
    EXECUTE 'DROP POLICY IF EXISTS "Users can delete own oura data" ON oura_data';
    EXECUTE 'CREATE POLICY "Users can view own oura data" ON oura_data FOR SELECT USING (auth.jwt() ->> ''email'' = email)';
    EXECUTE 'CREATE POLICY "Users can insert own oura data" ON oura_data FOR INSERT WITH CHECK (auth.jwt() ->> ''email'' = email)';
    EXECUTE 'CREATE POLICY "Users can update own oura data" ON oura_data FOR UPDATE USING (auth.jwt() ->> ''email'' = email)';
    EXECUTE 'CREATE POLICY "Users can delete own oura data" ON oura_data FOR DELETE USING (auth.jwt() ->> ''email'' = email)';
  END IF;

  -- vital_webhook_events
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vital_webhook_events' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE vital_webhook_events ENABLE ROW LEVEL SECURITY';
    -- Webhook events are typically service-only, no user policies needed
  END IF;
END $$;

-- ============================================================================
-- SECTION 7: RE-ENABLE RLS ON FORGE TABLES (in case it was disabled)
-- ============================================================================
-- These should already have RLS from 007_forge_enhancements.sql but ensure it's enabled

ALTER TABLE forge_workout_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE forge_training_data ENABLE ROW LEVEL SECURITY;

-- Recreate policies if they don't exist
DO $$
BEGIN
  -- forge_training_data
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'forge_training_data' AND policyname = 'Users can view their own training data') THEN
    EXECUTE 'CREATE POLICY "Users can view their own training data" ON forge_training_data FOR SELECT USING (auth.jwt() ->> ''email'' = email)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'forge_training_data' AND policyname = 'Users can insert their own training data') THEN
    EXECUTE 'CREATE POLICY "Users can insert their own training data" ON forge_training_data FOR INSERT WITH CHECK (auth.jwt() ->> ''email'' = email)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'forge_training_data' AND policyname = 'Users can update their own training data') THEN
    EXECUTE 'CREATE POLICY "Users can update their own training data" ON forge_training_data FOR UPDATE USING (auth.jwt() ->> ''email'' = email)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'forge_training_data' AND policyname = 'Users can delete their own training data') THEN
    EXECUTE 'CREATE POLICY "Users can delete their own training data" ON forge_training_data FOR DELETE USING (auth.jwt() ->> ''email'' = email)';
  END IF;

  -- forge_workout_patterns
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'forge_workout_patterns' AND policyname = 'Users can view their own workout patterns') THEN
    EXECUTE 'CREATE POLICY "Users can view their own workout patterns" ON forge_workout_patterns FOR SELECT USING (auth.jwt() ->> ''email'' = email)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'forge_workout_patterns' AND policyname = 'Users can insert their own workout patterns') THEN
    EXECUTE 'CREATE POLICY "Users can insert their own workout patterns" ON forge_workout_patterns FOR INSERT WITH CHECK (auth.jwt() ->> ''email'' = email)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'forge_workout_patterns' AND policyname = 'Users can update their own workout patterns') THEN
    EXECUTE 'CREATE POLICY "Users can update their own workout patterns" ON forge_workout_patterns FOR UPDATE USING (auth.jwt() ->> ''email'' = email)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'forge_workout_patterns' AND policyname = 'Users can delete their own workout patterns') THEN
    EXECUTE 'CREATE POLICY "Users can delete their own workout patterns" ON forge_workout_patterns FOR DELETE USING (auth.jwt() ->> ''email'' = email)';
  END IF;
END $$;

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================

COMMENT ON POLICY "Users can view own device tokens" ON user_device_tokens IS 'RLS: Users can only see their own device tokens';
COMMENT ON POLICY "Users can view own health baselines" ON user_health_baselines IS 'RLS: Users can only see their own health baselines';
COMMENT ON POLICY "Users can view own oauth connections" ON user_oauth_connections IS 'RLS: Users can only see their own OAuth connections';
COMMENT ON POLICY "Users can view own behavioral patterns" ON behavioral_patterns IS 'RLS: Users can only see their own behavioral patterns';
COMMENT ON POLICY "Users can view own ecosystem context" ON ecosystem_context_cache IS 'RLS: Users can only see their own ecosystem context cache';
COMMENT ON POLICY "Users can view own insights" ON real_time_insights IS 'RLS: Users can only see their own real-time insights';
COMMENT ON POLICY "Users can view own carts" ON shopping_carts IS 'RLS: Users can only see their own shopping carts';
COMMENT ON POLICY "Users can view own cart items" ON cart_items IS 'RLS: Users can only see items in their own carts';
COMMENT ON POLICY "Users can view own orders" ON orders IS 'RLS: Users can only see their own orders';
COMMENT ON POLICY "Users can view own order items" ON order_items IS 'RLS: Users can only see items in their own orders';
COMMENT ON POLICY "Users can view own addresses" ON shipping_addresses IS 'RLS: Users can only see their own shipping addresses';
COMMENT ON POLICY "Anyone can view active products" ON supplement_products IS 'RLS: Public read access to active products';
COMMENT ON POLICY "Anyone can view supplement mappings" ON supplement_name_mappings IS 'RLS: Public read access to supplement name mappings';
COMMENT ON POLICY "Anyone can view active discount codes" ON discount_codes IS 'RLS: Public read access to valid discount codes';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
