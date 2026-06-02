-- Migration 308: Table settings — настройки модуля столов
--
-- Одна строка на тенанта. Параметры вызова официанта (лейбл/иконка кнопки,
-- кулдаун, эскалация) и отображения Зала (ширина плитки, показ категории блюда).
-- Дефолтную строку создаём лениво (upsert при первом сохранении из админки).

-- ─── table_settings ───────────────────────────────────────

CREATE TABLE table_settings (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  call_button_label       text NOT NULL DEFAULT 'Официант',
  call_button_icon        text,                                   -- имя иконки (enum @fastio/icons)
  call_cooldown_seconds   int NOT NULL DEFAULT 30,
  call_escalation_minutes int NOT NULL DEFAULT 10,                -- через сколько минут оранжевый вызов → красный
  canvas_tile_size        text NOT NULL DEFAULT 's' CHECK (canvas_tile_size IN ('s', 'm', 'l')),
  show_dish_category      boolean NOT NULL DEFAULT false,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_table_settings_updated_at
  BEFORE UPDATE ON table_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── RLS ──────────────────────────────────────────────────
-- Чтение: любой участник тенанта (список/Зал применяют настройки).
-- Запись: право 'tables.manage' (owner/admin/manager) — тот же permission,
--   что и у CRUD типов вызова (table_call_types), переезжающих в Настройки.
-- Storefront читает через service-role server-endpoint.

ALTER TABLE table_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "table_settings: member can select"
  ON table_settings FOR SELECT
  USING (is_tenant_member(tenant_id));

CREATE POLICY "table_settings: tables.manage can insert"
  ON table_settings FOR INSERT
  WITH CHECK (has_permission(tenant_id, 'tables.manage'));

CREATE POLICY "table_settings: tables.manage can update"
  ON table_settings FOR UPDATE
  USING (has_permission(tenant_id, 'tables.manage'));

CREATE POLICY "table_settings: service role full access"
  ON table_settings FOR ALL
  USING (auth.role() = 'service_role');
