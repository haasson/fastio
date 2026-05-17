-- Убираем опт-аут "branchNotNeeded" из онбординга: теперь филиал обязателен
-- (для showcase-планов — упрощённый ввод только города). Чистим JSONB-флаг
-- у существующих тенантов + bootstrap'им stub-branch для тех у кого его нет
-- (без branch venue-mode page в админке показывает обрубок UI).

-- 1) Cleanup флага из onboarding_state. Безопасно — ключа может не быть.
UPDATE tenants
SET onboarding_state = onboarding_state - 'branchNotNeeded'
WHERE onboarding_state ? 'branchNotNeeded';

-- 2) Bootstrap stub-branch для тенантов без филиалов. Используем contacts.address
-- если заполнен, иначе ставим заглушку — юзер увидит её в админке и заменит на
-- реальный адрес через UI (CHECK-constraint на address_data заставит выбрать из
-- DaData при первой же правке).
INSERT INTO branches (tenant_id, name, address, address_data)
SELECT
  t.id,
  COALESCE(NULLIF(trim(t.name), ''), 'Основной'),
  COALESCE(NULLIF(trim(t.contacts->>'address'), ''), 'Адрес не указан'),
  jsonb_build_object('value', COALESCE(NULLIF(trim(t.contacts->>'address'), ''), 'Адрес не указан'))
FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM branches b WHERE b.tenant_id = t.id);
