-- User Workouts table - stores workout data from Apple Health/Google Fit
CREATE TABLE IF NOT EXISTS user_workouts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  workout_type text NOT NULL,
  duration_minutes integer,
  calories_burned numeric,
  distance_meters numeric,
  workout_date timestamptz NOT NULL,
  source text DEFAULT 'apple_health',
  synced_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),

  -- Unique constraint to prevent duplicate workouts
  UNIQUE(email, workout_date, workout_type)
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_workouts_email ON user_workouts(email);
CREATE INDEX IF NOT EXISTS idx_user_workouts_date ON user_workouts(workout_date DESC);
CREATE INDEX IF NOT EXISTS idx_user_workouts_type ON user_workouts(workout_type);

-- User Device Context table - tracks timezone/location for travel detection
CREATE TABLE IF NOT EXISTS user_device_context (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  timezone text NOT NULL,
  timezone_offset integer,
  local_time timestamptz,
  platform text,
  locale text,
  travel_detected boolean DEFAULT false,
  synced_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create indexes for context queries
CREATE INDEX IF NOT EXISTS idx_user_device_context_email ON user_device_context(email);
CREATE INDEX IF NOT EXISTS idx_user_device_context_synced ON user_device_context(synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_device_context_travel ON user_device_context(email, travel_detected) WHERE travel_detected = true;

-- User Travel Context table - stores detected travel events for insights
CREATE TABLE IF NOT EXISTS user_travel_context (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  home_timezone text,
  current_timezone text NOT NULL,
  timezone_offset_change integer,
  travel_start timestamptz,
  travel_detected_at timestamptz DEFAULT now(),
  estimated_location text, -- e.g., "Asia/Tokyo" -> "Japan"
  travel_type text, -- 'domestic', 'international', 'timezone_shift'
  insights_generated boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for travel queries
CREATE INDEX IF NOT EXISTS idx_user_travel_email ON user_travel_context(email);
CREATE INDEX IF NOT EXISTS idx_user_travel_recent ON user_travel_context(travel_detected_at DESC);

-- Add HRV to user_health_baselines if not exists (for the new Apple Health data)
-- This is handled by the upsert in the API, but good to document expected metrics:
-- hrv, flights_climbed, mindfulness_minutes
