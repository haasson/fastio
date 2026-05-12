-- Защищаем admin endpoint'ы /api/telegram/notify и /api/telegram/notify-reservation
-- от анонимных вызовов: триггеры теперь прикладывают x-internal-secret,
-- handler'ы сверяют его с NUXT_INTERNAL_API_SECRET.
--
-- После применения миграции:
-- 1) Прочитать сгенерированный секрет:
--    SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'telegram_internal_secret';
-- 2) Задать его в env admin'а: NUXT_INTERNAL_API_SECRET=<value>

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'telegram_internal_secret') THEN
    PERFORM vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'telegram_internal_secret');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION notify_new_order_telegram()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = net, public, vault
AS $$
DECLARE
  v_notify_url text;
  v_secret     text;
BEGIN
  SELECT decrypted_secret INTO v_notify_url
  FROM vault.decrypted_secrets
  WHERE name = 'telegram_notify_url';

  IF v_notify_url IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'telegram_internal_secret';

  PERFORM net.http_post(
    url     := v_notify_url,
    body    := jsonb_build_object('orderId', NEW.id, 'tenantId', NEW.tenant_id),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', COALESCE(v_secret, '')
    )
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION notify_new_reservation_telegram()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = net, public, vault
AS $$
DECLARE
  v_notify_url text;
  v_secret     text;
BEGIN
  SELECT decrypted_secret INTO v_notify_url
  FROM vault.decrypted_secrets
  WHERE name = 'telegram_notify_url';

  IF v_notify_url IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'telegram_internal_secret';

  PERFORM net.http_post(
    url     := regexp_replace(v_notify_url, '/notify$', '/notify-reservation'),
    body    := jsonb_build_object('reservationId', NEW.id, 'tenantId', NEW.tenant_id),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', COALESCE(v_secret, '')
    )
  );

  RETURN NEW;
END;
$$;
