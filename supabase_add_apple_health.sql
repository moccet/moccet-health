-- Add apple_health_data column to sage_onboarding_data table

-- Add apple_health_data column (stores parsed health metrics)
ALTER TABLE sage_onboarding_data
ADD COLUMN IF NOT EXISTS apple_health_data JSONB;

-- Add comment for documentation
COMMENT ON COLUMN sage_onboarding_data.apple_health_data IS
'Parsed Apple Health data including steps, heart rate, sleep, workouts, and other health metrics from the last 30 days';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_sage_onboarding_apple_health
ON sage_onboarding_data USING GIN (apple_health_data);
