-- Sprint 3 EPF-02 — Water Billing Domain
-- Implements the complete Water Billing Domain on top of the certified EPF-01 Financial Foundation.
--
-- Scope:
--   • Water Meters (installation, status, lifecycle)
--   • Meter Readings (manual, estimated, corrected, initial)
--   • Consumption Calculation (current - previous reading)
--   • Tariff Tables & Bands (configurable, never hardcoded)
--   • Consumption Adjustments (corrections, meter replacements)
--   • Billing Rules (configurable tenant-level rules)
--   • RLS (three-tier SELECT-only, matching EPF-01 pattern)
--   • Triggers (updated_at, initial reading, reading validation)
--   • Helper Functions (consumption calculation, tariff application)
--
-- Out of scope:
--   • Payment processing (EPF-03)
--   • Scheduled billing, cron, background workers (future EPF)
--   • Mobile Collector App (EPF-04)
--   • Notifications, dashboards, reports (future)

-- ============================================================================
-- ENUMS
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'meter_status') THEN
    CREATE TYPE resident.meter_status AS ENUM ('active', 'inactive', 'damaged', 'removed');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reading_source') THEN
    CREATE TYPE resident.reading_source AS ENUM ('manual', 'estimated', 'corrected', 'initial');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tariff_type') THEN
    CREATE TYPE resident.tariff_type AS ENUM ('fixed', 'progressive', 'minimum_charge');
  END IF;
END $$;

-- ============================================================================
-- TABLES
-- ============================================================================

-- Water Meters — Physical meters linked to properties
CREATE TABLE IF NOT EXISTS resident.water_meters (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES resident.tenants(id) ON DELETE RESTRICT,
  property_id       uuid NOT NULL REFERENCES resident.properties(id) ON DELETE RESTRICT,
  meter_number      text NOT NULL,
  installation_date date NOT NULL DEFAULT CURRENT_DATE,
  initial_reading   numeric(12,3) NOT NULL DEFAULT 0,
  status            resident.meter_status NOT NULL DEFAULT 'active',
  location          text,
  notes             text,
  metadata          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz,
  CONSTRAINT uq_water_meters_tenant_number UNIQUE (tenant_id, meter_number)
);

-- Meter Readings — Periodic readings for each meter
CREATE TABLE IF NOT EXISTS resident.meter_readings (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES resident.tenants(id) ON DELETE RESTRICT,
  meter_id            uuid NOT NULL REFERENCES resident.water_meters(id) ON DELETE CASCADE,
  reading_date        date NOT NULL,
  reading_value       numeric(12,3) NOT NULL,
  source              resident.reading_source NOT NULL DEFAULT 'manual',
  is_estimated        boolean NOT NULL DEFAULT false,
  notes               text,
  read_by_profile_id  uuid REFERENCES resident.profiles(id) ON DELETE SET NULL,
  metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_meter_readings_meter_date UNIQUE (meter_id, reading_date),
  CONSTRAINT chk_reading_value_positive CHECK (reading_value >= 0)
);

-- Tariff Tables — Configurable tariff models, never hardcoded
CREATE TABLE IF NOT EXISTS resident.tariff_tables (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES resident.tenants(id) ON DELETE RESTRICT,
  name              text NOT NULL,
  description       text,
  tariff_type       resident.tariff_type NOT NULL DEFAULT 'progressive',
  currency          text NOT NULL DEFAULT 'BRL',
  effective_from    date NOT NULL DEFAULT CURRENT_DATE,
  effective_to      date,
  is_active         boolean NOT NULL DEFAULT true,
  min_consumption   numeric(12,3) NOT NULL DEFAULT 0,
  min_charge        numeric(15,2) NOT NULL DEFAULT 0,
  metadata          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);

