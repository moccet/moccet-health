-- Gmail Labeling System Migration
-- Creates tables for:
-- 1. gmail_user_labels - Maps our labels to Gmail label IDs per user
-- 2. email_label_assignments - Tracks which label was applied to which email
-- 3. sent_email_tracking - Tracks sent emails for "Awaiting Reply" detection

-- =====================================================
-- 1. GMAIL USER LABELS TABLE
-- Maps Moccet labels to Gmail label IDs per user
-- =====================================================
CREATE TABLE IF NOT EXISTS public.gmail_user_labels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  user_code TEXT,

  -- Label definition
  label_name TEXT NOT NULL,  -- Our internal name (e.g., 'to_respond')
  gmail_label_id TEXT,       -- Gmail's label ID (created via API)
  display_name TEXT NOT NULL, -- Display name in Gmail (e.g., 'Moccet/To Respond')

  -- Label appearance (Gmail colors)
  background_color TEXT,     -- Hex color for Gmail background
  text_color TEXT,           -- Hex color for text

  -- Status
  is_synced BOOLEAN DEFAULT false,  -- Whether label exists in Gmail
  sync_error TEXT,
  last_synced_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(user_email, label_name)
);

CREATE INDEX IF NOT EXISTS idx_gmail_user_labels_email ON public.gmail_user_labels(user_email);
CREATE INDEX IF NOT EXISTS idx_gmail_user_labels_synced ON public.gmail_user_labels(user_email, is_synced);

-- Enable RLS
ALTER TABLE public.gmail_user_labels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on gmail_user_labels" ON public.gmail_user_labels
  FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- 2. EMAIL LABEL ASSIGNMENTS TABLE
-- Tracks which label was applied to which email/thread
-- =====================================================
CREATE TABLE IF NOT EXISTS public.email_label_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  user_code TEXT,

  -- Email reference
  message_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,

  -- Label assignment
  label_name TEXT NOT NULL,      -- Our internal label (to_respond, fyi, etc.)
  gmail_label_id TEXT,           -- Gmail label ID applied

  -- Classification details
  classification_source TEXT CHECK (classification_source IN ('ai', 'heuristic', 'user', 'sent_tracking', 'thread_update')),
  confidence_score NUMERIC CHECK (confidence_score >= 0 AND confidence_score <= 1),
  classification_reasoning TEXT,

  -- Previous label (for tracking changes)
  previous_label TEXT,

  -- Email metadata for context
  from_email TEXT,
  subject TEXT,

  -- Status
  is_applied BOOLEAN DEFAULT false,  -- Whether label was applied to Gmail
  apply_error TEXT,

  -- Timestamps
  labeled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  applied_at TIMESTAMP WITH TIME ZONE,

  UNIQUE(user_email, message_id)
);

CREATE INDEX IF NOT EXISTS idx_email_label_assignments_email ON public.email_label_assignments(user_email);
CREATE INDEX IF NOT EXISTS idx_email_label_assignments_thread ON public.email_label_assignments(thread_id);
CREATE INDEX IF NOT EXISTS idx_email_label_assignments_label ON public.email_label_assignments(label_name);
CREATE INDEX IF NOT EXISTS idx_email_label_assignments_applied ON public.email_label_assignments(is_applied);

-- Enable RLS
ALTER TABLE public.email_label_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on email_label_assignments" ON public.email_label_assignments
  FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- 3. SENT EMAIL TRACKING TABLE
-- Tracks user's sent emails for "Awaiting Reply" detection
-- =====================================================
CREATE TABLE IF NOT EXISTS public.sent_email_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  user_code TEXT,

  -- Email reference
  message_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,

  -- Recipient info
  to_recipients TEXT[],
  cc_recipients TEXT[],
  subject TEXT,

  -- Tracking status
  awaiting_reply BOOLEAN DEFAULT true,
  reply_received BOOLEAN DEFAULT false,
  reply_received_at TIMESTAMP WITH TIME ZONE,
  reply_message_id TEXT,

  -- Timestamps
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(user_email, message_id)
);

CREATE INDEX IF NOT EXISTS idx_sent_email_tracking_email ON public.sent_email_tracking(user_email);
CREATE INDEX IF NOT EXISTS idx_sent_email_tracking_thread ON public.sent_email_tracking(thread_id);
CREATE INDEX IF NOT EXISTS idx_sent_email_tracking_awaiting ON public.sent_email_tracking(user_email, awaiting_reply) WHERE awaiting_reply = true;

-- Enable RLS
ALTER TABLE public.sent_email_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on sent_email_tracking" ON public.sent_email_tracking
  FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- 4. ADD LABEL SETTINGS TO email_draft_settings
-- =====================================================
ALTER TABLE public.email_draft_settings
ADD COLUMN IF NOT EXISTS auto_labeling_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS label_prefix TEXT DEFAULT 'Moccet',
ADD COLUMN IF NOT EXISTS track_sent_for_awaiting_reply BOOLEAN DEFAULT true;

-- =====================================================
-- 5. TRIGGERS FOR UPDATED_AT
-- =====================================================
CREATE OR REPLACE FUNCTION update_gmail_labels_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_gmail_user_labels_updated
  BEFORE UPDATE ON public.gmail_user_labels
  FOR EACH ROW EXECUTE FUNCTION update_gmail_labels_updated_at();
