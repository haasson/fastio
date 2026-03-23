-- Allow null customer_phone for dine_in orders (no phone required)
ALTER TABLE orders ALTER COLUMN customer_phone DROP NOT NULL;
