-- ============================================================================
-- SUPPLEMENT E-COMMERCE SYSTEM
-- Migration: 006_supplement_ecommerce
-- Description: Complete database schema for direct supplement sales with
--              consistent pricing across AI-generated recommendations
-- ============================================================================

-- ============================================================================
-- PRODUCT CATALOG TABLES
-- ============================================================================

-- Main product catalog table
CREATE TABLE IF NOT EXISTS supplement_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Product identification
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  brand TEXT NOT NULL,

  -- Product specifications
  dosage_form TEXT, -- 'Capsule', 'Softgel', 'Powder', 'Liquid', 'Tablet'
  strength TEXT, -- '5000 IU', '1000mg', '5g'
  quantity INTEGER NOT NULL, -- Number of servings/doses in package
  unit TEXT, -- 'capsules', 'softgels', 'grams', 'servings'

  -- Pricing (all in USD)
  wholesale_cost DECIMAL(10,2) NOT NULL,
  retail_price DECIMAL(10,2) NOT NULL,
  margin DECIMAL(10,2) GENERATED ALWAYS AS (retail_price - wholesale_cost) STORED,
  margin_percent DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE
      WHEN wholesale_cost > 0 THEN ((retail_price - wholesale_cost) / wholesale_cost * 100)
      ELSE 0
    END
  ) STORED,

  -- Product content
  description TEXT,
  benefits TEXT[], -- Array of key benefits
  ingredients TEXT, -- Full ingredient list
  directions TEXT, -- Usage directions
  warnings TEXT, -- Warnings and contraindications

  -- Media
  image_url TEXT,
  additional_images TEXT[], -- Array of additional product images

  -- Inventory
  stock_level INTEGER NOT NULL DEFAULT 0,
  reorder_point INTEGER NOT NULL DEFAULT 30,
  reorder_quantity INTEGER NOT NULL DEFAULT 100,
  low_stock_alert BOOLEAN GENERATED ALWAYS AS (stock_level <= reorder_point) STORED,

  -- Supplier information
  supplier_name TEXT,
  supplier_sku TEXT,
  supplier_contact TEXT,

  -- Quality & Certifications
  third_party_tested BOOLEAN DEFAULT false,
  certifications TEXT[], -- ['NSF Certified', 'USP Verified', 'GMP Certified', etc.]
  expiration_tracking BOOLEAN DEFAULT false,

  -- Status
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT,
  updated_by TEXT,

  -- Constraints
  CHECK (wholesale_cost >= 0),
  CHECK (retail_price >= wholesale_cost),
  CHECK (stock_level >= 0),
  CHECK (reorder_point >= 0),
  CHECK (quantity > 0)
);

-- Indexes for supplement_products
CREATE INDEX idx_supplement_products_sku ON supplement_products(sku);
CREATE INDEX idx_supplement_products_name ON supplement_products(name);
CREATE INDEX idx_supplement_products_brand ON supplement_products(brand);
CREATE INDEX idx_supplement_products_active ON supplement_products(is_active);
CREATE INDEX idx_supplement_products_low_stock ON supplement_products(low_stock_alert) WHERE low_stock_alert = true;

-- ============================================================================
-- SUPPLEMENT NAME MAPPING TABLE
-- Maps AI-generated supplement names to actual product SKUs
-- Handles variations in naming (e.g., "Vitamin D3", "D3", "Cholecalciferol")
-- ============================================================================

