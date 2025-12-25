-- moccet share: Family Health Monitoring System
-- Author: Claude Code
-- Date: 2024-12-25
-- Purpose: Enable caregivers to monitor aging parents with continuous health data,
--          anomaly detection, proactive alerts, and autonomous interventions

-- =============================================================================
-- SHARE RELATIONSHIPS: Caregiver-Sharer Connections
-- =============================================================================

CREATE TABLE IF NOT EXISTS share_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sharer_email TEXT NOT NULL,           -- Person being monitored (e.g., elderly parent)
  caregiver_email TEXT NOT NULL,        -- Person monitoring
  -- Relationship details
  relationship_type TEXT NOT NULL CHECK (relationship_type IN (
    'spouse', 'child', 'sibling', 'parent', 'grandparent',
    'friend', 'clinical_provider', 'professional_caregiver', 'other'
  )),
  relationship_label TEXT,              -- Custom label like "Mom", "Dad", "Grandma"
  caregiver_role TEXT NOT NULL DEFAULT 'secondary' CHECK (caregiver_role IN (
    'primary', 'secondary', 'clinical', 'emergency_only'
  )),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'active', 'paused', 'revoked'
  )),
  -- Bidirectional support (elderly couples monitoring each other)
  is_bidirectional BOOLEAN DEFAULT false,
  reverse_relationship_id UUID REFERENCES share_relationships(id),
  -- Invite tracking
  invite_code TEXT UNIQUE,
  invite_message TEXT,
  invite_sent_at TIMESTAMPTZ,
  invite_accepted_at TIMESTAMPTZ,
  -- Lifecycle
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  paused_at TIMESTAMPTZ,
  pause_reason TEXT,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  UNIQUE(sharer_email, caregiver_email)
);

-- Indexes for relationship lookups
CREATE INDEX IF NOT EXISTS idx_share_rel_sharer ON share_relationships(sharer_email);
CREATE INDEX IF NOT EXISTS idx_share_rel_caregiver ON share_relationships(caregiver_email);
CREATE INDEX IF NOT EXISTS idx_share_rel_status ON share_relationships(status);
CREATE INDEX IF NOT EXISTS idx_share_rel_active ON share_relationships(sharer_email, caregiver_email)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_share_rel_invite ON share_relationships(invite_code)
  WHERE status = 'pending';

-- =============================================================================
-- SHARE PERMISSIONS: Granular Data Sharing Controls
-- =============================================================================

CREATE TABLE IF NOT EXISTS share_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id UUID NOT NULL REFERENCES share_relationships(id) ON DELETE CASCADE,
  -- Sleep metrics
  share_sleep_score BOOLEAN DEFAULT true,
  share_sleep_details BOOLEAN DEFAULT false,    -- Deep sleep, REM, wake times
  share_sleep_trends BOOLEAN DEFAULT true,
  -- Heart & Recovery metrics
  share_hrv BOOLEAN DEFAULT true,
  share_resting_hr BOOLEAN DEFAULT true,
  share_recovery BOOLEAN DEFAULT true,
  -- Activity metrics
  share_activity BOOLEAN DEFAULT true,
  share_steps BOOLEAN DEFAULT true,
  share_workouts BOOLEAN DEFAULT true,
  share_calories BOOLEAN DEFAULT false,
  -- Glucose/CGM
  share_glucose BOOLEAN DEFAULT false,          -- Full CGM data
  share_glucose_alerts_only BOOLEAN DEFAULT true,
  share_time_in_range BOOLEAN DEFAULT true,
  -- Medication & Compliance
  share_medication_compliance BOOLEAN DEFAULT true,
  share_medication_list BOOLEAN DEFAULT false,
  share_medication_schedule BOOLEAN DEFAULT false,
  -- Nutrition & Hydration
  share_nutrition BOOLEAN DEFAULT false,
  share_nutrition_alerts_only BOOLEAN DEFAULT true,
  share_hydration BOOLEAN DEFAULT true,
  -- Location (for safety - falls, wandering)
  share_location BOOLEAN DEFAULT false,
  share_location_history BOOLEAN DEFAULT false,
  share_geofence_alerts BOOLEAN DEFAULT false,
  -- Calendar & Schedule
  share_calendar BOOLEAN DEFAULT false,
  share_appointments BOOLEAN DEFAULT true,
  -- Vital signs
  share_blood_pressure BOOLEAN DEFAULT false,
  share_weight BOOLEAN DEFAULT false,
  share_temperature BOOLEAN DEFAULT false,
  -- Alert routing preferences
  receive_critical_alerts BOOLEAN DEFAULT true,
  receive_high_alerts BOOLEAN DEFAULT true,
  receive_medium_alerts BOOLEAN DEFAULT false,
  receive_low_alerts BOOLEAN DEFAULT false,
  receive_info_alerts BOOLEAN DEFAULT false,
  -- Clinical coordination visibility
  can_see_clinical_alerts BOOLEAN DEFAULT true,   -- See THAT clinical was alerted
  can_see_clinical_details BOOLEAN DEFAULT false, -- See WHAT was sent
  -- Intervention permissions
  can_create_reminders BOOLEAN DEFAULT true,
  can_initiate_deliveries BOOLEAN DEFAULT false,
  can_contact_emergency BOOLEAN DEFAULT true,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(relationship_id)
);

