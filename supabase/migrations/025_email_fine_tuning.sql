-- Email Fine-Tuning System Migration
-- Creates tables for:
-- 1. email_training_data - Training examples from user corrections
-- 2. user_fine_tuned_models - Track per-user fine-tuned models
-- 3. fine_tuning_jobs - Track OpenAI fine-tuning job status

-- =====================================================
-- 1. EMAIL TRAINING DATA TABLE
-- Stores training examples from user corrections to drafts
-- =====================================================
CREATE TABLE IF NOT EXISTS public.email_training_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  user_code TEXT,

  -- Reference to original draft
  draft_id UUID REFERENCES public.email_drafts(id) ON DELETE SET NULL,

  -- The original email that needed a response
  original_email_from TEXT NOT NULL,
  original_email_subject TEXT NOT NULL,
  original_email_body TEXT NOT NULL,
  original_email_snippet TEXT,

  -- Classification context
  email_type TEXT,
  urgency_level TEXT,

  -- AI-generated draft (what we produced)
  ai_draft_subject TEXT NOT NULL,
  ai_draft_body TEXT NOT NULL,

  -- User's final version (what they actually sent)
  user_final_subject TEXT NOT NULL,
  user_final_body TEXT NOT NULL,

  -- Edit analysis
  was_modified BOOLEAN DEFAULT false,
  modification_type TEXT CHECK (modification_type IN (
    'sent_as_is',       -- User sent our draft without changes
    'minor_edits',      -- Small tweaks (typos, word changes)
    'moderate_edits',   -- Noticeable changes but same structure
    'major_rewrite',    -- Significant rewrite
    'discarded'         -- User discarded and wrote their own
  )),
  edit_distance INTEGER,  -- Levenshtein distance for quantifying changes
  similarity_score NUMERIC CHECK (similarity_score >= 0 AND similarity_score <= 1),

  -- OpenAI fine-tuning format (pre-computed)
  training_prompt TEXT,  -- The system + user message for fine-tuning
  training_completion TEXT,  -- The expected assistant response

  -- Quality flags
  is_valid_for_training BOOLEAN DEFAULT true,
  excluded_reason TEXT,

  -- Usage tracking
  used_in_fine_tuning_job UUID,
  used_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(draft_id)
);

CREATE INDEX IF NOT EXISTS idx_email_training_email ON public.email_training_data(user_email);
CREATE INDEX IF NOT EXISTS idx_email_training_valid ON public.email_training_data(is_valid_for_training);
CREATE INDEX IF NOT EXISTS idx_email_training_unused ON public.email_training_data(used_in_fine_tuning_job) WHERE used_in_fine_tuning_job IS NULL;
CREATE INDEX IF NOT EXISTS idx_email_training_created ON public.email_training_data(created_at DESC);

-- Enable RLS
ALTER TABLE public.email_training_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on email_training_data" ON public.email_training_data
  FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- 2. USER FINE-TUNED MODELS TABLE
-- Tracks per-user fine-tuned OpenAI models
-- =====================================================
CREATE TABLE IF NOT EXISTS public.user_fine_tuned_models (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  user_code TEXT,

  -- OpenAI model details
  openai_model_id TEXT NOT NULL,  -- e.g., "ft:gpt-4o-mini-2024-07-18:org:user-123:abc123"
  base_model TEXT NOT NULL DEFAULT 'gpt-4o-mini-2024-07-18',

  -- Training info
  fine_tuning_job_id TEXT NOT NULL,
  training_examples_count INTEGER NOT NULL,

  -- Performance metrics (from OpenAI)
  training_loss NUMERIC,
  validation_loss NUMERIC,

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'deprecated', 'failed')),
  is_current BOOLEAN DEFAULT true,  -- Is this the current model to use?

  -- Version tracking (users may have multiple fine-tuned versions)
  version INTEGER DEFAULT 1,

  -- Usage stats
  drafts_generated INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deprecated_at TIMESTAMP WITH TIME ZONE,

  UNIQUE(openai_model_id)
);

CREATE INDEX IF NOT EXISTS idx_fine_tuned_models_email ON public.user_fine_tuned_models(user_email);
CREATE INDEX IF NOT EXISTS idx_fine_tuned_models_current ON public.user_fine_tuned_models(user_email, is_current) WHERE is_current = true;
CREATE INDEX IF NOT EXISTS idx_fine_tuned_models_status ON public.user_fine_tuned_models(status);

-- Enable RLS
ALTER TABLE public.user_fine_tuned_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on user_fine_tuned_models" ON public.user_fine_tuned_models
  FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- 3. FINE-TUNING JOBS TABLE
-- Tracks OpenAI fine-tuning job progress
-- =====================================================
CREATE TABLE IF NOT EXISTS public.fine_tuning_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  user_code TEXT,

  -- OpenAI job details
  openai_job_id TEXT,
  base_model TEXT NOT NULL DEFAULT 'gpt-4o-mini-2024-07-18',

  -- Training data
  training_file_id TEXT,  -- OpenAI file ID
  training_examples_count INTEGER NOT NULL,
  training_data_ids UUID[] DEFAULT '{}',  -- References to email_training_data

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',          -- Job created, not yet submitted
    'uploading',        -- Uploading training file
    'validating',       -- OpenAI validating file
    'queued',           -- In OpenAI queue
    'running',          -- Fine-tuning in progress
    'succeeded',        -- Completed successfully
    'failed',           -- Failed
    'cancelled'         -- Cancelled by user or system
  )),

  -- Progress
  trained_tokens INTEGER,
  epochs_completed INTEGER,

  -- Results
  result_model_id TEXT,  -- The fine-tuned model ID if succeeded
  error_message TEXT,

  -- Cost tracking (estimated)
  estimated_cost_usd NUMERIC,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,

  UNIQUE(openai_job_id)
);

CREATE INDEX IF NOT EXISTS idx_fine_tuning_jobs_email ON public.fine_tuning_jobs(user_email);
CREATE INDEX IF NOT EXISTS idx_fine_tuning_jobs_status ON public.fine_tuning_jobs(status);
CREATE INDEX IF NOT EXISTS idx_fine_tuning_jobs_openai ON public.fine_tuning_jobs(openai_job_id);

-- Enable RLS
ALTER TABLE public.fine_tuning_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on fine_tuning_jobs" ON public.fine_tuning_jobs
  FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- 4. ADD COLUMNS TO EMAIL_DRAFTS FOR TRACKING
-- =====================================================
ALTER TABLE public.email_drafts
ADD COLUMN IF NOT EXISTS user_final_body TEXT,
ADD COLUMN IF NOT EXISTS user_final_subject TEXT,
ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS sent_message_id TEXT,
ADD COLUMN IF NOT EXISTS training_data_id UUID REFERENCES public.email_training_data(id);

-- =====================================================
-- 5. ADD FINE-TUNED MODEL REFERENCE TO SETTINGS
-- =====================================================
ALTER TABLE public.email_draft_settings
ADD COLUMN IF NOT EXISTS use_fine_tuned_model BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS min_training_examples INTEGER DEFAULT 15,
ADD COLUMN IF NOT EXISTS auto_retrain_threshold INTEGER DEFAULT 50;
