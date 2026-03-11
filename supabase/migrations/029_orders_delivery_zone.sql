ALTER TABLE orders ADD COLUMN delivery_zone_id uuid REFERENCES delivery_zones(id) ON DELETE SET NULL;
