-- Migration: FCM Device Tokens for Push Notifications
-- Purpose: Store Firebase Cloud Messaging device tokens for sending push notifications
-- Created: 2025-12-14

-- Store FCM device tokens for push notifications
CREATE TABLE IF NOT EXISTS user_device_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    device_token TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(email, device_token)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_device_tokens_email ON user_device_tokens(email);
CREATE INDEX IF NOT EXISTS idx_device_tokens_active ON user_device_tokens(email) WHERE is_active = TRUE;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_device_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_device_tokens_updated_at ON user_device_tokens;
CREATE TRIGGER trigger_update_device_tokens_updated_at
    BEFORE UPDATE ON user_device_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_device_tokens_updated_at();

-- Comments
COMMENT ON TABLE user_device_tokens IS 'Stores FCM device tokens for sending push notifications to users';
COMMENT ON COLUMN user_device_tokens.device_token IS 'Firebase Cloud Messaging token for the device';
COMMENT ON COLUMN user_device_tokens.platform IS 'Device platform: ios or android';
COMMENT ON COLUMN user_device_tokens.is_active IS 'Whether the token is still valid (set to false on logout or token refresh)';
