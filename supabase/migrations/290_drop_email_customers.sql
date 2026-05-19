-- PREPROD-099: storefront-кастомеры теперь логинятся ТОЛЬКО через Telegram.
-- Email-auth endpoints удалены (login/register/forgot/reset). Существующие
-- email-customer'ы (telegram_id IS NULL) больше не смогут залогиниться — удаляем
-- их из auth.users, чтобы освободить email-адреса для возможной admin-регистрации.
--
-- Сами customers-записи НЕ удаляем: они нужны для FK orders.customer_id (история
-- заказов). Сначала разлинковываем FK `customers.auth_user_id` → ставим NULL,
-- иначе ON DELETE CASCADE удалит customers и упадёт на orders_customer_id_fkey.
-- После UPDATE такой customer становится «анонимной строкой истории» — никто
-- не сможет войти под ним, но финансовая запись orders сохраняется.
--
-- Безопасно: реальных платных юзеров нет (см. memory no-real-users-yet, 2026-05-19).
-- На prod срабатывает автоматом через GH Actions при пуше миграции.

-- Шаг 1: снять FK ссылку customers → auth.users, чтобы CASCADE не сработал.
UPDATE customers
SET auth_user_id = NULL
WHERE telegram_id IS NULL
  AND auth_user_id IS NOT NULL;

-- Шаг 2: удалить orphan auth.users записи (теперь у которых нет customers-ссылок).
-- Берём только тех, у кого НЕТ telegram-customer'а (на случай дубля email+telegram
-- для одного auth_user_id — теоретически невозможно, но защищаемся).
DELETE FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM customers c
  WHERE c.auth_user_id = u.id
)
AND NOT EXISTS (
  -- Не трогаем admin'ов: у них есть запись в tenant_members.
  SELECT 1 FROM tenant_members tm WHERE tm.user_id = u.id
)
AND NOT EXISTS (
  -- Не трогаем владельцев тенантов.
  SELECT 1 FROM tenants t WHERE t.owner_id = u.id
);
