-- Add table reference to orders
ALTER TABLE orders
  ADD COLUMN table_id   UUID REFERENCES tables(id) ON DELETE SET NULL,
  ADD COLUMN table_name VARCHAR(100);

-- Extend delivery_type constraint to include dine_in
ALTER TABLE orders DROP CONSTRAINT orders_delivery_type_check;
ALTER TABLE orders ADD CONSTRAINT orders_delivery_type_check
  CHECK (delivery_type IN ('delivery', 'pickup', 'dine_in'));

-- Prevent dine_in orders on closed tables
CREATE OR REPLACE FUNCTION check_table_is_open()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.table_id IS NOT NULL AND NEW.delivery_type = 'dine_in' THEN
    IF NOT EXISTS (
      SELECT 1 FROM tables
      WHERE id = NEW.table_id AND is_open = true AND is_active = true
    ) THEN
      RAISE EXCEPTION 'Table is not open or not active';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_orders_check_table_open
  BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION check_table_is_open();
