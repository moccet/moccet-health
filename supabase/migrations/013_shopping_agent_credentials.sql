-- Shopping Agent: Encrypted Credentials and Purchase History
-- This migration creates tables for autonomous shopping capabilities

-- ============================================================================
-- USER PAYMENT CREDENTIALS (Encrypted)
-- ============================================================================
-- Stores encrypted payment card details for autonomous purchases
-- Uses AES-256-GCM encryption at application layer

CREATE TABLE IF NOT EXISTS user_payment_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,

  -- Card details (all encrypted at application layer)
  encrypted_card_number TEXT NOT NULL,
  encrypted_expiry TEXT NOT NULL,
  encrypted_cvv TEXT NOT NULL,
  card_last_four TEXT NOT NULL, -- For display only (not encrypted)
  card_brand TEXT, -- 'visa', 'mastercard', 'amex', 'discover'
  cardholder_name TEXT,
  billing_address_id UUID REFERENCES user_addresses(id),

  -- Encryption metadata
  encryption_key_id TEXT NOT NULL, -- Reference to encryption key
  encryption_version INTEGER DEFAULT 1,

  -- Status
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- EXTERNAL SITE CREDENTIALS (Encrypted)
-- ============================================================================
-- Stores encrypted login credentials for Amazon, Healf, iHerb, etc.

CREATE TABLE IF NOT EXISTS external_site_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  site_name TEXT NOT NULL, -- 'amazon', 'healf', 'iherb', 'vitacost', etc.

  -- Credentials (encrypted at application layer)
  encrypted_email TEXT NOT NULL, -- Login email for the site
  encrypted_password TEXT NOT NULL,

  -- 2FA settings (encrypted)
  totp_secret_encrypted TEXT, -- For sites with TOTP 2FA
  backup_codes_encrypted TEXT, -- JSON array of backup codes
  phone_for_sms TEXT, -- For SMS 2FA (last 4 digits visible)

  -- Session management
  last_session_cookies_encrypted TEXT, -- Persist session for faster auth
  session_expires_at TIMESTAMPTZ,

  -- Encryption metadata
  encryption_key_id TEXT NOT NULL,
  encryption_version INTEGER DEFAULT 1,

  -- Status
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  login_failures INTEGER DEFAULT 0,
  last_login_failure_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_site_credential UNIQUE (user_email, site_name)
);

-- ============================================================================
-- SHOPPING AGENT TASKS
-- ============================================================================
-- Tracks shopping tasks initiated by the supplement agent

CREATE TABLE IF NOT EXISTS shopping_agent_tasks (
  id TEXT PRIMARY KEY,
  parent_task_id TEXT REFERENCES agent_tasks(id), -- Link to supplement task
  user_email TEXT NOT NULL,

  -- Task status
  status TEXT NOT NULL DEFAULT 'pending',

  -- Products to purchase (from supplement recommendations)
  products JSONB NOT NULL, -- Array of {name, dosage, quantity, maxPrice, priority}

  -- Search phase results
  search_results JSONB, -- {site: {products: [{name, price, url, rating, inStock}]}}
  search_completed_at TIMESTAMPTZ,

  -- Price comparison results
  price_comparison JSONB, -- Best options per product across sites
  recommended_site TEXT, -- Site with best overall value

  -- User approval
  selected_products JSONB, -- User-approved products with quantities
  approved_at TIMESTAMPTZ,
  approved_total DECIMAL(10,2),

  -- Cart state
  cart_snapshot JSONB, -- Cart state before checkout
  cart_verified_at TIMESTAMPTZ,

  -- Checkout execution
  target_site TEXT, -- Which site we're purchasing from
  checkout_started_at TIMESTAMPTZ,
  checkout_completed_at TIMESTAMPTZ,

  -- Results
  order_confirmation_number TEXT,
  order_confirmation_url TEXT,
  order_screenshot_url TEXT, -- S3/storage URL for confirmation screenshot
  total_spent DECIMAL(10,2),
  shipping_cost DECIMAL(10,2),
  tax_amount DECIMAL(10,2),
  estimated_delivery TEXT,

  -- Error handling
  error_type TEXT, -- 'captcha', 'login_failed', '2fa_required', 'out_of_stock', 'price_changed', 'payment_failed'
  error_details JSONB,
  error_screenshot_url TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,

  -- Debug/audit
  execution_log JSONB, -- Array of {timestamp, action, result, screenshot_url}

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_shopping_status CHECK (status IN (
    'pending',           -- Task created, not started
    'searching',         -- Searching products on sites
    'comparing_prices',  -- Aggregating and comparing results
    'awaiting_approval', -- Waiting for user to approve products/total
    'adding_to_cart',    -- Adding items to site cart
    'verifying_cart',    -- Verifying cart contents match selection
    'checking_out',      -- In checkout flow
    'awaiting_2fa',      -- Paused, waiting for 2FA code from user
    'processing_payment',-- Payment being processed
    'completed',         -- Order placed successfully
    'failed',            -- Task failed (see error_type)
    'cancelled'          -- User cancelled
  ))
);

