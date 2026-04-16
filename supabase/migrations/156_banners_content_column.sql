SET search_path = public;

ALTER TABLE banners ADD COLUMN IF NOT EXISTS content text DEFAULT NULL;
