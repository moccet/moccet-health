-- ============================================================================
-- UNMATCHED SUPPLEMENTS LOG
-- Migration: 007_unmatched_supplements_log
-- Description: Tracks supplement recommendations that don't match catalog
--              products, helping identify which products to add to inventory
-- ============================================================================

CREATE TABLE IF NOT EXISTS unmatched_supplements_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Supplement details
  supplement_name TEXT NOT NULL,
  dosage_example TEXT,

  -- Occurrence tracking
  occurrence_count INTEGER DEFAULT 1,
  first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Resolution
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_product_id UUID REFERENCES supplement_products(id) ON DELETE SET NULL,
  resolution_notes TEXT,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CHECK (occurrence_count > 0)
);

-- Indexes
CREATE INDEX idx_unmatched_supps_name ON unmatched_supplements_log(supplement_name);
CREATE INDEX idx_unmatched_supps_resolved ON unmatched_supplements_log(resolved) WHERE resolved = false;
CREATE INDEX idx_unmatched_supps_occurrence ON unmatched_supplements_log(occurrence_count DESC);
CREATE INDEX idx_unmatched_supps_last_seen ON unmatched_supplements_log(last_seen_at DESC);

-- View: Top unmatched supplements
CREATE OR REPLACE VIEW v_top_unmatched_supplements AS
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
LIMIT 50;

COMMENT ON TABLE unmatched_supplements_log IS 'Tracks AI recommendations that dont match products for catalog expansion';
COMMENT ON VIEW v_top_unmatched_supplements IS 'Most frequently requested supplements not in catalog';
