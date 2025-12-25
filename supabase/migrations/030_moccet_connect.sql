-- Moccet Connect: Social Connection System
-- Author: Claude Code
-- Date: 2024-12-24
-- Purpose: Enable social connections with health-aware meeting suggestions

-- =============================================================================
-- USER CONNECTIONS: Friend Relationships
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_email TEXT NOT NULL,
  addressee_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'blocked')),
  connection_level TEXT DEFAULT 'basic' CHECK (connection_level IN ('basic', 'health_sharing', 'full')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  UNIQUE(requester_email, addressee_email)
);

-- Indexes for connection lookups
CREATE INDEX IF NOT EXISTS idx_connections_requester ON user_connections(requester_email);
CREATE INDEX IF NOT EXISTS idx_connections_addressee ON user_connections(addressee_email);
CREATE INDEX IF NOT EXISTS idx_connections_status ON user_connections(status);
CREATE INDEX IF NOT EXISTS idx_connections_accepted ON user_connections(requester_email, addressee_email) WHERE status = 'accepted';

-- =============================================================================
-- CONNECTION PREFERENCES: Per-Friend Sharing Settings
-- =============================================================================

CREATE TABLE IF NOT EXISTS connection_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  friend_email TEXT NOT NULL,
  -- Data sharing toggles
  share_activity BOOLEAN DEFAULT true,
  share_sleep BOOLEAN DEFAULT false,
  share_stress BOOLEAN DEFAULT false,
  share_calendar BOOLEAN DEFAULT true,
  share_location BOOLEAN DEFAULT false,
  -- Activity preferences
  preferred_activities JSONB DEFAULT '[]',  -- ['gym', 'coffee', 'dinner', 'walk', 'run']
  meeting_frequency_preference TEXT DEFAULT 'weekly' CHECK (meeting_frequency_preference IN ('daily', 'weekly', 'biweekly', 'monthly', 'flexible')),
  -- Notification settings
  notify_suggestions BOOLEAN DEFAULT true,
  notify_friend_updates BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_email, friend_email)
);

CREATE INDEX IF NOT EXISTS idx_connection_prefs_user ON connection_preferences(user_email);
CREATE INDEX IF NOT EXISTS idx_connection_prefs_pair ON connection_preferences(user_email, friend_email);

-- =============================================================================
-- FRIEND ACTIVITY PATTERNS: Learning from Friendship History
-- =============================================================================

CREATE TABLE IF NOT EXISTS friend_activity_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_pair_hash TEXT NOT NULL UNIQUE,  -- Sorted hash of both emails for bidirectional lookup
  user_email_1 TEXT NOT NULL,
  user_email_2 TEXT NOT NULL,
  -- Pattern data
  shared_activities JSONB DEFAULT '{}',  -- {'gym': 12, 'coffee': 5, 'dinner': 3}
  compatibility_score FLOAT DEFAULT 0.5 CHECK (compatibility_score >= 0 AND compatibility_score <= 1),
  last_meeting TIMESTAMPTZ,
  meeting_count INT DEFAULT 0,
  meeting_history JSONB DEFAULT '[]',  -- Last 20 meetings with details
  -- Activity preferences inferred
  best_activities JSONB DEFAULT '[]',  -- Ranked list of activities that work for both
  best_times JSONB DEFAULT '{}',  -- {'morning': 0.3, 'afternoon': 0.5, 'evening': 0.2}
  avg_meeting_duration_mins INT,
  -- Health correlation data
  mood_improvement_correlation FLOAT,  -- Does meeting correlate with mood improvement?
  activity_boost_correlation FLOAT,  -- Does meeting boost activity levels?
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_friend_patterns_pair ON friend_activity_patterns(user_pair_hash);
CREATE INDEX IF NOT EXISTS idx_friend_patterns_user1 ON friend_activity_patterns(user_email_1);
CREATE INDEX IF NOT EXISTS idx_friend_patterns_user2 ON friend_activity_patterns(user_email_2);
CREATE INDEX IF NOT EXISTS idx_friend_patterns_score ON friend_activity_patterns(compatibility_score DESC);

