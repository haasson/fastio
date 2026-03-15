-- Make customer_name optional (nullable)
ALTER TABLE orders ALTER COLUMN customer_name DROP NOT NULL;
ALTER TABLE orders ALTER COLUMN customer_name SET DEFAULT NULL;

-- Clear empty strings to NULL for consistency
UPDATE orders SET customer_name = NULL WHERE customer_name = '';
