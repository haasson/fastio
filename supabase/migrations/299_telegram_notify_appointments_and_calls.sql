-- Migration 299: Telegram-уведомления для appointment_groups и table_calls (PREPROD-019)
--
-- До этой миграции существовали триггеры только на orders (113) и reservations (114, 263, 265).
-- Services-тенанты и retail-тенанты с QR-меню были «глухими»: записи на услуги,
-- заявки без слота и вызовы официанта не светились в Telegram-чате —
-- менеджер видел их только если открыт админский UI.
--
-- Здесь добавляются:
--   1. notify_new_appointment_group_telegram() — триггер AFTER INSERT на appointment_groups.
--      Один триггер закрывает оба сценария:
--        - status='active' (запись клиента на услугу со слотами)
--        - status='request' (заявка без выбора слота — гибридная сущность из миграции 230)
--      Формирование сообщения (разное по статусу) делается в admin endpoint'е,
--      потому что нужен JOIN с appointments + услугами + мастером, а триггер
--      работает с одной строкой group'ы.
--   2. notify_new_table_call_telegram() — триггер AFTER INSERT на table_calls.
--      Шлёт «стол №X вызывает официанта (тип)».
--
-- URL'ы читаются из vault.secrets с fallback'ом на базовый telegram_notify_url
-- (см. паттерн миграции 265). Это упрощает self-hosted инсталляции — если новый
-- секрет не задан, URL выводится из основного.
--
-- ⚠️ Fallback regex `'/notify$' → '/notify-X'` корректен ТОЛЬКО если базовый
-- секрет `telegram_notify_url` оканчивается на `/notify` (типовое значение
-- `https://admin.fastio.ru/api/telegram/notify` — миграция 283). Если базовый
-- URL другой — fallback вернёт неправильный URL, pg_net пойдёт в никуда.
-- Защита от этого: после применения миграции (рекомендуется) задать явные
-- секреты для нового домена через Supabase Studio или SQL:
--
--   SELECT vault.create_secret(
--     'https://admin.example.com/api/telegram/notify-appointment-group',
--     'telegram_notify_appointment_group_url'
--   );
--   SELECT vault.create_secret(
--     'https://admin.example.com/api/telegram/notify-table-call',
--     'telegram_notify_table_call_url'
--   );
--
-- pg_net.http_post асинхронный: реальный HTTP-запрос отправляется фоновым
-- worker'ом ПОСЛЕ commit транзакции. Поэтому endpoint'ы могут безопасно
-- читать appointments / table.name по group_id / table_call_id — данные уже
-- закоммичены к моменту вызова.

-- ─── 1. appointment_groups: notification trigger ───────────────────────────────────

CREATE OR REPLACE FUNCTION notify_new_appointment_group_telegram()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = net, public, vault
AS $$
DECLARE
  v_url    text;
  v_base   text;
  v_secret text;
BEGIN
  -- Дедицированный URL опционален; если нет — выводим из базового /notify.
  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets
  WHERE name = 'telegram_notify_appointment_group_url';

  IF v_url IS NULL THEN
    SELECT decrypted_secret INTO v_base
    FROM vault.decrypted_secrets
    WHERE name = 'telegram_notify_url';

    IF v_base IS NULL THEN
      -- Self-hosted без vault-секрета — silently no-op (тенант не получит TG).
      RETURN NEW;
    END IF;

    v_url := regexp_replace(v_base, '/notify$', '/notify-appointment-group');
  END IF;

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'telegram_internal_secret';

  PERFORM net.http_post(
    url     := v_url,
    body    := jsonb_build_object(
      'appointmentGroupId', NEW.id,
      'tenantId',           NEW.tenant_id
    ),
    headers := jsonb_build_object(
      'Content-Type',      'application/json',
      'x-internal-secret', COALESCE(v_secret, '')
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_telegram_new_appointment_group ON appointment_groups;
CREATE TRIGGER trg_notify_telegram_new_appointment_group
  AFTER INSERT ON appointment_groups
  FOR EACH ROW
  WHEN (NEW.status IN ('active', 'request'))
  EXECUTE FUNCTION notify_new_appointment_group_telegram();

-- ─── 2. table_calls: notification trigger ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION notify_new_table_call_telegram()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = net, public, vault
AS $$
DECLARE
  v_url    text;
  v_base   text;
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets
  WHERE name = 'telegram_notify_table_call_url';

  IF v_url IS NULL THEN
    SELECT decrypted_secret INTO v_base
    FROM vault.decrypted_secrets
    WHERE name = 'telegram_notify_url';

    IF v_base IS NULL THEN
      RETURN NEW;
    END IF;

    v_url := regexp_replace(v_base, '/notify$', '/notify-table-call');
  END IF;

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'telegram_internal_secret';

  PERFORM net.http_post(
    url     := v_url,
    body    := jsonb_build_object(
      'tableCallId', NEW.id,
      'tenantId',    NEW.tenant_id
    ),
    headers := jsonb_build_object(
      'Content-Type',      'application/json',
      'x-internal-secret', COALESCE(v_secret, '')
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_telegram_new_table_call ON table_calls;
CREATE TRIGGER trg_notify_telegram_new_table_call
  AFTER INSERT ON table_calls
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_table_call_telegram();
