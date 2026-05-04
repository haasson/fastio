-- Адрес филиала становится обязательным.
-- Бэкфил пустых значений именем филиала, чтобы NOT NULL не упал.
UPDATE branches
SET address = name
WHERE address IS NULL OR trim(address) = '';

ALTER TABLE branches
  ALTER COLUMN address SET NOT NULL;
