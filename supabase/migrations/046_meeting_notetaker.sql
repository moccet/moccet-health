-- Migration: Meeting Notetaker System
-- Description: Tables for meeting recordings, transcripts, summaries, and AI analysis

-- ============================================================================
-- MEETING RECORDINGS: Core meeting data and status tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS meeting_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  user_code TEXT,

  -- Meeting identification
  calendar_event_id TEXT,          -- Google Calendar event ID
  google_meet_url TEXT,
  meeting_type TEXT DEFAULT 'google_meet' CHECK (meeting_type IN ('google_meet', 'microphone', 'upload')),

  -- Meeting metadata
  title TEXT,
  scheduled_start TIMESTAMPTZ,
  scheduled_end TIMESTAMPTZ,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  duration_seconds INTEGER,

  -- Participants
  organizer_email TEXT,
  organizer_name TEXT,
  attendees JSONB DEFAULT '[]',    -- [{email, name, response_status}]

  -- Processing status
  status TEXT DEFAULT 'scheduled' CHECK (status IN (
    'scheduled', 'joining', 'recording', 'processing',
    'transcribing', 'summarizing', 'complete', 'failed'
  )),

  -- Bot session reference
  bot_session_id TEXT,             -- External bot service session ID

  -- Storage references
  recording_url TEXT,              -- S3/Supabase Storage URL
  recording_size_bytes BIGINT,

  -- Processing flags
  notetaker_enabled BOOLEAN DEFAULT true,
  email_sent BOOLEAN DEFAULT false,
  email_sent_at TIMESTAMPTZ,

  -- Error tracking
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- MEETING TRANSCRIPTS: Full transcript with speaker segments
-- ============================================================================
CREATE TABLE IF NOT EXISTS meeting_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meeting_recordings(id) ON DELETE CASCADE,

  -- Raw transcript
  raw_transcript TEXT,

  -- Edited transcript (user modifications)
  edited_transcript TEXT,

  -- Structured segments with speaker diarization
  -- Format: [{start_time, end_time, speaker, text, confidence}]
  segments JSONB DEFAULT '[]',

  -- Speaker profiles identified in the meeting
  -- Format: [{index, label, email, name, word_count, speaking_time_seconds}]
  speakers JSONB DEFAULT '[]',

  -- Language detection
  detected_language TEXT DEFAULT 'en',

  -- Accuracy metrics
  overall_confidence FLOAT,

  -- Custom word applications
  custom_words_applied TEXT[],

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- MEETING SUMMARIES: AI-generated summaries in multiple styles
-- ============================================================================
CREATE TABLE IF NOT EXISTS meeting_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meeting_recordings(id) ON DELETE CASCADE,

  -- Summary content
  summary_style TEXT NOT NULL CHECK (summary_style IN ('executive', 'chronological', 'sales')),
  summary_text TEXT NOT NULL,

  -- Structured summary data
  key_points JSONB DEFAULT '[]',
  topics_discussed JSONB DEFAULT '[]',

  -- Generation metadata
  generation_model TEXT,
  custom_prompt TEXT,

  -- User preference
  is_primary BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(meeting_id, summary_style)
);

-- ============================================================================
-- MEETING ACTION ITEMS: Tasks extracted from meetings
-- ============================================================================
CREATE TABLE IF NOT EXISTS meeting_action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meeting_recordings(id) ON DELETE CASCADE,

  -- Task details
  task_description TEXT NOT NULL,
  owner_email TEXT,
  owner_name TEXT,

  -- Metadata
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  due_date DATE,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),

  -- Extraction confidence
  confidence FLOAT,
  source_timestamp FLOAT,          -- Timestamp in recording where this was mentioned

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- MEETING DECISIONS: Key decisions captured
-- ============================================================================
CREATE TABLE IF NOT EXISTS meeting_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meeting_recordings(id) ON DELETE CASCADE,

  -- Decision details
  decision_text TEXT NOT NULL,
  context TEXT,
  impact_area TEXT,

  -- Extraction confidence
  confidence FLOAT,
  source_timestamp FLOAT,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- MEETING CUSTOM WORDS: User-defined vocabulary for better transcription
