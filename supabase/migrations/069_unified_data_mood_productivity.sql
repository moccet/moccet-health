-- Migration: Add mood and productivity fields to unified_health_data
-- These fields support Spotify (mood), Notion (productivity), and Linear (productivity) integrations

-- Add mood fields (Spotify)
ALTER TABLE unified_health_data
ADD COLUMN IF NOT EXISTS mood_type TEXT,
ADD COLUMN IF NOT EXISTS mood_confidence NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS energy_level NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS valence_score NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS late_night_activity BOOLEAN;

-- Add productivity fields (Notion/Linear)
ALTER TABLE unified_health_data
ADD COLUMN IF NOT EXISTS open_tasks INTEGER,
ADD COLUMN IF NOT EXISTS overdue_tasks INTEGER,
ADD COLUMN IF NOT EXISTS tasks_due_soon INTEGER,
ADD COLUMN IF NOT EXISTS urgent_issues INTEGER,
ADD COLUMN IF NOT EXISTS high_priority_items INTEGER,
ADD COLUMN IF NOT EXISTS task_completion_rate NUMERIC(5,2);

-- Add constraint for mood_type values
ALTER TABLE unified_health_data
ADD CONSTRAINT chk_mood_type CHECK (
  mood_type IS NULL OR
  mood_type IN ('happy', 'calm', 'energetic', 'melancholy', 'focused', 'anxious', 'mixed')
);

-- Update data_type constraint to include new types
ALTER TABLE unified_health_data DROP CONSTRAINT IF EXISTS chk_data_type;
ALTER TABLE unified_health_data
ADD CONSTRAINT chk_data_type CHECK (
  data_type IN ('sleep', 'recovery', 'activity', 'workout', 'stress', 'glucose', 'behavioral', 'mood', 'productivity')
);

-- Update provider constraint to include new providers
ALTER TABLE unified_health_data DROP CONSTRAINT IF EXISTS chk_provider;
ALTER TABLE unified_health_data
ADD CONSTRAINT chk_provider CHECK (
  provider IN ('oura', 'whoop', 'gmail', 'slack', 'dexcom', 'apple_health', 'strava', 'fitbit', 'garmin', 'teams', 'outlook', 'spotify', 'notion', 'linear')
);

-- Add indexes for new fields
CREATE INDEX IF NOT EXISTS idx_unified_mood ON unified_health_data(email, mood_type) WHERE mood_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_unified_productivity ON unified_health_data(email, provider) WHERE data_type = 'productivity';

-- Update daily rollup table with mood and productivity summary fields
ALTER TABLE unified_health_daily
ADD COLUMN IF NOT EXISTS mood_type TEXT,
ADD COLUMN IF NOT EXISTS energy_level NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS mood_provider TEXT,
ADD COLUMN IF NOT EXISTS open_tasks INTEGER,
ADD COLUMN IF NOT EXISTS overdue_tasks INTEGER,
ADD COLUMN IF NOT EXISTS task_completion_rate NUMERIC(5,2),
ADD COLUMN IF NOT EXISTS productivity_provider TEXT;

COMMENT ON COLUMN unified_health_data.mood_type IS 'Inferred mood from Spotify listening (happy, calm, energetic, etc.)';
COMMENT ON COLUMN unified_health_data.energy_level IS 'Energy level 0-100 from audio features';
COMMENT ON COLUMN unified_health_data.valence_score IS 'Positivity/happiness score 0-100 from audio features';
COMMENT ON COLUMN unified_health_data.open_tasks IS 'Number of open tasks from Notion/Linear';
COMMENT ON COLUMN unified_health_data.overdue_tasks IS 'Number of overdue tasks from Notion/Linear';
COMMENT ON COLUMN unified_health_data.urgent_issues IS 'Number of urgent issues from Linear';
COMMENT ON COLUMN unified_health_data.task_completion_rate IS 'Percentage of tasks completed';
