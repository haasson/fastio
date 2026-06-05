-- Migration 315: брони — часть модуля «Столы» (dineIn); modules.reservations упразднён
--
-- Раньше reservations был отдельным модулем: тоггл в module_configs + флаг
-- modules.reservations на тенанте + отдельная plan-фича. Теперь «Столы» (dineIn)
-- одним тоглом включает зал, QR-заказ и онлайн-бронирование. Признак «принимать
-- онлайн-брони вкл/выкл» переезжает в table_settings.booking_enabled — тем же
-- паттерном, что dine_in_ordering_enabled и waiter_call_enabled (миграция 313).
-- modules.reservations удаляется отовсюду. Гейт витрины = modules.dineIn AND
-- table_settings.booking_enabled.

-- 1. booking_enabled в table_settings — под-флаг приёма онлайн-броней.
--    DEFAULT true совпадает с соседними тогглами режима стола (313): новый
--    тенант с включёнными «Столами» по умолчанию принимает брони.
ALTER TABLE table_settings ADD COLUMN IF NOT EXISTS booking_enabled boolean NOT NULL DEFAULT true;

-- Переносим текущее значение modules.reservations в новый флаг (существующие строки),
-- ДО того как удалим сам ключ ниже. Нет ключа → false (брони не принимались).
UPDATE table_settings ts
SET booking_enabled = COALESCE((t.modules->>'reservations')::boolean, false)
FROM tenants t
WHERE ts.tenant_id = t.id;

-- 2. Триггер из миграции 148 (handle_module_toggle) сбрасывал max_guests_auto в
--    false при выключении dineIn. Лимит брони теперь всегда авто (см. шаг 7),
--    триггер устарел и только вредит — удаляем.
DROP TRIGGER IF EXISTS trg_module_toggle ON tenants;
DROP FUNCTION IF EXISTS handle_module_toggle();

-- 3. Тенанты, у кого брони были включены без модуля «Столы»: включаем dineIn,
--    чтобы и управление бронями (таб «Столы → Бронирование»), и приём броней
--    на витрине остались доступны.
UPDATE tenants
SET modules = jsonb_set(modules, '{dineIn}', 'true')
WHERE COALESCE((modules->>'reservations')::boolean, false) = true
  AND COALESCE((modules->>'dineIn')::boolean, false) = false;

-- 4. Удаляем flag modules.reservations у всех тенантов — он больше ничего не значит
--    (приём броней теперь в table_settings.booking_enabled, capability — в dineIn).
UPDATE tenants
SET modules = modules - 'reservations'
WHERE modules ? 'reservations';

-- 5. Убираем reservations из каталога модулей — отдельного тоггла больше нет.
DELETE FROM module_configs WHERE key = 'reservations';

-- Карточка модуля «Столы» теперь охватывает зал, QR-заказ и онлайн-брони.
UPDATE module_configs
SET name = 'Столы',
    description = 'Зал и столы, QR-заказ со стола и онлайн-бронирование столиков'
WHERE key = 'dineIn';

-- 6. Тарифы: reservations больше не отдельная plan-фича (гейт броней = dineIn).
--    Где тариф открывал reservations — гарантируем, что открывает и dineIn,
--    чтобы тенанты на таком тарифе не потеряли доступ к «Столам».
UPDATE plans
SET features = jsonb_set(features, '{modules,dineIn}', 'true')
WHERE features->'modules'->>'reservations' = 'true';

-- Затем выкидываем reservations-ключ из фич тарифа — он ничего не гейтит.
UPDATE plans
SET features = features #- '{modules,reservations}'
WHERE features->'modules' ? 'reservations';

-- 7. Лимит гостей в брони — всегда по вместимости самого большого стола.
--    Ручное «Максимум гостей» убрано из UI; max_guests_auto становится дефолтом
--    и включается всем (resolveMaxGuests на витрине берёт самый большой стол,
--    с фоллбэком на max_guests если столов нет).
ALTER TABLE reservation_settings ALTER COLUMN max_guests_auto SET DEFAULT true;
UPDATE reservation_settings SET max_guests_auto = true WHERE max_guests_auto = false;