-- ============================================================================
CREATE TABLE IF NOT EXISTS meeting_custom_words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  user_code TEXT,

  -- Word details
  word TEXT NOT NULL,
  category TEXT CHECK (category IN ('product_name', 'company_name', 'acronym', 'technical_term', 'person_name', 'other')),
  phonetic_hints TEXT[],           -- Alternative spellings/pronunciations

  -- Usage tracking
  usage_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(user_email, word)
);

-- ============================================================================
-- MEETING NOTETAKER SETTINGS: User preferences for notetaker
-- ============================================================================
CREATE TABLE IF NOT EXISTS meeting_notetaker_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  user_code TEXT,

  -- Auto-join settings
  auto_join_enabled BOOLEAN DEFAULT true,
  join_buffer_minutes INTEGER DEFAULT 1,  -- Join X minutes before meeting

  -- Transcription settings
  default_language TEXT DEFAULT 'en',
  enable_speaker_diarization BOOLEAN DEFAULT true,

  -- Summary preferences
  default_summary_style TEXT DEFAULT 'executive' CHECK (default_summary_style IN ('executive', 'chronological', 'sales')),

  -- Distribution settings
  auto_send_summary BOOLEAN DEFAULT true,
  send_to_attendees BOOLEAN DEFAULT false,
  recap_distribution_emails TEXT[],

  -- Follow-up email
  auto_generate_followup BOOLEAN DEFAULT true,
  match_email_style BOOLEAN DEFAULT true,

  -- Storage
  retain_recordings_days INTEGER DEFAULT 90,
  retain_transcripts_days INTEGER DEFAULT 365,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(user_email)
);

-- ============================================================================
-- MEETING CHAT HISTORY: Q&A conversations about transcripts
-- ============================================================================
CREATE TABLE IF NOT EXISTS meeting_chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meeting_recordings(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,

  -- Chat message
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,

  -- Response metadata (for assistant messages)
  source_citations JSONB,          -- [{timestamp, speaker, text}]
  confidence FLOAT,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- MEETING FOLLOWUP DRAFTS: Generated follow-up emails
-- ============================================================================
CREATE TABLE IF NOT EXISTS meeting_followup_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meeting_recordings(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,

  -- Email content
  subject TEXT,
  body TEXT,
  html_body TEXT,

  -- Recipients
  to_emails TEXT[],
  cc_emails TEXT[],

  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'discarded')),
  gmail_draft_id TEXT,

  -- Generation metadata
  generation_model TEXT,
  style_matched BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Meeting recordings indexes
CREATE INDEX idx_meeting_recordings_user ON meeting_recordings(user_email);
CREATE INDEX idx_meeting_recordings_status ON meeting_recordings(status);
CREATE INDEX idx_meeting_recordings_scheduled ON meeting_recordings(scheduled_start);
CREATE INDEX idx_meeting_recordings_calendar ON meeting_recordings(calendar_event_id);
CREATE INDEX idx_meeting_recordings_active ON meeting_recordings(user_email, status)
  WHERE status IN ('scheduled', 'joining', 'recording', 'processing');

-- Transcript indexes
CREATE INDEX idx_meeting_transcripts_meeting ON meeting_transcripts(meeting_id);

-- Summary indexes
CREATE INDEX idx_meeting_summaries_meeting ON meeting_summaries(meeting_id);
CREATE INDEX idx_meeting_summaries_primary ON meeting_summaries(meeting_id) WHERE is_primary = true;

-- Action items indexes
CREATE INDEX idx_meeting_action_items_meeting ON meeting_action_items(meeting_id);
CREATE INDEX idx_meeting_action_items_owner ON meeting_action_items(owner_email);
CREATE INDEX idx_meeting_action_items_open ON meeting_action_items(meeting_id, status) WHERE status = 'open';

-- Decisions indexes
CREATE INDEX idx_meeting_decisions_meeting ON meeting_decisions(meeting_id);

