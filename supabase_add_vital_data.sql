-- Create table for storing Vital unified health data
CREATE TABLE IF NOT EXISTS vital_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  vital_user_id TEXT NOT NULL,
  sync_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,

  -- Sleep data from various providers
  sleep_data JSONB DEFAULT '{}'::jsonb,

  -- Activity data (steps, calories, distance, etc.)
  activity_data JSONB DEFAULT '{}'::jsonb,

  -- Body measurements (weight, body fat, BMI, etc.)
  body_data JSONB DEFAULT '{}'::jsonb,

  -- Workouts and exercises
  workouts_data JSONB DEFAULT '{}'::jsonb,

  -- Glucose data (from CGMs like Dexcom, Libre via Vital)
  glucose_data JSONB DEFAULT '{}'::jsonb,

  -- User profile from Vital
  user_profile JSONB DEFAULT '{}'::jsonb,

  -- List of connected provider sources
  connected_providers JSONB DEFAULT '[]'::jsonb,

  -- Full raw data from API for reference
  raw_data JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table for Vital webhook events
CREATE TABLE IF NOT EXISTS vital_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  user_id TEXT NOT NULL,
  provider TEXT,
  data JSONB NOT NULL,
  received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes on vital_data
CREATE INDEX IF NOT EXISTS idx_vital_data_email ON vital_data(email);
CREATE INDEX IF NOT EXISTS idx_vital_data_user_id ON vital_data(vital_user_id);
CREATE INDEX IF NOT EXISTS idx_vital_data_sync_date ON vital_data(sync_date DESC);
CREATE INDEX IF NOT EXISTS idx_vital_data_dates ON vital_data(start_date, end_date);

-- Create GIN indexes for JSON queries
CREATE INDEX IF NOT EXISTS idx_vital_data_sleep_gin ON vital_data USING GIN (sleep_data);
CREATE INDEX IF NOT EXISTS idx_vital_data_activity_gin ON vital_data USING GIN (activity_data);
CREATE INDEX IF NOT EXISTS idx_vital_data_glucose_gin ON vital_data USING GIN (glucose_data);
CREATE INDEX IF NOT EXISTS idx_vital_data_providers_gin ON vital_data USING GIN (connected_providers);

-- Create indexes on vital_webhook_events
CREATE INDEX IF NOT EXISTS idx_vital_webhook_event_type ON vital_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_vital_webhook_user_id ON vital_webhook_events(user_id);
CREATE INDEX IF NOT EXISTS idx_vital_webhook_received_at ON vital_webhook_events(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_vital_webhook_processed ON vital_webhook_events(processed);

-- Create updated_at trigger for vital_data
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_vital_data_updated_at
  BEFORE UPDATE ON vital_data
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments to vital_data table
COMMENT ON TABLE vital_data IS 'Stores unified health data from Vital API (supports Dexcom, Libre, Fitbit, Apple Health, WHOOP, etc.)';
COMMENT ON COLUMN vital_data.email IS 'User email address';
COMMENT ON COLUMN vital_data.vital_user_id IS 'Unique user ID in Vital system';
COMMENT ON COLUMN vital_data.sync_date IS 'When this data was synced from Vital API';
COMMENT ON COLUMN vital_data.start_date IS 'Start date of the data range';
COMMENT ON COLUMN vital_data.end_date IS 'End date of the data range';
COMMENT ON COLUMN vital_data.sleep_data IS 'Sleep data from various providers aggregated by Vital';
COMMENT ON COLUMN vital_data.activity_data IS 'Daily activity data (steps, calories, distance, active minutes)';
COMMENT ON COLUMN vital_data.body_data IS 'Body measurements (weight, body fat percentage, BMI, etc.)';
COMMENT ON COLUMN vital_data.workouts_data IS 'Workout and exercise sessions';
COMMENT ON COLUMN vital_data.glucose_data IS 'Continuous glucose monitoring data';
COMMENT ON COLUMN vital_data.user_profile IS 'User profile information from Vital';
COMMENT ON COLUMN vital_data.connected_providers IS 'Array of connected data sources (e.g., ["fitbit", "dexcom", "apple_health"])';
COMMENT ON COLUMN vital_data.raw_data IS 'Complete raw response from Vital API for reference';

-- Add comments to vital_webhook_events table
COMMENT ON TABLE vital_webhook_events IS 'Stores webhook events from Vital API for real-time data updates';
COMMENT ON COLUMN vital_webhook_events.event_type IS 'Type of webhook event (e.g., daily.data.sleep.created)';
COMMENT ON COLUMN vital_webhook_events.user_id IS 'Vital user ID associated with the event';
COMMENT ON COLUMN vital_webhook_events.provider IS 'Data provider that triggered the event';
COMMENT ON COLUMN vital_webhook_events.data IS 'Event payload data';
COMMENT ON COLUMN vital_webhook_events.received_at IS 'When the webhook was received';
COMMENT ON COLUMN vital_webhook_events.processed IS 'Whether the webhook event has been processed';
