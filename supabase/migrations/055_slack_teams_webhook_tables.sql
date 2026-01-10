-- Slack and Teams Webhook Tables
-- For real-time event processing

-- Slack webhook events
CREATE TABLE IF NOT EXISTS slack_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  team_id TEXT,
  event_type TEXT NOT NULL,
  channel_id TEXT,
  user_id TEXT,
  message_ts TEXT,
  thread_ts TEXT,
  payload JSONB,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_slack_events_user ON slack_webhook_events(user_email);
CREATE INDEX IF NOT EXISTS idx_slack_events_team ON slack_webhook_events(team_id);
CREATE INDEX IF NOT EXISTS idx_slack_events_received ON slack_webhook_events(received_at DESC);

-- Teams webhook subscriptions
CREATE TABLE IF NOT EXISTS teams_webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  subscription_id TEXT NOT NULL,
  resource TEXT NOT NULL,
  change_types TEXT[], -- ['created', 'updated']
  expiration TIMESTAMPTZ NOT NULL,
  client_state TEXT,
  is_active BOOLEAN DEFAULT true,
  error_count INTEGER DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_teams_subs_user ON teams_webhook_subscriptions(user_email);
CREATE INDEX IF NOT EXISTS idx_teams_subs_active ON teams_webhook_subscriptions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_teams_subs_expiration ON teams_webhook_subscriptions(expiration);

-- Teams webhook events
CREATE TABLE IF NOT EXISTS teams_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  subscription_id TEXT,
  resource TEXT,
  change_type TEXT,
  client_state TEXT,
  resource_data JSONB,
  payload JSONB,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teams_events_user ON teams_webhook_events(user_email);
CREATE INDEX IF NOT EXISTS idx_teams_events_received ON teams_webhook_events(received_at DESC);

-- Enable RLS
ALTER TABLE slack_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams_webhook_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams_webhook_events ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Service can manage slack events"
  ON slack_webhook_events FOR ALL USING (true);

CREATE POLICY "Service can manage teams subscriptions"
  ON teams_webhook_subscriptions FOR ALL USING (true);

CREATE POLICY "Service can manage teams events"
  ON teams_webhook_events FOR ALL USING (true);

COMMENT ON TABLE slack_webhook_events IS 'Real-time events received from Slack Events API';
COMMENT ON TABLE teams_webhook_subscriptions IS 'Microsoft Graph webhook subscriptions for Teams';
COMMENT ON TABLE teams_webhook_events IS 'Real-time events received from Microsoft Graph webhooks';