-- ============================================================================
-- EXTERNAL PURCHASE HISTORY
-- ============================================================================
-- Records of purchases made on external sites

CREATE TABLE IF NOT EXISTS external_purchase_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  shopping_task_id TEXT REFERENCES shopping_agent_tasks(id),

  -- Site and order details
  site_name TEXT NOT NULL,
  order_number TEXT NOT NULL,
  order_url TEXT,

  -- Items purchased
  items JSONB NOT NULL, -- Array of {name, quantity, unitPrice, totalPrice, url}

  -- Costs
  subtotal DECIMAL(10,2),
  shipping DECIMAL(10,2),
  tax DECIMAL(10,2),
  discount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2),
  currency TEXT DEFAULT 'USD',

  -- Shipping
  shipping_address JSONB, -- Snapshot of address used
  shipping_method TEXT,

  -- Status tracking
  order_status TEXT DEFAULT 'placed', -- 'placed', 'confirmed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 'returned'
  tracking_number TEXT,
  tracking_url TEXT,
  carrier TEXT, -- 'ups', 'fedex', 'usps', 'dhl', etc.
  estimated_delivery TIMESTAMPTZ,
  actual_delivery TIMESTAMPTZ,

  -- Status check history
  last_status_check TIMESTAMPTZ,
  status_history JSONB, -- Array of {timestamp, status, details}

  -- Receipt/confirmation
  confirmation_screenshot_url TEXT,
  receipt_url TEXT,

  purchase_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Payment credentials
CREATE INDEX IF NOT EXISTS idx_payment_creds_email ON user_payment_credentials(user_email);
CREATE INDEX IF NOT EXISTS idx_payment_creds_default ON user_payment_credentials(user_email, is_default) WHERE is_default = true;

-- Site credentials
CREATE INDEX IF NOT EXISTS idx_site_creds_email ON external_site_credentials(user_email);
CREATE INDEX IF NOT EXISTS idx_site_creds_site ON external_site_credentials(user_email, site_name);

-- Shopping tasks
CREATE INDEX IF NOT EXISTS idx_shopping_tasks_email ON shopping_agent_tasks(user_email);
CREATE INDEX IF NOT EXISTS idx_shopping_tasks_status ON shopping_agent_tasks(status);
CREATE INDEX IF NOT EXISTS idx_shopping_tasks_parent ON shopping_agent_tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_shopping_tasks_created ON shopping_agent_tasks(created_at DESC);

-- Purchase history
CREATE INDEX IF NOT EXISTS idx_external_purchases_email ON external_purchase_history(user_email);
CREATE INDEX IF NOT EXISTS idx_external_purchases_site ON external_purchase_history(site_name);
CREATE INDEX IF NOT EXISTS idx_external_purchases_order ON external_purchase_history(order_number);
CREATE INDEX IF NOT EXISTS idx_external_purchases_status ON external_purchase_history(order_status);
CREATE INDEX IF NOT EXISTS idx_external_purchases_date ON external_purchase_history(purchase_date DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE user_payment_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_site_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_purchase_history ENABLE ROW LEVEL SECURITY;

-- Service role has full access (backend handles auth)
CREATE POLICY "Service role full access on payment_credentials"
  ON user_payment_credentials FOR ALL
  USING (true);

CREATE POLICY "Service role full access on site_credentials"
  ON external_site_credentials FOR ALL
  USING (true);

CREATE POLICY "Service role full access on shopping_tasks"
  ON shopping_agent_tasks FOR ALL
  USING (true);

CREATE POLICY "Service role full access on purchase_history"
  ON external_purchase_history FOR ALL
  USING (true);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_shopping_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_payment_creds_updated_at
  BEFORE UPDATE ON user_payment_credentials
  FOR EACH ROW EXECUTE FUNCTION update_shopping_updated_at();

CREATE TRIGGER trigger_site_creds_updated_at
  BEFORE UPDATE ON external_site_credentials
  FOR EACH ROW EXECUTE FUNCTION update_shopping_updated_at();

CREATE TRIGGER trigger_shopping_tasks_updated_at
  BEFORE UPDATE ON shopping_agent_tasks
  FOR EACH ROW EXECUTE FUNCTION update_shopping_updated_at();

CREATE TRIGGER trigger_purchase_history_updated_at
  BEFORE UPDATE ON external_purchase_history
  FOR EACH ROW EXECUTE FUNCTION update_shopping_updated_at();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE user_payment_credentials IS 'Encrypted payment cards for autonomous shopping';
COMMENT ON TABLE external_site_credentials IS 'Encrypted login credentials for e-commerce sites';
COMMENT ON TABLE shopping_agent_tasks IS 'Shopping tasks triggered by supplement recommendations';
COMMENT ON TABLE external_purchase_history IS 'History of purchases made on external sites';

COMMENT ON COLUMN user_payment_credentials.encryption_key_id IS 'Reference to AWS KMS or env key used for encryption';
COMMENT ON COLUMN external_site_credentials.totp_secret_encrypted IS 'Encrypted TOTP secret for sites using authenticator apps';
COMMENT ON COLUMN shopping_agent_tasks.execution_log IS 'Audit trail of all actions taken during task execution';
