-- Sage Food Logs Table
-- Stores user food log entries for the Sage nutrition tracking feature

CREATE TABLE IF NOT EXISTS sage_food_logs (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  name TEXT NOT NULL,
  brand TEXT,

  -- Macros (stored flat for easier querying)
  calories NUMERIC NOT NULL DEFAULT 0,
  protein NUMERIC NOT NULL DEFAULT 0,
  carbs NUMERIC NOT NULL DEFAULT 0,
  fat NUMERIC NOT NULL DEFAULT 0,
  fiber NUMERIC DEFAULT 0,

  -- Serving info
  serving_size NUMERIC NOT NULL DEFAULT 1,
  serving_unit TEXT NOT NULL DEFAULT 'serving',
  servings_consumed NUMERIC NOT NULL DEFAULT 1,

  -- Source and identification
  source TEXT NOT NULL DEFAULT 'manual',
  barcode TEXT,
  image_url TEXT,
  database_id TEXT,
  database_source TEXT,

  -- Timing
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  meal_type TEXT NOT NULL DEFAULT 'snack',

  -- User preferences
  is_favorite BOOLEAN DEFAULT FALSE,

  -- Additional nutrients
  sugar NUMERIC,
  sodium NUMERIC,
  cholesterol NUMERIC,
  saturated_fat NUMERIC,
  trans_fat NUMERIC,
  potassium NUMERIC,
  vitamin_a NUMERIC,
  vitamin_c NUMERIC,
  calcium NUMERIC,
  iron NUMERIC,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_sage_food_logs_user_email ON sage_food_logs(user_email);
CREATE INDEX IF NOT EXISTS idx_sage_food_logs_logged_at ON sage_food_logs(logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_sage_food_logs_user_date ON sage_food_logs(user_email, logged_at);
CREATE INDEX IF NOT EXISTS idx_sage_food_logs_meal_type ON sage_food_logs(user_email, meal_type);

-- Enable RLS
ALTER TABLE sage_food_logs ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can only access their own food logs
CREATE POLICY "Users can view own food logs" ON sage_food_logs
  FOR SELECT USING (user_email = current_setting('request.jwt.claims', true)::json->>'email');

CREATE POLICY "Users can insert own food logs" ON sage_food_logs
  FOR INSERT WITH CHECK (user_email = current_setting('request.jwt.claims', true)::json->>'email');

CREATE POLICY "Users can update own food logs" ON sage_food_logs
  FOR UPDATE USING (user_email = current_setting('request.jwt.claims', true)::json->>'email');

CREATE POLICY "Users can delete own food logs" ON sage_food_logs
  FOR DELETE USING (user_email = current_setting('request.jwt.claims', true)::json->>'email');

-- Service role bypass for backend operations
CREATE POLICY "Service role full access" ON sage_food_logs
  FOR ALL USING (auth.role() = 'service_role');
