-- Email Subscription System Migration
-- Creates tables for:
-- 1. email_subscriptions - Detected subscriptions from scanned emails
-- 2. email_unsubscribe_logs - Tracks unsubscribe attempts and results

-- =====================================================
-- 1. EMAIL SUBSCRIPTIONS TABLE
-- Stores detected subscriptions from List-Unsubscribe headers
-- =====================================================
CREATE TABLE IF NOT EXISTS public.email_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  user_code TEXT,
  email_provider TEXT NOT NULL CHECK (email_provider IN ('gmail', 'outlook')),

  -- Sender identification (grouping key)
  sender_domain TEXT NOT NULL,        -- e.g., 'newsletter.example.com'
  sender_name TEXT,                   -- Display name, e.g., 'Example Newsletter'
  sender_email TEXT NOT NULL,         -- Full email address

  -- Sample email reference
  sample_message_id TEXT NOT NULL,    -- Most recent email ID with unsubscribe
  sample_subject TEXT,                -- Subject for user reference

  -- Unsubscribe options (from List-Unsubscribe header)
  unsubscribe_mailto TEXT,            -- mailto: URL if available
  unsubscribe_https TEXT,             -- https: URL if available
  supports_one_click BOOLEAN DEFAULT false, -- Has List-Unsubscribe-Post header

  -- Statistics
  email_count INTEGER DEFAULT 1,      -- Number of emails from this sender
  first_seen_at TIMESTAMP WITH TIME ZONE,
  last_seen_at TIMESTAMP WITH TIME ZONE,

  -- Unsubscribe status
  status TEXT DEFAULT 'active' CHECK (status IN (
    'active',           -- Subscription detected, not unsubscribed
    'pending',          -- Unsubscribe in progress
    'unsubscribed',     -- Successfully unsubscribed
    'failed'            -- Unsubscribe failed
  )),
  unsubscribed_at TIMESTAMP WITH TIME ZONE,
  unsubscribe_method TEXT CHECK (unsubscribe_method IN ('one_click', 'mailto') OR unsubscribe_method IS NULL),
  unsubscribe_error TEXT,

  -- Scan metadata
  last_scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Unique per user + provider + sender domain
  UNIQUE(user_email, email_provider, sender_domain)
);

CREATE INDEX IF NOT EXISTS idx_email_subscriptions_user ON public.email_subscriptions(user_email);
CREATE INDEX IF NOT EXISTS idx_email_subscriptions_provider ON public.email_subscriptions(user_email, email_provider);
CREATE INDEX IF NOT EXISTS idx_email_subscriptions_status ON public.email_subscriptions(user_email, status);
CREATE INDEX IF NOT EXISTS idx_email_subscriptions_scanned ON public.email_subscriptions(last_scanned_at);

-- Enable RLS
ALTER TABLE public.email_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on email_subscriptions" ON public.email_subscriptions
  FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- 2. EMAIL UNSUBSCRIBE LOGS TABLE
-- Tracks unsubscribe attempts for debugging and retry
-- =====================================================
CREATE TABLE IF NOT EXISTS public.email_unsubscribe_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id UUID REFERENCES public.email_subscriptions(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,

  -- Attempt details
  method TEXT NOT NULL CHECK (method IN ('one_click', 'mailto')),
  target_url TEXT,                     -- URL or mailto address used

  -- Result
  success BOOLEAN DEFAULT false,
  http_status INTEGER,                 -- For one-click attempts
  error_message TEXT,
  response_body TEXT,                  -- Truncated response for debugging

  -- Timing
  attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_unsubscribe_logs_subscription ON public.email_unsubscribe_logs(subscription_id);
CREATE INDEX IF NOT EXISTS idx_unsubscribe_logs_user ON public.email_unsubscribe_logs(user_email);

-- Enable RLS
ALTER TABLE public.email_unsubscribe_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on email_unsubscribe_logs" ON public.email_unsubscribe_logs
  FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- 3. TRIGGER FOR UPDATED_AT
-- =====================================================
CREATE OR REPLACE FUNCTION update_email_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_email_subscriptions_updated ON public.email_subscriptions;
CREATE TRIGGER trigger_email_subscriptions_updated
  BEFORE UPDATE ON public.email_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_email_subscriptions_updated_at();