CREATE INDEX IF NOT EXISTS idx_share_perms_rel ON share_permissions(relationship_id);

-- =============================================================================
-- SHARE BASELINES: Personalized Health Baselines
-- =============================================================================

CREATE TABLE IF NOT EXISTS share_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  metric_type TEXT NOT NULL CHECK (metric_type IN (
    -- Sleep
    'sleep_score', 'sleep_duration_hours', 'deep_sleep_pct', 'rem_sleep_pct',
    'sleep_efficiency', 'wake_count', 'bedtime_consistency',
    -- Recovery/Heart
    'recovery_score', 'hrv_ms', 'resting_hr', 'hrv_variability',
    -- Activity
    'daily_steps', 'active_calories', 'active_minutes', 'sedentary_hours',
    'workout_frequency_weekly',
    -- Glucose
    'avg_glucose', 'glucose_variability', 'time_in_range_pct', 'spike_count_daily',
    -- Nutrition
    'daily_calories', 'protein_grams', 'hydration_oz', 'meal_count',
    -- Social/Behavior
    'social_interactions', 'phone_usage_hours', 'out_of_home_hours',
    -- Medication
    'medication_compliance_pct',
    -- Other
    'weight_lbs', 'blood_pressure_systolic', 'blood_pressure_diastolic'
  )),
  -- Rolling baseline values
  baseline_value NUMERIC NOT NULL,
  baseline_std_dev NUMERIC,
  sample_count INTEGER DEFAULT 1,
  window_days INTEGER DEFAULT 14,
  -- Personalized thresholds (learned from individual patterns)
  alert_threshold_pct NUMERIC DEFAULT 15,
  critical_threshold_pct NUMERIC DEFAULT 30,
  -- Context for this person
  normal_range_min NUMERIC,
  normal_range_max NUMERIC,
  personal_optimal_min NUMERIC,
  personal_optimal_max NUMERIC,
  -- Trend tracking
  trend_direction TEXT CHECK (trend_direction IN ('improving', 'stable', 'declining', 'volatile')),
  trend_duration_days INTEGER,
  trend_velocity NUMERIC,  -- Rate of change per day
  -- Seasonality
  day_of_week_patterns JSONB,  -- {'monday': 0.95, 'saturday': 1.1}
  time_of_day_patterns JSONB,  -- {'morning': 0.9, 'evening': 1.05}
  -- Timestamps
  last_updated TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_email, metric_type)
);

CREATE INDEX IF NOT EXISTS idx_share_baselines_user ON share_baselines(user_email);
CREATE INDEX IF NOT EXISTS idx_share_baselines_metric ON share_baselines(user_email, metric_type);
CREATE INDEX IF NOT EXISTS idx_share_baselines_trend ON share_baselines(user_email, trend_direction)
  WHERE trend_direction = 'declining';

-- =============================================================================
-- SHARE ALERTS: Caregiver Alerts
-- =============================================================================

CREATE TABLE IF NOT EXISTS share_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sharer_email TEXT NOT NULL,
  -- Alert details
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'anomaly_detected',       -- Pattern deviation
    'activity_drop',          -- Reduced movement
    'sleep_disruption',       -- Poor sleep pattern
    'glucose_concern',        -- CGM alert
    'medication_missed',      -- Non-compliance
    'hydration_low',          -- Not drinking enough
    'nutrition_concern',      -- Poor nutrition pattern
    'clinical_notified',      -- Clinical team was alerted
    'fall_detected',          -- Emergency
    'no_data_received',       -- Device not syncing
    'baseline_shift',         -- Long-term pattern change
    'recovery_concern',       -- Low recovery/high strain
    'isolation_risk',         -- Social isolation detected
    'geofence_exit',          -- Left safe zone
    'vital_sign_concern',     -- Blood pressure, etc.
    'weight_change',          -- Significant weight change
    'intervention_failed',    -- Reminder/delivery failed
    'pattern_break'           -- Routine disrupted
  )),
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  -- Context (full health picture at time of alert)
  context_data JSONB NOT NULL DEFAULT '{}',
  -- Actionable recommendation
  actionable_recommendation TEXT,
  suggested_actions JSONB DEFAULT '[]',  -- [{action: 'call', label: 'Call Mom'}, ...]
  -- Routing
  routed_to_caregivers TEXT[] NOT NULL DEFAULT '{}',
  routed_to_clinical BOOLEAN DEFAULT false,
  clinical_alert_id UUID,  -- Reference to share_clinical_alerts
  -- Status tracking
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'sent', 'acknowledged', 'resolved', 'escalated', 'expired'
  )),
  acknowledged_by TEXT,
  acknowledged_at TIMESTAMPTZ,
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  -- Escalation
  escalation_count INT DEFAULT 0,
  last_escalation_at TIMESTAMPTZ,
  escalation_history JSONB DEFAULT '[]',
  -- Source
  source_metric TEXT,
  source_value NUMERIC,
  baseline_value NUMERIC,
  deviation_pct NUMERIC,
  source_insight_id UUID,
  source_provider TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_share_alerts_sharer ON share_alerts(sharer_email);
