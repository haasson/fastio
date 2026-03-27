UPDATE dishes SET weight_unit = 'г' WHERE weight_unit = 'g';
UPDATE dishes SET weight_unit = 'мл' WHERE weight_unit = 'ml';
ALTER TABLE dishes ALTER COLUMN weight_unit SET DEFAULT 'г';
