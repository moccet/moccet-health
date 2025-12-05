-- Create a generic cache_store table for storing key-value pairs
CREATE TABLE IF NOT EXISTS cache_store (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on updated_at for efficient cache invalidation
CREATE INDEX IF NOT EXISTS idx_cache_store_updated_at ON cache_store(updated_at DESC);

-- Add RLS policies (allow public read access for caching)
ALTER TABLE cache_store ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then recreate them
DO $$
BEGIN
  DROP POLICY IF EXISTS "Allow public read access to cache store" ON cache_store;
  DROP POLICY IF EXISTS "Allow anon/authenticated to upsert cache" ON cache_store;
  DROP POLICY IF EXISTS "Allow anon/authenticated to update cache" ON cache_store;
END $$;

-- Create policies
CREATE POLICY "Allow public read access to cache store"
  ON cache_store
  FOR SELECT
  TO PUBLIC
  USING (true);

CREATE POLICY "Allow anon/authenticated to upsert cache"
  ON cache_store
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anon/authenticated to update cache"
  ON cache_store
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Add comment
COMMENT ON TABLE cache_store IS 'Generic key-value cache store for application data';
