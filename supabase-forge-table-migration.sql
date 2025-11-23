-- ============================================
-- FORGE ONBOARDING DATA TABLE
-- ============================================
-- Create forge_onboarding_data table
CREATE TABLE IF NOT EXISTS public.forge_onboarding_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  form_data JSONB NOT NULL,
  lab_file_analysis JSONB,
  forge_plan JSONB,
  plan_generation_status TEXT,
  plan_generation_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add unique constraint on email (required for upsert ON CONFLICT)
ALTER TABLE public.forge_onboarding_data ADD CONSTRAINT forge_onboarding_data_email_key UNIQUE (email);

-- Add index on email for faster lookups (unique constraint automatically creates an index, but keeping this for clarity)
-- CREATE INDEX IF NOT EXISTS forge_onboarding_data_email_idx ON public.forge_onboarding_data(email);

-- Add index on uniqueCode in form_data JSONB for faster lookups by code
CREATE INDEX IF NOT EXISTS forge_onboarding_data_unique_code_idx ON public.forge_onboarding_data((form_data->>'uniqueCode'));

-- Add index on plan_generation_status
CREATE INDEX IF NOT EXISTS forge_onboarding_data_status_idx ON public.forge_onboarding_data(plan_generation_status);

-- Enable Row Level Security (RLS)
ALTER TABLE public.forge_onboarding_data ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (adjust based on your security requirements)
CREATE POLICY "Allow all operations on forge_onboarding_data" ON public.forge_onboarding_data
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add comment to table
COMMENT ON TABLE public.forge_onboarding_data IS 'Stores forge (fitness) onboarding data and generated fitness plans';


-- ============================================
-- FORGE FITNESS PLANS TABLE
-- ============================================
-- Create forge_fitness_plans table (similar to sage_nutrition_plans)
CREATE TABLE IF NOT EXISTS public.forge_fitness_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  unique_code TEXT,
  fitness_plan JSONB,
  supplement_recommendations JSONB,
  recovery_protocol JSONB,
  progress_tracking JSONB,
  injury_prevention JSONB,
  adaptive_features JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index on email for faster lookups
CREATE INDEX IF NOT EXISTS forge_fitness_plans_email_idx ON public.forge_fitness_plans(email);

-- Add index on unique_code for faster lookups
CREATE INDEX IF NOT EXISTS forge_fitness_plans_unique_code_idx ON public.forge_fitness_plans(unique_code);

-- Enable Row Level Security (RLS)
ALTER TABLE public.forge_fitness_plans ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (adjust based on your security requirements)
CREATE POLICY "Allow all operations on forge_fitness_plans" ON public.forge_fitness_plans
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add comment to table
COMMENT ON TABLE public.forge_fitness_plans IS 'Stores generated forge fitness plans with workout programs and recommendations';
