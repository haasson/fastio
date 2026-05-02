-- ============================================================
-- Migration 235: Таблица для идемпотентной обработки webhook-событий
-- ============================================================
-- Используется payment-webhook Edge Function чтобы гарантировать
-- однократную обработку каждого payment.succeeded от ЮKassa.
-- event_id = payment.id из тела события (UUID от ЮKassa).
-- ============================================================

CREATE TABLE processed_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,          -- внешний ID события (payment.id)
  payload jsonb NOT NULL DEFAULT '{}',    -- оригинальное тело для аудита
  processed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_processed_webhook_events_event_id ON processed_webhook_events(event_id);

-- Только service_role может читать и писать (функция использует service key)
ALTER TABLE processed_webhook_events ENABLE ROW LEVEL SECURITY;

-- Нет смысла давать доступ обычным ролям — только service_role через Edge Function
