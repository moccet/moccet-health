-- Culture Assessment Submissions Table
-- Stores culture assessment results from /culture-assessment

CREATE TABLE IF NOT EXISTS culture_assessment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  name TEXT,
  role TEXT,

  -- Scores by category (0-100 percentage)
  overall_score INTEGER,
  locus_of_control_score INTEGER,
  giver_score INTEGER,
  conscientiousness_score INTEGER,
  grit_score INTEGER,
  intrinsic_motivation_score INTEGER,
  psych_safety_score INTEGER,
  emotional_intelligence_score INTEGER,
  deliberate_practice_score INTEGER,
  crisis_response_score INTEGER,

  -- Self-assessment fields
  self_rating INTEGER,
  manager_rating INTEGER,
  rating_gap INTEGER, -- self_rating - manager_rating

  -- Written responses (stored as text)
  weakness_response TEXT,
  hard_feedback_response TEXT,

  -- Raw data
  raw_answers JSONB, -- All choice answers with question index
  raw_text_answers JSONB, -- All text/scale answers

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_agent TEXT,
  ip_address TEXT
);

-- Index for quick email lookups
CREATE INDEX IF NOT EXISTS idx_culture_assessment_email ON culture_assessment_submissions(email);

-- Index for filtering by score
CREATE INDEX IF NOT EXISTS idx_culture_assessment_overall_score ON culture_assessment_submissions(overall_score);

-- Index for recent submissions
CREATE INDEX IF NOT EXISTS idx_culture_assessment_created_at ON culture_assessment_submissions(created_at DESC);

-- Enable Row Level Security
ALTER TABLE culture_assessment_submissions ENABLE ROW LEVEL SECURITY;

-- Policy: Allow insert from anyone (public form)
CREATE POLICY "Allow public insert" ON culture_assessment_submissions
  FOR INSERT
  WITH CHECK (true);

-- Policy: Only authenticated users with admin role can read
CREATE POLICY "Allow admin read" ON culture_assessment_submissions
  FOR SELECT
  USING (auth.role() = 'authenticated');
