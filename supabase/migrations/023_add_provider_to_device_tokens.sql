-- Migration: Add provider column to user_device_tokens
-- Purpose: Support multiple push notification providers (FCM, OneSignal, etc.)
-- Created: 2025-12-14

-- Add provider column to distinguish between FCM and OneSignal tokens
ALTER TABLE user_device_tokens
ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'fcm' CHECK (provider IN ('fcm', 'onesignal'));

-- Update comments
COMMENT ON COLUMN user_device_tokens.provider IS 'Push notification provider: fcm or onesignal';

-- Update existing rows to have provider = 'fcm'
UPDATE user_device_tokens SET provider = 'fcm' WHERE provider IS NULL;
