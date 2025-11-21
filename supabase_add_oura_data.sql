-- Create table for storing Oura Ring data
CREATE TABLE IF NOT EXISTS oura_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  sync_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,

  -- Sleep data (array of daily sleep records)
  sleep_data JSONB DEFAULT '[]'::jsonb,

  -- Daily activity data (steps, calories, distance, etc.)
  activity_data JSONB DEFAULT '[]'::jsonb,

  -- Daily readiness scores
  readiness_data JSONB DEFAULT '[]'::jsonb,

  -- Heart rate data
  heart_rate_data JSONB DEFAULT '[]'::jsonb,

  -- Workout data
  workout_data JSONB DEFAULT '[]'::jsonb,

  -- Full raw data from API for reference
  raw_data JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_oura_data_email ON oura_data(email);

-- Create index on sync_date for querying recent syncs
CREATE INDEX IF NOT EXISTS idx_oura_data_sync_date ON oura_data(sync_date DESC);

-- Create index on date range for querying specific periods
CREATE INDEX IF NOT EXISTS idx_oura_data_dates ON oura_data(start_date, end_date);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_oura_data_updated_at
  BEFORE UPDATE ON oura_data
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment to table
COMMENT ON TABLE oura_data IS 'Stores synchronized Oura Ring health data including sleep, activity, readiness, heart rate, and workout data';

-- Add comments to columns
COMMENT ON COLUMN oura_data.email IS 'User email address';
COMMENT ON COLUMN oura_data.sync_date IS 'When this data was synced from Oura API';
COMMENT ON COLUMN oura_data.start_date IS 'Start date of the data range';
COMMENT ON COLUMN oura_data.end_date IS 'End date of the data range';
COMMENT ON COLUMN oura_data.sleep_data IS 'Daily sleep records from Oura API v2';
COMMENT ON COLUMN oura_data.activity_data IS 'Daily activity records (steps, calories, etc.)';
COMMENT ON COLUMN oura_data.readiness_data IS 'Daily readiness scores';
COMMENT ON COLUMN oura_data.heart_rate_data IS 'Heart rate measurements';
COMMENT ON COLUMN oura_data.workout_data IS 'Workout/exercise records';
COMMENT ON COLUMN oura_data.raw_data IS 'Complete raw response from Oura API for reference';
