-- PREPROD-105: dish-images storage policy — единые имена + has_permission('menu.edit') + UPDATE policy
--
-- Контекст: миграция 010 создавала полиси через устаревший has_tenant_role(..., 'manager').
-- Миграция 109 уже подменила их на has_permission(..., 'menu.edit'), но:
--   1. потеряла клейуз TO authenticated (security: меньше работы планнеру и явность);
--   2. отсутствует UPDATE policy — любой upsert/перезапись файла в bucket сломается;
--   3. имена политик легаси-стиля ("manager can ...") смешались с новыми.
-- Эта миграция приводит политики dish-images к единому виду по образцу 123_storage_documents.sql.

-- Сносим все возможные предыдущие имена (idempotent)
DROP POLICY IF EXISTS "dish-images: manager can insert" ON storage.objects;
DROP POLICY IF EXISTS "dish-images: manager can delete" ON storage.objects;
DROP POLICY IF EXISTS "dish-images: menu.edit can insert" ON storage.objects;
DROP POLICY IF EXISTS "dish-images: menu.edit can update" ON storage.objects;
DROP POLICY IF EXISTS "dish-images: menu.edit can delete" ON storage.objects;

-- menu.edit может загружать в папку своего тенанта
CREATE POLICY "dish-images: menu.edit can insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'dish-images'
    AND has_permission((split_part(name, '/', 1))::uuid, 'menu.edit')
  );

-- menu.edit может перезаписывать (upsert) файлы в своей папке
CREATE POLICY "dish-images: menu.edit can update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'dish-images'
    AND has_permission((split_part(name, '/', 1))::uuid, 'menu.edit')
  );

-- menu.edit может удалять из своей папки
CREATE POLICY "dish-images: menu.edit can delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'dish-images'
    AND has_permission((split_part(name, '/', 1))::uuid, 'menu.edit')
  );