-- =============================================================================
-- MEETING SUGGESTIONS: AI-Generated Connection Recommendations
-- =============================================================================

CREATE TABLE IF NOT EXISTS meeting_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_type TEXT DEFAULT 'mutual' CHECK (suggestion_type IN ('mutual', 'outreach', 'group')),
  -- Participants
  initiator_email TEXT NOT NULL,  -- Who the suggestion is shown to first
  participant_emails TEXT[] NOT NULL,  -- All participants including initiator
  -- Suggestion details
  suggested_activity TEXT NOT NULL,
  suggested_times JSONB NOT NULL,  -- [{start: ISO, end: ISO, score: 0.9}]
  suggested_location JSONB,  -- {name, address, type}
  -- Context
  reason TEXT NOT NULL,  -- Human-readable explanation
  health_context JSONB,  -- {initiator: {stress: 'high'}, friend: {skipped_gym: true}}
  benefit_summary TEXT,  -- "This could help both of you decompress"
  -- Scoring
  priority_score FLOAT DEFAULT 0.5 CHECK (priority_score >= 0 AND priority_score <= 1),
  -- Status tracking
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'viewed', 'accepted', 'declined', 'expired', 'completed')),
  viewed_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  response_notes TEXT,
  -- Lifecycle
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days')
);

CREATE INDEX IF NOT EXISTS idx_suggestions_initiator ON meeting_suggestions(initiator_email);
CREATE INDEX IF NOT EXISTS idx_suggestions_status ON meeting_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_suggestions_pending ON meeting_suggestions(initiator_email, status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_suggestions_priority ON meeting_suggestions(priority_score DESC) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_suggestions_expires ON meeting_suggestions(expires_at) WHERE status = 'pending';

-- =============================================================================
-- SCHEDULED MEETUPS: Confirmed Meetings
-- =============================================================================

CREATE TABLE IF NOT EXISTS scheduled_meetups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id UUID REFERENCES meeting_suggestions(id),
  -- Participants
  organizer_email TEXT NOT NULL,
  participant_emails TEXT[] NOT NULL,
  -- Event details
  activity_type TEXT NOT NULL,
  title TEXT,
  description TEXT,
  scheduled_time TIMESTAMPTZ NOT NULL,
  duration_mins INT DEFAULT 60,
  location JSONB,  -- {name, address, lat, lng}
  -- Calendar integration
  calendar_event_ids JSONB DEFAULT '{}',  -- {user_email: event_id}
  -- Status
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show')),
  cancellation_reason TEXT,
  cancelled_by TEXT,
  -- Post-meeting
  completed_at TIMESTAMPTZ,
  feedback JSONB,  -- {user_email: {rating: 5, notes: 'Great catch up!'}}
  health_impact JSONB,  -- Measured impact on health metrics after meeting
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meetups_organizer ON scheduled_meetups(organizer_email);
CREATE INDEX IF NOT EXISTS idx_meetups_time ON scheduled_meetups(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_meetups_status ON scheduled_meetups(status);
CREATE INDEX IF NOT EXISTS idx_meetups_upcoming ON scheduled_meetups(scheduled_time) WHERE status IN ('scheduled', 'confirmed');

-- =============================================================================
-- CLINICAL SOCIAL SHARING: Healthcare Provider Integration
-- =============================================================================

CREATE TABLE IF NOT EXISTS clinical_social_sharing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  provider_email TEXT NOT NULL,
  provider_name TEXT,
  provider_type TEXT CHECK (provider_type IN ('physician', 'therapist', 'psychiatrist', 'coach', 'other')),
  -- Sharing settings
  share_meeting_frequency BOOLEAN DEFAULT true,
  share_social_patterns BOOLEAN DEFAULT true,
  share_isolation_alerts BOOLEAN DEFAULT true,
  share_friend_count BOOLEAN DEFAULT false,
  -- Clinical goals
  recommended_weekly_connections INT,
  isolation_alert_threshold_days INT DEFAULT 7,  -- Alert if no social contact for X days
  -- Notes
  clinical_notes TEXT,
  -- Status
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_email, provider_email)
);

