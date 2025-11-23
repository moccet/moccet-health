-- ============================================
-- FIX: Add unique constraint to forge_onboarding_data.email
-- ============================================
-- This fixes the error: "there is no unique or exclusion constraint matching the ON CONFLICT specification"
-- Run this in your Supabase SQL editor

-- Drop the old index if it exists (unique constraint will create its own index)
DROP INDEX IF EXISTS public.forge_onboarding_data_email_idx;

-- Add unique constraint on email (required for upsert ON CONFLICT to work)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'forge_onboarding_data_email_key'
  ) THEN
    ALTER TABLE public.forge_onboarding_data
    ADD CONSTRAINT forge_onboarding_data_email_key UNIQUE (email);

    RAISE NOTICE 'Successfully added unique constraint on email column';
  ELSE
    RAISE NOTICE 'Unique constraint already exists, skipping...';
  END IF;
END $$;
