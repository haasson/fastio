-- Migration 256: защита от пересекающихся периодов отсутствия одного мастера.
--
-- Зачем: UI на стороне админа в принципе не должен позволять создать два
-- пересекающихся `resource_unavailability` для одного `resource_id` (это
-- бессмысленно — отпуск внутри отпуска), но ошибки случаются:
--   * двойной submit формы из-за лагов сети;
--   * импорт из стороннего календаря с дубликатами;
--   * параллельные сессии двух админов.
-- В UI пересекающиеся периоды отрисовываются как "Отпуск 15-28" и "Отпуск 20-25" —
-- мусор. `resolveResourceWorkingHours` отрабатывает корректно (любое попадание
-- блокирует), но БД должна сама гарантировать инвариант.
--
-- Расширение `btree_gist` идёт в стандартной поставке PostgreSQL/Supabase
-- (contrib-модуль), отдельно ставить не надо. Нужно потому что GIST по умолчанию
-- не умеет работать с равенством по UUID — а нам нужно `resource_id WITH =`.
--
-- `daterange(date_from, date_to + 1, '[)')` — превращаем `[from..to]` inclusive
-- в half-open `[from..to+1)`, чтобы стандартный оператор `&&` (overlap) работал
-- корректно: два диапазона пересекаются если `[a, b) && [c, d)`.

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE resource_unavailability
  ADD CONSTRAINT resource_unavailability_no_overlap
  EXCLUDE USING gist (
    resource_id WITH =,
    daterange(date_from, date_to + 1, '[)') WITH &&
  );