-- Custom words indexes
CREATE INDEX idx_meeting_custom_words_user ON meeting_custom_words(user_email);

-- Settings indexes
CREATE INDEX idx_meeting_settings_user ON meeting_notetaker_settings(user_email);

-- Chat history indexes
CREATE INDEX idx_meeting_chat_meeting ON meeting_chat_history(meeting_id);
CREATE INDEX idx_meeting_chat_user ON meeting_chat_history(user_email);

-- Followup drafts indexes
CREATE INDEX idx_meeting_followup_meeting ON meeting_followup_drafts(meeting_id);
CREATE INDEX idx_meeting_followup_user ON meeting_followup_drafts(user_email);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE meeting_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_custom_words ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_notetaker_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_followup_drafts ENABLE ROW LEVEL SECURITY;

-- Permissive policies (following existing pattern in codebase)
CREATE POLICY "meeting_recordings_policy" ON meeting_recordings FOR ALL USING (true);
CREATE POLICY "meeting_transcripts_policy" ON meeting_transcripts FOR ALL USING (true);
CREATE POLICY "meeting_summaries_policy" ON meeting_summaries FOR ALL USING (true);
CREATE POLICY "meeting_action_items_policy" ON meeting_action_items FOR ALL USING (true);
CREATE POLICY "meeting_decisions_policy" ON meeting_decisions FOR ALL USING (true);
CREATE POLICY "meeting_custom_words_policy" ON meeting_custom_words FOR ALL USING (true);
CREATE POLICY "meeting_notetaker_settings_policy" ON meeting_notetaker_settings FOR ALL USING (true);
CREATE POLICY "meeting_chat_policy" ON meeting_chat_history FOR ALL USING (true);
CREATE POLICY "meeting_followup_policy" ON meeting_followup_drafts FOR ALL USING (true);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

-- Create trigger function if it doesn't exist (may already exist from other migrations)
CREATE OR REPLACE FUNCTION update_meeting_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_meeting_recordings_updated
  BEFORE UPDATE ON meeting_recordings
  FOR EACH ROW EXECUTE FUNCTION update_meeting_updated_at();

CREATE TRIGGER update_meeting_transcripts_updated
  BEFORE UPDATE ON meeting_transcripts
  FOR EACH ROW EXECUTE FUNCTION update_meeting_updated_at();

CREATE TRIGGER update_meeting_summaries_updated
  BEFORE UPDATE ON meeting_summaries
  FOR EACH ROW EXECUTE FUNCTION update_meeting_updated_at();

CREATE TRIGGER update_meeting_action_items_updated
  BEFORE UPDATE ON meeting_action_items
  FOR EACH ROW EXECUTE FUNCTION update_meeting_updated_at();

CREATE TRIGGER update_meeting_settings_updated
  BEFORE UPDATE ON meeting_notetaker_settings
  FOR EACH ROW EXECUTE FUNCTION update_meeting_updated_at();

CREATE TRIGGER update_meeting_followup_updated
  BEFORE UPDATE ON meeting_followup_drafts
  FOR EACH ROW EXECUTE FUNCTION update_meeting_updated_at();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE meeting_recordings IS 'Core meeting data including scheduling, status, and recording references';
COMMENT ON TABLE meeting_transcripts IS 'Full transcripts with speaker diarization segments';
COMMENT ON TABLE meeting_summaries IS 'AI-generated summaries in multiple styles (executive, chronological, sales)';
COMMENT ON TABLE meeting_action_items IS 'Tasks extracted from meetings with ownership and deadlines';
COMMENT ON TABLE meeting_decisions IS 'Key decisions captured during meetings';
COMMENT ON TABLE meeting_custom_words IS 'User-defined vocabulary for improved transcription accuracy';
COMMENT ON TABLE meeting_notetaker_settings IS 'User preferences for the notetaker feature';
COMMENT ON TABLE meeting_chat_history IS 'Q&A conversations about meeting transcripts';
COMMENT ON TABLE meeting_followup_drafts IS 'Generated follow-up email drafts';
