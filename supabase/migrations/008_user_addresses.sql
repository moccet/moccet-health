-- User Addresses for One-Click Checkout
-- Migration: 008_user_addresses

-- User addresses table
CREATE TABLE IF NOT EXISTS user_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  state_province TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'US',
  phone TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_user_addresses_email ON user_addresses(email);
CREATE INDEX idx_user_addresses_default ON user_addresses(email, is_default) WHERE is_default = true;

-- RLS Policies
ALTER TABLE user_addresses ENABLE ROW LEVEL SECURITY;

-- Users can read their own addresses
CREATE POLICY "Users can read own addresses"
  ON user_addresses
  FOR SELECT
  USING (true);

-- Users can insert their own addresses
CREATE POLICY "Users can insert own addresses"
  ON user_addresses
  FOR INSERT
  WITH CHECK (true);

-- Users can update their own addresses
CREATE POLICY "Users can update own addresses"
  ON user_addresses
  FOR UPDATE
  USING (true);

-- Users can delete their own addresses
CREATE POLICY "Users can delete own addresses"
  ON user_addresses
  FOR DELETE
  USING (true);

-- Function to ensure only one default address per user
CREATE OR REPLACE FUNCTION ensure_single_default_address()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE user_addresses
    SET is_default = false
    WHERE email = NEW.email
      AND id != NEW.id
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce single default address
CREATE TRIGGER enforce_single_default_address
  BEFORE INSERT OR UPDATE ON user_addresses
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_default_address();

-- Update updated_at timestamp
CREATE TRIGGER update_user_addresses_updated_at
  BEFORE UPDATE ON user_addresses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE user_addresses IS 'Stores user shipping addresses for one-click checkout';