CREATE INDEX IF NOT EXISTS idx_share_alerts_status ON share_alerts(status);
CREATE INDEX IF NOT EXISTS idx_share_alerts_severity ON share_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_share_alerts_pending ON share_alerts(sharer_email, status)
  WHERE status IN ('pending', 'sent');
CREATE INDEX IF NOT EXISTS idx_share_alerts_critical ON share_alerts(severity, status)
  WHERE severity = 'critical' AND status NOT IN ('resolved', 'expired');
CREATE INDEX IF NOT EXISTS idx_share_alerts_created ON share_alerts(created_at DESC);

-- =============================================================================
-- SHARE INTERVENTIONS: Proactive Care Actions
-- =============================================================================

CREATE TABLE IF NOT EXISTS share_interventions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  -- Intervention type
  intervention_type TEXT NOT NULL CHECK (intervention_type IN (
    'reminder',              -- Hydration, medication, activity
    'automated_delivery',    -- Groceries, supplies
    'scheduled_check_in',    -- Phone call, video call
    'suggestion',            -- Gentle nudge
    'emergency_contact',     -- Alert emergency services
    'care_coordination'      -- Coordinate with clinical
  )),
  subtype TEXT,  -- 'hydration', 'medication', 'activity', 'stretch', 'meal'
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'time_based',            -- Regular schedule
    'metric_based',          -- When metric drops
    'pattern_based',         -- When pattern detected
    'caregiver_initiated',   -- Manual trigger
    'ai_suggested'           -- AI recommendation
  )),
  -- Configuration
  config JSONB NOT NULL DEFAULT '{}',
  -- Personalization learned from outcomes
  personalization JSONB DEFAULT '{}',
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN (
    'active', 'paused', 'completed', 'cancelled', 'expired'
  )),
  -- Execution tracking
  last_executed_at TIMESTAMPTZ,
  next_scheduled_at TIMESTAMPTZ,
  execution_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  skip_count INTEGER DEFAULT 0,
  -- Effectiveness tracking
  effectiveness_score NUMERIC CHECK (effectiveness_score >= 0 AND effectiveness_score <= 1),
  avg_response_time_seconds INTEGER,
  -- Delivery specific
  delivery_provider TEXT,
  delivery_address_id TEXT,
  recurring_delivery BOOLEAN DEFAULT false,
  delivery_frequency_days INTEGER,
  -- Approval workflow
  requires_approval BOOLEAN DEFAULT false,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by TEXT,  -- Caregiver email or 'system' or 'ai'
  paused_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_share_interventions_user ON share_interventions(user_email);
CREATE INDEX IF NOT EXISTS idx_share_interventions_status ON share_interventions(status);
CREATE INDEX IF NOT EXISTS idx_share_interventions_next ON share_interventions(next_scheduled_at)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_share_interventions_type ON share_interventions(intervention_type, subtype);
CREATE INDEX IF NOT EXISTS idx_share_interventions_pending_approval ON share_interventions(user_email)
  WHERE requires_approval = true AND approved_at IS NULL;

-- =============================================================================
-- SHARE INTERVENTION LOGS: Intervention Execution History
-- =============================================================================

