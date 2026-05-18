-- PREPROD-016: file_size_limit + allowed_mime_types для всех 5 storage bucket'ов.
--
-- До этой миграции bucket'ы создавались без ограничений → авторизованный member
-- тенанта мог загрузить 100MB видео под видом .jpg, .svg со <script>, polyglot
-- файлы и т.д. Bucket'ы public → файлы доступны всем по URL.
--
-- Решение: явные file_size_limit (в байтах) и allowed_mime_types для каждого
-- bucket'а на уровне самого Supabase Storage (он сам отдаст 413/415 без
-- доезда до приложения).
--
-- Почему SVG разрешён в tenant-assets:
-- - apps/admin/shared/data/api/tenants.ts:139-151 (uploadAsset) явно поддерживает
--   SVG для логотипов тенантов.
-- - Все 4 места отрисовки логотипа — через <img src> (sandboxed):
--   apps/storefront/shared/ui/sections/SiteHeader.vue,
--   apps/storefront/layouts/table.vue,
--   apps/admin/features/appearance/components/HeaderOptions.vue,
--   apps/storefront/app.vue (og:image).
-- - JS внутри SVG в <img> браузером не выполняется → XSS-вектор закрыт.
-- - Техдолг с триггерами «когда стрелять» зафиксирован в TECHDEBT.md
--   (раздел «SVG в tenant-assets разрешён без server-side sanitize»).

-- dish-images, addon-images: фото блюд / аддонов меню, 5 MB, без SVG.
UPDATE storage.buckets
SET
  file_size_limit = 5242880, -- 5 MB
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id IN ('dish-images', 'addon-images');

-- tenant-assets: логотипы, favicon, brand assets — SVG разрешён (см. комментарий выше).
UPDATE storage.buckets
SET
  file_size_limit = 5242880, -- 5 MB
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
WHERE id = 'tenant-assets';

-- support-attachments: вложения в саппорт-чате (скрины багов и т.д.), 10 MB.
UPDATE storage.buckets
SET
  file_size_limit = 10485760, -- 10 MB
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id = 'support-attachments';

-- documents: PDF (договоры, оферты, инвойсы), 10 MB.
UPDATE storage.buckets
SET
  file_size_limit = 10485760, -- 10 MB
  allowed_mime_types = ARRAY['application/pdf']
WHERE id = 'documents';
