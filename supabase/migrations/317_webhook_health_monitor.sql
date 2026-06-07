-- Мониторинг здоровья Telegram webhook'ов: pg_cron каждые 10 мин вызывает
-- POST /api/monitoring/webhook-health на OPS-сервисе. Endpoint проверяет
-- getWebhookInfo обоих ботов (клиентский + тенант-бот), при ошибках шлёт
-- алёрт в ops-чат. Если Telegram недоступен — email-фоллбек.
--
-- Cooldown: таблица webhook_health_state хранит last_alert_at — алёрт шлём
-- не чаще раза в 60 минут (endpoint сам проверяет через Supabase client).
--
-- Активация после применения миграции:
-- 1. Задать URL в vault:
--      SELECT vault.update_secret(id, 'https://ops.fastio.ru/api/monitoring/webhook-health')
--      FROM vault.secrets WHERE name = 'webhook_health_url';
-- 2. Переиспользуем telegram_internal_secret (миграция 263).
-- 3. Задать env в Coolify OPS-сервисе:
--      NUXT_SMTP_USER, NUXT_SMTP_PASS, NUXT_ALERT_EMAIL

CREATE TABLE IF NOT EXISTS webhook_health_state (
  id smallint PRIMARY KEY DEFAULT 1,
  last_alert_at timestamptz,
  CONSTRAINT webhook_health_state_singleton CHECK (id = 1)
);

INSERT INTO webhook_health_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Vault placeholder для URL endpoint'а.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'webhook_health_url') THEN
    PERFORM vault.create_secret('', 'webhook_health_url');
  END IF;
END $$;

-- pg_cron: каждые 10 минут
SELECT cron.schedule(
  'check-webhook-health',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'webhook_health_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', (
        SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'telegram_internal_secret'
      )
    ),
    body := '{}'::jsonb
  ) AS request_id
  WHERE (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'webhook_health_url') != '';
  $$
);