CREATE TABLE IF NOT EXISTS share_intervention_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intervention_id UUID NOT NULL REFERENCES share_interventions(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  -- Execution details
  executed_at TIMESTAMPTZ DEFAULT now(),
  execution_result TEXT CHECK (execution_result IN (
    'sent', 'completed', 'acknowledged', 'ignored',
    'snoozed', 'failed', 'escalated', 'cancelled', 'skipped'
  )),
  skip_reason TEXT,
  failure_reason TEXT,
  -- Response tracking
  user_response TEXT,  -- "done", "later", "skip", custom response
  response_at TIMESTAMPTZ,
  response_time_seconds INTEGER,
  -- Outcome tracking (for learning)
  outcome_measured BOOLEAN DEFAULT false,
  outcome_positive BOOLEAN,
  outcome_metric TEXT,
  outcome_value_before NUMERIC,
  outcome_value_after NUMERIC,
  outcome_notes TEXT,
  -- Context at time of execution
  context_data JSONB,
  health_snapshot JSONB,
  -- Delivery specific
  delivery_order_id TEXT,
  delivery_provider TEXT,
  delivery_status TEXT,
  delivery_eta TIMESTAMPTZ,
  delivery_completed_at TIMESTAMPTZ,
  delivery_items JSONB,
  delivery_total_amount NUMERIC,
  -- Notification details
  notification_channel TEXT,  -- 'push', 'sms', 'email', 'voice'
  notification_id TEXT,
  -- Escalation
  escalated_to TEXT[],
  escalated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_share_logs_intervention ON share_intervention_logs(intervention_id);
CREATE INDEX IF NOT EXISTS idx_share_logs_user ON share_intervention_logs(user_email);
CREATE INDEX IF NOT EXISTS idx_share_logs_executed ON share_intervention_logs(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_share_logs_result ON share_intervention_logs(execution_result);
CREATE INDEX IF NOT EXISTS idx_share_logs_delivery ON share_intervention_logs(delivery_order_id)
  WHERE delivery_order_id IS NOT NULL;

-- =============================================================================
-- SHARE CLINICAL COORDINATION: Clinical Team Integration
-- =============================================================================

CREATE TABLE IF NOT EXISTS share_clinical_coordination (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  -- Clinical provider info
  provider_email TEXT NOT NULL,
  provider_name TEXT,
  provider_type TEXT CHECK (provider_type IN (
    'primary_care', 'cardiologist', 'endocrinologist', 'geriatrician',
    'neurologist', 'psychiatrist', 'physical_therapist', 'nutritionist',
    'care_coordinator', 'nurse', 'pharmacist', 'other'
  )),
  provider_organization TEXT,
  provider_phone TEXT,
  provider_fax TEXT,
  -- What to share with clinical
  share_continuous_data BOOLEAN DEFAULT false,   -- Real-time streaming
  share_alerts BOOLEAN DEFAULT true,
  share_weekly_summary BOOLEAN DEFAULT true,
  share_trend_reports BOOLEAN DEFAULT true,
  share_medication_data BOOLEAN DEFAULT true,
  share_caregiver_notes BOOLEAN DEFAULT false,
  -- Alert routing rules
  alert_for_critical BOOLEAN DEFAULT true,
  alert_for_concerning_patterns BOOLEAN DEFAULT true,
  alert_threshold_days INTEGER DEFAULT 3,  -- Days of pattern before alert
  -- Specific metrics to share
  share_metrics JSONB DEFAULT '["sleep", "activity", "glucose", "medication_compliance"]',
  -- Communication preferences
  preferred_contact_method TEXT CHECK (preferred_contact_method IN (
    'email', 'fax', 'portal', 'api', 'phone'
  )) DEFAULT 'email',
  portal_integration_id TEXT,   -- Epic/Cerner patient ID if available
  fhir_patient_id TEXT,
  -- Status
  is_active BOOLEAN DEFAULT true,
  verified_at TIMESTAMPTZ,
  verified_by TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_communication_at TIMESTAMPTZ,
  UNIQUE(user_email, provider_email)
);

CREATE INDEX IF NOT EXISTS idx_share_clinical_user ON share_clinical_coordination(user_email);
CREATE INDEX IF NOT EXISTS idx_share_clinical_provider ON share_clinical_coordination(provider_email);
CREATE INDEX IF NOT EXISTS idx_share_clinical_active ON share_clinical_coordination(user_email)
  WHERE is_active = true;

-- =============================================================================
-- SHARE CLINICAL ALERTS: Alerts Sent to Clinical Team
-- =============================================================================

CREATE TABLE IF NOT EXISTS share_clinical_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coordination_id UUID REFERENCES share_clinical_coordination(id),
  user_email TEXT NOT NULL,
  provider_email TEXT NOT NULL,
  -- Alert content
  alert_type TEXT NOT NULL,
  alert_severity TEXT NOT NULL CHECK (alert_severity IN ('critical', 'high', 'medium', 'low')),
  summary TEXT NOT NULL,
  detailed_report JSONB NOT NULL,
  -- Related share alert
  share_alert_id UUID REFERENCES share_alerts(id),
  -- Delivery
  sent_at TIMESTAMPTZ DEFAULT now(),
  delivery_method TEXT,
  delivery_status TEXT CHECK (delivery_status IN (
    'pending', 'sent', 'delivered', 'opened', 'failed', 'bounced'
  )),
  delivery_attempts INTEGER DEFAULT 1,
  last_attempt_at TIMESTAMPTZ,
  -- Provider response (if any)
  provider_acknowledged BOOLEAN DEFAULT false,
  provider_acknowledged_at TIMESTAMPTZ,
  provider_notes TEXT,
  provider_action_taken TEXT,
  provider_recommendations JSONB,
  -- Visibility for caregivers
  visible_to_caregivers BOOLEAN DEFAULT true,
  caregiver_view_summary TEXT,  -- What caregivers see (less detailed)
  caregivers_notified TEXT[],
  -- Follow-up
  requires_followup BOOLEAN DEFAULT false,
  followup_due_at TIMESTAMPTZ,
  followup_completed BOOLEAN DEFAULT false,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clinical_alerts_user ON share_clinical_alerts(user_email);
CREATE INDEX IF NOT EXISTS idx_clinical_alerts_provider ON share_clinical_alerts(provider_email);
CREATE INDEX IF NOT EXISTS idx_clinical_alerts_pending ON share_clinical_alerts(delivery_status)
  WHERE delivery_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_clinical_alerts_sent ON share_clinical_alerts(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_clinical_alerts_followup ON share_clinical_alerts(followup_due_at)
  WHERE requires_followup = true AND followup_completed = false;

-- =============================================================================
-- SHARE HEALTH SNAPSHOTS: Point-in-Time Health State
-- =============================================================================

CREATE TABLE IF NOT EXISTS share_health_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  snapshot_type TEXT NOT NULL CHECK (snapshot_type IN (
    'daily', 'weekly', 'alert_context', 'clinical_report', 'manual'
  )),
  -- Metrics snapshot
  metrics JSONB NOT NULL DEFAULT '{}',
  -- Baseline comparisons
  baseline_comparisons JSONB DEFAULT '{}',
  -- Trends
  trends JSONB DEFAULT '{}',
  -- Events
  recent_events JSONB DEFAULT '[]',
  -- Status indicators
  overall_status TEXT CHECK (overall_status IN ('good', 'fair', 'concerning', 'critical')),
  status_breakdown JSONB DEFAULT '{}',
  -- Recommendations
  recommendations JSONB DEFAULT '[]',
  -- Timestamps
  snapshot_at TIMESTAMPTZ DEFAULT now(),
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_snapshots_user ON share_health_snapshots(user_email);
CREATE INDEX IF NOT EXISTS idx_snapshots_type ON share_health_snapshots(user_email, snapshot_type);
CREATE INDEX IF NOT EXISTS idx_snapshots_date ON share_health_snapshots(snapshot_at DESC);

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Generate invite code
CREATE OR REPLACE FUNCTION generate_share_invite_code()
RETURNS TEXT AS $$
BEGIN
  RETURN upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
END;
$$ LANGUAGE plpgsql;

-- Get all caregivers for a sharer
CREATE OR REPLACE FUNCTION get_share_caregivers(p_sharer_email TEXT)
RETURNS TABLE (
  relationship_id UUID,
  caregiver_email TEXT,
  caregiver_role TEXT,
  relationship_type TEXT,
  relationship_label TEXT,
  connected_since TIMESTAMPTZ,
  permissions share_permissions
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sr.id AS relationship_id,
    sr.caregiver_email,
    sr.caregiver_role,
    sr.relationship_type,
    sr.relationship_label,
    sr.invite_accepted_at AS connected_since,
    sp.*
  FROM share_relationships sr
  LEFT JOIN share_permissions sp ON sp.relationship_id = sr.id
  WHERE sr.sharer_email = p_sharer_email
    AND sr.status = 'active'
  ORDER BY
    CASE sr.caregiver_role
      WHEN 'primary' THEN 1
      WHEN 'secondary' THEN 2
      WHEN 'clinical' THEN 3
      ELSE 4
    END;
END;
$$ LANGUAGE plpgsql;

-- Get all sharers for a caregiver (people they monitor)
CREATE OR REPLACE FUNCTION get_share_monitored_people(p_caregiver_email TEXT)
RETURNS TABLE (
  relationship_id UUID,
  sharer_email TEXT,
  sharer_label TEXT,
  caregiver_role TEXT,
  relationship_type TEXT,
  connected_since TIMESTAMPTZ,
  is_bidirectional BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sr.id AS relationship_id,
    sr.sharer_email,
    sr.relationship_label AS sharer_label,
    sr.caregiver_role,
    sr.relationship_type,
    sr.invite_accepted_at AS connected_since,
    sr.is_bidirectional
  FROM share_relationships sr
  WHERE sr.caregiver_email = p_caregiver_email
    AND sr.status = 'active'
  ORDER BY sr.invite_accepted_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Check if caregiver can access metric
CREATE OR REPLACE FUNCTION can_caregiver_access_metric(
  p_sharer_email TEXT,
  p_caregiver_email TEXT,
  p_metric_type TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_permission BOOLEAN;
  v_column_name TEXT;
BEGIN
  -- Map metric type to permission column
  v_column_name := CASE p_metric_type
    WHEN 'sleep_score' THEN 'share_sleep_score'
    WHEN 'sleep_duration' THEN 'share_sleep_score'
    WHEN 'deep_sleep' THEN 'share_sleep_details'
    WHEN 'rem_sleep' THEN 'share_sleep_details'
    WHEN 'hrv' THEN 'share_hrv'
    WHEN 'resting_hr' THEN 'share_resting_hr'
    WHEN 'recovery' THEN 'share_recovery'
    WHEN 'steps' THEN 'share_steps'
    WHEN 'activity' THEN 'share_activity'
    WHEN 'glucose' THEN 'share_glucose'
    WHEN 'medication' THEN 'share_medication_compliance'
    WHEN 'hydration' THEN 'share_hydration'
    WHEN 'nutrition' THEN 'share_nutrition'
    WHEN 'location' THEN 'share_location'
    ELSE 'share_activity'  -- Default to activity permission
  END;

  -- Check permission
  EXECUTE format(
    'SELECT sp.%I FROM share_relationships sr
     JOIN share_permissions sp ON sp.relationship_id = sr.id
     WHERE sr.sharer_email = $1
       AND sr.caregiver_email = $2
       AND sr.status = ''active''',
    v_column_name
  ) INTO v_permission USING p_sharer_email, p_caregiver_email;

  RETURN COALESCE(v_permission, false);
END;
$$ LANGUAGE plpgsql;

-- Check if value deviates from baseline
CREATE OR REPLACE FUNCTION check_baseline_deviation(
  p_user_email TEXT,
  p_metric_type TEXT,
  p_current_value NUMERIC
) RETURNS TABLE (
  is_anomaly BOOLEAN,
  deviation_pct NUMERIC,
  severity TEXT,
  baseline_value NUMERIC,
  threshold_pct NUMERIC
) AS $$
DECLARE
  v_baseline RECORD;
  v_deviation NUMERIC;
  v_severity TEXT;
BEGIN
  -- Get baseline
  SELECT * INTO v_baseline
  FROM share_baselines
  WHERE user_email = p_user_email
    AND metric_type = p_metric_type;

  IF v_baseline IS NULL THEN
    RETURN QUERY SELECT false, 0::NUMERIC, 'none'::TEXT, 0::NUMERIC, 0::NUMERIC;
    RETURN;
  END IF;

  -- Calculate deviation
  v_deviation := ABS((p_current_value - v_baseline.baseline_value) /
                     NULLIF(v_baseline.baseline_value, 0)) * 100;

  -- Determine severity
  v_severity := CASE
    WHEN v_deviation >= v_baseline.critical_threshold_pct THEN 'critical'
    WHEN v_deviation >= v_baseline.alert_threshold_pct THEN 'high'
    WHEN v_deviation >= v_baseline.alert_threshold_pct * 0.7 THEN 'medium'
    WHEN v_deviation >= v_baseline.alert_threshold_pct * 0.5 THEN 'low'
    ELSE 'none'
  END;

  RETURN QUERY SELECT
    v_deviation >= v_baseline.alert_threshold_pct AS is_anomaly,
    ROUND(v_deviation, 2) AS deviation_pct,
    v_severity AS severity,
    v_baseline.baseline_value,
    v_baseline.alert_threshold_pct AS threshold_pct;
END;
$$ LANGUAGE plpgsql;

-- Get pending alerts for caregiver
CREATE OR REPLACE FUNCTION get_caregiver_pending_alerts(p_caregiver_email TEXT)
RETURNS TABLE (
  alert_id UUID,
  sharer_email TEXT,
  sharer_label TEXT,
  alert_type TEXT,
  severity TEXT,
  title TEXT,
  message TEXT,
  created_at TIMESTAMPTZ,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sa.id AS alert_id,
    sa.sharer_email,
    sr.relationship_label AS sharer_label,
    sa.alert_type,
    sa.severity,
    sa.title,
    sa.message,
    sa.created_at,
    sa.status
  FROM share_alerts sa
  JOIN share_relationships sr ON sr.sharer_email = sa.sharer_email
    AND sr.caregiver_email = p_caregiver_email
    AND sr.status = 'active'
  JOIN share_permissions sp ON sp.relationship_id = sr.id
  WHERE p_caregiver_email = ANY(sa.routed_to_caregivers)
    AND sa.status IN ('pending', 'sent')
    AND (
      (sa.severity = 'critical' AND sp.receive_critical_alerts) OR
      (sa.severity = 'high' AND sp.receive_high_alerts) OR
      (sa.severity = 'medium' AND sp.receive_medium_alerts) OR
      (sa.severity = 'low' AND sp.receive_low_alerts) OR
      (sa.severity = 'info' AND sp.receive_info_alerts)
    )
  ORDER BY
    CASE sa.severity
      WHEN 'critical' THEN 1
      WHEN 'high' THEN 2
      WHEN 'medium' THEN 3
      WHEN 'low' THEN 4
      ELSE 5
    END,
    sa.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_share_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_share_rel_updated
  BEFORE UPDATE ON share_relationships
  FOR EACH ROW
  EXECUTE FUNCTION update_share_timestamp();

CREATE TRIGGER trg_share_perms_updated
  BEFORE UPDATE ON share_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_share_timestamp();

CREATE TRIGGER trg_share_interventions_updated
  BEFORE UPDATE ON share_interventions
  FOR EACH ROW
  EXECUTE FUNCTION update_share_timestamp();

CREATE TRIGGER trg_share_clinical_coord_updated
  BEFORE UPDATE ON share_clinical_coordination
  FOR EACH ROW
  EXECUTE FUNCTION update_share_timestamp();

CREATE TRIGGER trg_share_clinical_alerts_updated
  BEFORE UPDATE ON share_clinical_alerts
  FOR EACH ROW
  EXECUTE FUNCTION update_share_timestamp();

-- Auto-generate invite code
CREATE OR REPLACE FUNCTION generate_invite_on_create()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invite_code IS NULL THEN
    NEW.invite_code = generate_share_invite_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_share_invite_code
  BEFORE INSERT ON share_relationships
  FOR EACH ROW
  EXECUTE FUNCTION generate_invite_on_create();

-- Auto-create permissions when relationship is accepted
CREATE OR REPLACE FUNCTION create_share_permissions()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'active' AND OLD.status = 'pending' THEN
    NEW.invite_accepted_at = now();

    INSERT INTO share_permissions (relationship_id)
    VALUES (NEW.id)
    ON CONFLICT (relationship_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_create_share_permissions
  BEFORE UPDATE ON share_relationships
  FOR EACH ROW
  EXECUTE FUNCTION create_share_permissions();

-- Track pause/revoke
CREATE OR REPLACE FUNCTION track_relationship_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'paused' AND OLD.status = 'active' THEN
    NEW.paused_at = now();
  ELSIF NEW.status = 'revoked' THEN
    NEW.revoked_at = now();
  ELSIF NEW.status = 'active' AND OLD.status = 'paused' THEN
    NEW.paused_at = NULL;
    NEW.pause_reason = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_track_status_change
  BEFORE UPDATE ON share_relationships
  FOR EACH ROW
  EXECUTE FUNCTION track_relationship_status_change();

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

-- Enable RLS
ALTER TABLE share_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_interventions ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_intervention_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_clinical_coordination ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_clinical_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_health_snapshots ENABLE ROW LEVEL SECURITY;

-- Share Relationships policies
CREATE POLICY "Users can view own relationships" ON share_relationships
  FOR SELECT USING (
    auth.jwt() ->> 'email' = sharer_email
    OR auth.jwt() ->> 'email' = caregiver_email
  );

CREATE POLICY "Sharers can create invites" ON share_relationships
  FOR INSERT WITH CHECK (auth.jwt() ->> 'email' = sharer_email);

CREATE POLICY "Sharers can manage relationships" ON share_relationships
  FOR UPDATE USING (auth.jwt() ->> 'email' = sharer_email);

CREATE POLICY "Caregivers can accept invites" ON share_relationships
  FOR UPDATE USING (
    auth.jwt() ->> 'email' = caregiver_email
    AND status = 'pending'
  );

-- Share Permissions policies
CREATE POLICY "Sharers can view and manage permissions" ON share_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM share_relationships sr
      WHERE sr.id = relationship_id
        AND sr.sharer_email = auth.jwt() ->> 'email'
    )
  );

CREATE POLICY "Caregivers can view permissions" ON share_permissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM share_relationships sr
      WHERE sr.id = relationship_id
        AND sr.caregiver_email = auth.jwt() ->> 'email'
        AND sr.status = 'active'
    )
  );

-- Share Baselines policies
CREATE POLICY "Users can manage own baselines" ON share_baselines
  FOR ALL USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Caregivers can view baselines" ON share_baselines
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM share_relationships sr
      WHERE sr.sharer_email = user_email
        AND sr.caregiver_email = auth.jwt() ->> 'email'
        AND sr.status = 'active'
    )
  );

-- Share Alerts policies
CREATE POLICY "Sharers can view own alerts" ON share_alerts
  FOR SELECT USING (auth.jwt() ->> 'email' = sharer_email);

CREATE POLICY "Routed caregivers can view alerts" ON share_alerts
  FOR SELECT USING (auth.jwt() ->> 'email' = ANY(routed_to_caregivers));

CREATE POLICY "Caregivers can acknowledge alerts" ON share_alerts
  FOR UPDATE USING (auth.jwt() ->> 'email' = ANY(routed_to_caregivers));

-- Share Interventions policies
CREATE POLICY "Sharers can view own interventions" ON share_interventions
  FOR SELECT USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Caregivers can manage interventions" ON share_interventions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM share_relationships sr
      JOIN share_permissions sp ON sp.relationship_id = sr.id
      WHERE sr.sharer_email = user_email
        AND sr.caregiver_email = auth.jwt() ->> 'email'
        AND sr.status = 'active'
        AND sp.can_create_reminders
    )
  );

-- Intervention Logs policies
CREATE POLICY "Sharers can view own logs" ON share_intervention_logs
  FOR SELECT USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Caregivers can view logs" ON share_intervention_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM share_relationships sr
      WHERE sr.sharer_email = user_email
        AND sr.caregiver_email = auth.jwt() ->> 'email'
        AND sr.status = 'active'
    )
  );

-- Clinical Coordination policies
CREATE POLICY "Users can manage own clinical sharing" ON share_clinical_coordination
  FOR ALL USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Providers can view their shared data" ON share_clinical_coordination
  FOR SELECT USING (
    auth.jwt() ->> 'email' = provider_email
    AND is_active = true
  );

CREATE POLICY "Caregivers can view clinical settings" ON share_clinical_coordination
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM share_relationships sr
      JOIN share_permissions sp ON sp.relationship_id = sr.id
      WHERE sr.sharer_email = user_email
        AND sr.caregiver_email = auth.jwt() ->> 'email'
        AND sr.status = 'active'
        AND sp.can_see_clinical_alerts
    )
  );

-- Clinical Alerts policies
CREATE POLICY "Users can view own clinical alerts" ON share_clinical_alerts
  FOR SELECT USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Providers can view and respond" ON share_clinical_alerts
  FOR ALL USING (
    auth.jwt() ->> 'email' = provider_email
  );

CREATE POLICY "Caregivers can view clinical alerts" ON share_clinical_alerts
  FOR SELECT USING (
    visible_to_caregivers = true
    AND auth.jwt() ->> 'email' = ANY(caregivers_notified)
  );

-- Health Snapshots policies
CREATE POLICY "Users can view own snapshots" ON share_health_snapshots
  FOR SELECT USING (auth.jwt() ->> 'email' = user_email);

CREATE POLICY "Caregivers can view snapshots" ON share_health_snapshots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM share_relationships sr
      WHERE sr.sharer_email = user_email
        AND sr.caregiver_email = auth.jwt() ->> 'email'
        AND sr.status = 'active'
    )
  );

-- Service role full access
CREATE POLICY "Service role full access to relationships" ON share_relationships
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to permissions" ON share_permissions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to baselines" ON share_baselines
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to alerts" ON share_alerts
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to interventions" ON share_interventions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to logs" ON share_intervention_logs
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to clinical coord" ON share_clinical_coordination
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to clinical alerts" ON share_clinical_alerts
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to snapshots" ON share_health_snapshots
  FOR ALL USING (auth.role() = 'service_role');

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE share_relationships IS 'Caregiver-sharer relationships for family health monitoring';
COMMENT ON TABLE share_permissions IS 'Granular per-relationship data sharing controls';
COMMENT ON TABLE share_baselines IS 'Personalized health metric baselines for anomaly detection';
COMMENT ON TABLE share_alerts IS 'Alerts sent to caregivers when health patterns deviate';
COMMENT ON TABLE share_interventions IS 'Proactive care actions (reminders, deliveries, check-ins)';
COMMENT ON TABLE share_intervention_logs IS 'Execution history and outcomes of interventions';
COMMENT ON TABLE share_clinical_coordination IS 'Healthcare provider integration settings';
COMMENT ON TABLE share_clinical_alerts IS 'Alerts sent to clinical team with detailed reports';
COMMENT ON TABLE share_health_snapshots IS 'Point-in-time health state for context and reports';
