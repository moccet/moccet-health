-- ============================================================================
-- Migration: Fix SECURITY DEFINER Views
-- Purpose: Change views from SECURITY DEFINER to SECURITY INVOKER
-- Created: 2025-01-01
-- ============================================================================
-- Views with SECURITY DEFINER run with the privileges of the view owner,
-- not the calling user. This can be a security risk. Changing to SECURITY
-- INVOKER ensures the view respects the caller's permissions.
-- ============================================================================

-- ============================================================================
-- v_products_inventory
-- Shows active products with inventory status and sales metrics
-- ============================================================================
DROP VIEW IF EXISTS v_products_inventory;

CREATE VIEW v_products_inventory
WITH (security_invoker = true)
AS
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

COMMENT ON VIEW v_products_inventory IS 'Active products with inventory status and sales metrics (SECURITY INVOKER)';

-- ============================================================================
-- v_orders_summary
-- Order summary with item counts and shipping details
-- ============================================================================
DROP VIEW IF EXISTS v_orders_summary;

CREATE VIEW v_orders_summary
WITH (security_invoker = true)
AS
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

COMMENT ON VIEW v_orders_summary IS 'Order summary with items and shipping (SECURITY INVOKER)';

-- ============================================================================
-- v_cart_summary
-- Active shopping carts with item counts and totals
-- ============================================================================
DROP VIEW IF EXISTS v_cart_summary;

CREATE VIEW v_cart_summary
WITH (security_invoker = true)
AS
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

COMMENT ON VIEW v_cart_summary IS 'Active shopping carts with totals (SECURITY INVOKER)';

-- ============================================================================
-- v_top_unmatched_supplements
-- Most frequently requested supplements not in catalog
-- ============================================================================
DROP VIEW IF EXISTS v_top_unmatched_supplements;

-- Only create if the source table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'unmatched_supplements_log') THEN
    EXECUTE '
      CREATE VIEW v_top_unmatched_supplements
      WITH (security_invoker = true)
      AS
      SELECT
        supplement_name,
        dosage_example,
        occurrence_count,
        first_seen_at,
        last_seen_at,
        EXTRACT(DAY FROM (last_seen_at - first_seen_at)) as days_active
      FROM unmatched_supplements_log
      WHERE resolved = false
      ORDER BY occurrence_count DESC, last_seen_at DESC
      LIMIT 50
    ';

    EXECUTE 'COMMENT ON VIEW v_top_unmatched_supplements IS ''Most frequently requested supplements not in catalog (SECURITY INVOKER)''';
  END IF;
END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- To verify views are now using SECURITY INVOKER, run:
--
-- SELECT
--   schemaname,
--   viewname,
--   CASE
--     WHEN definition LIKE '%security_invoker%' THEN 'INVOKER'
--     ELSE 'Check pg_class.reloptions'
--   END as security_mode
-- FROM pg_views
-- WHERE schemaname = 'public'
--   AND viewname IN ('v_products_inventory', 'v_orders_summary', 'v_cart_summary', 'v_top_unmatched_supplements');
--
-- Or check pg_class:
--
-- SELECT c.relname, c.reloptions
-- FROM pg_class c
-- JOIN pg_namespace n ON c.relnamespace = n.oid
-- WHERE n.nspname = 'public'
--   AND c.relkind = 'v'
--   AND c.relname LIKE 'v_%';
--
-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
