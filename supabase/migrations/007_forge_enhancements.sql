-- ============================================================================
-- FORGE MCP ENHANCEMENTS
-- ============================================================================
-- Purpose: Add Forge-specific tables for training data and workout patterns
-- Author: Claude Code
-- Date: 2025-12-04
-- ============================================================================

-- ============================================================================
-- FORGE TRAINING DATA TABLE
-- ============================================================================
-- Stores raw workout data from wearables (Strava, Fitbit, Whoop, etc.)

CREATE TABLE IF NOT EXISTS forge_training_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('strava', 'fitbit', 'whoop', 'garmin', 'polar', 'apple_health')),

  -- Workout data (JSONB for flexibility across different providers)
  workouts JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Example structure:
  -- [
  --   {
  --     "id": "12345",
  --     "type": "run",
  --     "startTime": "2025-12-01T06:30:00Z",
  --     "duration": 3600,
  --     "distance": 10000,
  --     "heartRateZones": { "zone1": 15, "zone2": 45, "zone3": 25, "zone4": 10, "zone5": 5 },
  --     "avgHeartRate": 145,
  --     "calories": 650
  --   }
  -- ]

  -- Training metrics (calculated from workouts)
  weekly_volume INTEGER, -- Total minutes per week
  avg_workout_duration INTEGER, -- Average minutes per workout
  workout_frequency INTEGER, -- Number of workouts per week
  intensity_distribution JSONB, -- { "zone1": 15, "zone2": 45, "zone3": 25, "zone4": 10, "zone5": 5 }

  -- Performance metrics
  performance_trends JSONB, -- { "strength": "improving", "endurance": "stable", "power": "declining" }
  pr_history JSONB, -- Personal records: { "5k_run": { "time": 1200, "date": "2025-11-15" } }

  -- Recovery metrics (primarily from Whoop)
  recovery_score JSONB, -- { "avg": 75, "trend": "improving", "greenDays": 20, "yellowDays": 7, "redDays": 3 }
  hrv_trends JSONB, -- { "avg": 65, "trend": "stable", "baseline": 62 }
  resting_hr_trends JSONB, -- { "avg": 52, "trend": "decreasing" }

  -- Data period
  data_period_start DATE,
  data_period_end DATE,
  data_points_analyzed INTEGER,

  -- Metadata
  sync_date TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_forge_training_email ON forge_training_data(email);
CREATE INDEX idx_forge_training_provider ON forge_training_data(provider);
CREATE INDEX idx_forge_training_email_provider ON forge_training_data(email, provider);
CREATE INDEX idx_forge_training_sync_date ON forge_training_data(sync_date);

-- GIN indexes for JSONB queries
CREATE INDEX idx_forge_training_workouts ON forge_training_data USING GIN (workouts);
CREATE INDEX idx_forge_training_performance ON forge_training_data USING GIN (performance_trends);
CREATE INDEX idx_forge_training_recovery ON forge_training_data USING GIN (recovery_score);

-- ============================================================================
-- FORGE WORKOUT PATTERNS TABLE
-- ============================================================================
-- Stores analyzed workout patterns (similar to behavioral_patterns for Sage)

CREATE TABLE IF NOT EXISTS forge_workout_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('strava', 'fitbit', 'whoop', 'garmin', 'polar', 'apple_health', 'manual')),

  -- Pattern analysis (JSONB for flexibility)
  patterns JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Example structure:
  -- {
  --   "trainingLoad": {
  --     "weeklyMinutes": 450,
  --     "trend": "increasing",
  --     "status": "optimal",
  --     "acwr": 1.2
  --   },
  --   "workoutDistribution": {
  --     "strength": 3,
  --     "cardio": 2,
  --     "hiit": 1,
  --     "flexibility": 1
  --   },
  --   "intensityDistribution": {
  --     "zone1_recovery": 15,
  --     "zone2_base": 45,
  --     "zone3_tempo": 25,
  --     "zone4_threshold": 10,
  --     "zone5_max": 5
  --   },
  --   "recoveryPatterns": {
  --     "avgRecovery": 75,
  --     "adequateRecovery": true,
  --     "hrvTrend": "improving"
  --   },
  --   "performanceTrends": {
  --     "strength": "improving",
  --     "endurance": "stable",
  --     "consistency": 85
  --   },
  --   "optimalTrainingTimes": ["06:00-07:00", "17:00-19:00"]
  -- }

  -- Metrics (JSONB for flexibility)
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Example structure:
  -- {
  --   "trainingScore": 85,
  --   "recoveryScore": 72,
  --   "performanceScore": 78,
  --   "overtrainingRisk": "low",
  --   "consistencyScore": 85
  -- }

  -- Data period
  data_period_start DATE,
  data_period_end DATE,
  data_points_analyzed INTEGER,

  -- Metadata
  sync_date TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_forge_workout_patterns_email ON forge_workout_patterns(email);
