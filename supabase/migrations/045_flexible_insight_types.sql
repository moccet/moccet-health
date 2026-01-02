-- Migration: Flexible insight types with post-classification
-- Purpose: Remove rigid CHECK constraints, add design_category for UI display
-- Part of Phase 2: AI Quality improvements
-- Created: 2026-01-02

-- Step 1: Add design_category column for UI card styling
-- This is assigned by post-classification, not during AI generation
ALTER TABLE real_time_insights
ADD COLUMN IF NOT EXISTS design_category TEXT;

-- Step 2: Add classification metadata columns
ALTER TABLE real_time_insights
ADD COLUMN IF NOT EXISTS classification_confidence NUMERIC(3,2);

ALTER TABLE real_time_insights
ADD COLUMN IF NOT EXISTS classification_source TEXT DEFAULT 'auto';

-- Step 3: Drop the old restrictive CHECK constraint on insight_type
-- This allows AI to freely describe patterns without being constrained
ALTER TABLE real_time_insights DROP CONSTRAINT IF EXISTS real_time_insights_insight_type_check;

-- Step 4: Add a more flexible CHECK constraint
-- Just ensures insight_type is not null/empty, allows any value
ALTER TABLE real_time_insights ADD CONSTRAINT real_time_insights_insight_type_check
    CHECK (insight_type IS NOT NULL AND length(trim(insight_type)) > 0);

-- Step 5: Add CHECK constraint for design_category (valid values only)
ALTER TABLE real_time_insights ADD CONSTRAINT real_time_insights_design_category_check
    CHECK (design_category IS NULL OR design_category IN (
        'PREDICTION', 'OPTIMIZATION', 'ANALYSIS', 'IKIGAI', 'SOCIAL'
    ));

-- Step 6: Create index for design_category queries
CREATE INDEX IF NOT EXISTS idx_real_time_insights_design_category
ON real_time_insights(design_category)
WHERE design_category IS NOT NULL;

-- Step 7: Backfill existing insights with design_category based on insight_type mapping
-- This ensures existing data works with the new UI
UPDATE real_time_insights
SET design_category = CASE
    -- Prediction-style types
    WHEN insight_type IN ('energy_prediction', 'sleep_improvement') THEN 'PREDICTION'
    -- Optimization-style types
    WHEN insight_type IN ('workout_recommendation', 'nutrition_reminder') THEN 'OPTIMIZATION'
    -- Analysis-style types (most common - default)
    WHEN insight_type IN ('sleep_alert', 'glucose_spike', 'biomarker_trend', 'recovery_low', 'recovery_high') THEN 'ANALYSIS'
    -- Ikigai-style types
    WHEN insight_type IN ('deep_focus_window', 'stress_indicator') THEN 'IKIGAI'
    -- Social-style types
    WHEN insight_type IN ('activity_anomaly', 'workout_completed') THEN 'SOCIAL'
    -- Default to ANALYSIS for any other type
    ELSE 'ANALYSIS'
END
WHERE design_category IS NULL;

-- Step 8: Add comments for documentation
COMMENT ON COLUMN real_time_insights.design_category IS 'UI display category assigned by post-classification: PREDICTION, OPTIMIZATION, ANALYSIS, IKIGAI, SOCIAL';
COMMENT ON COLUMN real_time_insights.classification_confidence IS 'Confidence score (0.00-1.00) of the automated classification';
COMMENT ON COLUMN real_time_insights.classification_source IS 'Source of classification: auto (classifier), manual (user), ai (during generation)';

-- Step 9: Create a helper function to classify insights by content
-- This can be called from application code or as a database trigger
CREATE OR REPLACE FUNCTION classify_insight_design_category(
    p_title TEXT,
    p_message TEXT
)
RETURNS TEXT AS $$
DECLARE
    combined_text TEXT;
BEGIN
    combined_text := lower(p_title || ' ' || COALESCE(p_message, ''));

    -- PREDICTION patterns
    IF combined_text ~ '(tomorrow|upcoming|predicted|will (be|have|see)|expect|forecast|next (day|week|morning))' THEN
        RETURN 'PREDICTION';
    END IF;

    -- OPTIMIZATION patterns
    IF combined_text ~ '(could (be|transform|improve)|try |consider|secret to|unlock|boost|small change)' THEN
        RETURN 'OPTIMIZATION';
    END IF;

    -- IKIGAI patterns
    IF combined_text ~ '(purpose|meaning|best (ideas|work|self)|flow state|peak|potential|creativity)' THEN
        RETURN 'IKIGAI';
    END IF;

    -- SOCIAL patterns
    IF combined_text ~ '(together|social|community|friends|connection|partner|accountability|group|team)' THEN
        RETURN 'SOCIAL';
    END IF;

    -- Default to ANALYSIS
    RETURN 'ANALYSIS';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION classify_insight_design_category(TEXT, TEXT) IS 'Classifies an insight into a design category based on title and message content patterns';
