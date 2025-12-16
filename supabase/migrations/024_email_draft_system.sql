-- Email Draft System Migration
-- Creates tables for:
-- 1. user_email_style - Learned writing patterns
-- 2. email_drafts - Track generated drafts
-- 3. gmail_watch_subscriptions - Push notification subscriptions
-- 4. email_draft_settings - User preferences

-- =====================================================
-- 1. USER EMAIL STYLE TABLE
-- Stores learned writing patterns from user's email history
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_email_style (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  user_code TEXT,

  -- Greeting patterns (e.g., ["Hey {name}", "Hi {name},", "Hello,"])
  greeting_patterns JSONB DEFAULT '[]'::jsonb,

  -- Sign-off patterns (e.g., ["Best,", "Thanks,", "Cheers,"])
  signoff_patterns JSONB DEFAULT '[]'::jsonb,

  -- Tone analysis
  -- e.g., { "formality": 0.6, "warmth": 0.7, "directness": 0.8 }
  tone_profile JSONB DEFAULT '{}'::jsonb,

  -- Verbosity metrics
  avg_sentence_length NUMERIC,
  avg_email_length INTEGER,
  verbosity_level TEXT CHECK (verbosity_level IN ('concise', 'medium', 'detailed')),

  -- Common phrases and vocabulary
  common_phrases JSONB DEFAULT '[]'::jsonb,
  preferred_vocabulary JSONB DEFAULT '{}'::jsonb,

  -- Response patterns
  response_time_preference TEXT CHECK (response_time_preference IN ('immediate', 'thoughtful', 'brief')),
  uses_emojis BOOLEAN DEFAULT false,
  uses_bullet_points BOOLEAN DEFAULT false,
  uses_numbered_lists BOOLEAN DEFAULT false,

  -- Sample emails used for learning
  sample_emails_analyzed INTEGER DEFAULT 0,
  sent_emails_analyzed INTEGER DEFAULT 0,
  received_emails_analyzed INTEGER DEFAULT 0,
  thread_responses_analyzed INTEGER DEFAULT 0,

  -- Learning metadata
  last_learned_at TIMESTAMP WITH TIME ZONE,
  learning_version INTEGER DEFAULT 1,
  confidence_score NUMERIC DEFAULT 0 CHECK (confidence_score >= 0 AND confidence_score <= 1),

  -- Raw analysis data for debugging
  raw_analysis JSONB,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(user_email)
);

CREATE INDEX IF NOT EXISTS idx_user_email_style_email ON public.user_email_style(user_email);
CREATE INDEX IF NOT EXISTS idx_user_email_style_code ON public.user_email_style(user_code);

-- Enable RLS
ALTER TABLE public.user_email_style ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on user_email_style" ON public.user_email_style
  FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- 2. EMAIL DRAFTS TABLE
-- Tracks AI-generated email drafts
-- =====================================================
CREATE TABLE IF NOT EXISTS public.email_drafts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  user_code TEXT,

  -- Original email reference
  original_message_id TEXT NOT NULL,
  original_thread_id TEXT NOT NULL,
  original_subject TEXT,
  original_from TEXT,
  original_from_name TEXT,
  original_snippet TEXT,
  original_body_preview TEXT,
  original_received_at TIMESTAMP WITH TIME ZONE,
  original_labels JSONB DEFAULT '[]'::jsonb,

  -- Draft information
  gmail_draft_id TEXT,
  draft_subject TEXT,
  draft_body TEXT NOT NULL,
  draft_html_body TEXT,

  -- Classification
  email_type TEXT CHECK (email_type IN ('question', 'request', 'action_item', 'follow_up', 'informational')),
  urgency_level TEXT CHECK (urgency_level IN ('low', 'medium', 'high')),
  classification_reasoning TEXT,
  response_points JSONB DEFAULT '[]'::jsonb,
  confidence_score NUMERIC CHECK (confidence_score >= 0 AND confidence_score <= 1),

  -- Status tracking
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',      -- Draft generated, not yet in Gmail
    'created',      -- Draft exists in Gmail
    'sent',         -- User sent the draft
    'modified',     -- User modified before sending
    'discarded',    -- User deleted the draft
    'expired',      -- Draft expired/cleaned up
    'failed'        -- Failed to create draft
  )),

  -- Agent execution reference
  agent_execution_id UUID,
  reasoning_steps JSONB,
  generation_model TEXT,

  -- Error tracking
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  gmail_created_at TIMESTAMP WITH TIME ZONE,
  status_updated_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,

  UNIQUE(original_message_id, user_email)
);

