-- Публичный bucket для документов тенанта (политика конфиденциальности, оферта и т.д.)
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT DO NOTHING;

-- Public read
CREATE POLICY "documents: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'documents');

-- settings.edit может загружать в папку своего тенанта
CREATE POLICY "documents: manager can insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documents' AND
    has_permission(split_part(name, '/', 1)::uuid, 'settings.edit')
  );

-- settings.edit может обновлять файлы в своей папке
CREATE POLICY "documents: manager can update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'documents' AND
    has_permission(split_part(name, '/', 1)::uuid, 'settings.edit')
  );

-- settings.edit может удалять из своей папки
CREATE POLICY "documents: manager can delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documents' AND
    has_permission(split_part(name, '/', 1)::uuid, 'settings.edit')
  );