CREATE TABLE IF NOT EXISTS supplement_name_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- AI recommendation details
  recommendation_name TEXT NOT NULL, -- What AI generates: "Vitamin D3"
  recommendation_name_variations TEXT[], -- Variations: ["D3", "Vitamin D-3", "Cholecalciferol"]
  recommendation_dosage_range TEXT, -- "2000-5000 IU" or "1000-2000mg"

  -- Product mapping
  product_id UUID NOT NULL REFERENCES supplement_products(id) ON DELETE CASCADE,
  is_primary_match BOOLEAN DEFAULT true, -- Primary product for this supplement
  match_score DECIMAL(3,2) DEFAULT 1.0, -- How well product matches (0.0-1.0)

  -- Dosage matching rules
  min_dosage_match TEXT, -- Minimum dosage this product satisfies
  max_dosage_match TEXT, -- Maximum dosage this product satisfies
  dosage_unit TEXT, -- 'IU', 'mg', 'g', 'mcg'

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT,

  -- Constraints
  CHECK (match_score >= 0 AND match_score <= 1),
  UNIQUE(recommendation_name, product_id)
);

-- Indexes for supplement_name_mappings
CREATE INDEX idx_supp_mappings_rec_name ON supplement_name_mappings(recommendation_name);
CREATE INDEX idx_supp_mappings_product ON supplement_name_mappings(product_id);
CREATE INDEX idx_supp_mappings_primary ON supplement_name_mappings(is_primary_match) WHERE is_primary_match = true;

-- GIN index for array searching (variations)
CREATE INDEX idx_supp_mappings_variations ON supplement_name_mappings USING GIN(recommendation_name_variations);

-- ============================================================================
-- SHOPPING CART TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS shopping_carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User identification
  user_email TEXT NOT NULL,
  session_id TEXT, -- For anonymous carts
  plan_code TEXT, -- Which forge plan triggered this cart

  -- Cart metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days'),

  -- Status
  is_active BOOLEAN DEFAULT true,
  converted_to_order_id UUID, -- Reference to order if cart was converted

  -- Constraints
  CHECK (user_email IS NOT NULL OR session_id IS NOT NULL)
);

-- Indexes for shopping_carts
CREATE INDEX idx_shopping_carts_email ON shopping_carts(user_email);
CREATE INDEX idx_shopping_carts_session ON shopping_carts(session_id);
CREATE INDEX idx_shopping_carts_active ON shopping_carts(is_active) WHERE is_active = true;

-- Cart items table
CREATE TABLE IF NOT EXISTS cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  cart_id UUID NOT NULL REFERENCES shopping_carts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES supplement_products(id) ON DELETE CASCADE,

  -- Item details
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL, -- Price snapshot at time of add to cart

  -- Metadata
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  recommendation_context JSONB, -- Store the AI recommendation that led to this

  -- Constraints
  CHECK (quantity > 0),
  CHECK (unit_price >= 0),
  UNIQUE(cart_id, product_id) -- Prevent duplicate products in same cart
);

-- Indexes for cart_items
CREATE INDEX idx_cart_items_cart ON cart_items(cart_id);
CREATE INDEX idx_cart_items_product ON cart_items(product_id);

-- ============================================================================
-- ORDERS TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Order identification
  order_number TEXT UNIQUE NOT NULL, -- Human-readable: ORD-20250128-001

  -- User information
  user_email TEXT NOT NULL,
  plan_code TEXT, -- Which forge plan led to this purchase

  -- Pricing
  subtotal DECIMAL(10,2) NOT NULL,
  shipping_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,

  -- Payment
  payment_method TEXT, -- 'stripe', 'paypal', etc.
  payment_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'paid', 'failed', 'refunded'
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_charge_id TEXT,
  paid_at TIMESTAMP WITH TIME ZONE,

  -- Fulfillment
  fulfillment_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'shipped', 'delivered', 'cancelled'
  tracking_number TEXT,
  tracking_carrier TEXT, -- 'USPS', 'FedEx', 'UPS'
  shipped_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT, -- Internal notes
  customer_notes TEXT, -- Customer's order notes

  -- Constraints
  CHECK (subtotal >= 0),
  CHECK (shipping_cost >= 0),
  CHECK (tax_amount >= 0),
  CHECK (discount_amount >= 0),
  CHECK (total_amount >= 0),
  CHECK (payment_status IN ('pending', 'processing', 'paid', 'failed', 'refunded')),
  CHECK (fulfillment_status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'))
);