-- Tariff Bands — Consumption bands within a tariff table
CREATE TABLE IF NOT EXISTS resident.tariff_bands (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tariff_table_id   uuid NOT NULL REFERENCES resident.tariff_tables(id) ON DELETE CASCADE,
  from_consumption  numeric(12,3) NOT NULL DEFAULT 0,
  to_consumption    numeric(12,3),
  unit_price        numeric(15,4) NOT NULL,
  flat_fee          numeric(15,2) NOT NULL DEFAULT 0,
  sort_order        integer NOT NULL DEFAULT 0,
  metadata          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_tariff_band_range CHECK (to_consumption IS NULL OR to_consumption > from_consumption),
  CONSTRAINT chk_tariff_band_price CHECK (unit_price >= 0)
);

-- Consumption Adjustments — Corrections to readings
CREATE TABLE IF NOT EXISTS resident.consumption_adjustments (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid NOT NULL REFERENCES resident.tenants(id) ON DELETE RESTRICT,
  reading_id              uuid NOT NULL REFERENCES resident.meter_readings(id) ON DELETE CASCADE,
  adjustment_type         text NOT NULL,
  previous_value          numeric(12,3) NOT NULL,
  adjusted_value          numeric(12,3) NOT NULL,
  reason                  text NOT NULL,
  adjusted_by_profile_id  uuid REFERENCES resident.profiles(id) ON DELETE SET NULL,
  metadata                jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_consumption_adjustment_type CHECK (
    adjustment_type IN ('manual_correction', 'meter_replacement', 'estimated_correction')
  )
);

