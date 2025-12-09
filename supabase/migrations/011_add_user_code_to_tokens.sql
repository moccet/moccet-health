-- Migration: Add user_code to integration_tokens
-- Purpose: Allow token lookup by unique code instead of email to fix token-email mismatch
-- Date: 2024-12-08

-- Add user_code column to integration_tokens
ALTER TABLE integration_tokens ADD COLUMN IF NOT EXISTS user_code TEXT;

-- Create index for user_code lookups
CREATE INDEX IF NOT EXISTS idx_integration_tokens_user_code
ON integration_tokens(user_code) WHERE is_active = TRUE;

-- Create composite index for user_code + provider lookups
CREATE INDEX IF NOT EXISTS idx_integration_tokens_code_provider
ON integration_tokens(user_code, provider) WHERE is_active = TRUE;

-- Update the get_active_token function to support user_code
CREATE OR REPLACE FUNCTION get_active_token(
  p_user_email TEXT,
  p_provider TEXT,
  p_user_code TEXT DEFAULT NULL
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
    (
      (p_user_code IS NOT NULL AND user_code = p_user_code)
      OR (p_user_code IS NULL AND user_email = p_user_email)
    )
    AND provider = p_provider
    AND is_active = TRUE
  ORDER BY created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Add comment for documentation
COMMENT ON COLUMN integration_tokens.user_code IS '8-character unique code linking to onboarding data (preferred over user_email for lookups)';
