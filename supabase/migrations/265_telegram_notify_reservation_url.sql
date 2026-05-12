-- Раньше URL для уведомления о бронировании вычислялся как
--   regexp_replace(telegram_notify_url, '/notify$', '/notify-reservation')
-- что молча ломалось, если базовый секрет не заканчивался на '/notify'.
-- Заводим отдельный vault-секрет `telegram_notify_reservation_url`, fallback на старое
-- поведение оставляем для совместимости с инсталляциями где новый секрет ещё не задан.
--
-- После применения миграции (рекомендуется):
--   SELECT vault.create_secret('https://admin.example.com/api/telegram/notify-reservation', 'telegram_notify_reservation_url');

CREATE OR REPLACE FUNCTION notify_new_reservation_telegram()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = net, public, vault
AS $$
DECLARE
  v_notify_url      text;
  v_reservation_url text;
  v_secret          text;
BEGIN
  SELECT decrypted_secret INTO v_reservation_url
  FROM vault.decrypted_secrets
  WHERE name = 'telegram_notify_reservation_url';

  IF v_reservation_url IS NULL THEN
    -- Fallback: вывести URL из основного телеграм-нотифая. Сохранено для бесшовного апгрейда.
    SELECT decrypted_secret INTO v_notify_url
    FROM vault.decrypted_secrets
    WHERE name = 'telegram_notify_url';

    IF v_notify_url IS NULL THEN
      RETURN NEW;
    END IF;

    v_reservation_url := regexp_replace(v_notify_url, '/notify$', '/notify-reservation');
  END IF;

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'telegram_internal_secret';

  PERFORM net.http_post(
    url     := v_reservation_url,
    body    := jsonb_build_object('reservationId', NEW.id, 'tenantId', NEW.tenant_id),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', COALESCE(v_secret, '')
    )
  );

  RETURN NEW;
END;
$$;
