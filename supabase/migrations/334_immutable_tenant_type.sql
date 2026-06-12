-- 334: business_type и menu_style иммутабельны после онбординга.
--
-- Найдено в ручном тестинге 3.18 (2026-06-12): RLS-политика
-- «tenants: settings.edit can update» имеет qual has_permission(id,'settings.edit')
-- и ПУСТОЙ with_check, колоночных GRANT-ограничений нет, триггера-гарда нет.
-- RLS не умеет ограничивать колонки → любой держатель settings.edit
-- (owner/Администратор) мог сменить business_type/menu_style прямым
-- supabase.from('tenants').update(...), пробивая инвариант «no hybrid tenants»
-- (тенант всегда retail XOR services). UI эти поля не показывает — защита была
-- только UI-side. Вдобавок смена business_type даже не аудировалась
-- (его нет в WHEN audit_tenants).
--
-- Гейт на OLD.onboarding_completed: во время онбординга поля выставляются
-- свободно (menu_style легитимно меняется food→catalog), у завершённого
-- тенанта — заперты. service_role (backoffice/edge) — bypass для возможной
-- легитимной коррекции, по аналогии с prevent_billing_self_update.

CREATE OR REPLACE FUNCTION prevent_tenant_type_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- service_role (backoffice / edge-функции) — доверенный, пропускаем.
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- До завершения онбординга поля ещё выбираются — не мешаем.
  IF OLD.onboarding_completed THEN
    IF NEW.business_type IS DISTINCT FROM OLD.business_type THEN
      RAISE EXCEPTION 'Тип бизнеса нельзя изменить после онбординга'
        USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.menu_style IS DISTINCT FROM OLD.menu_style THEN
      RAISE EXCEPTION 'Стиль меню нельзя изменить после онбординга'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_prevent_tenant_type_change ON public.tenants;
CREATE TRIGGER trg_prevent_tenant_type_change
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION prevent_tenant_type_change();