CREATE INDEX idx_forge_workout_patterns_source ON forge_workout_patterns(source);
CREATE INDEX idx_forge_workout_patterns_email_source ON forge_workout_patterns(email, source);
CREATE INDEX idx_forge_workout_patterns_sync_date ON forge_workout_patterns(sync_date);

-- GIN indexes for JSONB queries
CREATE INDEX idx_forge_workout_patterns_patterns ON forge_workout_patterns USING GIN (patterns);
CREATE INDEX idx_forge_workout_patterns_metrics ON forge_workout_patterns USING GIN (metrics);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on tables
ALTER TABLE forge_training_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE forge_workout_patterns ENABLE ROW LEVEL SECURITY;

-- Policies for forge_training_data
CREATE POLICY "Users can view their own training data"
  ON forge_training_data FOR SELECT
  USING (auth.jwt() ->> 'email' = email);

CREATE POLICY "Users can insert their own training data"
  ON forge_training_data FOR INSERT
  WITH CHECK (auth.jwt() ->> 'email' = email);

CREATE POLICY "Users can update their own training data"
  ON forge_training_data FOR UPDATE
  USING (auth.jwt() ->> 'email' = email);

CREATE POLICY "Users can delete their own training data"
  ON forge_training_data FOR DELETE
  USING (auth.jwt() ->> 'email' = email);

-- Policies for forge_workout_patterns
CREATE POLICY "Users can view their own workout patterns"
  ON forge_workout_patterns FOR SELECT
  USING (auth.jwt() ->> 'email' = email);

CREATE POLICY "Users can insert their own workout patterns"
  ON forge_workout_patterns FOR INSERT
  WITH CHECK (auth.jwt() ->> 'email' = email);

CREATE POLICY "Users can update their own workout patterns"
  ON forge_workout_patterns FOR UPDATE
  USING (auth.jwt() ->> 'email' = email);

CREATE POLICY "Users can delete their own workout patterns"
  ON forge_workout_patterns FOR DELETE
  USING (auth.jwt() ->> 'email' = email);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_forge_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER forge_training_data_updated_at
  BEFORE UPDATE ON forge_training_data
  FOR EACH ROW
  EXECUTE FUNCTION update_forge_updated_at();

CREATE TRIGGER forge_workout_patterns_updated_at
  BEFORE UPDATE ON forge_workout_patterns
  FOR EACH ROW
  EXECUTE FUNCTION update_forge_updated_at();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE forge_training_data IS 'Stores raw workout data from wearables (Strava, Fitbit, Whoop, etc.)';
COMMENT ON TABLE forge_workout_patterns IS 'Stores analyzed workout patterns and training metrics';

COMMENT ON COLUMN forge_training_data.workouts IS 'JSONB array of workout objects with type, duration, heart rate zones, etc.';
COMMENT ON COLUMN forge_training_data.intensity_distribution IS 'Percentage distribution across heart rate zones';
COMMENT ON COLUMN forge_training_data.recovery_score IS 'Recovery metrics from Whoop or similar devices';

COMMENT ON COLUMN forge_workout_patterns.patterns IS 'Analyzed patterns: training load, workout distribution, recovery, performance trends';
COMMENT ON COLUMN forge_workout_patterns.metrics IS 'Calculated metrics: training score, recovery score, overtraining risk';
