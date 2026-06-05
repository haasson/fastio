-- Migration 314: убрать TG-уведомление при вызове официанта
--
-- Причина: RT в /tables/list достаточен — бейдж на канвасе, плашка внизу.
-- Уведомление на каждый вызов создаёт спам в загруженном заведении.
-- Хендлер (apps/ops/server/api/telegram/notify-table-call.post.ts) удалён.
-- Если понадобится — вернуть как эскалацию: уведомление только когда вызов
-- висит необработанным дольше callEscalationMinutes.

DROP TRIGGER IF EXISTS trg_notify_telegram_new_table_call ON table_calls;
DROP FUNCTION IF EXISTS notify_new_table_call_telegram();
