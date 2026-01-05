-- Migration: Social Goals & Achievements for Moccet Connect
-- Description: Enables goal sharing, interactions, challenges, and achievements between friends
-- Author: Claude Code
-- Date: 2026-01-05

-- =============================================================================
-- TABLE: Shared Goals
-- Track which goals are shared with which friends
-- =============================================================================

CREATE TABLE IF NOT EXISTS shared_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES user_health_goals(id) ON DELETE CASCADE,
  owner_email TEXT NOT NULL,
  -- Sharing settings
  is_public BOOLEAN DEFAULT false,  -- Visible to all friends
  shared_with TEXT[] DEFAULT '{}',  -- Specific friend emails (if not public)
  share_progress BOOLEAN DEFAULT true,  -- Show progress %
  share_current_value BOOLEAN DEFAULT false,  -- Show actual numbers
  -- Timestamps
  shared_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(goal_id)
);

CREATE INDEX IF NOT EXISTS idx_shared_goals_owner ON shared_goals(owner_email);
CREATE INDEX IF NOT EXISTS idx_shared_goals_public ON shared_goals(owner_email) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_shared_goals_goal ON shared_goals(goal_id);

-- =============================================================================
-- TABLE: Goal Interactions
-- Cheers, comments, and other interactions on shared goals
-- =============================================================================

CREATE TABLE IF NOT EXISTS goal_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES user_health_goals(id) ON DELETE CASCADE,
  from_email TEXT NOT NULL,  -- Who sent the interaction
  to_email TEXT NOT NULL,    -- Goal owner
  -- Interaction type
  interaction_type TEXT NOT NULL CHECK (interaction_type IN (
    'cheer', 'comment', 'milestone_cheer'
  )),
  -- Content
  emoji TEXT,  -- For cheers: 💪🔥👏🎉⭐
  message TEXT CHECK (message IS NULL OR length(message) <= 280),  -- For comments (max 280 chars)
  -- Context
  at_progress_pct NUMERIC,  -- Progress when interaction was made
  -- Status
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_goal_interactions_goal ON goal_interactions(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_interactions_to ON goal_interactions(to_email, is_read);
CREATE INDEX IF NOT EXISTS idx_goal_interactions_from ON goal_interactions(from_email);
CREATE INDEX IF NOT EXISTS idx_goal_interactions_unread ON goal_interactions(to_email)
  WHERE is_read = false;

-- =============================================================================
-- TABLE: Goal Challenges
-- Friendly competitions between friends
-- =============================================================================

CREATE TABLE IF NOT EXISTS goal_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Participants
  challenger_email TEXT NOT NULL,
  challenged_email TEXT NOT NULL,
  -- Challenge details
  title TEXT NOT NULL,  -- "7-Day Step Challenge"
  description TEXT,
  challenge_type TEXT NOT NULL CHECK (challenge_type IN (
    'head_to_head',  -- Who reaches target first
    'combined',      -- Work together toward goal
    'streak'         -- Who maintains streak longer
  )),
  -- Metric being challenged
  metric_type TEXT NOT NULL,  -- 'daily_steps', 'sleep_score', etc.
  target_value NUMERIC,
  -- Timeline
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  -- Progress tracking
  challenger_progress NUMERIC DEFAULT 0,
  challenged_progress NUMERIC DEFAULT 0,
  challenger_streak_days INTEGER DEFAULT 0,
  challenged_streak_days INTEGER DEFAULT 0,
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'active', 'completed', 'declined', 'cancelled'
  )),
  winner_email TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_challenges_challenger ON goal_challenges(challenger_email, status);
