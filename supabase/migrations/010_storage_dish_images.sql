-- Создать публичный bucket для фото блюд
INSERT INTO storage.buckets (id, name, public)
VALUES ('dish-images', 'dish-images', true)
ON CONFLICT DO NOTHING;

-- Public read
CREATE POLICY "dish-images: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'dish-images');

-- manager+ может загружать в папку своего тенанта
CREATE POLICY "dish-images: manager can insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'dish-images' AND
    has_tenant_role(split_part(name, '/', 1)::uuid, 'manager')
  );

-- manager+ может удалять из своей папки
CREATE POLICY "dish-images: manager can delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'dish-images' AND
    has_tenant_role(split_part(name, '/', 1)::uuid, 'manager')
  );
