ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS use_first_dish_photo boolean NOT NULL DEFAULT false;