-- Indexes for orders
CREATE INDEX idx_orders_email ON orders(user_email);
CREATE INDEX idx_orders_number ON orders(order_number);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_fulfillment_status ON orders(fulfillment_status);
CREATE INDEX idx_orders_stripe_payment ON orders(stripe_payment_intent_id);
CREATE INDEX idx_orders_created ON orders(created_at DESC);

-- Order items table
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES supplement_products(id),

  -- Item details (snapshot at time of purchase)
  product_sku TEXT NOT NULL, -- SKU snapshot
  product_name TEXT NOT NULL, -- Name snapshot
  product_brand TEXT NOT NULL, -- Brand snapshot
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL, -- Price at time of purchase
  line_total DECIMAL(10,2) NOT NULL, -- quantity * unit_price

  -- AI recommendation that led to this purchase
  recommendation_context JSONB,

  -- Constraints
  CHECK (quantity > 0),
  CHECK (unit_price >= 0),
  CHECK (line_total >= 0)
);

-- Indexes for order_items
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

-- ============================================================================
-- SHIPPING ADDRESSES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS shipping_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User
  user_email TEXT NOT NULL,
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL, -- If address was used for an order

  -- Address details
  full_name TEXT NOT NULL,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  state_province TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'US',

  -- Contact
  phone TEXT,

  -- Preferences
  is_default BOOLEAN DEFAULT false,
  address_type TEXT DEFAULT 'shipping', -- 'shipping', 'billing', 'both'

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for shipping_addresses
CREATE INDEX idx_shipping_addresses_email ON shipping_addresses(user_email);
CREATE INDEX idx_shipping_addresses_order ON shipping_addresses(order_id);
CREATE INDEX idx_shipping_addresses_default ON shipping_addresses(is_default) WHERE is_default = true;

-- ============================================================================
-- INVENTORY TRANSACTIONS TABLE
-- Track all inventory movements
-- ============================================================================

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Product reference
  product_id UUID NOT NULL REFERENCES supplement_products(id) ON DELETE CASCADE,

  -- Transaction details
  transaction_type TEXT NOT NULL, -- 'sale', 'restock', 'adjustment', 'return', 'damage'
  quantity_change INTEGER NOT NULL, -- Negative for sales, positive for restocks
  quantity_before INTEGER NOT NULL,
  quantity_after INTEGER NOT NULL,

  -- References
  order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
  order_item_id UUID REFERENCES order_items(id) ON DELETE SET NULL,

  -- Metadata
  transaction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT,
  created_by TEXT, -- Admin user who made adjustment

  -- Constraints
  CHECK (transaction_type IN ('sale', 'restock', 'adjustment', 'return', 'damage', 'expiration')),
  CHECK (quantity_after >= 0)
);

-- Indexes for inventory_transactions
CREATE INDEX idx_inventory_trans_product ON inventory_transactions(product_id);
CREATE INDEX idx_inventory_trans_order ON inventory_transactions(order_id);
CREATE INDEX idx_inventory_trans_date ON inventory_transactions(transaction_date DESC);
CREATE INDEX idx_inventory_trans_type ON inventory_transactions(transaction_type);

-- ============================================================================
-- PRICE HISTORY TABLE
-- Track all price changes for auditing and consistency
-- ============================================================================

CREATE TABLE IF NOT EXISTS price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Product reference
  product_id UUID NOT NULL REFERENCES supplement_products(id) ON DELETE CASCADE,

  -- Price changes
  old_wholesale_cost DECIMAL(10,2),
  new_wholesale_cost DECIMAL(10,2),
  old_retail_price DECIMAL(10,2),
  new_retail_price DECIMAL(10,2),

  -- Margin calculations
  old_margin DECIMAL(10,2),
  new_margin DECIMAL(10,2),
  margin_change DECIMAL(10,2),

  -- Change metadata
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  changed_by TEXT,
  reason TEXT, -- Why the price changed

  -- Constraints
  CHECK (new_wholesale_cost >= 0),
  CHECK (new_retail_price >= new_wholesale_cost)
);

