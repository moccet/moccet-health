-- Agent Planning Migration
-- Adds planning capabilities and health plans to the agent system

-- ============================================================================
-- PLANNING RESULTS TABLE 

-- ============================================================================
-- Stores the reasoning/planning output for each task

CREATE TABLE IF NOT EXISTS agent_task_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id TEXT NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,

  -- Planning output (Chain of Thought)
  reasoning JSONB NOT NULL DEFAULT '[]',    -- Array of {thought, observation, conclusion}
  dynamic_steps JSONB NOT NULL DEFAULT '[]', -- Generated TaskStep array

  -- Metrics
  risk_level TEXT NOT NULL DEFAULT 'medium',
  confidence_score DECIMAL(3,2),            -- 0.00 to 1.00
  estimated_duration_minutes INTEGER,

  -- Alternatives and dependencies
  alternatives JSONB DEFAULT '[]',
  dependencies JSONB DEFAULT '[]',
  side_effects JSONB DEFAULT '[]',

  -- Planning context (what data was used)
  planning_context JSONB,

  -- Model info
  model_used TEXT DEFAULT 'gpt-4',
  tokens_used INTEGER,
  planning_duration_ms INTEGER,

  -- Versioning (re-planning support)
  version INTEGER DEFAULT 1,
  previous_plan_id UUID REFERENCES agent_task_plans(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_risk_level CHECK (risk_level IN ('low', 'medium', 'high'))
);

-- ============================================================================
-- HEALTH PLANS TABLE
-- ============================================================================
-- Multi-task coordinated health plans

CREATE TABLE IF NOT EXISTS health_plans (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,

  -- Plan details
  title TEXT NOT NULL,
  description TEXT,
  plan_type TEXT DEFAULT 'custom',    -- 'morning_routine', 'recovery', 'optimization', 'custom'

  -- Status
  status TEXT NOT NULL DEFAULT 'draft',

  -- Source insights that triggered this plan
  source_insights JSONB DEFAULT '[]',

  -- Task ordering and dependencies
  task_graph JSONB NOT NULL DEFAULT '[]',
  execution_order TEXT[] DEFAULT '{}',

  -- Approval configuration
  approval_config JSONB DEFAULT '{
    "auto_approve_low_risk": true,
    "require_approval_for": ["calendar", "health_booking", "shopping"],
    "max_auto_approve_cost": 50,
    "notify_on_completion": true
  }',

  -- Progress tracking
  current_task_index INTEGER DEFAULT 0,
  overall_progress INTEGER DEFAULT 0,  -- 0-100
  completed_tasks TEXT[] DEFAULT '{}',
  failed_tasks TEXT[] DEFAULT '{}',
  blocked_tasks TEXT[] DEFAULT '{}',

  -- Timing
  estimated_total_duration INTEGER,    -- minutes
  actual_duration INTEGER,
  scheduled_start TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  CONSTRAINT valid_plan_status CHECK (status IN (
    'draft',              -- Being created
    'planning',           -- Agents are planning their tasks
    'awaiting_approval',  -- Waiting for user approval
    'approved',           -- User approved, ready to execute
    'executing',          -- Currently running
    'paused',             -- Paused by user or blocked
    'completed',          -- All tasks done
    'partially_completed',-- Some tasks failed
    'failed',             -- Plan failed
    'cancelled'           -- User cancelled
  ))
);

-- ============================================================================
-- HEALTH PLAN TASKS (Junction Table)
-- ============================================================================
-- Links tasks to health plans with ordering metadata

CREATE TABLE IF NOT EXISTS health_plan_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id TEXT NOT NULL REFERENCES health_plans(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,

  -- Ordering
  sequence_number INTEGER NOT NULL,

  -- Dependencies within this plan
  depends_on_task_ids TEXT[] DEFAULT '{}',

  -- Approval
  requires_approval BOOLEAN DEFAULT true,
  approval_status TEXT DEFAULT 'pending',
  approved_at TIMESTAMPTZ,
  approved_by TEXT,                   -- 'user' or 'auto'

  -- Execution
  can_run_parallel BOOLEAN DEFAULT false,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Risk assessment
  risk_level TEXT DEFAULT 'medium',
  risk_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_plan_task UNIQUE (plan_id, task_id),
  CONSTRAINT valid_approval_status CHECK (approval_status IN (
    'pending', 'approved', 'auto_approved', 'rejected', 'skipped'
  )),
  CONSTRAINT valid_hpt_risk_level CHECK (risk_level IN ('low', 'medium', 'high'))
);

-- ============================================================================
-- UPDATE AGENT_TASKS TABLE
-- ============================================================================

-- Add new columns to agent_tasks
ALTER TABLE agent_tasks
  ADD COLUMN IF NOT EXISTS plan_id TEXT REFERENCES health_plans(id),
  ADD COLUMN IF NOT EXISTS has_plan BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS risk_level TEXT DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS can_auto_execute BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS planning_status TEXT DEFAULT 'not_started';

-- Update valid types to include shopping and planning
ALTER TABLE agent_tasks DROP CONSTRAINT IF EXISTS valid_type;
ALTER TABLE agent_tasks ADD CONSTRAINT valid_type CHECK (
  type IN ('calendar', 'spotify', 'supplement', 'health_booking', 'shopping', 'planning', 'custom')
);

-- Add planning status constraint
ALTER TABLE agent_tasks DROP CONSTRAINT IF EXISTS valid_planning_status;
ALTER TABLE agent_tasks ADD CONSTRAINT valid_planning_status CHECK (
  planning_status IN ('not_started', 'planning', 'planned', 'replanning', 'failed')
);

-- Add risk level constraint
ALTER TABLE agent_tasks DROP CONSTRAINT IF EXISTS valid_task_risk_level;
ALTER TABLE agent_tasks ADD CONSTRAINT valid_task_risk_level CHECK (
  risk_level IN ('low', 'medium', 'high')
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_task_plans_task_id ON agent_task_plans(task_id);
CREATE INDEX IF NOT EXISTS idx_health_plans_email ON health_plans(user_email);
CREATE INDEX IF NOT EXISTS idx_health_plans_status ON health_plans(status);
CREATE INDEX IF NOT EXISTS idx_health_plan_tasks_plan ON health_plan_tasks(plan_id);
CREATE INDEX IF NOT EXISTS idx_health_plan_tasks_task ON health_plan_tasks(task_id);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_plan ON agent_tasks(plan_id);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_planning_status ON agent_tasks(planning_status);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE agent_task_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_plan_tasks ENABLE ROW LEVEL SECURITY;

-- Service role full access (backend handles auth)
DROP POLICY IF EXISTS "Service role full access on task_plans" ON agent_task_plans;
CREATE POLICY "Service role full access on task_plans"
  ON agent_task_plans FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on health_plans" ON health_plans;
CREATE POLICY "Service role full access on health_plans"
  ON health_plans FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on health_plan_tasks" ON health_plan_tasks;
CREATE POLICY "Service role full access on health_plan_tasks"
  ON health_plan_tasks FOR ALL USING (true) WITH CHECK (true);

-- ============================================================================
-- TRIGGER FOR HEALTH PLANS UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_health_plan_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_health_plans_updated_at ON health_plans;
CREATE TRIGGER trigger_health_plans_updated_at
  BEFORE UPDATE ON health_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_health_plan_updated_at();
