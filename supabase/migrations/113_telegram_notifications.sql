-- Таблица для одноразовых кодов привязки Telegram-группы
CREATE TABLE telegram_link_codes (
  code        text        PRIMARY KEY,
  tenant_id   uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL DEFAULT now() + interval '15 minutes',
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id)
);

CREATE INDEX idx_telegram_link_codes_expires ON telegram_link_codes(expires_at);

ALTER TABLE telegram_link_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "telegram_link_codes: member can manage"
  ON telegram_link_codes
  USING (is_tenant_member(tenant_id))
  WITH CHECK (is_tenant_member(tenant_id));

-- Триггер: уведомление при новом заказе через pg_net
CREATE OR REPLACE FUNCTION notify_new_order_telegram()
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
    url     := v_notify_url,
    body    := jsonb_build_object('orderId', NEW.id, 'tenantId', NEW.tenant_id),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_telegram_new_order
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_order_telegram();
