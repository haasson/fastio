CREATE OR REPLACE FUNCTION notify_new_reservation_telegram()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = net, public, vault
AS $$
DECLARE
  v_notify_url text;
BEGIN
  SELECT decrypted_secret INTO v_notify_url
  FROM vault.decrypted_secrets
  WHERE name = 'telegram_notify_url';

  IF v_notify_url IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := regexp_replace(v_notify_url, '/notify$', '/notify-reservation'),
    body    := jsonb_build_object('reservationId', NEW.id, 'tenantId', NEW.tenant_id),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_telegram_new_reservation
  AFTER INSERT ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_reservation_telegram();
