-- ============================================================================
-- Unified Health Data Architecture
-- Migration: 068_unified_health_data.sql
--
-- Purpose: Create a single source of truth for all health data across providers
-- This consolidates data from: Oura, Whoop, Gmail/Slack, Dexcom, Apple Health,
-- Strava, Fitbit, and behavioral patterns into a unified schema.
-- ============================================================================

-- Main time-series table for all health data
CREATE TABLE IF NOT EXISTS unified_health_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  provider TEXT NOT NULL,  -- 'oura', 'whoop', 'gmail', 'slack', 'dexcom', 'apple_health', 'strava', 'fitbit'
  data_type TEXT NOT NULL, -- 'sleep', 'recovery', 'activity', 'stress', 'glucose', 'workout', 'behavioral'

  -- Normalized sleep fields
  sleep_duration_hours NUMERIC(4,2),
  sleep_score NUMERIC(5,2),
  deep_sleep_minutes INTEGER,
  rem_sleep_minutes INTEGER,
  light_sleep_minutes INTEGER,
  awake_minutes INTEGER,
  sleep_efficiency NUMERIC(5,2),
  bedtime_start TIMESTAMPTZ,
  bedtime_end TIMESTAMPTZ,

  -- Normalized recovery fields
  recovery_score NUMERIC(5,2),
  readiness_score NUMERIC(5,2),
  strain_score NUMERIC(5,2),
  hrv_avg NUMERIC(6,2),
  hrv_rmssd NUMERIC(6,2),
  resting_hr INTEGER,
  respiratory_rate NUMERIC(4,1),
  spo2_avg NUMERIC(5,2),
  body_temp_deviation NUMERIC(4,2),

  -- Normalized activity fields
  steps INTEGER,
  active_calories INTEGER,
  total_calories INTEGER,
  active_minutes INTEGER,
  distance_meters INTEGER,
  floors_climbed INTEGER,

  -- Normalized workout fields
  workout_type TEXT,
  workout_duration_minutes INTEGER,
  workout_calories INTEGER,
  avg_heart_rate INTEGER,
  max_heart_rate INTEGER,
  workout_strain NUMERIC(5,2),

  -- Normalized glucose fields
  glucose_avg NUMERIC(5,1),
  glucose_min NUMERIC(5,1),
  glucose_max NUMERIC(5,1),
  time_in_range_percent NUMERIC(5,2),
  readings_count INTEGER,

  -- Normalized stress/behavioral fields
  stress_score NUMERIC(5,2),
  meeting_count INTEGER,
  meeting_minutes INTEGER,
  email_count INTEGER,
  after_hours_activity BOOLEAN,
  focus_time_minutes INTEGER,

  -- Provider-specific raw data (preserved for detailed analysis)
  provider_data JSONB DEFAULT '{}'::jsonb,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint to prevent duplicate entries
  CONSTRAINT unified_health_unique UNIQUE(email, provider, data_type, recorded_at)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_unified_email_date
  ON unified_health_data(email, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_unified_provider
  ON unified_health_data(email, provider, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_unified_type
  ON unified_health_data(email, data_type, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_unified_email_provider_type
  ON unified_health_data(email, provider, data_type, recorded_at DESC);

-- Note: Partial indexes with time-based predicates removed as NOW() is not IMMUTABLE
-- Use the standard indexes above for time-based queries

-- ============================================================================
-- Daily rollup table for fast context reads
-- Pre-aggregates the best available data per category for each day
-- ============================================================================

CREATE TABLE IF NOT EXISTS unified_health_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  date DATE NOT NULL,

  -- Sleep metrics (best available)
  sleep_hours NUMERIC(4,2),
  sleep_score NUMERIC(5,2),
  deep_sleep_minutes INTEGER,
  rem_sleep_minutes INTEGER,
  sleep_efficiency NUMERIC(5,2),
  sleep_provider TEXT,

  -- Recovery metrics (best available)
  recovery_score NUMERIC(5,2),
  readiness_score NUMERIC(5,2),
  hrv_avg NUMERIC(6,2),
  resting_hr INTEGER,
  recovery_provider TEXT,

  -- Activity metrics (combined)
  steps INTEGER,
  active_calories INTEGER,
  active_minutes INTEGER,
  workout_count INTEGER,
  total_workout_minutes INTEGER,
  activity_provider TEXT,

  -- Glucose metrics
  glucose_avg NUMERIC(5,1),
  time_in_range_percent NUMERIC(5,2),
  glucose_provider TEXT,

  -- Behavioral/Stress metrics
  stress_score NUMERIC(5,2),
  stress_level TEXT, -- 'low', 'moderate', 'high', 'very_high'
  meeting_count INTEGER,
  meeting_minutes INTEGER,
  focus_time_minutes INTEGER,
  behavioral_provider TEXT,

  -- Aggregated metadata
  providers_reporting TEXT[], -- Array of providers that contributed data
  data_quality_score NUMERIC(3,2), -- 0-1 score based on data completeness
  overall_status TEXT, -- 'thriving', 'stable', 'needs_attention', 'concerning'
  key_insights JSONB DEFAULT '[]'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unified_daily_unique UNIQUE(email, date)
);

-- Indexes for daily rollup table
CREATE INDEX IF NOT EXISTS idx_daily_email_date
  ON unified_health_daily(email, date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_status
  ON unified_health_daily(email, overall_status, date DESC);

-- Note: Partial index with time-based predicate removed as CURRENT_DATE is not IMMUTABLE

-- ============================================================================
-- Function to calculate overall status based on daily metrics
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_overall_status(
  p_sleep_score NUMERIC,
  p_recovery_score NUMERIC,
  p_stress_score NUMERIC,
  p_steps INTEGER
) RETURNS TEXT AS $$
DECLARE
  score_sum NUMERIC := 0;
  score_count INTEGER := 0;
  avg_score NUMERIC;
BEGIN
  -- Calculate weighted average of available scores
  IF p_sleep_score IS NOT NULL THEN
    score_sum := score_sum + (p_sleep_score * 0.3);
    score_count := score_count + 1;
  END IF;

  IF p_recovery_score IS NOT NULL THEN
    score_sum := score_sum + (p_recovery_score * 0.3);
    score_count := score_count + 1;
  END IF;

  IF p_stress_score IS NOT NULL THEN
    -- Invert stress score (lower is better)
    score_sum := score_sum + ((100 - p_stress_score) * 0.2);
    score_count := score_count + 1;
  END IF;

  IF p_steps IS NOT NULL THEN
    -- Normalize steps (8000+ is good)
    score_sum := score_sum + (LEAST(p_steps::NUMERIC / 8000 * 100, 100) * 0.2);
    score_count := score_count + 1;
  END IF;

  IF score_count = 0 THEN
    RETURN 'stable';
  END IF;

  avg_score := score_sum / score_count;

  RETURN CASE
    WHEN avg_score >= 75 THEN 'thriving'
    WHEN avg_score >= 50 THEN 'stable'
    WHEN avg_score >= 30 THEN 'needs_attention'
    ELSE 'concerning'
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- Function to update daily rollup from unified_health_data
-- Called by trigger or scheduled job
-- ============================================================================

CREATE OR REPLACE FUNCTION update_unified_health_daily(p_email TEXT, p_date DATE)
RETURNS void AS $$
DECLARE
  v_sleep_data RECORD;
  v_recovery_data RECORD;
  v_activity_data RECORD;
  v_glucose_data RECORD;
  v_behavioral_data RECORD;
  v_providers TEXT[] := '{}';
  v_data_points INTEGER := 0;
  v_total_possible INTEGER := 5;
BEGIN
  -- Get best sleep data (prefer Oura > Whoop > Apple Health > Fitbit)
  SELECT INTO v_sleep_data
    sleep_duration_hours,
    sleep_score,
    deep_sleep_minutes,
    rem_sleep_minutes,
    sleep_efficiency,
    provider
  FROM unified_health_data
  WHERE email = p_email
    AND date_trunc('day', recorded_at)::date = p_date
    AND data_type = 'sleep'
    AND sleep_duration_hours IS NOT NULL
  ORDER BY
    CASE provider
      WHEN 'oura' THEN 1
      WHEN 'whoop' THEN 2
      WHEN 'apple_health' THEN 3
      WHEN 'fitbit' THEN 4
      ELSE 5
    END,
    created_at DESC
  LIMIT 1;

  IF FOUND THEN
    v_providers := array_append(v_providers, v_sleep_data.provider);
    v_data_points := v_data_points + 1;
  END IF;

  -- Get best recovery data (prefer Whoop > Oura)
  SELECT INTO v_recovery_data
    recovery_score,
    readiness_score,
    hrv_avg,
    resting_hr,
    provider
  FROM unified_health_data
  WHERE email = p_email
    AND date_trunc('day', recorded_at)::date = p_date
    AND data_type IN ('recovery', 'sleep')
    AND (recovery_score IS NOT NULL OR readiness_score IS NOT NULL)
  ORDER BY
    CASE provider
      WHEN 'whoop' THEN 1
      WHEN 'oura' THEN 2
      ELSE 3
    END,
    created_at DESC
  LIMIT 1;

  IF FOUND THEN
    IF NOT (v_recovery_data.provider = ANY(v_providers)) THEN
      v_providers := array_append(v_providers, v_recovery_data.provider);
    END IF;
    v_data_points := v_data_points + 1;
  END IF;

  -- Get activity data (aggregate from all providers)
  SELECT INTO v_activity_data
    MAX(steps) as steps,
    SUM(active_calories) as active_calories,
    SUM(active_minutes) as active_minutes,
    COUNT(*) FILTER (WHERE data_type = 'workout') as workout_count,
    SUM(workout_duration_minutes) as total_workout_minutes,
    string_agg(DISTINCT provider, ',') as providers
  FROM unified_health_data
  WHERE email = p_email
    AND date_trunc('day', recorded_at)::date = p_date
    AND data_type IN ('activity', 'workout')
    AND (steps IS NOT NULL OR active_calories IS NOT NULL OR workout_duration_minutes IS NOT NULL);

  IF v_activity_data.steps IS NOT NULL OR v_activity_data.active_calories IS NOT NULL THEN
    v_providers := v_providers || string_to_array(COALESCE(v_activity_data.providers, ''), ',');
    v_data_points := v_data_points + 1;
  END IF;

  -- Get glucose data
  SELECT INTO v_glucose_data
    glucose_avg,
    time_in_range_percent,
    provider
  FROM unified_health_data
  WHERE email = p_email
    AND date_trunc('day', recorded_at)::date = p_date
    AND data_type = 'glucose'
    AND glucose_avg IS NOT NULL
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    IF NOT (v_glucose_data.provider = ANY(v_providers)) THEN
      v_providers := array_append(v_providers, v_glucose_data.provider);
    END IF;
    v_data_points := v_data_points + 1;
  END IF;

  -- Get behavioral/stress data
  SELECT INTO v_behavioral_data
    stress_score,
    meeting_count,
    meeting_minutes,
    focus_time_minutes,
    provider
  FROM unified_health_data
  WHERE email = p_email
    AND date_trunc('day', recorded_at)::date = p_date
    AND data_type IN ('stress', 'behavioral')
    AND (stress_score IS NOT NULL OR meeting_count IS NOT NULL)
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    IF NOT (v_behavioral_data.provider = ANY(v_providers)) THEN
      v_providers := array_append(v_providers, v_behavioral_data.provider);
    END IF;
    v_data_points := v_data_points + 1;
  END IF;

  -- Remove empty strings from providers array
  v_providers := array_remove(v_providers, '');

  -- Upsert daily rollup
  INSERT INTO unified_health_daily (
    email, date,
    sleep_hours, sleep_score, deep_sleep_minutes, rem_sleep_minutes, sleep_efficiency, sleep_provider,
    recovery_score, readiness_score, hrv_avg, resting_hr, recovery_provider,
    steps, active_calories, active_minutes, workout_count, total_workout_minutes, activity_provider,
    glucose_avg, time_in_range_percent, glucose_provider,
    stress_score, stress_level, meeting_count, meeting_minutes, focus_time_minutes, behavioral_provider,
    providers_reporting, data_quality_score, overall_status, updated_at
  ) VALUES (
    p_email, p_date,
    v_sleep_data.sleep_duration_hours, v_sleep_data.sleep_score, v_sleep_data.deep_sleep_minutes,
    v_sleep_data.rem_sleep_minutes, v_sleep_data.sleep_efficiency, v_sleep_data.provider,
    v_recovery_data.recovery_score, v_recovery_data.readiness_score, v_recovery_data.hrv_avg,
    v_recovery_data.resting_hr, v_recovery_data.provider,
    v_activity_data.steps, v_activity_data.active_calories::INTEGER, v_activity_data.active_minutes::INTEGER,
    v_activity_data.workout_count::INTEGER, v_activity_data.total_workout_minutes::INTEGER,
    v_activity_data.providers,
    v_glucose_data.glucose_avg, v_glucose_data.time_in_range_percent, v_glucose_data.provider,
    v_behavioral_data.stress_score,
    CASE
      WHEN v_behavioral_data.stress_score IS NULL THEN NULL
      WHEN v_behavioral_data.stress_score <= 25 THEN 'low'
      WHEN v_behavioral_data.stress_score <= 50 THEN 'moderate'
      WHEN v_behavioral_data.stress_score <= 75 THEN 'high'
      ELSE 'very_high'
    END,
    v_behavioral_data.meeting_count, v_behavioral_data.meeting_minutes,
    v_behavioral_data.focus_time_minutes, v_behavioral_data.provider,
    v_providers,
    v_data_points::NUMERIC / v_total_possible,
    calculate_overall_status(
      v_sleep_data.sleep_score,
      COALESCE(v_recovery_data.recovery_score, v_recovery_data.readiness_score),
      v_behavioral_data.stress_score,
      v_activity_data.steps
    ),
    NOW()
  )
  ON CONFLICT (email, date) DO UPDATE SET
    sleep_hours = EXCLUDED.sleep_hours,
    sleep_score = EXCLUDED.sleep_score,
    deep_sleep_minutes = EXCLUDED.deep_sleep_minutes,
    rem_sleep_minutes = EXCLUDED.rem_sleep_minutes,
    sleep_efficiency = EXCLUDED.sleep_efficiency,
    sleep_provider = EXCLUDED.sleep_provider,
    recovery_score = EXCLUDED.recovery_score,
    readiness_score = EXCLUDED.readiness_score,
    hrv_avg = EXCLUDED.hrv_avg,
    resting_hr = EXCLUDED.resting_hr,
    recovery_provider = EXCLUDED.recovery_provider,
    steps = EXCLUDED.steps,
    active_calories = EXCLUDED.active_calories,
    active_minutes = EXCLUDED.active_minutes,
    workout_count = EXCLUDED.workout_count,
    total_workout_minutes = EXCLUDED.total_workout_minutes,
    activity_provider = EXCLUDED.activity_provider,
    glucose_avg = EXCLUDED.glucose_avg,
    time_in_range_percent = EXCLUDED.time_in_range_percent,
    glucose_provider = EXCLUDED.glucose_provider,
    stress_score = EXCLUDED.stress_score,
    stress_level = EXCLUDED.stress_level,
    meeting_count = EXCLUDED.meeting_count,
    meeting_minutes = EXCLUDED.meeting_minutes,
    focus_time_minutes = EXCLUDED.focus_time_minutes,
    behavioral_provider = EXCLUDED.behavioral_provider,
    providers_reporting = EXCLUDED.providers_reporting,
    data_quality_score = EXCLUDED.data_quality_score,
    overall_status = EXCLUDED.overall_status,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Trigger to automatically update daily rollup when new data is inserted
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_update_daily_rollup()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM update_unified_health_daily(NEW.email, date_trunc('day', NEW.recorded_at)::date);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS unified_health_data_daily_update ON unified_health_data;

CREATE TRIGGER unified_health_data_daily_update
  AFTER INSERT OR UPDATE ON unified_health_data
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_daily_rollup();

-- ============================================================================
-- Helper view for quick context building (last 30 days)
-- ============================================================================

CREATE OR REPLACE VIEW unified_health_context AS
SELECT
  email,
  date,
  sleep_hours,
  sleep_score,
  recovery_score,
  readiness_score,
  hrv_avg,
  resting_hr,
  steps,
  active_calories,
  workout_count,
  glucose_avg,
  stress_level,
  meeting_count,
  overall_status,
  providers_reporting,
  data_quality_score
FROM unified_health_daily
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY email, date DESC;

-- ============================================================================
-- Grant permissions (adjust based on your roles)
-- ============================================================================

-- Ensure RLS is enabled
ALTER TABLE unified_health_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE unified_health_daily ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read their own data
CREATE POLICY unified_health_data_select ON unified_health_data
  FOR SELECT USING (auth.email() = email);

CREATE POLICY unified_health_daily_select ON unified_health_daily
  FOR SELECT USING (auth.email() = email);

-- Allow service role full access (for cron jobs and backend services)
CREATE POLICY unified_health_data_service ON unified_health_data
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY unified_health_daily_service ON unified_health_daily
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE unified_health_data IS 'Time-series table storing all health data from all providers in a normalized schema';
COMMENT ON TABLE unified_health_daily IS 'Daily rollup table with best available data per category for fast context reads';
COMMENT ON FUNCTION update_unified_health_daily IS 'Updates the daily rollup table with aggregated data from unified_health_data';
COMMENT ON FUNCTION calculate_overall_status IS 'Calculates overall health status based on available metrics';
