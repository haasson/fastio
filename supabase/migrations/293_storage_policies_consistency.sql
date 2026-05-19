-- Доравниваем storage-полиси addon-images / tenant-assets к dish-images
-- (миграция 292): explicit TO authenticated, добавление UPDATE-полиси на
-- addon-images (на случай upsert через client SDK).
--
-- Все полиси переcоздаются через DROP IF EXISTS + CREATE — идемпотентно.

-- ═══════════════════════════════════════
-- STORAGE: addon-images
-- ═══════════════════════════════════════
DROP POLICY IF EXISTS "addon-images: manager can insert" ON storage.objects;
DROP POLICY IF EXISTS "addon-images: manager can delete" ON storage.objects;
DROP POLICY IF EXISTS "addon-images: menu.edit can insert" ON storage.objects;
DROP POLICY IF EXISTS "addon-images: menu.edit can update" ON storage.objects;
DROP POLICY IF EXISTS "addon-images: menu.edit can delete" ON storage.objects;

CREATE POLICY "addon-images: menu.edit can insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'addon-images'
    AND has_permission((split_part(name, '/', 1))::uuid, 'menu.edit')
  );

CREATE POLICY "addon-images: menu.edit can update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'addon-images'
    AND has_permission((split_part(name, '/', 1))::uuid, 'menu.edit')
  );

CREATE POLICY "addon-images: menu.edit can delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'addon-images'
    AND has_permission((split_part(name, '/', 1))::uuid, 'menu.edit')
  );

-- ═══════════════════════════════════════
-- STORAGE: tenant-assets
-- ═══════════════════════════════════════
DROP POLICY IF EXISTS "tenant-assets: manager can insert" ON storage.objects;
DROP POLICY IF EXISTS "tenant-assets: manager can update" ON storage.objects;
DROP POLICY IF EXISTS "tenant-assets: manager can delete" ON storage.objects;
DROP POLICY IF EXISTS "tenant-assets: settings.edit can insert" ON storage.objects;
DROP POLICY IF EXISTS "tenant-assets: settings.edit can update" ON storage.objects;
DROP POLICY IF EXISTS "tenant-assets: settings.edit can delete" ON storage.objects;

CREATE POLICY "tenant-assets: settings.edit can insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'tenant-assets'
    AND has_permission((split_part(name, '/', 1))::uuid, 'settings.edit')
  );

CREATE POLICY "tenant-assets: settings.edit can update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'tenant-assets'
    AND has_permission((split_part(name, '/', 1))::uuid, 'settings.edit')
  );

CREATE POLICY "tenant-assets: settings.edit can delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'tenant-assets'
    AND has_permission((split_part(name, '/', 1))::uuid, 'settings.edit')
  );
