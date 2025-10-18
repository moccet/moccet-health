-- Create waitlist_counter table
-- Run this SQL in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS waitlist_counter (
  id INTEGER PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 2848,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial counter value
INSERT INTO waitlist_counter (id, count)
VALUES (1, 2848)
ON CONFLICT (id) DO NOTHING;

-- Enable Row Level Security (RLS)
ALTER TABLE waitlist_counter ENABLE ROW LEVEL SECURITY;

-- Create policy to allow read access to everyone
CREATE POLICY "Allow public read access"
  ON waitlist_counter
  FOR SELECT
  TO public
  USING (true);

-- Create policy to allow update access to service role only
CREATE POLICY "Allow service role update"
  ON waitlist_counter
  FOR UPDATE
  TO service_role
  USING (true);

-- Create policy to allow insert access to service role only
CREATE POLICY "Allow service role insert"
  ON waitlist_counter
  FOR INSERT
  TO service_role
  WITH CHECK (true);