CREATE INDEX IF NOT EXISTS idx_clinical_sharing_user ON clinical_social_sharing(user_email);
CREATE INDEX IF NOT EXISTS idx_clinical_sharing_provider ON clinical_social_sharing(provider_email);
CREATE INDEX IF NOT EXISTS idx_clinical_sharing_active ON clinical_social_sharing(user_email) WHERE is_active = true;

-- =============================================================================
-- SOCIAL HEALTH METRICS: Weekly Aggregations
-- =============================================================================

CREATE TABLE IF NOT EXISTS social_health_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  week_start DATE NOT NULL,
  -- Connection metrics
  connections_count INT DEFAULT 0,
  unique_friends_seen INT DEFAULT 0,
  new_connections INT DEFAULT 0,
  -- Activity breakdown
  activities_completed JSONB DEFAULT '{}',  -- {'gym': 2, 'coffee': 1}
  total_social_time_mins INT DEFAULT 0,
  -- Risk indicators
  isolation_score FLOAT CHECK (isolation_score >= 0 AND isolation_score <= 1),  -- 0 = highly connected, 1 = isolated
  loneliness_risk TEXT CHECK (loneliness_risk IN ('low', 'moderate', 'high', 'critical')),
  days_since_last_connection INT,
  -- Trends
  week_over_week_change FLOAT,  -- % change from previous week
  -- Intervention tracking
  intervention_triggered BOOLEAN DEFAULT false,
  intervention_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_email, week_start)
);

CREATE INDEX IF NOT EXISTS idx_social_metrics_user ON social_health_metrics(user_email);
CREATE INDEX IF NOT EXISTS idx_social_metrics_week ON social_health_metrics(week_start DESC);
CREATE INDEX IF NOT EXISTS idx_social_metrics_risk ON social_health_metrics(loneliness_risk) WHERE loneliness_risk IN ('high', 'critical');

-- =============================================================================
-- CONTACT MATCHING: Phone Contacts to Moccet Users
-- =============================================================================

CREATE TABLE IF NOT EXISTS contact_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  contact_phone_hash TEXT NOT NULL,  -- Hashed phone number for privacy
  matched_user_email TEXT,  -- NULL if no match found
  contact_name TEXT,  -- From user's phone
  match_status TEXT DEFAULT 'pending' CHECK (match_status IN ('pending', 'matched', 'no_match', 'invited')),
  invite_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_email, contact_phone_hash)
);

