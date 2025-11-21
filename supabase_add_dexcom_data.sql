-- Create table for storing Dexcom CGM data
CREATE TABLE IF NOT EXISTS dexcom_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  sync_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Estimated Glucose Values (EGV) - main glucose readings
  egv_data JSONB DEFAULT '[]'::jsonb,

  -- User events (meals, exercise, insulin, etc.)
  events_data JSONB DEFAULT '[]'::jsonb,

  -- Calibration data
  calibrations_data JSONB DEFAULT '[]'::jsonb,

  -- Statistics data (time in range, averages, etc.)
  statistics_data JSONB DEFAULT '{}'::jsonb,

  -- Full raw data from API for reference
  raw_data JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_dexcom_data_email ON dexcom_data(email);

-- Create index on sync_date for querying recent syncs
CREATE INDEX IF NOT EXISTS idx_dexcom_data_sync_date ON dexcom_data(sync_date DESC);

-- Create index on date range for querying specific periods
CREATE INDEX IF NOT EXISTS idx_dexcom_data_dates ON dexcom_data(start_date, end_date);

-- Create GIN index for JSON queries (useful for searching within glucose data)
CREATE INDEX IF NOT EXISTS idx_dexcom_data_egv_gin ON dexcom_data USING GIN (egv_data);
CREATE INDEX IF NOT EXISTS idx_dexcom_data_events_gin ON dexcom_data USING GIN (events_data);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_dexcom_data_updated_at
  BEFORE UPDATE ON dexcom_data
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment to table
COMMENT ON TABLE dexcom_data IS 'Stores synchronized Dexcom CGM data including glucose readings, events, calibrations, and statistics';

-- Add comments to columns
COMMENT ON COLUMN dexcom_data.email IS 'User email address';
COMMENT ON COLUMN dexcom_data.sync_date IS 'When this data was synced from Dexcom API';
COMMENT ON COLUMN dexcom_data.start_date IS 'Start date of the data range';
COMMENT ON COLUMN dexcom_data.end_date IS 'End date of the data range';
COMMENT ON COLUMN dexcom_data.egv_data IS 'Estimated Glucose Values (main glucose readings) from Dexcom API v2';
COMMENT ON COLUMN dexcom_data.events_data IS 'User events (meals, exercise, insulin, etc.)';
COMMENT ON COLUMN dexcom_data.calibrations_data IS 'CGM calibration records';
COMMENT ON COLUMN dexcom_data.statistics_data IS 'Glucose statistics (time in range, averages, standard deviation, etc.)';
COMMENT ON COLUMN dexcom_data.raw_data IS 'Complete raw response from Dexcom API for reference';