-- Indexes for price_history
CREATE INDEX idx_price_history_product ON price_history(product_id);
CREATE INDEX idx_price_history_date ON price_history(changed_at DESC);

-- ============================================================================
-- DISCOUNT CODES TABLE (Optional - for future use)
-- ============================================================================

CREATE TABLE IF NOT EXISTS discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Code details
  code TEXT UNIQUE NOT NULL,
  description TEXT,

  -- Discount type
  discount_type TEXT NOT NULL, -- 'percentage', 'fixed_amount'
  discount_value DECIMAL(10,2) NOT NULL, -- 15 for 15% or 15.00 for $15 off

  -- Constraints
  min_purchase_amount DECIMAL(10,2) DEFAULT 0,
  max_discount_amount DECIMAL(10,2), -- Cap for percentage discounts

  -- Usage limits
  usage_limit INTEGER, -- Total times code can be used
  usage_count INTEGER DEFAULT 0,
  per_user_limit INTEGER DEFAULT 1,

  -- Validity
  valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  valid_until TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT,

  -- Constraints
  CHECK (discount_type IN ('percentage', 'fixed_amount')),
  CHECK (discount_value > 0),
  CHECK (
    (discount_type = 'percentage' AND discount_value <= 100) OR
    discount_type = 'fixed_amount'
  )
);

-- Indexes for discount_codes
CREATE INDEX idx_discount_codes_code ON discount_codes(code);
CREATE INDEX idx_discount_codes_active ON discount_codes(is_active) WHERE is_active = true;

