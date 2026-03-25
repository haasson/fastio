SET search_path = public;

ALTER TABLE banners ADD COLUMN IF NOT EXISTS page text DEFAULT NULL;
