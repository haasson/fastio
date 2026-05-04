-- Структурированный адрес филиала из DaData. Храним весь объект `data` целиком —
-- размер 2-3 КБ на филиал, филиалов на тенанта 1-30, экономить нет смысла, зато
-- открыта дорога для метро/региона/фиаса/qc без новых миграций.
--
-- Бэкфилл: для старых филиалов кладём минимальный объект {value: address},
-- этого достаточно для CHECK-консистентности и для save-without-changes.
-- При первом редактировании адреса фронт потребует выбрать подсказку DaData,
-- и это полноценно перезапишет address_data.

ALTER TABLE branches ADD COLUMN address_data jsonb;

UPDATE branches
SET address_data = jsonb_build_object('value', address)
WHERE address_data IS NULL;

ALTER TABLE branches ALTER COLUMN address_data SET NOT NULL;

-- Защита от рассинхрона: address всегда равен address_data->>'value'.
-- На уровне приложения мы тоже это валидируем, но constraint — последняя линия
-- защиты (например, ручной UPDATE через psql).
ALTER TABLE branches
  ADD CONSTRAINT branches_address_data_value_matches
  CHECK (address_data->>'value' = address);