-- ============================================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_supplement_products_updated_at BEFORE UPDATE ON supplement_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_supplement_name_mappings_updated_at BEFORE UPDATE ON supplement_name_mappings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shopping_carts_updated_at BEFORE UPDATE ON shopping_carts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shipping_addresses_updated_at BEFORE UPDATE ON shipping_addresses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-generate order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
                        LPAD(NEXTVAL('order_number_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create sequence for order numbers
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1;

CREATE TRIGGER set_order_number BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION generate_order_number();

-- Auto-record inventory transactions on order creation
CREATE OR REPLACE FUNCTION record_inventory_transaction()
RETURNS TRIGGER AS $$
BEGIN
  -- When order item is created, record inventory transaction
  IF TG_OP = 'INSERT' THEN
    INSERT INTO inventory_transactions (
      product_id,
      transaction_type,
      quantity_change,
      quantity_before,
      quantity_after,
      order_id,
      order_item_id,
      notes
    )
    SELECT
      NEW.product_id,
      'sale',
      -NEW.quantity,
      sp.stock_level,
      sp.stock_level - NEW.quantity,
      NEW.order_id,
      NEW.id,
      'Sold via order ' || o.order_number
    FROM supplement_products sp
    JOIN orders o ON o.id = NEW.order_id
    WHERE sp.id = NEW.product_id;

    -- Update product stock level
    UPDATE supplement_products
    SET stock_level = stock_level - NEW.quantity
    WHERE id = NEW.product_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER record_sale_transaction AFTER INSERT ON order_items
  FOR EACH ROW EXECUTE FUNCTION record_inventory_transaction();

-- Auto-record price changes
CREATE OR REPLACE FUNCTION record_price_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.wholesale_cost != NEW.wholesale_cost OR OLD.retail_price != NEW.retail_price THEN
    INSERT INTO price_history (
      product_id,
      old_wholesale_cost,
      new_wholesale_cost,
      old_retail_price,
      new_retail_price,
      old_margin,
      new_margin,
      margin_change,
      changed_by,
      reason
    ) VALUES (
      NEW.id,
      OLD.wholesale_cost,
      NEW.wholesale_cost,
      OLD.retail_price,
      NEW.retail_price,
      OLD.retail_price - OLD.wholesale_cost,
      NEW.retail_price - NEW.wholesale_cost,
      (NEW.retail_price - NEW.wholesale_cost) - (OLD.retail_price - OLD.wholesale_cost),
      NEW.updated_by,
      'Price update'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER track_price_changes AFTER UPDATE ON supplement_products
  FOR EACH ROW EXECUTE FUNCTION record_price_change();

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View: Active products with inventory status
CREATE OR REPLACE VIEW v_products_inventory AS
SELECT
  sp.*,
  CASE
    WHEN sp.stock_level = 0 THEN 'out_of_stock'
    WHEN sp.stock_level <= sp.reorder_point THEN 'low_stock'
    ELSE 'in_stock'
  END as inventory_status,
  COUNT(DISTINCT oi.order_id) as total_orders,
  COALESCE(SUM(oi.quantity), 0) as total_units_sold,
  COALESCE(SUM(oi.line_total), 0) as total_revenue
FROM supplement_products sp
LEFT JOIN order_items oi ON oi.product_id = sp.id
WHERE sp.is_active = true
GROUP BY sp.id;

-- View: Order summary with items
CREATE OR REPLACE VIEW v_orders_summary AS
SELECT
  o.*,
  COUNT(oi.id) as item_count,
  SUM(oi.quantity) as total_items,
  sa.full_name as shipping_name,
  sa.address_line1,
  sa.city,
  sa.state_province,
  sa.postal_code
FROM orders o
LEFT JOIN order_items oi ON oi.order_id = o.id
LEFT JOIN shipping_addresses sa ON sa.order_id = o.id
GROUP BY o.id, sa.id;

-- View: Cart summary
CREATE OR REPLACE VIEW v_cart_summary AS
SELECT
  sc.id as cart_id,
  sc.user_email,
  sc.plan_code,
  COUNT(ci.id) as item_count,
  SUM(ci.quantity) as total_items,
  SUM(ci.quantity * ci.unit_price) as cart_total,
  sc.created_at,
  sc.updated_at
FROM shopping_carts sc
LEFT JOIN cart_items ci ON ci.cart_id = sc.id
WHERE sc.is_active = true
GROUP BY sc.id;

-- ============================================================================
-- SEED DATA (Example products)
-- ============================================================================

-- Insert example products (you'll replace with real inventory)
INSERT INTO supplement_products (
  sku, name, brand, dosage_form, strength, quantity, unit,
  wholesale_cost, retail_price, description, image_url,
  stock_level, reorder_point, is_active, third_party_tested,
  certifications
) VALUES
  (
    'NOW-VITD3-5000-240',
    'Vitamin D3',
    'NOW Foods',
    'Softgel',
    '5000 IU',
    240,
    'softgels',
    15.00,
    45.00, -- $30 margin
    'High-potency vitamin D3 for immune and bone health',
    '/products/vitamin-d3.jpg',
    500,
    100,
    true,
    true,
    ARRAY['NSF Certified', 'GMP Certified']
  ),
  (
    'NOW-CREAT-1000',
    'Creatine Monohydrate',
    'NOW Foods',
    'Powder',
    '5g per serving',
    1000,
    'grams',
    18.00,
    48.00, -- $30 margin
    'Pure creatine monohydrate powder for strength and muscle building',
    '/products/creatine.jpg',
    300,
    75,
    true,
    true,
    ARRAY['Informed Sport Certified', 'GMP Certified']
  ),
  (
    'NORDIC-OMEGA3-180',
    'Omega-3 Fish Oil',
    'Nordic Naturals',
    'Softgel',
    '1000mg EPA+DHA',
    180,
    'softgels',
    25.00,
    55.00, -- $30 margin
    'High-quality omega-3 for cardiovascular and brain health',
    '/products/omega3.jpg',
    250,
    50,
    true,
    true,
    ARRAY['IFOS 5-Star', 'Friend of the Sea']
  ),
  (
    'THORNE-MAG-90',
    'Magnesium Glycinate',
    'Thorne',
    'Capsule',
    '200mg',
    90,
    'capsules',
    12.00,
    42.00, -- $30 margin
    'Highly absorbable magnesium for muscle recovery and sleep',
    '/products/magnesium.jpg',
    400,
    100,
    true,
    true,
    ARRAY['NSF Sport Certified', 'GMP Certified']
  ),
  (
    'OPTIM-WHEY-5LB',
    'Whey Protein Isolate',
    'Optimum Nutrition',
    'Powder',
    '25g per serving',
    2268,
    'grams',
    40.00,
    70.00, -- $30 margin
    'Gold standard whey protein isolate for muscle recovery',
    '/products/whey-protein.jpg',
    150,
    30,
    true,
    true,
    ARRAY['Informed Choice', 'GMP Certified']
  )
ON CONFLICT (sku) DO NOTHING;

-- Insert supplement name mappings
INSERT INTO supplement_name_mappings (
  recommendation_name,
  recommendation_name_variations,
  product_id,
  is_primary_match,
  match_score,
  dosage_unit
) VALUES
  (
    'Vitamin D3',
    ARRAY['Vitamin D', 'D3', 'Cholecalciferol', 'Vitamin D-3'],
    (SELECT id FROM supplement_products WHERE sku = 'NOW-VITD3-5000-240'),
    true,
    1.0,
    'IU'
  ),
  (
    'Creatine Monohydrate',
    ARRAY['Creatine', 'Creatine Powder', 'Micronized Creatine'],
    (SELECT id FROM supplement_products WHERE sku = 'NOW-CREAT-1000'),
    true,
    1.0,
    'g'
  ),
  (
    'Omega-3 Fish Oil',
    ARRAY['Omega-3', 'Fish Oil', 'EPA DHA', 'Omega 3'],
    (SELECT id FROM supplement_products WHERE sku = 'NORDIC-OMEGA3-180'),
    true,
    1.0,
    'mg'
  ),
  (
    'Magnesium Glycinate',
    ARRAY['Magnesium', 'Mag Glycinate', 'Magnesium Bisglycinate'],
    (SELECT id FROM supplement_products WHERE sku = 'THORNE-MAG-90'),
    true,
    1.0,
    'mg'
  ),
  (
    'Whey Protein',
    ARRAY['Whey Protein Isolate', 'Protein Powder', 'Whey Isolate', 'WPI'],
    (SELECT id FROM supplement_products WHERE sku = 'OPTIM-WHEY-5LB'),
    true,
    1.0,
    'g'
  )
ON CONFLICT (recommendation_name, product_id) DO NOTHING;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE supplement_products IS 'Master catalog of supplement products available for purchase';
COMMENT ON TABLE supplement_name_mappings IS 'Maps AI-generated supplement names to product SKUs for consistent pricing';
COMMENT ON TABLE shopping_carts IS 'User shopping carts for supplement purchases';
COMMENT ON TABLE cart_items IS 'Individual items in shopping carts';
COMMENT ON TABLE orders IS 'Completed supplement orders';
COMMENT ON TABLE order_items IS 'Line items in orders with price snapshots';
COMMENT ON TABLE shipping_addresses IS 'Customer shipping addresses';
COMMENT ON TABLE inventory_transactions IS 'Audit trail of all inventory movements';
COMMENT ON TABLE price_history IS 'Historical record of all price changes';

-- ============================================================================
-- GRANT PERMISSIONS (adjust based on your security model)
-- ============================================================================

-- Grant SELECT to authenticated users for read-only tables
-- GRANT SELECT ON supplement_products TO authenticated;
-- GRANT SELECT ON supplement_name_mappings TO authenticated;

-- Grant appropriate permissions for cart and order operations
-- GRANT ALL ON shopping_carts TO authenticated;
-- GRANT ALL ON cart_items TO authenticated;
-- etc...

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
