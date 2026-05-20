-- PREPROD-209 follow-up (Code Review #1 + #3).
--
-- Два фикса для audit_logs retention из миграции 300:
--
-- 1. Retention 180 → 365 дней. Privacy-policy (docs/policy/privacy-policy-fastio.md:62)
--    публично обещает «Логи действий — 12 месяцев». 180 дней нарушает это
--    publicly-promised retention и подставляет проект под ст.13.11 КоАП РФ
--    (несоответствие фактической обработки заявленной). Меняем на 365 дней.
--
-- 2. Добавляем single-column index `audit_logs_created_at_only_idx` на created_at.
--    Существующий `audit_logs_created_at_idx` это composite (tenant_id, created_at DESC) —
--    WHERE created_at без tenant_id не использует его эффективно (нужен leading column).
--    На больших таблицах через 3-6 месяцев nightly cron делает Seq Scan + долгий lock
--    на проде. Single-column index обеспечивает быстрый scan по диапазону created_at.
--
-- 3. '0 3 * * *' = 06:00 МСК / 13:00 VLA, низкая нагрузка во всех часовых поясах РФ.
--    pg_cron работает в server timezone (обычно UTC).

CREATE INDEX IF NOT EXISTS audit_logs_created_at_only_idx ON audit_logs(created_at);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'audit_logs_cleanup') THEN
    PERFORM cron.unschedule('audit_logs_cleanup');
  END IF;
END $$;

SELECT cron.schedule(
  'audit_logs_cleanup',
  '0 3 * * *',
  $$DELETE FROM audit_logs WHERE created_at < now() - interval '365 days'$$
);
