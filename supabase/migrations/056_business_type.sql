-- Add business_type to tenants
-- food = общепит (Меню), retail = магазин (Каталог), services = услуги (Услуги)
ALTER TABLE tenants ADD COLUMN business_type text;
