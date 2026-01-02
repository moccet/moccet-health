-- Migration: Fix device token RLS policy for backend API calls
-- Purpose: Allow backend API (service role) to insert device tokens on behalf of users
-- Created: 2026-01-02

-- The current RLS policy requires auth.jwt() >> 'email' = email, but when the
-- backend API (using service_role key) inserts tokens, there's no JWT.
--
-- Solution: Add a policy that allows service role to bypass RLS for inserts
-- while still protecting user data from direct client access.

-- Drop existing insert policy
DROP POLICY IF EXISTS "Users can insert own device tokens" ON user_device_tokens;

-- Create a more flexible insert policy that allows:
-- 1. Authenticated users inserting their own tokens (via JWT email match)
-- 2. Service role (backend API) inserting on behalf of users
CREATE POLICY "Users can insert own device tokens"
  ON user_device_tokens FOR INSERT
  WITH CHECK (
    -- Allow if JWT email matches the token email (direct user insert)
    auth.jwt() ->> 'email' = email
    OR
    -- Allow if using service role (backend API inserting on behalf of user)
    auth.role() = 'service_role'
  );

-- Also update the update and delete policies for consistency
DROP POLICY IF EXISTS "Users can update own device tokens" ON user_device_tokens;
CREATE POLICY "Users can update own device tokens"
  ON user_device_tokens FOR UPDATE
  USING (
    auth.jwt() ->> 'email' = email
    OR
    auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "Users can delete own device tokens" ON user_device_tokens;
CREATE POLICY "Users can delete own device tokens"
  ON user_device_tokens FOR DELETE
  USING (
    auth.jwt() ->> 'email' = email
    OR
    auth.role() = 'service_role'
  );

-- Also update select policy for consistency (backend needs to read tokens for notifications)
DROP POLICY IF EXISTS "Users can view own device tokens" ON user_device_tokens;
CREATE POLICY "Users can view own device tokens"
  ON user_device_tokens FOR SELECT
  USING (
    auth.jwt() ->> 'email' = email
    OR
    auth.role() = 'service_role'
  );

-- Add helpful comments
COMMENT ON POLICY "Users can insert own device tokens" ON user_device_tokens
  IS 'RLS: Users can insert own tokens, or service role (backend API) can insert on behalf of users';
COMMENT ON POLICY "Users can update own device tokens" ON user_device_tokens
  IS 'RLS: Users can update own tokens, or service role (backend API) can update on behalf of users';
COMMENT ON POLICY "Users can delete own device tokens" ON user_device_tokens
  IS 'RLS: Users can delete own tokens, or service role (backend API) can delete on behalf of users';
COMMENT ON POLICY "Users can view own device tokens" ON user_device_tokens
  IS 'RLS: Users can view own tokens, or service role (backend API) can view for notification sending';
