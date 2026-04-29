-- Migration 212: убираем дублирующий индекс idx_service_resources_resource.
--
-- Таблица service_resources имеет PRIMARY KEY (resource_id, service_id).
-- PK создаёт уникальный b-tree, который полностью покрывает запросы по
-- ведущему столбцу resource_id. Отдельный idx_service_resources_resource
-- (см. миграцию 185) — избыточен, занимает место и замедляет вставки.
--
-- idx_service_resources_service оставляем — он по второму столбцу PK,
-- который через ведущий ключ не покрыт.

DROP INDEX IF EXISTS idx_service_resources_resource;