CREATE INDEX IF NOT EXISTS idx_contact_matches_user ON contact_matches(user_email);
CREATE INDEX IF NOT EXISTS idx_contact_matches_matched ON contact_matches(matched_user_email);

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Generate user pair hash (always same regardless of order)
CREATE OR REPLACE FUNCTION generate_user_pair_hash(email1 TEXT, email2 TEXT)
RETURNS TEXT AS $$
BEGIN
  IF email1 < email2 THEN
    RETURN md5(email1 || ':' || email2);
  ELSE
    RETURN md5(email2 || ':' || email1);
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Get all friends for a user
CREATE OR REPLACE FUNCTION get_user_friends(p_user_email TEXT)
RETURNS TABLE (
  friend_email TEXT,
  connection_level TEXT,
  connected_since TIMESTAMPTZ,
  last_meeting TIMESTAMPTZ,
  compatibility_score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE
      WHEN uc.requester_email = p_user_email THEN uc.addressee_email
      ELSE uc.requester_email
    END AS friend_email,
    uc.connection_level,
    uc.accepted_at AS connected_since,
    fap.last_meeting,
    COALESCE(fap.compatibility_score, 0.5) AS compatibility_score
  FROM user_connections uc
  LEFT JOIN friend_activity_patterns fap ON fap.user_pair_hash = generate_user_pair_hash(
    uc.requester_email, uc.addressee_email
  )
  WHERE uc.status = 'accepted'
    AND (uc.requester_email = p_user_email OR uc.addressee_email = p_user_email);
END;
$$ LANGUAGE plpgsql;

-- Check if two users are connected
CREATE OR REPLACE FUNCTION are_users_connected(email1 TEXT, email2 TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_connections
    WHERE status = 'accepted'
      AND ((requester_email = email1 AND addressee_email = email2)
        OR (requester_email = email2 AND addressee_email = email1))
  );
END;
$$ LANGUAGE plpgsql;

-- Get pending connection requests for a user
CREATE OR REPLACE FUNCTION get_pending_requests(p_user_email TEXT)
RETURNS TABLE (
  request_id UUID,
  requester_email TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    uc.id AS request_id,
    uc.requester_email,
    uc.created_at
  FROM user_connections uc
  WHERE uc.addressee_email = p_user_email
    AND uc.status = 'pending'
  ORDER BY uc.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Calculate isolation score for a user
CREATE OR REPLACE FUNCTION calculate_isolation_score(p_user_email TEXT)
RETURNS FLOAT AS $$
DECLARE
  v_days_since_contact INT;
  v_weekly_connections INT;
  v_friend_count INT;
  v_score FLOAT;
BEGIN
  -- Get days since last social contact
  SELECT COALESCE(
    EXTRACT(DAY FROM now() - MAX(scheduled_time))::INT,
    30
  ) INTO v_days_since_contact
  FROM scheduled_meetups
  WHERE organizer_email = p_user_email OR p_user_email = ANY(participant_emails)
    AND status = 'completed';

  -- Get average weekly connections (last 4 weeks)
  SELECT COALESCE(AVG(connections_count), 0)::INT INTO v_weekly_connections
  FROM social_health_metrics
  WHERE user_email = p_user_email
    AND week_start >= now() - interval '4 weeks';

  -- Get friend count
  SELECT COUNT(*) INTO v_friend_count
  FROM get_user_friends(p_user_email);

  -- Calculate score (0 = connected, 1 = isolated)
  v_score := 0.0;

  -- Days since contact component (0.4 weight)
  v_score := v_score + (LEAST(v_days_since_contact, 30) / 30.0) * 0.4;

  -- Weekly connections component (0.4 weight)
  v_score := v_score + (1.0 - LEAST(v_weekly_connections, 5) / 5.0) * 0.4;

  -- Friend count component (0.2 weight)
  v_score := v_score + (1.0 - LEAST(v_friend_count, 10) / 10.0) * 0.2;

  RETURN ROUND(v_score::NUMERIC, 3);
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION update_connect_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_connections_updated
  BEFORE UPDATE ON user_connections
  FOR EACH ROW
  EXECUTE FUNCTION update_connect_timestamp();

CREATE TRIGGER trg_connection_prefs_updated
  BEFORE UPDATE ON connection_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_connect_timestamp();

CREATE TRIGGER trg_friend_patterns_updated
  BEFORE UPDATE ON friend_activity_patterns
  FOR EACH ROW
  EXECUTE FUNCTION update_connect_timestamp();

CREATE TRIGGER trg_meetups_updated
  BEFORE UPDATE ON scheduled_meetups
  FOR EACH ROW
  EXECUTE FUNCTION update_connect_timestamp();

CREATE TRIGGER trg_clinical_sharing_updated
  BEFORE UPDATE ON clinical_social_sharing
  FOR EACH ROW
  EXECUTE FUNCTION update_connect_timestamp();

-- Auto-set accepted_at when connection is accepted
CREATE OR REPLACE FUNCTION set_accepted_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status != 'accepted' THEN
    NEW.accepted_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_connection_accepted
  BEFORE UPDATE ON user_connections
  FOR EACH ROW
  EXECUTE FUNCTION set_accepted_at();

-- Auto-create friend activity pattern when connection is accepted
CREATE OR REPLACE FUNCTION create_friend_pattern()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    INSERT INTO friend_activity_patterns (
      user_pair_hash,
      user_email_1,
      user_email_2
    ) VALUES (
      generate_user_pair_hash(NEW.requester_email, NEW.addressee_email),
      LEAST(NEW.requester_email, NEW.addressee_email),
      GREATEST(NEW.requester_email, NEW.addressee_email)
    ) ON CONFLICT (user_pair_hash) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_create_friend_pattern
  AFTER UPDATE ON user_connections
  FOR EACH ROW
  EXECUTE FUNCTION create_friend_pattern();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE user_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE connection_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_activity_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_meetups ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_social_sharing ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_health_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_matches ENABLE ROW LEVEL SECURITY;

-- User Connections policies
CREATE POLICY "Users can view own connections" ON user_connections
  FOR SELECT USING (
    auth.jwt() ->> 'email' = requester_email
    OR auth.jwt() ->> 'email' = addressee_email
  );

CREATE POLICY "Users can create connection requests" ON user_connections
  FOR INSERT WITH CHECK (auth.jwt() ->> 'email' = requester_email);

CREATE POLICY "Users can update own connection requests" ON user_connections
  FOR UPDATE USING (
    auth.jwt() ->> 'email' = requester_email
    OR auth.jwt() ->> 'email' = addressee_email
  );

-- Connection Preferences policies
CREATE POLICY "Users can view own preferences" ON connection_preferences
  FOR SELECT USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Users can manage own preferences" ON connection_preferences
  FOR ALL USING (auth.jwt() ->> 'email' = user_email);

-- Friend Activity Patterns policies (both users can view)
CREATE POLICY "Users can view own friend patterns" ON friend_activity_patterns
  FOR SELECT USING (
    auth.jwt() ->> 'email' = user_email_1
    OR auth.jwt() ->> 'email' = user_email_2
  );

-- Meeting Suggestions policies
CREATE POLICY "Users can view own suggestions" ON meeting_suggestions
  FOR SELECT USING (
    auth.jwt() ->> 'email' = initiator_email
    OR auth.jwt() ->> 'email' = ANY(participant_emails)
  );

CREATE POLICY "Users can update own suggestions" ON meeting_suggestions
  FOR UPDATE USING (auth.jwt() ->> 'email' = initiator_email);

-- Scheduled Meetups policies
CREATE POLICY "Users can view own meetups" ON scheduled_meetups
  FOR SELECT USING (
    auth.jwt() ->> 'email' = organizer_email
    OR auth.jwt() ->> 'email' = ANY(participant_emails)
  );

CREATE POLICY "Users can manage own meetups" ON scheduled_meetups
  FOR ALL USING (auth.jwt() ->> 'email' = organizer_email);

-- Clinical Sharing policies
CREATE POLICY "Users can view own clinical sharing" ON clinical_social_sharing
  FOR SELECT USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Users can manage own clinical sharing" ON clinical_social_sharing
  FOR ALL USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Providers can view shared data" ON clinical_social_sharing
  FOR SELECT USING (auth.jwt() ->> 'email' = provider_email AND is_active = true);

-- Social Health Metrics policies
CREATE POLICY "Users can view own metrics" ON social_health_metrics
  FOR SELECT USING (auth.jwt() ->> 'email' = user_email);

-- Contact Matches policies
CREATE POLICY "Users can view own contact matches" ON contact_matches
  FOR SELECT USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Users can manage own contact matches" ON contact_matches
  FOR ALL USING (auth.jwt() ->> 'email' = user_email);

-- Service role full access policies
CREATE POLICY "Service role full access to connections" ON user_connections
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to preferences" ON connection_preferences
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to patterns" ON friend_activity_patterns
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to suggestions" ON meeting_suggestions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to meetups" ON scheduled_meetups
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to clinical" ON clinical_social_sharing
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to metrics" ON social_health_metrics
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to contacts" ON contact_matches
  FOR ALL USING (auth.role() = 'service_role');

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE user_connections IS 'Friend connections between users';
COMMENT ON TABLE connection_preferences IS 'Per-friend sharing and activity preferences';
COMMENT ON TABLE friend_activity_patterns IS 'Learned patterns from friendship history';
COMMENT ON TABLE meeting_suggestions IS 'AI-generated meeting recommendations';
COMMENT ON TABLE scheduled_meetups IS 'Confirmed and completed meetings';
COMMENT ON TABLE clinical_social_sharing IS 'Healthcare provider integration for social health';
COMMENT ON TABLE social_health_metrics IS 'Weekly social health aggregations';
COMMENT ON TABLE contact_matches IS 'Phone contact to moccet user matching';
