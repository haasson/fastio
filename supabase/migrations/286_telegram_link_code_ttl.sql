-- PREPROD-006: уменьшить TTL telegram_link_codes с 15 минут до 3.
-- 6-значный код брутится за минуты без rate-limit; в паре с server-side
-- rate-limit'ом в webhook (5 попыток/15мин на chat) и crypto.getRandomValues
-- на генерации даёт достаточную защиту без UX-регрессии (юзер успевает
-- открыть бот в Telegram и переслать в группу за 3 мин).

ALTER TABLE telegram_link_codes
  ALTER COLUMN expires_at SET DEFAULT now() + interval '3 minutes';
