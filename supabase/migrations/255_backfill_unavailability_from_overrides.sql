-- Migration 255: backfill resource_unavailability из старых date_overrides + чистка.
--
-- До 254 «отпуск/выходной мастера на период» хранили в `resource_date_overrides`
-- мульти-INSERT'ом — по строке на каждую дату диапазона с `is_working=false`.
-- Это давало:
--   * 14 строк в БД на 14-дневный отпуск;
--   * 14 запросов на удаление/edit периода;
--   * семантическую кашу: dateOverride концептуально про «нестандартные часы
--     дня», а не «период отсутствия».
--
-- Теперь периоды живут в `resource_unavailability` (мигр. 254): одна строка на
-- весь диапазон + поле `reason` (vacation/sick_leave/training/other) + notes.
--
-- В backfill подряд идущие даты одного ресурса схлопываем в один период через
-- island/gap трюк (`date - row_number()` даёт одинаковый grp у соседей).
-- Reason ставим 'other' — старые записи не различали отпуск vs больничный.
--
-- Идемпотентность: WHERE NOT EXISTS отсекает периоды, уже перенесённые
-- предыдущим прогоном. На уникальность ровно нечего ловить триггерами/CHECK,
-- поэтому опираемся на (resource_id, date_from, date_to).

WITH ordered AS (
  SELECT
    o.resource_id,
    o.date,
    r.tenant_id,
    -- island grouping: в подряд идущих датах разница (date - rn*1day) одинакова.
    (o.date - (ROW_NUMBER() OVER (PARTITION BY o.resource_id ORDER BY o.date))::int) AS grp
  FROM resource_date_overrides o
  JOIN resources r ON r.id = o.resource_id
  WHERE o.is_working = false
),
periods AS (
  SELECT
    tenant_id,
    resource_id,
    MIN(date) AS date_from,
    MAX(date) AS date_to
  FROM ordered
  GROUP BY tenant_id, resource_id, grp
)
INSERT INTO resource_unavailability (tenant_id, resource_id, date_from, date_to, reason, notes)
SELECT p.tenant_id, p.resource_id, p.date_from, p.date_to, 'other', 'Перенесено из date_overrides миграцией 255'
FROM periods p
WHERE NOT EXISTS (
  SELECT 1 FROM resource_unavailability u
  WHERE u.resource_id = p.resource_id
    AND u.date_from = p.date_from
    AND u.date_to = p.date_to
);

-- Удаляем мигрированные строки. Оставлять опасно: resolveResourceWorkingHours
-- проверяет unavailability ДО override, поэтому функционально ничего не
-- сломается, но `useStaffMonthSchedule.isAbsence` исходно вычисляется через
-- override → пометки «отсутствует» в календаре дублируются.
DELETE FROM resource_date_overrides WHERE is_working = false;