-- Billing Rules — Configurable tenant-level water billing rules
CREATE TABLE IF NOT EXISTS resident.billing_rules (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES resident.tenants(id) ON DELETE RESTRICT,
  name              text NOT NULL,
  description       text,
  rule_type         text NOT NULL,
  rule_config       jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active         boolean NOT NULL DEFAULT true,
  sort_order        integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_billing_rule_type CHECK (
    rule_type IN ('minimum_consumption', 'rounding', 'estimated_reading')
  )
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_water_meters_tenant_property ON resident.water_meters (tenant_id, property_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_water_meters_status ON resident.water_meters (status) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_meter_readings_meter_date ON resident.meter_readings (meter_id, reading_date DESC);
CREATE INDEX IF NOT EXISTS idx_meter_readings_tenant_date ON resident.meter_readings (tenant_id, reading_date);

CREATE INDEX IF NOT EXISTS idx_tariff_tables_tenant_active ON resident.tariff_tables (tenant_id, is_active) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tariff_bands_table_sort ON resident.tariff_bands (tariff_table_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_consumption_adjustments_reading ON resident.consumption_adjustments (reading_id);

CREATE INDEX IF NOT EXISTS idx_billing_rules_tenant_type ON resident.billing_rules (tenant_id, rule_type) WHERE is_active = true;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Calculates consumption for a meter between two dates.
-- Finds the latest reading on or before each date and returns the difference.
CREATE OR REPLACE FUNCTION resident.calculate_consumption(
  p_meter_id uuid,
  p_from_date date,
  p_to_date date
) RETURNS numeric(12,3)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_previous numeric(12,3);
  v_current numeric(12,3);
BEGIN
  SELECT reading_value INTO v_previous
  FROM resident.meter_readings
  WHERE meter_id = p_meter_id
    AND reading_date <= p_from_date
  ORDER BY reading_date DESC, created_at DESC
  LIMIT 1;

  SELECT reading_value INTO v_current
  FROM resident.meter_readings
  WHERE meter_id = p_meter_id
    AND reading_date <= p_to_date
  ORDER BY reading_date DESC, created_at DESC
  LIMIT 1;

  IF v_previous IS NULL AND v_current IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_previous IS NULL THEN
    RETURN v_current;
  END IF;

  IF v_current < v_previous THEN
    RETURN NULL;
  END IF;

  RETURN v_current - v_previous;
END;
$$;
COMMENT ON FUNCTION resident.calculate_consumption(uuid, date, date)
  IS 'Calculates consumption (current - previous reading) for a meter between two dates. Returns NULL when data is insufficient.';

-- Applies a tariff table's consumption bands to a given consumption amount.
-- Returns a jsonb with total_amount, band breakdown, and min_charge info.
CREATE OR REPLACE FUNCTION resident.apply_tariff(
  p_consumption numeric(12,3),
  p_tariff_table_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tariff_table record;
  v_band record;
  v_remaining numeric(12,3);
  v_band_consumption numeric(12,3);
  v_band_charge numeric(15,4);
  v_total numeric(15,2) := 0;
  v_bands jsonb := '[]'::jsonb;
  v_result jsonb;
  v_has_bands boolean;
BEGIN
  SELECT * INTO v_tariff_table
  FROM resident.tariff_tables
  WHERE id = p_tariff_table_id
    AND deleted_at IS NULL
    AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tariff table not found or inactive: %', p_tariff_table_id;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM resident.tariff_bands WHERE tariff_table_id = p_tariff_table_id
  ) INTO v_has_bands;

  IF NOT v_has_bands THEN
    RAISE EXCEPTION 'Tariff table % has no bands defined', p_tariff_table_id;
  END IF;

  IF p_consumption <= v_tariff_table.min_consumption AND v_tariff_table.min_charge > 0 THEN
    v_result := jsonb_build_object(
      'total_amount', v_tariff_table.min_charge,
      'bands', '[]'::jsonb,
      'min_charge_applied', true,
      'min_consumption', v_tariff_table.min_consumption,
      'min_charge', v_tariff_table.min_charge,
      'calculated_consumption', p_consumption,
      'tariff_table_id', p_tariff_table_id,
      'tariff_type', v_tariff_table.tariff_type::text,
      'currency', v_tariff_table.currency
    );
    RETURN v_result;
  END IF;

  v_remaining := p_consumption;

  FOR v_band IN
    SELECT * FROM resident.tariff_bands
    WHERE tariff_table_id = p_tariff_table_id
    ORDER BY sort_order ASC, from_consumption ASC
  LOOP
    IF v_remaining <= 0 THEN
      EXIT;
    END IF;

    IF v_band.to_consumption IS NULL THEN
      v_band_consumption := v_remaining;
    ELSE
      v_band_consumption := LEAST(
        v_remaining,
        GREATEST(0, v_band.to_consumption - v_band.from_consumption)
      );
    END IF;

    IF v_band_consumption <= 0 THEN
      CONTINUE;
    END IF;

    v_band_charge := (v_band_consumption * v_band.unit_price) + v_band.flat_fee;
    v_total := v_total + v_band_charge;
    v_remaining := v_remaining - v_band_consumption;

    v_bands := v_bands || jsonb_build_object(
      'band_id', v_band.id,
      'from_consumption', v_band.from_consumption,
      'to_consumption', v_band.to_consumption,
      'consumption', v_band_consumption,
      'unit_price', v_band.unit_price,
      'flat_fee', v_band.flat_fee,
      'charge', ROUND(v_band_charge::numeric, 2)
    );
  END LOOP;

  v_result := jsonb_build_object(
    'total_amount', ROUND(v_total::numeric, 2),
    'bands', v_bands,
    'min_charge_applied', false,
    'min_consumption', v_tariff_table.min_consumption,
    'min_charge', v_tariff_table.min_charge,
    'calculated_consumption', p_consumption,
    'tariff_table_id', p_tariff_table_id,
    'tariff_type', v_tariff_table.tariff_type::text,
    'currency', v_tariff_table.currency
  );

  RETURN v_result;
END;
$$;
COMMENT ON FUNCTION resident.apply_tariff(numeric, uuid)
  IS 'Applies a tariff table''s consumption bands to the given consumption. Returns jsonb with total_amount, band breakdown, and fee details.';

-- ============================================================================
-- TRIGGER FUNCTIONS & TRIGGERS
-- ============================================================================

-- Sets initial meter reading when a water meter is created
CREATE OR REPLACE FUNCTION resident.set_initial_meter_reading()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.initial_reading IS NOT NULL AND NEW.initial_reading >= 0 THEN
    INSERT INTO resident.meter_readings (
      tenant_id, meter_id, reading_date, reading_value, source, notes
    ) VALUES (
      NEW.tenant_id, NEW.id, NEW.installation_date, NEW.initial_reading, 'initial',
      'Leitura inicial — instalação do hidrômetro ' || NEW.meter_number
    )
    ON CONFLICT (meter_id, reading_date) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_set_initial_meter_reading
  AFTER INSERT ON resident.water_meters
  FOR EACH ROW EXECUTE FUNCTION resident.set_initial_meter_reading();

-- Validates that new readings are not lower than previous readings
-- (with exception for meter replacement scenarios, which are handled via consumption_adjustments)
CREATE OR REPLACE FUNCTION resident.validate_reading_monotonic()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_previous numeric(12,3);
BEGIN
  IF NEW.source IN ('initial', 'corrected') THEN
    RETURN NEW;
  END IF;

  SELECT reading_value INTO v_previous
  FROM resident.meter_readings
  WHERE meter_id = NEW.meter_id
    AND reading_date < NEW.reading_date
    AND id != NEW.id
  ORDER BY reading_date DESC, created_at DESC
  LIMIT 1;

  IF v_previous IS NOT NULL AND NEW.reading_value < v_previous THEN
    RAISE EXCEPTION 'Reading value (%) cannot be lower than previous reading (%) for meter %. Use source=corrected or create a consumption_adjustment.',
      NEW.reading_value, v_previous, NEW.meter_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_validate_reading_monotonic
  BEFORE INSERT OR UPDATE ON resident.meter_readings
  FOR EACH ROW EXECUTE FUNCTION resident.validate_reading_monotonic();

-- updated_at triggers (reusing existing touch_updated_at function)

CREATE OR REPLACE TRIGGER trg_water_meters_updated_at
  BEFORE UPDATE ON resident.water_meters
  FOR EACH ROW EXECUTE FUNCTION resident.touch_updated_at();

CREATE OR REPLACE TRIGGER trg_meter_readings_updated_at
  BEFORE UPDATE ON resident.meter_readings
  FOR EACH ROW EXECUTE FUNCTION resident.touch_updated_at();

CREATE OR REPLACE TRIGGER trg_tariff_tables_updated_at
  BEFORE UPDATE ON resident.tariff_tables
  FOR EACH ROW EXECUTE FUNCTION resident.touch_updated_at();

CREATE OR REPLACE TRIGGER trg_billing_rules_updated_at
  BEFORE UPDATE ON resident.billing_rules
  FOR EACH ROW EXECUTE FUNCTION resident.touch_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- water_meters — Three-tier SELECT-only (owner, payers, platform)
ALTER TABLE resident.water_meters ENABLE ROW LEVEL SECURITY;
ALTER TABLE resident.water_meters FORCE ROW LEVEL SECURITY;

CREATE POLICY water_meters_select_owner_policy ON resident.water_meters
  FOR SELECT TO authenticated
  USING (
    resident.is_active_residence_member(property_id)
    AND deleted_at IS NULL
  );

CREATE POLICY water_meters_select_payers_policy ON resident.water_meters
  FOR SELECT TO authenticated
  USING (
    resident.has_tenant_permission(tenant_id, 'residence_payers:read')
    AND deleted_at IS NULL
  );

CREATE POLICY water_meters_select_platform_policy ON resident.water_meters
  FOR SELECT TO authenticated
  USING (
    resident.is_platform_admin()
  );

-- meter_readings — Three-tier SELECT-only
ALTER TABLE resident.meter_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE resident.meter_readings FORCE ROW LEVEL SECURITY;

CREATE POLICY meter_readings_select_owner_policy ON resident.meter_readings
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM resident.water_meters wm
      WHERE wm.id = meter_id
        AND resident.is_active_residence_member(wm.property_id)
        AND wm.deleted_at IS NULL
    )
  );

CREATE POLICY meter_readings_select_payers_policy ON resident.meter_readings
  FOR SELECT TO authenticated
  USING (
    resident.has_tenant_permission(tenant_id, 'residence_payers:read')
  );

CREATE POLICY meter_readings_select_platform_policy ON resident.meter_readings
  FOR SELECT TO authenticated
  USING (
    resident.is_platform_admin()
  );

-- tariff_tables — Association-wide SELECT (details permission for staff)
ALTER TABLE resident.tariff_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE resident.tariff_tables FORCE ROW LEVEL SECURITY;

CREATE POLICY tariff_tables_select_association_policy ON resident.tariff_tables
  FOR SELECT TO authenticated
  USING (
    resident.has_tenant_permission(tenant_id, 'association_details:read')
    AND deleted_at IS NULL
  );

CREATE POLICY tariff_tables_select_platform_policy ON resident.tariff_tables
  FOR SELECT TO authenticated
  USING (
    resident.is_platform_admin()
  );

-- tariff_bands — Inherits access via tariff table
ALTER TABLE resident.tariff_bands ENABLE ROW LEVEL SECURITY;
ALTER TABLE resident.tariff_bands FORCE ROW LEVEL SECURITY;

CREATE POLICY tariff_bands_select_association_policy ON resident.tariff_bands
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM resident.tariff_tables tt
      WHERE tt.id = tariff_table_id
        AND resident.has_tenant_permission(tt.tenant_id, 'association_details:read')
        AND tt.deleted_at IS NULL
    )
  );

