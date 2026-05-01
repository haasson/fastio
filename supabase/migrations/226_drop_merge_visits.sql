-- =====================================================================================
-- Migration 226: убираем merge_visits + merged_into_id
-- =====================================================================================
--
-- Решили отказаться от объединения визитов: кейс «два визита одного клиента в
-- один день, надо склеить» закрывается обычным cancel + add_service_to_visit.
-- Аудит при этом честнее (видно что был ошибочный визит, отменили), а в коде
-- меньше веток (фильтр merged_into IS NULL во всех выборках, бейдж merged,
-- блокировка экшенов на странице, отдельная логика в кабинете клиента).
--
-- Чистим:
--   1. RPC merge_visits — DROP
--   2. FK appointment_groups.merged_into_id → DROP
--   3. Индекс appointment_groups_merged_into_idx → DROP
--   4. Колонка appointment_groups.merged_into_id → DROP
-- =====================================================================================


DROP FUNCTION IF EXISTS public.merge_visits(uuid, uuid);

ALTER TABLE appointment_groups
  DROP CONSTRAINT IF EXISTS appointment_groups_merged_into_fkey;

DROP INDEX IF EXISTS appointment_groups_merged_into_idx;

ALTER TABLE appointment_groups
  DROP COLUMN IF EXISTS merged_into_id;
