-- Migration 254: resource_unavailability — отпуск/больничный/обучение мастера
-- (диапазон дат, в отличие от resource_date_overrides — точечные дни).
--
-- Зачем отдельная таблица, а не расширение date_overrides:
--   * date_overrides — про «нестандартные часы конкретного дня» (10-15 вместо 10-22),
--     unavailability — про «полностью отсутствует период». Разная семантика.
--   * Отпуск = диапазон, заводить N override-строк на каждый день — UX-ад.
--   * Семантический reason ('vacation'/'sick_leave'/'training'/'other') нужен только
--     для unavailability — у date_overrides его нет и не должно быть.
--
-- Приоритет в resolveResourceWorkingHours: unavailability > date_override > shift-cycle
-- > weekly > branch > tenant. То есть отпуск перебивает всё, даже специально
-- назначенный override на день — это форс-мажор, не «нестандартный график».

CREATE TABLE resource_unavailability (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  date_from   date NOT NULL,
  date_to     date NOT NULL,
  reason      text NOT NULL CHECK (reason IN ('vacation', 'sick_leave', 'training', 'other')),
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (date_from <= date_to)
);

CREATE INDEX idx_resource_unavailability_resource_dates
  ON resource_unavailability (resource_id, date_from, date_to);

CREATE INDEX idx_resource_unavailability_tenant
  ON resource_unavailability (tenant_id);

-- ─── Triggers ──────────────────────────────────────────────────────

-- updated_at автоинкремент.
CREATE OR REPLACE FUNCTION resource_unavailability_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_resource_unavailability_set_updated_at
  BEFORE UPDATE ON resource_unavailability
  FOR EACH ROW EXECUTE FUNCTION resource_unavailability_set_updated_at();

-- Защита от cross-tenant ссылки: tenant_id обязан совпадать с tenant_id ресурса.
-- Без этого admin/UI могли бы записать unavailability со ссылкой на чужого ресурса.
CREATE OR REPLACE FUNCTION resource_unavailability_check_tenant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_resource_tenant uuid;
BEGIN
  SELECT tenant_id INTO v_resource_tenant FROM resources WHERE id = NEW.resource_id;
  IF v_resource_tenant IS NULL THEN
    RAISE EXCEPTION 'resource_unavailability: resource % not found', NEW.resource_id;
  END IF;
  IF v_resource_tenant <> NEW.tenant_id THEN
    RAISE EXCEPTION 'resource_unavailability: tenant_id (%) does not match resource.tenant_id (%)',
      NEW.tenant_id, v_resource_tenant;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_resource_unavailability_check_tenant
  BEFORE INSERT OR UPDATE OF tenant_id, resource_id ON resource_unavailability
  FOR EACH ROW EXECUTE FUNCTION resource_unavailability_check_tenant();

-- ─── RLS ──────────────────────────────────────────────────────────

ALTER TABLE resource_unavailability ENABLE ROW LEVEL SECURITY;

-- Чтение для tenant-member'ов (по аналогии с resource_date_overrides_tenant_read).
-- Anon не имеет — расписание отпусков мастеров не публичная информация.
-- Storefront читает через server endpoint с service_role.
CREATE POLICY "resource_unavailability_tenant_read"
  ON resource_unavailability FOR SELECT
  TO authenticated
  USING (is_tenant_member(tenant_id));

-- Управление (INSERT/UPDATE/DELETE) — членам тенанта с appointments.manage.
-- Owner проходит has_permission по умолчанию.
CREATE POLICY "resource_unavailability_manage"
  ON resource_unavailability FOR ALL
  TO authenticated
  USING (is_tenant_member(tenant_id) AND has_permission(tenant_id, 'appointments.manage'))
  WITH CHECK (is_tenant_member(tenant_id) AND has_permission(tenant_id, 'appointments.manage'));

CREATE POLICY "resource_unavailability_service_role"
  ON resource_unavailability FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
