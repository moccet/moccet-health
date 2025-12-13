-- Migration: LangGraph Autonomous Agent System
-- Creates tables for agent execution, checkpointing, and approval flows

-- ============================================================================
-- AGENT CHECKPOINTS
-- Stores LangGraph state for resuming execution
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id TEXT NOT NULL,
  checkpoint_id TEXT NOT NULL,
  parent_id TEXT,
  checkpoint JSONB NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(thread_id, checkpoint_id)
);

CREATE INDEX idx_agent_checkpoints_thread ON agent_checkpoints(thread_id);
CREATE INDEX idx_agent_checkpoints_created ON agent_checkpoints(created_at DESC);

-- ============================================================================
-- AGENT EXECUTIONS
-- Tracks each agent execution session
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_executions (
  id TEXT PRIMARY KEY,
  task_id TEXT,
  user_email TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  status TEXT DEFAULT 'running' CHECK (status IN (
    'running', 'awaiting_approval', 'completed', 'failed', 'cancelled'
  )),
  reasoning_steps JSONB DEFAULT '[]',
  tool_calls JSONB DEFAULT '[]',
  pending_approval JSONB,
  final_result JSONB,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_agent_executions_user ON agent_executions(user_email);
CREATE INDEX idx_agent_executions_task ON agent_executions(task_id);
CREATE INDEX idx_agent_executions_status ON agent_executions(status);
CREATE INDEX idx_agent_executions_thread ON agent_executions(thread_id);

-- ============================================================================
-- AGENT APPROVAL REQUESTS
-- Tracks pending/completed approval requests for medium/high risk actions
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id TEXT REFERENCES agent_executions(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  tool_args JSONB NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  user_response_at TIMESTAMPTZ,
  user_feedback TEXT,
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '24 hours'),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_agent_approval_execution ON agent_approval_requests(execution_id);
CREATE INDEX idx_agent_approval_status ON agent_approval_requests(status);

-- ============================================================================
-- AGENT APPROVAL DECISIONS
-- Stores user decisions on approval requests
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_approval_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id TEXT REFERENCES agent_executions(id) ON DELETE CASCADE,
  tool_call_id TEXT NOT NULL,
  approved BOOLEAN NOT NULL,
  feedback TEXT,
  decided_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(execution_id, tool_call_id)
);

CREATE INDEX idx_agent_decisions_execution ON agent_approval_decisions(execution_id);

-- ============================================================================
-- AGENT ACTION LOG
-- Audit trail of all agent actions
-- ============================================================================

CREATE TABLE IF NOT EXISTS agent_action_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  action_type TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_agent_action_log_user ON agent_action_log(user_email);
CREATE INDEX idx_agent_action_log_type ON agent_action_log(action_type);
CREATE INDEX idx_agent_action_log_created ON agent_action_log(created_at DESC);

-- ============================================================================
-- USER SHOPPING CART
-- Persists shopping cart for the shopping tool
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_shopping_cart (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT UNIQUE NOT NULL,
  cart_items JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_shopping_cart_user ON user_shopping_cart(user_email);

-- ============================================================================
-- USER ORDERS
-- Tracks completed purchases
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_orders (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  items JSONB NOT NULL,
  total DECIMAL(10, 2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'
  )),
  shipping_address JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_user_orders_user ON user_orders(user_email);
CREATE INDEX idx_user_orders_status ON user_orders(status);

-- ============================================================================
-- USER APPOINTMENTS
-- Tracks booked health appointments
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_appointments (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  provider_name TEXT NOT NULL,
  specialty TEXT,
  appointment_type TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'confirmed' CHECK (status IN (
    'pending', 'confirmed', 'cancelled', 'completed', 'no_show'
  )),
  cancellation_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_user_appointments_user ON user_appointments(user_email);
CREATE INDEX idx_user_appointments_scheduled ON user_appointments(scheduled_at);
CREATE INDEX idx_user_appointments_status ON user_appointments(status);

-- ============================================================================
-- USER OAUTH CONNECTIONS (if not exists)
-- Store OAuth tokens for connected services
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_oauth_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  provider TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[],
  connected_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(user_email, provider)
);

CREATE INDEX idx_oauth_connections_user ON user_oauth_connections(user_email);
CREATE INDEX idx_oauth_connections_provider ON user_oauth_connections(provider);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to expire old approval requests
CREATE OR REPLACE FUNCTION expire_old_approval_requests()
RETURNS void AS $$
BEGIN
  UPDATE agent_approval_requests
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < now();
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old checkpoints (keep last 10 per thread)
CREATE OR REPLACE FUNCTION cleanup_old_checkpoints()
RETURNS void AS $$
BEGIN
  DELETE FROM agent_checkpoints
  WHERE id IN (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY thread_id ORDER BY created_at DESC) as rn
      FROM agent_checkpoints
    ) ranked
    WHERE rn > 10
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE agent_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_action_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_shopping_cart ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_appointments ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own executions"
  ON agent_executions FOR SELECT
  USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Users can view own approval requests"
  ON agent_approval_requests FOR SELECT
  USING (
    execution_id IN (
      SELECT id FROM agent_executions
      WHERE user_email = auth.jwt() ->> 'email'
    )
  );

CREATE POLICY "Users can view own action log"
  ON agent_action_log FOR SELECT
  USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Users can manage own cart"
  ON user_shopping_cart FOR ALL
  USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Users can view own orders"
  ON user_orders FOR SELECT
  USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Users can manage own appointments"
  ON user_appointments FOR ALL
  USING (auth.jwt() ->> 'email' = user_email);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE agent_checkpoints IS 'LangGraph state checkpoints for resuming agent execution';
COMMENT ON TABLE agent_executions IS 'Agent execution sessions with reasoning and tool call history';
COMMENT ON TABLE agent_approval_requests IS 'Pending and completed approval requests for agent actions';
COMMENT ON TABLE agent_action_log IS 'Audit trail of all agent actions';
COMMENT ON TABLE user_shopping_cart IS 'User shopping carts for the shopping tool';
COMMENT ON TABLE user_orders IS 'Completed purchases from the shopping tool';
COMMENT ON TABLE user_appointments IS 'Health appointments booked through the agent';