CREATE INDEX IF NOT EXISTS idx_email_drafts_email ON public.email_drafts(user_email);
CREATE INDEX IF NOT EXISTS idx_email_drafts_status ON public.email_drafts(status);
CREATE INDEX IF NOT EXISTS idx_email_drafts_thread ON public.email_drafts(original_thread_id);
CREATE INDEX IF NOT EXISTS idx_email_drafts_gmail_draft ON public.email_drafts(gmail_draft_id);
CREATE INDEX IF NOT EXISTS idx_email_drafts_created ON public.email_drafts(created_at DESC);

-- Enable RLS
ALTER TABLE public.email_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on email_drafts" ON public.email_drafts
  FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- 3. GMAIL WATCH SUBSCRIPTIONS TABLE
-- Tracks active Gmail push notification subscriptions
-- =====================================================
CREATE TABLE IF NOT EXISTS public.gmail_watch_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  user_code TEXT,

  -- Gmail watch details
  history_id TEXT NOT NULL,
  expiration_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Pub/Sub details
  topic_name TEXT NOT NULL,

  -- Label filters
  label_ids JSONB DEFAULT '["INBOX"]'::jsonb,

  -- Status
  is_active BOOLEAN DEFAULT true,
  last_notification_at TIMESTAMP WITH TIME ZONE,
  notification_count INTEGER DEFAULT 0,

  -- Processing stats
  emails_processed INTEGER DEFAULT 0,
  drafts_generated INTEGER DEFAULT 0,

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

CREATE INDEX IF NOT EXISTS idx_gmail_watch_email ON public.gmail_watch_subscriptions(user_email);
CREATE INDEX IF NOT EXISTS idx_gmail_watch_active ON public.gmail_watch_subscriptions(is_active);
CREATE INDEX IF NOT EXISTS idx_gmail_watch_expiration ON public.gmail_watch_subscriptions(expiration_timestamp);

-- Enable RLS
ALTER TABLE public.gmail_watch_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on gmail_watch_subscriptions" ON public.gmail_watch_subscriptions
  FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- 4. EMAIL DRAFT SETTINGS TABLE
-- User preferences for automatic draft generation
-- =====================================================
CREATE TABLE IF NOT EXISTS public.email_draft_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  user_code TEXT,

  -- Feature toggles
  auto_draft_enabled BOOLEAN DEFAULT true,
  require_approval BOOLEAN DEFAULT false,

  -- Filter settings
  process_primary_only BOOLEAN DEFAULT true,
  process_social BOOLEAN DEFAULT false,
  process_promotions BOOLEAN DEFAULT false,
  process_updates BOOLEAN DEFAULT false,
  min_urgency_level TEXT DEFAULT 'low' CHECK (min_urgency_level IN ('low', 'medium', 'high')),

  -- Sender filters
  excluded_senders JSONB DEFAULT '[]'::jsonb,
  excluded_domains JSONB DEFAULT '[]'::jsonb,
  whitelisted_senders JSONB DEFAULT '[]'::jsonb,
  only_known_senders BOOLEAN DEFAULT false,

  -- Draft behavior
  max_drafts_per_day INTEGER DEFAULT 20,
  max_drafts_per_hour INTEGER DEFAULT 5,
  draft_retention_days INTEGER DEFAULT 7,

  -- Style overrides
  always_formal BOOLEAN DEFAULT false,
  always_casual BOOLEAN DEFAULT false,
  include_signature BOOLEAN DEFAULT true,
  signature_text TEXT,

  -- Response preferences
  min_response_length INTEGER DEFAULT 50,
  max_response_length INTEGER DEFAULT 500,
  include_original_context BOOLEAN DEFAULT true,

  -- Notification preferences
  notify_on_draft_created BOOLEAN DEFAULT true,
  notify_channel TEXT DEFAULT 'push' CHECK (notify_channel IN ('push', 'email', 'both', 'none')),

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(user_email)
);

CREATE INDEX IF NOT EXISTS idx_email_draft_settings_email ON public.email_draft_settings(user_email);
CREATE INDEX IF NOT EXISTS idx_email_draft_settings_enabled ON public.email_draft_settings(auto_draft_enabled);

-- Enable RLS
ALTER TABLE public.email_draft_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on email_draft_settings" ON public.email_draft_settings
  FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- TRIGGER FOR UPDATED_AT
-- =====================================================
CREATE OR REPLACE FUNCTION update_email_draft_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_email_style_updated
  BEFORE UPDATE ON public.user_email_style
  FOR EACH ROW EXECUTE FUNCTION update_email_draft_updated_at();

CREATE TRIGGER trigger_gmail_watch_subscriptions_updated
  BEFORE UPDATE ON public.gmail_watch_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_email_draft_updated_at();

CREATE TRIGGER trigger_email_draft_settings_updated
  BEFORE UPDATE ON public.email_draft_settings
  FOR EACH ROW EXECUTE FUNCTION update_email_draft_updated_at();
