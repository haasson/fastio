-- Seed для vault-секретов pg_cron / pg_net.
-- Запускать в Supabase Studio (db.fastio.ru) → SQL Editor.
-- Заменить <ADMIN_HOST> и сгенерить секреты ДО запуска!
--
-- Шаг 1. Сгенерить два random hex (32 байта = 64 символа) на маке:
--   openssl rand -hex 32   # → REMINDER_SECRET
--   openssl rand -hex 32   # → TELEGRAM_INTERNAL_SECRET (если не настроен)
--
-- Шаг 2. Положить эти секреты в Bitwarden («FastIO Supabase Self-hosted»).
--
-- Шаг 3. В Coolify → Admin App → Environment Variables добавить:
--   NUXT_REMINDER_CRON_SECRET = <REMINDER_SECRET из шага 1>
--   NUXT_TELEGRAM_INTERNAL_SECRET = <TELEGRAM_INTERNAL_SECRET из шага 1>
--   Затем Redeploy admin.
--
-- Шаг 4. Заменить <PLACEHOLDER>'ы ниже и выполнить SQL в Studio.

-- Helper: создать секрет если нет, иначе обновить.
DO $seed$
DECLARE
  v_id uuid;
  v_pairs CONSTANT jsonb[] := ARRAY[
    -- name, value
    jsonb_build_object('name', 'appointment_reminder_url',
                       'value', 'https://admin.fastio.ru/api/telegram/send-appointment-reminders'),
    jsonb_build_object('name', 'telegram_notify_reservation_url',
                       'value', 'https://admin.fastio.ru/api/telegram/notify-reservation'),
    jsonb_build_object('name', 'telegram_alert_url',
                       'value', 'https://admin.fastio.ru/api/telegram/notify-alert'),
    jsonb_build_object('name', 'reminder_cron_secret',
                       'value', '<REMINDER_SECRET>'),
    jsonb_build_object('name', 'telegram_internal_secret',
                       'value', '<TELEGRAM_INTERNAL_SECRET>')
  ];
  pair jsonb;
BEGIN
  FOREACH pair IN ARRAY v_pairs LOOP
    IF pair->>'value' LIKE '<%>' THEN
      RAISE EXCEPTION 'Placeholder % not replaced — abort', pair->>'name';
    END IF;
    SELECT id INTO v_id FROM vault.secrets WHERE name = pair->>'name';
    IF v_id IS NULL THEN
      PERFORM vault.create_secret(pair->>'value', pair->>'name');
    ELSE
      PERFORM vault.update_secret(v_id, pair->>'value');
    END IF;
  END LOOP;
END;
$seed$;

-- Проверка: список заданных ключей (без значений).
SELECT name FROM vault.secrets
WHERE name IN (
  'appointment_reminder_url',
  'telegram_notify_reservation_url',
  'telegram_alert_url',
  'reminder_cron_secret',
  'telegram_internal_secret'
)
ORDER BY name;
