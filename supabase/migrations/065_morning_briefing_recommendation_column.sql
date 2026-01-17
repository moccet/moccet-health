-- Migration: Add wellness_recommendation column to morning_briefings
-- Purpose: Enable efficient deduplication of morning briefing recommendations

-- Add a dedicated column for the wellness recommendation
-- This allows efficient querying to prevent repetitive recommendations
ALTER TABLE morning_briefings
ADD COLUMN IF NOT EXISTS wellness_recommendation TEXT;

-- Create an index for efficient recommendation lookups
CREATE INDEX IF NOT EXISTS idx_morning_briefings_recommendation
  ON morning_briefings(user_email, wellness_recommendation, generated_at DESC);

-- Backfill existing rows from the JSONB wellness_data
UPDATE morning_briefings
SET wellness_recommendation = wellness_data->>'recommendation'
WHERE wellness_recommendation IS NULL
  AND wellness_data->>'recommendation' IS NOT NULL;

COMMENT ON COLUMN morning_briefings.wellness_recommendation IS 'The wellness recommendation text, stored separately for deduplication queries';
