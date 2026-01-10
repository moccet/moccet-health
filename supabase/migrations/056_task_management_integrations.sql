-- Migration: Task Management Integrations (Notion & Linear) + Cross-Platform Correlation
-- Created: 2026-01-10

-- ============================================================================
-- ENTITY REFERENCES (Cross-platform entity linking)
-- ============================================================================
-- Links the same person/project/task across different platforms
CREATE TABLE IF NOT EXISTS entity_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('person', 'project', 'task')),
  canonical_name TEXT NOT NULL,
  sources JSONB NOT NULL DEFAULT '[]',
  -- Example sources: [{"source": "gmail", "id": "email@x.com"}, {"source": "slack", "id": "U123"}]
  confidence FLOAT DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_email, entity_type, canonical_name)
);

CREATE INDEX IF NOT EXISTS idx_entity_refs_email ON entity_references(user_email);
CREATE INDEX IF NOT EXISTS idx_entity_refs_type ON entity_references(user_email, entity_type);

-- ============================================================================
-- MESSAGE CORRELATIONS (Cross-platform thread linking)
-- ============================================================================
-- Links related conversations/threads across platforms
CREATE TABLE IF NOT EXISTS message_correlations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  topic TEXT,
  messages JSONB NOT NULL DEFAULT '[]',
  -- Example: [{"source": "gmail", "id": "xxx", "timestamp": "..."}, {"source": "slack", "id": "yyy"}]
  participants TEXT[] DEFAULT '{}',
  urgency TEXT CHECK (urgency IN ('critical', 'high', 'medium', 'low')),
  confidence FLOAT DEFAULT 1.0,
  detected_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_correlations_email ON message_correlations(user_email);
CREATE INDEX IF NOT EXISTS idx_correlations_topic ON message_correlations(user_email, topic);
CREATE INDEX IF NOT EXISTS idx_correlations_detected ON message_correlations(detected_at);

-- ============================================================================
-- NOTION TASKS
-- ============================================================================
-- Stores tasks/pages from Notion databases
CREATE TABLE IF NOT EXISTS notion_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  notion_page_id TEXT NOT NULL,
  database_id TEXT,
  title TEXT NOT NULL,
  status TEXT,
  due_date TIMESTAMPTZ,
  assignee TEXT,
  priority TEXT,
  last_edited TIMESTAMPTZ,
  raw_properties JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_email, notion_page_id)
);

CREATE INDEX IF NOT EXISTS idx_notion_tasks_email ON notion_tasks(user_email);
CREATE INDEX IF NOT EXISTS idx_notion_tasks_status ON notion_tasks(user_email, status);
CREATE INDEX IF NOT EXISTS idx_notion_tasks_due ON notion_tasks(user_email, due_date);

-- ============================================================================
-- LINEAR ISSUES
-- ============================================================================
-- Stores issues from Linear
CREATE TABLE IF NOT EXISTS linear_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  linear_issue_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  state TEXT,
  priority INTEGER, -- 0=None, 1=Urgent, 2=High, 3=Medium, 4=Low
  due_date TIMESTAMPTZ,
  project_name TEXT,
  team_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_email, linear_issue_id)
);

CREATE INDEX IF NOT EXISTS idx_linear_issues_email ON linear_issues(user_email);
CREATE INDEX IF NOT EXISTS idx_linear_issues_state ON linear_issues(user_email, state);
CREATE INDEX IF NOT EXISTS idx_linear_issues_priority ON linear_issues(user_email, priority);
CREATE INDEX IF NOT EXISTS idx_linear_issues_due ON linear_issues(user_email, due_date);

-- ============================================================================
-- TASK CORRELATIONS (Link tasks to conversations)
-- ============================================================================
-- Links tasks from Notion/Linear to conversations in email/chat
CREATE TABLE IF NOT EXISTS task_correlations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  task_source TEXT NOT NULL CHECK (task_source IN ('notion', 'linear')),
  task_id TEXT NOT NULL, -- notion_page_id or linear_issue_id
  task_title TEXT NOT NULL,
  mentions JSONB NOT NULL DEFAULT '[]',
  -- Example: [{"source": "gmail", "id": "xxx", "snippet": "..."}, {"source": "slack", "id": "yyy"}]
  confidence FLOAT DEFAULT 1.0,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_email, task_source, task_id)
);

CREATE INDEX IF NOT EXISTS idx_task_correlations_email ON task_correlations(user_email);
CREATE INDEX IF NOT EXISTS idx_task_correlations_source ON task_correlations(user_email, task_source);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================
-- Enable RLS on all tables
ALTER TABLE entity_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_correlations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notion_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE linear_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_correlations ENABLE ROW LEVEL SECURITY;

-- Entity references policies
CREATE POLICY "Users can view their own entity references"
  ON entity_references FOR SELECT
  USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Service role can manage entity references"
  ON entity_references FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Message correlations policies
CREATE POLICY "Users can view their own message correlations"
  ON message_correlations FOR SELECT
  USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Service role can manage message correlations"
  ON message_correlations FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Notion tasks policies
CREATE POLICY "Users can view their own notion tasks"
  ON notion_tasks FOR SELECT
  USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Service role can manage notion tasks"
  ON notion_tasks FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Linear issues policies
CREATE POLICY "Users can view their own linear issues"
  ON linear_issues FOR SELECT
  USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Service role can manage linear issues"
  ON linear_issues FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Task correlations policies
CREATE POLICY "Users can view their own task correlations"
  ON task_correlations FOR SELECT
  USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Service role can manage task correlations"
  ON task_correlations FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE entity_references IS 'Cross-platform entity references (person, project, task)';
COMMENT ON TABLE message_correlations IS 'Cross-platform message/thread correlations';
COMMENT ON TABLE notion_tasks IS 'Tasks and pages from Notion';
COMMENT ON TABLE linear_issues IS 'Issues from Linear';
COMMENT ON TABLE task_correlations IS 'Links between tasks (Notion/Linear) and conversations (email/chat)';
