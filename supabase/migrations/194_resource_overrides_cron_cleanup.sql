-- Чистим прошедшие отсутствия (resource_date_overrides с is_working=false и
-- датой строго в прошлом). Они уже не несут полезной информации, занимают
-- место и шумят в UI «Выходные и отсутствия».
--
-- Cron в UTC: запускаем раз в сутки в 03:00 — ночью для большинства таймзон,
-- даже с самым поздним сдвигом (UTC+12) мы остаёмся в рамках суток.

SELECT cron.schedule(
  'resource-overrides-cleanup-past-absences',
  '0 3 * * *',
  $$
  DELETE FROM resource_date_overrides
  WHERE is_working = false
    AND date < CURRENT_DATE;
  $$
);
