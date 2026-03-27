SET search_path = public;

-- Глобальный дефолт на уровне тенанта (NULL = без ограничений)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS max_addons_default int DEFAULT NULL;

-- Per-dish override (NULL = использовать дефолт тенанта)
ALTER TABLE dishes ADD COLUMN IF NOT EXISTS max_addons int DEFAULT NULL;
