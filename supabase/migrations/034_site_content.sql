-- Добавляем колонку site_content
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS site_content jsonb NOT NULL DEFAULT '{}';

-- Мигрируем данные из theme и site_layout
UPDATE tenants SET site_content = jsonb_build_object(
  'logo', theme->>'logoUrl',
  'hero', jsonb_build_object(
    'bgUrl', site_layout->'sections'->'hero'->>'bgUrl',
    'text',  site_layout->'sections'->'hero'->>'content'
  ),
  'banners', COALESCE(site_layout->'sections'->'banners'->'items', '[]'::jsonb)
);

-- Чистим старые поля
UPDATE tenants SET
  theme = theme - 'logoUrl' - 'bannerUrl',
  site_layout = CASE
    WHEN site_layout->'sections' IS NOT NULL THEN
      jsonb_set(
        jsonb_set(
          site_layout,
          '{sections,hero}',
          COALESCE(site_layout->'sections'->'hero', '{}'::jsonb) - 'bgUrl' - 'content'
        ),
        '{sections,banners}',
        COALESCE(site_layout->'sections'->'banners', '{}'::jsonb) - 'items'
      )
    ELSE site_layout
  END;
