-- Outlook Email System Migration
-- Creates tables for:
-- 1. outlook_user_categories - Maps our categories to Outlook category IDs per user
-- 2. outlook_subscriptions - Tracks Microsoft Graph webhook subscriptions
-- 3. Extends email_label_assignments for Outlook support
-- 4. Extends email_draft_settings for Outlook support

-- =====================================================
-- 1. OUTLOOK USER CATEGORIES TABLE
-- Maps Moccet categories to Outlook category IDs per user
-- =====================================================
CREATE TABLE IF NOT EXISTS public.outlook_user_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  user_code TEXT,

  -- Category definition
  category_name TEXT NOT NULL,       -- Our internal name (e.g., 'to_respond')
  outlook_category_id TEXT,          -- Outlook's category ID
  display_name TEXT NOT NULL,        -- Display name in Outlook (e.g., 'Moccet: To Respond')
  color_preset TEXT,                 -- Outlook color preset (preset0-preset24)

  -- Status
  is_synced BOOLEAN DEFAULT false,   -- Whether category exists in Outlook
  sync_error TEXT,
  last_synced_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(user_email, category_name)
);

CREATE INDEX IF NOT EXISTS idx_outlook_user_categories_email ON public.outlook_user_categories(user_email);
CREATE INDEX IF NOT EXISTS idx_outlook_user_categories_synced ON public.outlook_user_categories(user_email, is_synced);

-- Enable RLS
ALTER TABLE public.outlook_user_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on outlook_user_categories" ON public.outlook_user_categories
  FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- 2. OUTLOOK SUBSCRIPTIONS TABLE
-- Tracks Microsoft Graph webhook subscriptions
-- =====================================================
CREATE TABLE IF NOT EXISTS public.outlook_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  user_code TEXT,

  -- Subscription details
  subscription_id TEXT NOT NULL,           -- Microsoft Graph subscription ID
  resource TEXT NOT NULL,                  -- Resource path (e.g., '/me/mailFolders/inbox/messages')
  change_types TEXT[] NOT NULL,            -- Change types (created, updated, deleted)
  notification_url TEXT NOT NULL,          -- Webhook URL
  client_state TEXT NOT NULL,              -- For validation
  expiration_datetime TIMESTAMP WITH TIME ZONE NOT NULL,  -- When subscription expires

  -- Status
  is_active BOOLEAN DEFAULT true,
  last_notification_at TIMESTAMP WITH TIME ZONE,
  notification_count INTEGER DEFAULT 0,

  -- Error tracking
  last_error TEXT,
  last_error_at TIMESTAMP WITH TIME ZONE,
  consecutive_errors INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  renewed_at TIMESTAMP WITH TIME ZONE,

  UNIQUE(user_email)
);

CREATE INDEX IF NOT EXISTS idx_outlook_subscriptions_email ON public.outlook_subscriptions(user_email);
CREATE INDEX IF NOT EXISTS idx_outlook_subscriptions_active ON public.outlook_subscriptions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_outlook_subscriptions_expiration ON public.outlook_subscriptions(expiration_datetime);
CREATE INDEX IF NOT EXISTS idx_outlook_subscriptions_sub_id ON public.outlook_subscriptions(subscription_id);

-- Enable RLS
ALTER TABLE public.outlook_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on outlook_subscriptions" ON public.outlook_subscriptions
  FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- 3. EXTEND EMAIL_LABEL_ASSIGNMENTS FOR OUTLOOK
-- Add email_provider column to support both Gmail and Outlook
-- =====================================================
ALTER TABLE public.email_label_assignments
ADD COLUMN IF NOT EXISTS email_provider TEXT DEFAULT 'gmail' CHECK (email_provider IN ('gmail', 'outlook'));

-- Create index for provider-based queries
CREATE INDEX IF NOT EXISTS idx_email_label_assignments_provider ON public.email_label_assignments(email_provider);
CREATE INDEX IF NOT EXISTS idx_email_label_assignments_email_provider ON public.email_label_assignments(user_email, email_provider);

-- =====================================================
-- 4. EXTEND EMAIL_DRAFT_SETTINGS FOR OUTLOOK
-- Add Outlook-specific settings
-- =====================================================
ALTER TABLE public.email_draft_settings
ADD COLUMN IF NOT EXISTS outlook_auto_draft_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS outlook_auto_labeling_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS outlook_subscription_id TEXT;

-- =====================================================
-- 5. EXTEND SENT_EMAIL_TRACKING FOR OUTLOOK
-- Add email_provider column
-- =====================================================
ALTER TABLE public.sent_email_tracking
ADD COLUMN IF NOT EXISTS email_provider TEXT DEFAULT 'gmail' CHECK (email_provider IN ('gmail', 'outlook'));

CREATE INDEX IF NOT EXISTS idx_sent_email_tracking_provider ON public.sent_email_tracking(email_provider);

-- =====================================================
-- 6. TRIGGERS FOR UPDATED_AT
-- =====================================================
CREATE OR REPLACE FUNCTION update_outlook_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_outlook_user_categories_updated
  BEFORE UPDATE ON public.outlook_user_categories
  FOR EACH ROW EXECUTE FUNCTION update_outlook_categories_updated_at();

CREATE OR REPLACE FUNCTION update_outlook_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_outlook_subscriptions_updated
  BEFORE UPDATE ON public.outlook_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_outlook_subscriptions_updated_at();
