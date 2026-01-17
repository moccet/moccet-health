-- User Location Profile Table
-- Stores location and activity preferences for local recommendations
-- Used by the Insight Enhancer Agent to provide specific venue recommendations

CREATE TABLE IF NOT EXISTS user_location_profile (
  email TEXT PRIMARY KEY,
  city TEXT,                              -- e.g., 'London', 'New York'
  neighborhood TEXT,                      -- e.g., 'Kensington', 'Brooklyn Heights'
  home_latitude DOUBLE PRECISION,         -- For local recommendations
  home_longitude DOUBLE PRECISION,
  work_latitude DOUBLE PRECISION,
  work_longitude DOUBLE PRECISION,
  preferred_radius_km INTEGER DEFAULT 10, -- Search radius for recommendations
  inferred_activities TEXT[],             -- From Whoop: ['running', 'cycling', 'swimming']
  primary_activity TEXT,                  -- Most frequent activity
  activity_frequency JSONB,               -- Activity frequency data: {"running": 12, "cycling": 5}
  last_activity_inference TIMESTAMPTZ,    -- When activities were last inferred
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient lookups by email
CREATE INDEX IF NOT EXISTS idx_user_location_profile_email ON user_location_profile(email);

-- Index for city-based queries (for potential aggregations)
CREATE INDEX IF NOT EXISTS idx_user_location_profile_city ON user_location_profile(city);

-- Enable Row Level Security
ALTER TABLE user_location_profile ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first (if any) to make this idempotent
DROP POLICY IF EXISTS "Users can view own location profile" ON user_location_profile;
DROP POLICY IF EXISTS "Users can insert own location profile" ON user_location_profile;
DROP POLICY IF EXISTS "Users can update own location profile" ON user_location_profile;
DROP POLICY IF EXISTS "Users can delete own location profile" ON user_location_profile;
DROP POLICY IF EXISTS "Service role full access location profile" ON user_location_profile;

-- Users can only access their own location profile
CREATE POLICY "Users can view own location profile" ON user_location_profile
  FOR SELECT USING (auth.jwt() ->> 'email' = email);

CREATE POLICY "Users can insert own location profile" ON user_location_profile
  FOR INSERT WITH CHECK (auth.jwt() ->> 'email' = email);

CREATE POLICY "Users can update own location profile" ON user_location_profile
  FOR UPDATE USING (auth.jwt() ->> 'email' = email);

CREATE POLICY "Users can delete own location profile" ON user_location_profile
  FOR DELETE USING (auth.jwt() ->> 'email' = email);

-- Service role can access all records (for backend queries)
CREATE POLICY "Service role full access location profile" ON user_location_profile
  FOR ALL USING (auth.role() = 'service_role');

-- Trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_location_profile_updated_at()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_location_profile_updated_at ON user_location_profile;

CREATE TRIGGER trigger_update_location_profile_updated_at
  BEFORE UPDATE ON user_location_profile
  FOR EACH ROW
  EXECUTE FUNCTION update_location_profile_updated_at();

-- Local recommendations cache table
-- Caches Google Places API results to reduce API costs (24hr cache)
CREATE TABLE IF NOT EXISTS local_recommendations_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT NOT NULL UNIQUE,          -- e.g., 'running_clubs_london_kensington'
  query_type TEXT NOT NULL,                -- e.g., 'running_clubs', 'gyms', 'yoga_studios'
  city TEXT NOT NULL,
  neighborhood TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  radius_km INTEGER,
  results JSONB NOT NULL,                  -- Cached Google Places results
  result_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours'
);

-- Index for cache lookups
CREATE INDEX IF NOT EXISTS idx_local_recommendations_cache_key ON local_recommendations_cache(cache_key);

-- Index for expiration cleanup
CREATE INDEX IF NOT EXISTS idx_local_recommendations_cache_expires ON local_recommendations_cache(expires_at);

-- Enable RLS on cache table
ALTER TABLE local_recommendations_cache ENABLE ROW LEVEL SECURITY;

-- Service role full access for cache (backend only)
DROP POLICY IF EXISTS "Service role full access recommendations cache" ON local_recommendations_cache;
CREATE POLICY "Service role full access recommendations cache" ON local_recommendations_cache
  FOR ALL USING (auth.role() = 'service_role');
