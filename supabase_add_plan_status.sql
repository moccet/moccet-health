-- Add plan generation status tracking to sage_onboarding_data table

-- Add plan_generation_status column
ALTER TABLE sage_onboarding_data
ADD COLUMN IF NOT EXISTS plan_generation_status TEXT
CHECK (plan_generation_status IN ('queued', 'processing', 'completed', 'failed'));

-- Add plan_generation_error column to store error messages if generation fails
ALTER TABLE sage_onboarding_data
ADD COLUMN IF NOT EXISTS plan_generation_error TEXT;

-- Create index for faster status lookups
CREATE INDEX IF NOT EXISTS idx_sage_onboarding_plan_status
ON sage_onboarding_data(plan_generation_status);

-- Add comment to columns for documentation
COMMENT ON COLUMN sage_onboarding_data.plan_generation_status IS
'Status of background plan generation job: queued, processing, completed, or failed';

COMMENT ON COLUMN sage_onboarding_data.plan_generation_error IS
'Error message if plan generation failed';