CREATE POLICY tariff_bands_select_platform_policy ON resident.tariff_bands
  FOR SELECT TO authenticated
  USING (
    resident.is_platform_admin()
  );

-- consumption_adjustments — Three-tier SELECT-only
ALTER TABLE resident.consumption_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE resident.consumption_adjustments FORCE ROW LEVEL SECURITY;

CREATE POLICY consumption_adjustments_select_owner_policy ON resident.consumption_adjustments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM resident.meter_readings mr
        JOIN resident.water_meters wm ON wm.id = mr.meter_id
      WHERE mr.id = reading_id
        AND resident.is_active_residence_member(wm.property_id)
        AND wm.deleted_at IS NULL
    )
  );

CREATE POLICY consumption_adjustments_select_payers_policy ON resident.consumption_adjustments
  FOR SELECT TO authenticated
  USING (
    resident.has_tenant_permission(tenant_id, 'residence_payers:read')
  );

CREATE POLICY consumption_adjustments_select_platform_policy ON resident.consumption_adjustments
  FOR SELECT TO authenticated
  USING (
    resident.is_platform_admin()
  );

-- billing_rules — Association-wide SELECT
ALTER TABLE resident.billing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE resident.billing_rules FORCE ROW LEVEL SECURITY;

CREATE POLICY billing_rules_select_association_policy ON resident.billing_rules
  FOR SELECT TO authenticated
  USING (
    resident.has_tenant_permission(tenant_id, 'association_details:read')
  );

