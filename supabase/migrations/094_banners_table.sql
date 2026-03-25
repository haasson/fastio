-- Migration 094: Banners table
--
-- Выносим баннеры из tenants.site_content (JSONB) в отдельную таблицу.
-- content (rich text) хранится на баннере — это лендинг баннера, не акции.

SET search_path = public;

-- ─── Schema ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS banners (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  url           text        NOT NULL,
  enabled       boolean     NOT NULL DEFAULT true,
  sort_order    int         NOT NULL DEFAULT 0,
  promotion_id  uuid        REFERENCES promotions(id) ON DELETE SET NULL,
  promo_code_id uuid        REFERENCES promo_codes(id) ON DELETE SET NULL,
  link          text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_banners_tenant ON banners(tenant_id);

-- ─── RLS ─────────────────────────────────────────────────────

ALTER TABLE banners ENABLE ROW LEVEL SECURITY;

-- Витрина читает все (фильтрация по enabled — на уровне приложения)
CREATE POLICY "banners: public read"
  ON banners FOR SELECT
  USING (true);

CREATE POLICY "banners: manager can insert"
  ON banners FOR INSERT
  WITH CHECK (has_tenant_role(tenant_id, 'manager'));

CREATE POLICY "banners: manager can update"
  ON banners FOR UPDATE
  USING (has_tenant_role(tenant_id, 'manager'));

CREATE POLICY "banners: manager can delete"
  ON banners FOR DELETE
  USING (has_tenant_role(tenant_id, 'manager'));

-- ─── Migrate existing banners from JSONB ─────────────────────

DO $$
DECLARE
  r         record;
  banner    jsonb;
  idx       int;
BEGIN
  FOR r IN SELECT id, site_content FROM tenants WHERE site_content->'banners' IS NOT NULL LOOP
    idx := 0;
    FOR banner IN SELECT jsonb_array_elements(r.site_content->'banners') LOOP
      IF (banner->>'url') IS NOT NULL AND (banner->>'url') != '' THEN
        INSERT INTO banners (tenant_id, url, enabled, sort_order, link)
        VALUES (
          r.id,
          banner->>'url',
          COALESCE((banner->>'enabled')::boolean, true),
          idx,
          banner->>'link'
        );
        idx := idx + 1;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

-- Убираем banners из site_content JSONB
UPDATE tenants
SET site_content = site_content - 'banners'
WHERE site_content ? 'banners';
