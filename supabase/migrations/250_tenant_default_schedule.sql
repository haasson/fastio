-- Migration 250: дефолтный график работы для tenants.working_hours_schedule.
--
-- Проблема: миграция 087 создала колонку без DEFAULT, а self_register_tenant
-- (миграция 169) не передаёт значение → новый тенант получает NULL.
-- В UI настроек форма подставляет клиентский DEFAULT (10:00–22:00) только
-- для отображения; пока юзер не нажмёт «Сохранить», в БД остаётся NULL.
-- Это создавало визуальный диссонанс: «у меня в настройках 10–22, но slot
-- engine падает в FALLBACK 09–18, потому что в БД null».
--
-- Фикс:
-- 1. Поставить server-side DEFAULT (10:00–22:00) на колонку.
-- 2. Бэкфилл существующих NULL.
-- 3. Branches.working_hours_schedule оставляем без DEFAULT — там null имеет
--    семантику «наследовать у тенанта», это не ошибка.

ALTER TABLE tenants
  ALTER COLUMN working_hours_schedule SET DEFAULT
    jsonb_build_object(
      'default', jsonb_build_object('open', '10:00', 'close', '22:00'),
      'days', '{}'::jsonb
    );

UPDATE tenants
   SET working_hours_schedule = jsonb_build_object(
         'default', jsonb_build_object('open', '10:00', 'close', '22:00'),
         'days', '{}'::jsonb
       )
 WHERE working_hours_schedule IS NULL;

-- self_register_tenant теперь не нужно править: новый тенант получит DEFAULT
-- автоматически, потому что INSERT без явного значения в этой колонке.
