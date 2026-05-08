-- Каждую минуту вызываем admin-сервер для отправки подошедших напоминаний.
-- URL хранится в vault (ключ 'appointment_reminder_url').
-- Секрет авторизации хранится в vault (ключ 'reminder_cron_secret').
DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-appointment-reminders') THEN
    PERFORM cron.unschedule('send-appointment-reminders');
  END IF;
END;
$guard$;

SELECT cron.schedule(
  'send-appointment-reminders',
  '* * * * *',
  $cron$
  DO $body$
  DECLARE
    v_url    text;
    v_secret text;
  BEGIN
    SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets
    WHERE name = 'appointment_reminder_url';

    IF v_url IS NULL THEN
      RAISE WARNING 'send-appointment-reminders: vault key "appointment_reminder_url" is not set, skipping run';
      RETURN;
    END IF;

    SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
    WHERE name = 'reminder_cron_secret';

    PERFORM net.http_post(
      url     := v_url,
      body    := '{}',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-reminder-cron-secret', coalesce(v_secret, '')
      )
    );
  END;
  $body$
  $cron$
);
