-- Sееd vault.secrets записи `telegram_notify_url`, который читает trigger
-- `notify_new_order_telegram` (из миграции 113). Без него триггер на INSERT
-- INTO orders молча возвращает без вызова pg_net → тенант не получает
-- уведомлений о заказах в Telegram.
--
-- На managed Supabase этот секрет сидился вручную через Studio. На self-hosted
-- нужно явно — этой миграцией.
--
-- Идемпотентно: если секрет уже есть, ничего не делает (vault.create_secret
-- кидает unique_violation на повторе, ловим).

DO $$
BEGIN
  PERFORM vault.create_secret(
    'https://admin.fastio.ru/api/telegram/notify',
    'telegram_notify_url'
  );
EXCEPTION
  WHEN unique_violation THEN
    -- Секрет уже создан — пропускаем.
    NULL;
END $$;
