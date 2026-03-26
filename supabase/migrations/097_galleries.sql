-- Migration 097: Galleries
--
-- Галереи: наборы фото с настройками слайдера.
-- Каждая галерея — отдельный слайдер с заголовком, описанием и режимом отображения.

SET search_path = public;

-- ─── galleries ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS galleries (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name             text        NOT NULL,
  title            text,
  description      text,
  autoplay         boolean     NOT NULL DEFAULT false,
  autoplay_interval int        NOT NULL DEFAULT 4,
  sort_order       int         NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_galleries_tenant ON galleries(tenant_id);

ALTER TABLE galleries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "galleries: public read"
  ON galleries FOR SELECT
  USING (true);

CREATE POLICY "galleries: manager can insert"
  ON galleries FOR INSERT
  WITH CHECK (has_tenant_role(tenant_id, 'manager'));

CREATE POLICY "galleries: manager can update"
  ON galleries FOR UPDATE
  USING (has_tenant_role(tenant_id, 'manager'));

CREATE POLICY "galleries: manager can delete"
  ON galleries FOR DELETE
  USING (has_tenant_role(tenant_id, 'manager'));

-- ─── gallery_photos ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gallery_photos (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  gallery_id  uuid        NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
  tenant_id   uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  url         text        NOT NULL DEFAULT '',
  sort_order  int         NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_gallery_photos_gallery ON gallery_photos(gallery_id);
CREATE INDEX idx_gallery_photos_tenant  ON gallery_photos(tenant_id);

ALTER TABLE gallery_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gallery_photos: public read"
  ON gallery_photos FOR SELECT
  USING (true);

CREATE POLICY "gallery_photos: manager can insert"
  ON gallery_photos FOR INSERT
  WITH CHECK (has_tenant_role(tenant_id, 'manager'));

CREATE POLICY "gallery_photos: manager can update"
  ON gallery_photos FOR UPDATE
  USING (has_tenant_role(tenant_id, 'manager'));

CREATE POLICY "gallery_photos: manager can delete"
  ON gallery_photos FOR DELETE
  USING (has_tenant_role(tenant_id, 'manager'));
