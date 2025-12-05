-- Create blog posts cache table
CREATE TABLE IF NOT EXISTS blog_posts_cache (
  id BIGSERIAL PRIMARY KEY,
  posts JSONB NOT NULL,
  cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on cached_at for efficient sorting
CREATE INDEX IF NOT EXISTS idx_blog_posts_cache_cached_at ON blog_posts_cache(cached_at DESC);

-- Add RLS policies (allow public read access)
ALTER TABLE blog_posts_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to blog posts cache"
  ON blog_posts_cache
  FOR SELECT
  TO PUBLIC
  USING (true);

CREATE POLICY "Allow service role to insert blog posts cache"
  ON blog_posts_cache
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Add comment
COMMENT ON TABLE blog_posts_cache IS 'Caches Substack blog posts to improve loading performance';
