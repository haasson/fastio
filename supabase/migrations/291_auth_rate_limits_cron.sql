-- Запланировать `cleanup_auth_rate_limits()` (миграция 264) каждый час.
-- После PREPROD-102 на durable rate-limit перешли ВСЕ публичные endpoint'ы
-- (storefront + landing): ключи tenant-scoped → растёт cardinality. Хвост
-- истёкших записей надо подметать, иначе INSERT ON CONFLICT медленнеет.

SELECT cron.schedule(
  'cleanup-auth-rate-limits',
  '0 * * * *',
  $$SELECT public.cleanup_auth_rate_limits()$$
);