CREATE INDEX IF NOT EXISTS idx_challenges_challenged ON goal_challenges(challenged_email, status);
CREATE INDEX IF NOT EXISTS idx_challenges_active ON goal_challenges(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_challenges_pending ON goal_challenges(challenged_email)
  WHERE status = 'pending';

-- =============================================================================
-- TABLE: User Achievements
-- Auto-generated achievements based on milestones
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  -- Achievement details
  achievement_type TEXT NOT NULL CHECK (achievement_type IN (
    'goal_completed',      -- Finished a goal
    'streak_milestone',    -- 7, 14, 30, 60, 90 day streaks
    'progress_milestone',  -- 25%, 50%, 75% progress
    'first_goal',          -- Created first goal
    'category_master',     -- Completed 5 goals in category
    'challenge_won',       -- Won a challenge
    'early_achiever',      -- Completed goal before deadline
    'consistency_king',    -- Met goal 7 days straight
    'social_butterfly'     -- Cheered 10 friends
  )),
  title TEXT NOT NULL,
  description TEXT,
  emoji TEXT NOT NULL,  -- 🏆🎯🔥💪⭐🌟👑
  -- Context
  related_goal_id UUID REFERENCES user_health_goals(id) ON DELETE SET NULL,
  related_challenge_id UUID REFERENCES goal_challenges(id) ON DELETE SET NULL,
  related_category TEXT,  -- For category_master
  streak_days INTEGER,    -- For streak_milestone
  metadata JSONB DEFAULT '{}',  -- Additional context
  -- Sharing
  is_shared BOOLEAN DEFAULT false,
  shared_at TIMESTAMPTZ,
  -- Timestamps
  earned_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_achievements_user ON user_achievements(user_email);
CREATE INDEX IF NOT EXISTS idx_achievements_type ON user_achievements(user_email, achievement_type);
CREATE INDEX IF NOT EXISTS idx_achievements_shared ON user_achievements(user_email)
  WHERE is_shared = true;
CREATE INDEX IF NOT EXISTS idx_achievements_recent ON user_achievements(earned_at DESC);

-- Prevent duplicate achievements of same type for same goal
CREATE UNIQUE INDEX IF NOT EXISTS idx_achievements_unique_goal
  ON user_achievements(user_email, achievement_type, related_goal_id)
  WHERE related_goal_id IS NOT NULL;

-- Prevent duplicate streak milestones
CREATE UNIQUE INDEX IF NOT EXISTS idx_achievements_unique_streak
  ON user_achievements(user_email, achievement_type, streak_days)
  WHERE achievement_type = 'streak_milestone';

-- =============================================================================
-- TABLE: Friend Activity Feed
-- Aggregated feed of friend activities
-- =============================================================================

CREATE TABLE IF NOT EXISTS friend_activity_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,  -- Who this feed item is for
  friend_email TEXT NOT NULL,  -- Who did the activity
  -- Activity details
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'goal_created', 'goal_progress', 'goal_completed',
    'achievement_earned', 'challenge_created', 'challenge_won'
  )),
  title TEXT NOT NULL,
  subtitle TEXT,
  emoji TEXT,
  -- References
  goal_id UUID REFERENCES user_health_goals(id) ON DELETE CASCADE,
  achievement_id UUID REFERENCES user_achievements(id) ON DELETE CASCADE,
  challenge_id UUID REFERENCES goal_challenges(id) ON DELETE CASCADE,
  -- Engagement
  has_cheered BOOLEAN DEFAULT false,
  cheered_at TIMESTAMPTZ,
  cheer_emoji TEXT,
  -- Timestamps
  activity_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feed_user ON friend_activity_feed(user_email, activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_expires ON friend_activity_feed(expires_at);
CREATE INDEX IF NOT EXISTS idx_feed_friend ON friend_activity_feed(friend_email);

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_social_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Check if users are friends (connected)
CREATE OR REPLACE FUNCTION are_friends(email1 TEXT, email2 TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_connections
    WHERE status = 'accepted'
    AND (
      (requester_email = email1 AND addressee_email = email2) OR
      (requester_email = email2 AND addressee_email = email1)
    )
  );
END;
$$ LANGUAGE plpgsql;

-- Check if user can view a shared goal
CREATE OR REPLACE FUNCTION can_view_shared_goal(viewer_email TEXT, p_goal_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_shared RECORD;
BEGIN
  SELECT * INTO v_shared
  FROM shared_goals
  WHERE goal_id = p_goal_id;

  IF v_shared IS NULL THEN
    RETURN false;
  END IF;

  -- Owner can always view
  IF v_shared.owner_email = viewer_email THEN
    RETURN true;
  END IF;

  -- Check if they're friends first
  IF NOT are_friends(viewer_email, v_shared.owner_email) THEN
    RETURN false;
  END IF;

  -- Public to all friends
  IF v_shared.is_public THEN
    RETURN true;
  END IF;

  -- Specific shared list
  RETURN viewer_email = ANY(v_shared.shared_with);
END;
$$ LANGUAGE plpgsql;

-- Get friends' shared goals
CREATE OR REPLACE FUNCTION get_friends_shared_goals(p_email TEXT)
RETURNS TABLE (
  goal_id UUID,
  owner_email TEXT,
  title TEXT,
  category TEXT,
  progress_pct NUMERIC,
  current_value NUMERIC,
  target_value NUMERIC,
  unit TEXT,
  direction TEXT,
  share_progress BOOLEAN,
  share_current_value BOOLEAN,
  shared_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    g.id AS goal_id,
    sg.owner_email,
    g.title,
    g.category,
    g.progress_pct,
    g.current_value,
    g.target_value,
    g.unit,
    g.direction,
    sg.share_progress,
    sg.share_current_value,
    sg.shared_at
  FROM shared_goals sg
  JOIN user_health_goals g ON g.id = sg.goal_id
  WHERE g.status = 'active'
  AND sg.owner_email != p_email
  AND are_friends(p_email, sg.owner_email)
  AND (
    sg.is_public = true
    OR p_email = ANY(sg.shared_with)
  )
  ORDER BY sg.shared_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Grant achievement (with duplicate prevention)
CREATE OR REPLACE FUNCTION grant_achievement(
  p_email TEXT,
  p_type TEXT,
  p_title TEXT,
  p_description TEXT,
  p_emoji TEXT,
  p_goal_id UUID DEFAULT NULL,
  p_challenge_id UUID DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_streak_days INTEGER DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_achievement_id UUID;
BEGIN
  -- Check for duplicates based on type
  IF p_goal_id IS NOT NULL THEN
    -- Goal-related achievement
    IF EXISTS (
      SELECT 1 FROM user_achievements
      WHERE user_email = p_email
      AND achievement_type = p_type
      AND related_goal_id = p_goal_id
    ) THEN
      RETURN NULL;
    END IF;
  ELSIF p_type = 'streak_milestone' AND p_streak_days IS NOT NULL THEN
    -- Streak achievement
    IF EXISTS (
      SELECT 1 FROM user_achievements
      WHERE user_email = p_email
      AND achievement_type = p_type
      AND streak_days = p_streak_days
    ) THEN
      RETURN NULL;
    END IF;
  ELSIF p_type IN ('first_goal', 'social_butterfly') THEN
    -- One-time achievements
    IF EXISTS (
      SELECT 1 FROM user_achievements
      WHERE user_email = p_email
      AND achievement_type = p_type
    ) THEN
      RETURN NULL;
    END IF;
  END IF;

  -- Insert the achievement
  INSERT INTO user_achievements (
    user_email, achievement_type, title, description, emoji,
    related_goal_id, related_challenge_id, related_category,
    streak_days, metadata
  ) VALUES (
    p_email, p_type, p_title, p_description, p_emoji,
    p_goal_id, p_challenge_id, p_category,
    p_streak_days, p_metadata
  )
  RETURNING id INTO v_achievement_id;

  RETURN v_achievement_id;
END;
$$ LANGUAGE plpgsql;

-- Generate feed items for all friends
CREATE OR REPLACE FUNCTION generate_feed_for_friends(
  p_friend_email TEXT,
  p_activity_type TEXT,
  p_title TEXT,
  p_subtitle TEXT,
  p_emoji TEXT,
  p_goal_id UUID DEFAULT NULL,
  p_achievement_id UUID DEFAULT NULL,
  p_challenge_id UUID DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO friend_activity_feed (
    user_email, friend_email, activity_type, title, subtitle, emoji,
    goal_id, achievement_id, challenge_id
  )
  SELECT
    CASE
      WHEN requester_email = p_friend_email THEN addressee_email
      ELSE requester_email
    END AS user_email,
    p_friend_email,
    p_activity_type,
    p_title,
    p_subtitle,
    p_emoji,
    p_goal_id,
    p_achievement_id,
    p_challenge_id
  FROM user_connections
  WHERE status = 'accepted'
  AND (requester_email = p_friend_email OR addressee_email = p_friend_email);
END;
$$ LANGUAGE plpgsql;

-- Get unread interaction count
CREATE OR REPLACE FUNCTION get_unread_interaction_count(p_email TEXT)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM goal_interactions
    WHERE to_email = p_email
    AND is_read = false
  );
END;
$$ LANGUAGE plpgsql;

-- Cleanup expired feed items
CREATE OR REPLACE FUNCTION cleanup_expired_feed_items()
RETURNS void AS $$
BEGIN
  DELETE FROM friend_activity_feed
  WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Auto-update timestamps for shared_goals
CREATE TRIGGER trg_shared_goals_updated
  BEFORE UPDATE ON shared_goals
  FOR EACH ROW
  EXECUTE FUNCTION update_social_timestamp();

-- Auto-update timestamps for goal_challenges
CREATE TRIGGER trg_challenges_updated
  BEFORE UPDATE ON goal_challenges
  FOR EACH ROW
  EXECUTE FUNCTION update_social_timestamp();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE shared_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_activity_feed ENABLE ROW LEVEL SECURITY;

-- Shared Goals Policies
CREATE POLICY "Users can manage own shared goals" ON shared_goals
  FOR ALL USING (auth.jwt() ->> 'email' = owner_email);

CREATE POLICY "Friends can view shared goals" ON shared_goals
  FOR SELECT USING (can_view_shared_goal(auth.jwt() ->> 'email', goal_id));

CREATE POLICY "Service role full access to shared_goals" ON shared_goals
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Goal Interactions Policies
CREATE POLICY "Users can view own interactions" ON goal_interactions
  FOR SELECT USING (
    auth.jwt() ->> 'email' = to_email
    OR auth.jwt() ->> 'email' = from_email
  );

CREATE POLICY "Users can create interactions on viewable goals" ON goal_interactions
  FOR INSERT WITH CHECK (
    can_view_shared_goal(auth.jwt() ->> 'email', goal_id)
  );

CREATE POLICY "Users can update own received interactions" ON goal_interactions
  FOR UPDATE USING (auth.jwt() ->> 'email' = to_email);

CREATE POLICY "Service role full access to goal_interactions" ON goal_interactions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Goal Challenges Policies
CREATE POLICY "Users can view own challenges" ON goal_challenges
  FOR SELECT USING (
    auth.jwt() ->> 'email' = challenger_email
    OR auth.jwt() ->> 'email' = challenged_email
  );

CREATE POLICY "Users can create challenges with friends" ON goal_challenges
  FOR INSERT WITH CHECK (
    auth.jwt() ->> 'email' = challenger_email
    AND are_friends(challenger_email, challenged_email)
  );

CREATE POLICY "Participants can update challenges" ON goal_challenges
  FOR UPDATE USING (
    auth.jwt() ->> 'email' = challenger_email
    OR auth.jwt() ->> 'email' = challenged_email
  );

CREATE POLICY "Service role full access to goal_challenges" ON goal_challenges
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- User Achievements Policies
CREATE POLICY "Users can view own achievements" ON user_achievements
  FOR SELECT USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Friends can view shared achievements" ON user_achievements
  FOR SELECT USING (
    is_shared = true
    AND are_friends(auth.jwt() ->> 'email', user_email)
  );

CREATE POLICY "Users can update own achievements" ON user_achievements
  FOR UPDATE USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Service role full access to user_achievements" ON user_achievements
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Friend Activity Feed Policies
CREATE POLICY "Users can view own feed" ON friend_activity_feed
  FOR SELECT USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Users can update own feed items" ON friend_activity_feed
  FOR UPDATE USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Service role full access to friend_activity_feed" ON friend_activity_feed
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =============================================================================
-- GRANTS
-- =============================================================================

GRANT SELECT ON shared_goals TO authenticated;
GRANT INSERT, UPDATE, DELETE ON shared_goals TO authenticated;
GRANT ALL ON shared_goals TO service_role;

GRANT SELECT ON goal_interactions TO authenticated;
GRANT INSERT, UPDATE ON goal_interactions TO authenticated;
GRANT ALL ON goal_interactions TO service_role;

GRANT SELECT ON goal_challenges TO authenticated;
GRANT INSERT, UPDATE ON goal_challenges TO authenticated;
GRANT ALL ON goal_challenges TO service_role;

GRANT SELECT ON user_achievements TO authenticated;
GRANT UPDATE ON user_achievements TO authenticated;
GRANT ALL ON user_achievements TO service_role;

GRANT SELECT, UPDATE ON friend_activity_feed TO authenticated;
GRANT ALL ON friend_activity_feed TO service_role;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE shared_goals IS 'Tracks which goals are shared with which friends';
COMMENT ON TABLE goal_interactions IS 'Cheers, comments, and other interactions on shared goals';
COMMENT ON TABLE goal_challenges IS 'Friendly competitions between friends';
COMMENT ON TABLE user_achievements IS 'Auto-generated achievements based on milestones';
COMMENT ON TABLE friend_activity_feed IS 'Aggregated feed of friend activities';

COMMENT ON FUNCTION are_friends IS 'Check if two users are connected friends';
COMMENT ON FUNCTION can_view_shared_goal IS 'Check if a user can view a specific shared goal';
COMMENT ON FUNCTION get_friends_shared_goals IS 'Get all shared goals visible to a user from their friends';
COMMENT ON FUNCTION grant_achievement IS 'Grant an achievement with duplicate prevention';
COMMENT ON FUNCTION generate_feed_for_friends IS 'Generate feed items for all of a users friends';