CREATE POLICY billing_rules_select_platform_policy ON resident.billing_rules
  FOR SELECT TO authenticated
  USING (
    resident.is_platform_admin()
  );

-- ============================================================================
-- GRANTS
-- ============================================================================

REVOKE ALL ON TABLE resident.water_meters FROM anon, authenticated;
REVOKE ALL ON TABLE resident.meter_readings FROM anon, authenticated;
REVOKE ALL ON TABLE resident.tariff_tables FROM anon, authenticated;
REVOKE ALL ON TABLE resident.tariff_bands FROM anon, authenticated;
REVOKE ALL ON TABLE resident.consumption_adjustments FROM anon, authenticated;
REVOKE ALL ON TABLE resident.billing_rules FROM anon, authenticated;

GRANT SELECT ON TABLE resident.water_meters TO authenticated;
GRANT SELECT ON TABLE resident.meter_readings TO authenticated;
GRANT SELECT ON TABLE resident.tariff_tables TO authenticated;
GRANT SELECT ON TABLE resident.tariff_bands TO authenticated;
GRANT SELECT ON TABLE resident.consumption_adjustments TO authenticated;
GRANT SELECT ON TABLE resident.billing_rules TO authenticated;

GRANT EXECUTE ON FUNCTION resident.calculate_consumption(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION resident.apply_tariff(numeric, uuid) TO authenticated;
