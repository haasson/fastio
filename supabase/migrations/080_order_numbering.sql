-- ============================================================
-- Migration 080: Order numbering
-- ============================================================

-- A) New columns

ALTER TABLE tenants ADD COLUMN order_number_config jsonb;
ALTER TABLE branches ADD COLUMN order_number_prefix text;
ALTER TABLE orders ADD COLUMN order_number text;

-- B) Counter table (atomic per-tenant, per-period increments)

CREATE TABLE order_number_counters (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  period    text NOT NULL,
  value     bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, period)
);

-- C) Generator function

CREATE OR REPLACE FUNCTION generate_order_number(
  p_tenant_id uuid,
  p_config    jsonb,
  p_branch_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_format       text;
  v_scope        text;
  v_prefix       text;
  v_date_fmt     text;
  v_reset_period text;
  v_pad_length   int;
  v_start_from   bigint;
  v_counter      bigint;
  v_period       text;
  v_date_part    text;
  v_counter_str  text;
  v_branch_prefix text;
BEGIN
  v_format       := COALESCE(p_config->>'format', 'counter');
  v_scope        := COALESCE(p_config->>'scope', 'global');
  v_prefix       := COALESCE(p_config->>'prefix', '');
  v_date_fmt     := COALESCE(p_config->>'dateFormat', 'DDMM');
  v_reset_period := COALESCE(p_config->>'resetPeriod', 'never');
  v_pad_length   := COALESCE((p_config->>'padLength')::int, 0);
  v_start_from   := COALESCE((p_config->>'startFrom')::bigint, 1);

  -- Determine counter period key
  IF v_scope = 'per_branch' AND p_branch_id IS NOT NULL THEN
    IF v_reset_period = 'daily' THEN
      v_period := 'branch_' || p_branch_id::text || '_' || to_char(now(), 'YYYY-MM-DD');
    ELSE
      v_period := 'branch_' || p_branch_id::text;
    END IF;
  ELSE
    IF v_reset_period = 'daily' THEN
      v_period := 'global_' || to_char(now(), 'YYYY-MM-DD');
    ELSE
      v_period := 'global';
    END IF;
  END IF;

  -- Atomic increment
  INSERT INTO order_number_counters (tenant_id, period, value)
  VALUES (p_tenant_id, v_period, 1)
  ON CONFLICT (tenant_id, period)
  DO UPDATE SET value = order_number_counters.value + 1
  RETURNING value INTO v_counter;

  -- Apply startFrom offset
  v_counter := v_counter + v_start_from - 1;

  -- Format counter with optional zero-padding
  IF v_pad_length > 0 THEN
    v_counter_str := lpad(v_counter::text, v_pad_length, '0');
  ELSE
    v_counter_str := v_counter::text;
  END IF;

  -- Build date part if needed
  IF v_format IN ('date_counter', 'prefix_date_counter') THEN
    IF v_date_fmt = 'DDMM' THEN
      v_date_part := to_char(now(), 'DDMM');
    ELSIF v_date_fmt = 'DDMMYY' THEN
      v_date_part := to_char(now(), 'DDMMYY');
    ELSE -- YYYYMMDD
      v_date_part := to_char(now(), 'YYYYMMDD');
    END IF;
  END IF;

  -- Resolve prefix: per-branch overrides global default
  IF v_scope = 'per_branch' AND p_branch_id IS NOT NULL THEN
    SELECT order_number_prefix INTO v_branch_prefix
    FROM branches
    WHERE id = p_branch_id;

    IF v_branch_prefix IS NOT NULL AND v_branch_prefix <> '' THEN
      v_prefix := v_branch_prefix;
    END IF;
  END IF;

  -- Assemble final number
  RETURN CASE v_format
    WHEN 'counter' THEN
      v_counter_str
    WHEN 'prefix_counter' THEN
      CASE WHEN v_prefix <> '' THEN v_prefix || '-' || v_counter_str ELSE v_counter_str END
    WHEN 'date_counter' THEN
      v_date_part || '-' || v_counter_str
    WHEN 'prefix_date_counter' THEN
      CASE WHEN v_prefix <> ''
        THEN v_prefix || '-' || v_date_part || '-' || v_counter_str
        ELSE v_date_part || '-' || v_counter_str
      END
    ELSE v_counter_str
  END;
END;
$$;

-- D) Trigger function

CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_config jsonb;
BEGIN
  SELECT order_number_config INTO v_config
  FROM tenants
  WHERE id = NEW.tenant_id;

  IF v_config IS NOT NULL AND (v_config->>'enabled')::boolean = true THEN
    NEW.order_number := generate_order_number(NEW.tenant_id, v_config, NEW.branch_id);
  END IF;

  RETURN NEW;
END;
$$;

-- E) Trigger

CREATE TRIGGER trg_set_order_number
BEFORE INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION set_order_number();
