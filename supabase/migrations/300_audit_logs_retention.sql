-- PREPROD-209: audit_logs retention policy.
--
-- audit_logs пишется на каждый mutation в admin (CRUD меню, заказы, настройки),
-- через год активного тенанта таблица легко перевалит за миллионы строк и начнёт
-- бить по index'ам / planner'у. 180 дней — баланс между complience (полгода ретро
-- для расследований) и размером таблицы.
--
-- Партиционирование по месяцам не делаем — overkill для текущего объёма, плюс
-- усложняет миграции (придётся пересоздавать индексы/RLS для каждой партиции).
-- DELETE по индексу `audit_logs_created_at_idx` идёт быстро.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'audit_logs_cleanup') THEN
    PERFORM cron.unschedule('audit_logs_cleanup');
  END IF;
END $$;

SELECT cron.schedule(
  'audit_logs_cleanup',
  '0 3 * * *',
  $$DELETE FROM audit_logs WHERE created_at < now() - interval '180 days'$$
);
