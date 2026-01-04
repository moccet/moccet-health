-- Migration: Oura Webhook Tables
-- Description: Tables to store Oura webhook events and subscription info

-- Table for storing incoming webhook events (for debugging/audit)
CREATE TABLE IF NOT EXISTS oura_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  oura_user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  data_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  process_result JSONB,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for tracking webhook subscriptions per user
CREATE TABLE IF NOT EXISTS oura_webhook_subscriptions (
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

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_oura_webhook_events_email ON oura_webhook_events(email);
CREATE INDEX IF NOT EXISTS idx_oura_webhook_events_oura_user_id ON oura_webhook_events(oura_user_id);
CREATE INDEX IF NOT EXISTS idx_oura_webhook_events_data_type ON oura_webhook_events(data_type);
CREATE INDEX IF NOT EXISTS idx_oura_webhook_events_received_at ON oura_webhook_events(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_oura_webhook_events_processed ON oura_webhook_events(processed) WHERE NOT processed;

CREATE INDEX IF NOT EXISTS idx_oura_webhook_subscriptions_email ON oura_webhook_subscriptions(email);
CREATE INDEX IF NOT EXISTS idx_oura_webhook_subscriptions_active ON oura_webhook_subscriptions(is_active) WHERE is_active;

-- Enable RLS
ALTER TABLE oura_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE oura_webhook_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for oura_webhook_events
-- Service role can do everything
CREATE POLICY "Service role has full access to oura_webhook_events"
  ON oura_webhook_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Users can only read their own events
CREATE POLICY "Users can read their own oura_webhook_events"
  ON oura_webhook_events
  FOR SELECT
  TO authenticated
  USING (email = auth.jwt() ->> 'email');

-- RLS Policies for oura_webhook_subscriptions
-- Service role can do everything
CREATE POLICY "Service role has full access to oura_webhook_subscriptions"
  ON oura_webhook_subscriptions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Users can only read their own subscriptions
CREATE POLICY "Users can read their own oura_webhook_subscriptions"
  ON oura_webhook_subscriptions
  FOR SELECT
  TO authenticated
  USING (email = auth.jwt() ->> 'email');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_oura_webhook_subscriptions_updated_at()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_oura_webhook_subscriptions_updated_at ON oura_webhook_subscriptions;
CREATE TRIGGER update_oura_webhook_subscriptions_updated_at
  BEFORE UPDATE ON oura_webhook_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_oura_webhook_subscriptions_updated_at();

-- Grant permissions
GRANT SELECT ON oura_webhook_events TO authenticated;
GRANT ALL ON oura_webhook_events TO service_role;
GRANT SELECT ON oura_webhook_subscriptions TO authenticated;
GRANT ALL ON oura_webhook_subscriptions TO service_role;
