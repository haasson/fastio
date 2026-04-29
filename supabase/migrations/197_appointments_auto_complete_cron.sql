-- Auto-complete appointments via pg_cron (раз в 30 минут).
--
-- Иначе записи зависают вечно: подтвердили → время прошло → никто кнопку не
-- нажал → запись остаётся 'confirmed' навсегда. То же с new — заявка пришла,
-- админ не подтвердил, время вышло.
--
-- Правила:
--   new       past endsAt                            → cancelled, reason='no_show'
--   confirmed past COALESCE(actual_ends_at, endsAt)
--                  + буфер 30 минут                  → done
--
-- Буфер у confirmed — чтобы админ успел отметить «не пришёл» вручную, прежде
-- чем cron штампует done. Для open_ended считаем по actual_ends_at (если задан)
-- — иначе по плановому endsAt.

SELECT cron.schedule(
  'appointments-auto-complete',
  '*/30 * * * *',
  $$
  -- new past their slot — клиент не явился и админ даже не подтвердил
  UPDATE appointments
  SET
    status        = 'cancelled',
    cancel_reason = 'no_show',
    cancelled_by  = 'system',
    cancelled_at  = now(),
    updated_at    = now()
  WHERE status = 'new'
    AND ends_at < now();

  -- confirmed past их окончания + 30 минут — считаем что услуга оказана
  UPDATE appointments
  SET
    status     = 'done',
    updated_at = now()
  WHERE status = 'confirmed'
    AND COALESCE(actual_ends_at, ends_at) < now() - interval '30 minutes';
  $$
);
