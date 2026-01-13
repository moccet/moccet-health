-- Migration: Feed Comments
-- Description: Add commenting capability to friend activity feed
-- Author: Claude Code
-- Date: 2026-01-13

-- =============================================================================
-- PREREQUISITE: Ensure friend_activity_feed table exists
-- (Originally from 051_social_goals.sql)
-- =============================================================================

CREATE TABLE IF NOT EXISTS friend_activity_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,  -- Who this feed item is for
  friend_email TEXT NOT NULL,  -- Who did the activity
  -- Activity details
  activity_type TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  emoji TEXT,
  -- References (optional)
  goal_id UUID,
  achievement_id UUID,
  challenge_id UUID,
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
-- TABLE: Feed Comments
-- Comments on friend activity feed items
-- =============================================================================

CREATE TABLE IF NOT EXISTS feed_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_item_id UUID NOT NULL REFERENCES friend_activity_feed(id) ON DELETE CASCADE,
  from_email TEXT NOT NULL,  -- Who posted the comment
  to_email TEXT NOT NULL,    -- Feed item owner (friend who earned the achievement)
  message TEXT NOT NULL CHECK (length(message) <= 280),  -- Max 280 chars like Twitter
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_feed_comments_feed_item ON feed_comments(feed_item_id);
CREATE INDEX IF NOT EXISTS idx_feed_comments_from ON feed_comments(from_email);
CREATE INDEX IF NOT EXISTS idx_feed_comments_to ON feed_comments(to_email, is_read);
CREATE INDEX IF NOT EXISTS idx_feed_comments_created ON feed_comments(created_at DESC);

-- =============================================================================
-- TABLE: Feed Reactions (enhanced cheers with multiple emoji options)
-- =============================================================================

CREATE TABLE IF NOT EXISTS feed_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_item_id UUID NOT NULL REFERENCES friend_activity_feed(id) ON DELETE CASCADE,
  from_email TEXT NOT NULL,
  emoji TEXT NOT NULL,  -- The reaction emoji
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(feed_item_id, from_email)  -- One reaction per user per item
);

CREATE INDEX IF NOT EXISTS idx_feed_reactions_feed_item ON feed_reactions(feed_item_id);
CREATE INDEX IF NOT EXISTS idx_feed_reactions_from ON feed_reactions(from_email);

-- =============================================================================
-- RLS Policies
-- =============================================================================

ALTER TABLE feed_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_reactions ENABLE ROW LEVEL SECURITY;

-- Comments: Users can see comments on feed items they can view
CREATE POLICY "Users can read comments on visible feed items"
  ON feed_comments FOR SELECT
  USING (
    from_email = auth.jwt() ->> 'email' OR
    to_email = auth.jwt() ->> 'email'
  );

-- Comments: Users can create comments on friends' feed items
CREATE POLICY "Users can comment on friends feed items"
  ON feed_comments FOR INSERT
  WITH CHECK (from_email = auth.jwt() ->> 'email');

-- Service role can manage all
CREATE POLICY "Service role can manage feed comments"
  ON feed_comments FOR ALL
  USING (auth.role() = 'service_role');

-- Reactions policies
CREATE POLICY "Users can read reactions"
  ON feed_reactions FOR SELECT
  USING (true);  -- Reactions are public

CREATE POLICY "Users can add reactions"
  ON feed_reactions FOR INSERT
  WITH CHECK (from_email = auth.jwt() ->> 'email');

CREATE POLICY "Users can remove own reactions"
  ON feed_reactions FOR DELETE
  USING (from_email = auth.jwt() ->> 'email');

CREATE POLICY "Service role can manage reactions"
  ON feed_reactions FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================================================
-- FUNCTION: Get comments for a feed item
-- =============================================================================

CREATE OR REPLACE FUNCTION get_feed_item_comments(p_feed_item_id UUID)
RETURNS TABLE (
  id UUID,
  from_email TEXT,
  from_display_name TEXT,
  message TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    fc.id,
    fc.from_email,
    COALESCE(up.display_name, split_part(fc.from_email, '@', 1)) as from_display_name,
    fc.message,
    fc.created_at
  FROM feed_comments fc
  LEFT JOIN user_profiles up ON up.user_email = fc.from_email
  WHERE fc.feed_item_id = p_feed_item_id
  ORDER BY fc.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- FUNCTION: Get reactions for a feed item
-- =============================================================================

CREATE OR REPLACE FUNCTION get_feed_item_reactions(p_feed_item_id UUID)
RETURNS TABLE (
  emoji TEXT,
  count BIGINT,
  users TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    fr.emoji,
    COUNT(*) as count,
    array_agg(COALESCE(up.display_name, split_part(fr.from_email, '@', 1))) as users
  FROM feed_reactions fr
  LEFT JOIN user_profiles up ON up.user_email = fr.from_email
  WHERE fr.feed_item_id = p_feed_item_id
  GROUP BY fr.emoji
  ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- FUNCTION: Get feed item details with comments and reactions
-- =============================================================================

CREATE OR REPLACE FUNCTION get_feed_item_details(p_feed_item_id UUID, p_user_email TEXT)
RETURNS JSON AS $$
DECLARE
  result JSON;
  feed_item RECORD;
  friend_profile RECORD;
BEGIN
  -- Get feed item
  SELECT * INTO feed_item
  FROM friend_activity_feed
  WHERE id = p_feed_item_id;

  IF feed_item IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get friend profile
  SELECT display_name, avatar_url INTO friend_profile
  FROM user_profiles
  WHERE user_email = feed_item.friend_email;

  -- Build result
  SELECT json_build_object(
    'id', feed_item.id,
    'friendEmail', feed_item.friend_email,
    'friendDisplayName', COALESCE(friend_profile.display_name, split_part(feed_item.friend_email, '@', 1)),
    'friendAvatarUrl', friend_profile.avatar_url,
    'activityType', feed_item.activity_type,
    'title', feed_item.title,
    'subtitle', feed_item.subtitle,
    'emoji', feed_item.emoji,
    'activityAt', feed_item.activity_at,
    'hasCheered', feed_item.has_cheered,
    'cheerEmoji', feed_item.cheer_emoji,
    'comments', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', c.id,
        'fromEmail', c.from_email,
        'fromDisplayName', c.from_display_name,
        'message', c.message,
        'createdAt', c.created_at
      )), '[]'::json)
      FROM get_feed_item_comments(p_feed_item_id) c
    ),
    'reactions', (
      SELECT COALESCE(json_agg(json_build_object(
        'emoji', r.emoji,
        'count', r.count,
        'users', r.users
      )), '[]'::json)
      FROM get_feed_item_reactions(p_feed_item_id) r
    ),
    'userReaction', (
      SELECT emoji FROM feed_reactions
      WHERE feed_item_id = p_feed_item_id AND from_email = p_user_email
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
