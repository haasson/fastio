-- Публичный bucket для ассетов тенанта (логотип, баннер и т.д.)
INSERT INTO storage.buckets (id, name, public)
VALUES ('tenant-assets', 'tenant-assets', true)
ON CONFLICT DO NOTHING;

-- Public read
CREATE POLICY "tenant-assets: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'tenant-assets');

-- owner/manager может загружать в папку своего тенанта
CREATE POLICY "tenant-assets: manager can insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'tenant-assets' AND
    has_tenant_role(split_part(name, '/', 1)::uuid, 'manager')
  );

-- owner/manager может обновлять файлы в своей папке
CREATE POLICY "tenant-assets: manager can update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'tenant-assets' AND
    has_tenant_role(split_part(name, '/', 1)::uuid, 'manager')
  );

-- owner/manager может удалять из своей папки
CREATE POLICY "tenant-assets: manager can delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'tenant-assets' AND
    has_tenant_role(split_part(name, '/', 1)::uuid, 'manager')
  );
