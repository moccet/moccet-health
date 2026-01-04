-- Migration: Whoop Webhook Tables
-- Description: Tables to store Whoop webhook events and subscription info

-- Table for storing incoming webhook events (for debugging/audit)
CREATE TABLE IF NOT EXISTS whoop_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  whoop_user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  process_result JSONB,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for tracking webhook subscriptions per user
CREATE TABLE IF NOT EXISTS whoop_webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  callback_url TEXT NOT NULL,
  subscriptions JSONB NOT NULL DEFAULT '[]',
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  last_webhook_received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User health baselines table (for tracking recovery/HRV baselines)
CREATE TABLE IF NOT EXISTS user_health_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  recovery_score_avg NUMERIC DEFAULT 65,
  hrv_avg NUMERIC DEFAULT 50,
  sleep_score_avg NUMERIC DEFAULT 75,
  resting_hr_avg NUMERIC DEFAULT 60,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_whoop_webhook_events_email ON whoop_webhook_events(email);
CREATE INDEX IF NOT EXISTS idx_whoop_webhook_events_whoop_user_id ON whoop_webhook_events(whoop_user_id);
CREATE INDEX IF NOT EXISTS idx_whoop_webhook_events_event_type ON whoop_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_whoop_webhook_events_received_at ON whoop_webhook_events(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_whoop_webhook_events_processed ON whoop_webhook_events(processed) WHERE NOT processed;

CREATE INDEX IF NOT EXISTS idx_whoop_webhook_subscriptions_email ON whoop_webhook_subscriptions(email);
CREATE INDEX IF NOT EXISTS idx_whoop_webhook_subscriptions_active ON whoop_webhook_subscriptions(is_active) WHERE is_active;

CREATE INDEX IF NOT EXISTS idx_user_health_baselines_email ON user_health_baselines(email);

-- Enable RLS
ALTER TABLE whoop_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE whoop_webhook_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_health_baselines ENABLE ROW LEVEL SECURITY;

-- RLS Policies for whoop_webhook_events
CREATE POLICY "Service role has full access to whoop_webhook_events"
  ON whoop_webhook_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can read their own whoop_webhook_events"
  ON whoop_webhook_events
  FOR SELECT
  TO authenticated
  USING (email = auth.jwt() ->> 'email');

-- RLS Policies for whoop_webhook_subscriptions
CREATE POLICY "Service role has full access to whoop_webhook_subscriptions"
  ON whoop_webhook_subscriptions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can read their own whoop_webhook_subscriptions"
  ON whoop_webhook_subscriptions
  FOR SELECT
  TO authenticated
  USING (email = auth.jwt() ->> 'email');

-- RLS Policies for user_health_baselines
CREATE POLICY "Service role has full access to user_health_baselines"
  ON user_health_baselines
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can read their own user_health_baselines"
  ON user_health_baselines
  FOR SELECT
  TO authenticated
  USING (email = auth.jwt() ->> 'email');

-- Function to update updated_at timestamp for whoop tables
CREATE OR REPLACE FUNCTION update_whoop_webhook_subscriptions_updated_at()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_user_health_baselines_updated_at()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
DROP TRIGGER IF EXISTS update_whoop_webhook_subscriptions_updated_at ON whoop_webhook_subscriptions;
CREATE TRIGGER update_whoop_webhook_subscriptions_updated_at
  BEFORE UPDATE ON whoop_webhook_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_whoop_webhook_subscriptions_updated_at();

DROP TRIGGER IF EXISTS update_user_health_baselines_updated_at ON user_health_baselines;
CREATE TRIGGER update_user_health_baselines_updated_at
  BEFORE UPDATE ON user_health_baselines
  FOR EACH ROW
  EXECUTE FUNCTION update_user_health_baselines_updated_at();

-- Grant permissions
GRANT SELECT ON whoop_webhook_events TO authenticated;
GRANT ALL ON whoop_webhook_events TO service_role;
GRANT SELECT ON whoop_webhook_subscriptions TO authenticated;
GRANT ALL ON whoop_webhook_subscriptions TO service_role;
GRANT SELECT ON user_health_baselines TO authenticated;
GRANT ALL ON user_health_baselines TO service_role;
