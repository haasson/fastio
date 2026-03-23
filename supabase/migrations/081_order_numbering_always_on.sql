-- ============================================================
-- Migration 081: Order numbering is always on
-- Default: simple global counter starting from 1
-- ============================================================

CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_config jsonb;
  v_default_config constant jsonb := '{
    "format": "counter",
    "scope": "global",
    "prefix": "",
    "dateFormat": "DDMM",
    "resetPeriod": "never",
    "padLength": 0,
    "startFrom": 1
  }'::jsonb;
BEGIN
  SELECT order_number_config INTO v_config
  FROM tenants
  WHERE id = NEW.tenant_id;

  NEW.order_number := generate_order_number(
    NEW.tenant_id,
    COALESCE(v_config, v_default_config),
    NEW.branch_id
  );

  RETURN NEW;
END;
$$;
