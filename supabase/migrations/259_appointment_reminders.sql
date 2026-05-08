CREATE TABLE appointment_reminders (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id        uuid        NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  telegram_chat_id      text        NOT NULL,
  remind_before_minutes integer     NOT NULL,
  sent_at               timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_appt_reminder_chat UNIQUE (appointment_id, telegram_chat_id)
);

-- Индекс для эффективного поиска неотправленных напоминаний cron'ом
CREATE INDEX idx_appt_reminders_unsent
  ON appointment_reminders(appointment_id)
  WHERE sent_at IS NULL;

ALTER TABLE appointment_reminders ENABLE ROW LEVEL SECURITY;

-- INSERT/UPDATE/SELECT только через service_role (cron и server API).
-- Анонимный и аутентифицированный роли не имеют доступа.
CREATE POLICY "appointment_reminders: service_role only"
  ON appointment_reminders
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ─── One-shot deep-link tokens ────────────────────────────────────────────
-- Сценарий: storefront выдаёт случайный 22-символьный токен → клиент открывает
-- t.me/<bot>?start=remind_<token> → бот резолвит token → appointment_id.
-- После успешной настройки напоминания токен удаляется (single-use).
-- Цель: исключить enum по UUID appointment'а через публичный deep-link.
CREATE TABLE appointment_reminder_tokens (
  token          text        PRIMARY KEY,
  appointment_id uuid        NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  expires_at     timestamptz NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_appt_reminder_tokens_appt
  ON appointment_reminder_tokens(appointment_id);

ALTER TABLE appointment_reminder_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "appointment_reminder_tokens: service_role only"
  ON appointment_reminder_tokens
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Cleanup: удаляем записи для визитов, прошедших более 7 дней назад.
-- ON DELETE CASCADE уже подчищает при удалении appointment, это — страховка для не-удалённых.
SELECT cron.schedule(
  'cleanup-old-appointment-reminders',
  '0 3 * * *',
  $$
  DELETE FROM appointment_reminders
  WHERE appointment_id IN (
    SELECT id FROM appointments WHERE starts_at < now() - interval '7 days'
  );
  $$
);

-- Cleanup просроченных токенов (single-use удаляются сразу, expired — раз в сутки).
SELECT cron.schedule(
  'cleanup-expired-reminder-tokens',
  '15 3 * * *',
  $$DELETE FROM appointment_reminder_tokens WHERE expires_at < now();$$
);
