-- Мульти-подписчики Telegram на тенант: вместо одного chat_id в JSONB —
-- отдельная таблица. Поддерживает N личных DM + N групп для одного тенанта.

CREATE TABLE tenant_telegram_subscribers (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  chat_id      text        NOT NULL,
  chat_type    text        NOT NULL CHECK (chat_type IN ('private', 'group', 'supergroup', 'channel')),
  label        text,
  thread_id    integer,
  added_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, chat_id)
);

CREATE INDEX idx_tt_subscribers_tenant ON tenant_telegram_subscribers(tenant_id);

ALTER TABLE tenant_telegram_subscribers ENABLE ROW LEVEL SECURITY;

-- Доступ через UI: член тенанта может смотреть и отвязывать. Привязку
-- (INSERT) делает только бот через service_role, поэтому WITH CHECK сужен.
CREATE POLICY "tt_subscribers: member can read"
  ON tenant_telegram_subscribers
  FOR SELECT
  USING (is_tenant_member(tenant_id));

CREATE POLICY "tt_subscribers: member can delete"
  ON tenant_telegram_subscribers
  FOR DELETE
  USING (is_tenant_member(tenant_id));

-- Перелив существующих привязок из notifications JSONB в новую таблицу.
INSERT INTO tenant_telegram_subscribers (tenant_id, chat_id, chat_type, label, thread_id)
SELECT
  id,
  notifications->>'telegramChatId',
  CASE
    WHEN (notifications->>'telegramThreadId') IS NOT NULL THEN 'supergroup'
    WHEN (notifications->>'telegramChatTitle') IS NOT NULL THEN 'group'
    ELSE 'group'  -- старые привязки точно были группами (single-chat-старый flow)
  END,
  notifications->>'telegramChatTitle',
  NULLIF(notifications->>'telegramThreadId', '')::integer
FROM tenants
WHERE notifications->>'telegramChatId' IS NOT NULL
  AND notifications->>'telegramChatId' <> ''
ON CONFLICT (tenant_id, chat_id) DO NOTHING;

-- Чистим JSONB от устаревших полей — больше нигде не читаются.
UPDATE tenants
SET notifications = notifications - 'telegramChatId' - 'telegramThreadId' - 'telegramChatTitle'
WHERE notifications ? 'telegramChatId'
   OR notifications ? 'telegramThreadId'
   OR notifications ? 'telegramChatTitle';
