-- Agent Tasks Table
-- Stores task state for the Moccet Agent system

CREATE TABLE IF NOT EXISTS agent_tasks (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  type TEXT NOT NULL, -- 'calendar', 'spotify', 'supplement', 'health_booking'
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'analyzing', 'awaiting_approval', 'executing', 'completed', 'failed'
  analyzing TEXT[] DEFAULT '{}', -- What the agent is analyzing
  using_services TEXT[] DEFAULT '{}', -- Services/integrations being used
  steps JSONB DEFAULT '[]', -- Array of TaskStep objects
  params JSONB DEFAULT '{}', -- Task parameters
  result JSONB, -- Result data when completed
  source_insight_id TEXT, -- Link to triggering insight
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- Foreign key to users (if you have a users table)
  -- CONSTRAINT fk_user_email FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE

  -- Indexes for common queries
  CONSTRAINT valid_status CHECK (status IN ('pending', 'analyzing', 'awaiting_approval', 'executing', 'completed', 'failed')),
  CONSTRAINT valid_type CHECK (type IN ('calendar', 'spotify', 'supplement', 'health_booking', 'custom'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_tasks_user_email ON agent_tasks(user_email);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON agent_tasks(status);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_created_at ON agent_tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_type ON agent_tasks(type);

-- Enable Row Level Security
ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations for service role (backend API uses this)
-- This is the primary policy since your backend handles auth
CREATE POLICY "Enable all for service role" ON agent_tasks
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Note: Since your backend validates the user email before making requests,
-- RLS is effectively handled at the API layer. If you want stricter RLS,
-- you can add user-specific policies, but they require the anon key + JWT.

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_agent_task_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_agent_tasks_updated_at ON agent_tasks;
CREATE TRIGGER trigger_agent_tasks_updated_at
  BEFORE UPDATE ON agent_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_task_updated_at();

-- Task Suggestions Table (optional - for caching suggestions)
CREATE TABLE IF NOT EXISTS agent_suggestions (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  agent_type TEXT NOT NULL,
  title TEXT NOT NULL,
  reason TEXT,
  source_insight_id TEXT,
  params JSONB DEFAULT '{}',
  impact TEXT DEFAULT 'medium',
  dismissed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_suggestion_type CHECK (agent_type IN ('calendar', 'spotify', 'supplement'))
);

CREATE INDEX IF NOT EXISTS idx_agent_suggestions_user_email ON agent_suggestions(user_email);
CREATE INDEX IF NOT EXISTS idx_agent_suggestions_dismissed ON agent_suggestions(dismissed);

-- Enable RLS for suggestions
ALTER TABLE agent_suggestions ENABLE ROW LEVEL SECURITY;

-- Allow all for service role (backend handles auth)
CREATE POLICY "Enable all for suggestions" ON agent_suggestions
  FOR ALL
  USING (true)
  WITH CHECK (true);
