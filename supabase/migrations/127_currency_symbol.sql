ALTER TABLE tenants ALTER COLUMN currency SET DEFAULT '₽';
UPDATE tenants SET currency = '₽' WHERE currency = 'RUB';
