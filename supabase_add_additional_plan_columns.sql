-- Add additional plan data columns to sage_onboarding_data table

-- Add meal_plan column (stores the detailed 7-day meal plan)
ALTER TABLE sage_onboarding_data
ADD COLUMN IF NOT EXISTS meal_plan JSONB;

-- Add micronutrients column (stores personalized micronutrient recommendations)
ALTER TABLE sage_onboarding_data
ADD COLUMN IF NOT EXISTS micronutrients JSONB;

-- Add lifestyle_integration column (stores lifestyle integration strategies)
ALTER TABLE sage_onboarding_data
ADD COLUMN IF NOT EXISTS lifestyle_integration JSONB;

-- Add comments for documentation
COMMENT ON COLUMN sage_onboarding_data.meal_plan IS
'Detailed 7-day biomarker-optimized meal plan with recipes and macros';

COMMENT ON COLUMN sage_onboarding_data.micronutrients IS
'Personalized micronutrient recommendations based on user data and biomarkers';

COMMENT ON COLUMN sage_onboarding_data.lifestyle_integration IS
'Lifestyle integration strategies including sleep, exercise, and stress management';
