-- Migration: Integration Tokens Storage
-- Purpose: Migrate OAuth tokens from cookies to encrypted database storage
-- Author: Claude Code
-- Date: 2024-11-26

-- Create integration_tokens table for secure token storage
CREATE TABLE IF NOT EXISTS integration_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN (
    'oura', 'dexcom', 'fitbit', 'strava', 'vital',
    'gmail', 'slack', 'outlook', 'teams', 'apple_calendar', 'apple_health',
    'whoop', 'myfitnesspal', 'cronometer'
  )),

  -- Token data (will be encrypted at application layer)
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type TEXT DEFAULT 'Bearer',
  expires_at TIMESTAMP WITH TIME ZONE,

  -- OAuth metadata
  scopes TEXT[], -- Array of granted OAuth scopes
  provider_user_id TEXT, -- User ID from the provider (e.g., Oura user ID)

  -- Additional metadata
  metadata JSONB DEFAULT '{}'::jsonb, -- Provider-specific metadata

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_refreshed_at TIMESTAMP WITH TIME ZONE,

  -- Status tracking
  is_active BOOLEAN DEFAULT TRUE,
  revoked_at TIMESTAMP WITH TIME ZONE,

  -- Ensure one active token per user per provider
  CONSTRAINT unique_active_user_provider UNIQUE (user_email, provider, is_active)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_integration_tokens_user_email ON integration_tokens(user_email);
CREATE INDEX IF NOT EXISTS idx_integration_tokens_provider ON integration_tokens(provider);
CREATE INDEX IF NOT EXISTS idx_integration_tokens_expires_at ON integration_tokens(expires_at) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_integration_tokens_user_provider ON integration_tokens(user_email, provider) WHERE is_active = TRUE;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_integration_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER trigger_update_integration_tokens_updated_at
  BEFORE UPDATE ON integration_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_integration_tokens_updated_at();

-- Function to safely revoke tokens
CREATE OR REPLACE FUNCTION revoke_integration_token(
  p_user_email TEXT,
  p_provider TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE integration_tokens
  SET
    is_active = FALSE,
    revoked_at = NOW()
  WHERE
    user_email = p_user_email
    AND provider = p_provider
    AND is_active = TRUE;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to get active token with expiry check
CREATE OR REPLACE FUNCTION get_active_token(
  p_user_email TEXT,
  p_provider TEXT
)
RETURNS TABLE (
  token_id UUID,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_expired BOOLEAN,
  provider_user_id TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    id,
    integration_tokens.access_token,
    integration_tokens.refresh_token,
    integration_tokens.expires_at,
    (integration_tokens.expires_at IS NOT NULL AND integration_tokens.expires_at < NOW()) AS is_expired,
    integration_tokens.provider_user_id
  FROM integration_tokens
  WHERE
    user_email = p_user_email
    AND provider = p_provider
    AND is_active = TRUE
  ORDER BY created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Add RLS (Row Level Security) policies
ALTER TABLE integration_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own tokens
CREATE POLICY "Users can access their own integration tokens"
  ON integration_tokens
  FOR ALL
  USING (user_email = current_setting('app.current_user_email', TRUE));

-- Grant permissions (adjust based on your Supabase setup)
-- GRANT ALL ON integration_tokens TO authenticated;
-- GRANT EXECUTE ON FUNCTION revoke_integration_token TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_active_token TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE integration_tokens IS 'Stores OAuth tokens for third-party integrations with encryption';
COMMENT ON COLUMN integration_tokens.access_token IS 'OAuth access token (encrypted at app layer)';
COMMENT ON COLUMN integration_tokens.refresh_token IS 'OAuth refresh token for renewing access';
COMMENT ON COLUMN integration_tokens.expires_at IS 'Token expiration timestamp (NULL for non-expiring tokens)';
COMMENT ON COLUMN integration_tokens.scopes IS 'Array of OAuth scopes granted by user';
COMMENT ON COLUMN integration_tokens.provider_user_id IS 'User ID from the provider system';
COMMENT ON COLUMN integration_tokens.metadata IS 'Provider-specific metadata (e.g., team_id for Slack)';
