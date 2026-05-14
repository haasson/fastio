-- Edge functions observability: pg_cron каждые 15 мин читает net._http_response,
-- считает 4xx/5xx за окно, при превышении порога шлёт алёрт в Telegram-канал
-- через admin endpoint (POST на /api/telegram/notify-alert).
--
-- Решает проблему: pg_net и Database Webhooks шлют HTTP fire-and-forget, ответы
-- падают в net._http_response, никто туда не смотрит. Опечатка в ENV / упавшая
-- edge-функция / истёкший SMTP-пароль = молчаливый сбой до звонка клиента.
--
-- Это опция C из WISHLIST → Edge-functions observability. Дополняет (НЕ заменяет)
-- Sentry в edge-функциях — Sentry ловит ТРОУ внутри функции, monitor_edge_errors()
-- ловит вызовы, которые ВООБЩЕ не дошли или вернули ошибку.
--
-- Активация (после применения миграции):
-- 1. Задать chat id админ-канала в env admin'а:
--      NUXT_TELEGRAM_ALERT_CHAT_ID=-1001234567890
--    (chatId намеренно НЕ в Vault — иначе компрометация internal-secret
--     позволила бы перенаправить алёрт в чужой чат).
-- 2. Задать URL endpoint'а в vault. Для свежеустановленной миграции значение
--    пустое, обновляем через vault.update_secret (не INSERT — UNIQUE name):
--      SELECT vault.update_secret(id, 'https://admin.fastio.ru/api/telegram/notify-alert')
--      FROM vault.secrets WHERE name = 'telegram_alert_url';
-- 3. telegram_internal_secret уже создан миграцией 263 — переиспользуется.
-- 4. Чтобы временно выключить — UPDATE cron.job SET active = false WHERE jobname = 'monitor-edge-errors';

CREATE TABLE IF NOT EXISTS edge_alerts_state (
  id smallint PRIMARY KEY DEFAULT 1,
  last_alert_at timestamptz,
  CONSTRAINT edge_alerts_state_singleton CHECK (id = 1)
);

INSERT INTO edge_alerts_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Vault placeholder для URL. Реальное значение админ задаёт после деплоя (см. шапку).
-- Используем DO + create_secret чтобы миграция была идемпотентной — повторный
-- прогон не падает на UNIQUE name.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'telegram_alert_url') THEN
    PERFORM vault.create_secret('', 'telegram_alert_url');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION monitor_edge_errors()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = net, public, vault
AS $$
DECLARE
  v_window_start    timestamptz := now() - interval '15 minutes';
  v_rate_limit      interval    := interval '30 minutes';
  v_min_errors      int         := 5;
  v_min_total       int         := 10;
  v_error_rate      numeric     := 0.3;

  v_last_alert_at   timestamptz;
  v_error_count     int;
  v_total_count     int;
  v_alert_url       text;
  v_internal_secret text;
  v_request_id      bigint;
BEGIN
  -- Rate-limit: не чаще раза в 30 мин (защита от спама при затяжном инциденте).
  SELECT last_alert_at INTO v_last_alert_at FROM edge_alerts_state WHERE id = 1;
  IF v_last_alert_at IS NOT NULL AND v_last_alert_at > now() - v_rate_limit THEN
    RETURN;
  END IF;

  -- Считаем ошибки за окно. status_code >= 400 OR timed_out OR error_msg —
  -- три источника проблем у pg_net: HTTP-уровень / TCP-таймаут / DNS-fail.
  SELECT
    count(*) FILTER (WHERE status_code >= 400 OR timed_out OR error_msg IS NOT NULL),
    count(*)
  INTO v_error_count, v_total_count
  FROM net._http_response
  WHERE created >= v_window_start;

  -- Threshold: >= 5 ошибок ИЛИ >= 30% от total при total >= 10.
  -- Низкий total + редкие ошибки = пропускаем (фоновый шум).
  IF v_error_count < v_min_errors
     AND NOT (v_total_count >= v_min_total AND v_error_count::numeric / v_total_count >= v_error_rate)
  THEN
    RETURN;
  END IF;

  SELECT decrypted_secret INTO v_alert_url
  FROM vault.decrypted_secrets WHERE name = 'telegram_alert_url';

  SELECT decrypted_secret INTO v_internal_secret
  FROM vault.decrypted_secrets WHERE name = 'telegram_internal_secret';

  -- Без url alerter ещё не сконфигурирован, выходим тихо
  -- (не пишем last_alert_at — пусть следующий тик попробует снова).
  IF COALESCE(v_alert_url, '') = '' THEN
    RETURN;
  END IF;

  -- chatId намеренно НЕ передаём — admin берёт его из env (см. шапку).
  -- Это защищает от перенаправления алёрта в чужой чат при компрометации secret.
  SELECT net.http_post(
    url := v_alert_url,
    body := jsonb_build_object(
      'errorCount', v_error_count,
      'totalCount', v_total_count,
      'windowMinutes', 15
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', COALESCE(v_internal_secret, '')
    )
  ) INTO v_request_id;

  -- Помечаем last_alert_at только если pg_net реально принял запрос в очередь.
  -- Если http_post вернул NULL (расширение/конфиг сломаны) — не подавляем
  -- следующий тик, чтобы повторить попытку через 15 мин.
  IF v_request_id IS NOT NULL THEN
    UPDATE edge_alerts_state SET last_alert_at = now() WHERE id = 1;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION monitor_edge_errors FROM PUBLIC, anon, authenticated;

-- Cron. Безопасно для повторного прогона: unschedule + schedule.
DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'monitor-edge-errors') THEN
    PERFORM cron.unschedule('monitor-edge-errors');
  END IF;
END;
$guard$;

SELECT cron.schedule(
  'monitor-edge-errors',
  '*/15 * * * *',
  $$SELECT monitor_edge_errors();$$
);
