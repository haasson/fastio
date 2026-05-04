-- Migration 245: убираем RLS policy "customers: user can update own".
--
-- Контекст: исходная политика (079) разрешала UPDATE строки customers по
-- условию auth.uid() = auth_user_id, без проверки tenant_id. Пользователь,
-- залогиненный одним и тем же auth.users в нескольких тенантах (через тот
-- же email/телефон), мог сделать `PATCH /rest/v1/customers?id=<id_в_тенанте_B>`
-- с JWT тенанта A — RLS пускал, потому что auth.uid() совпадал.
--
-- Все апдейты профиля идут через storefront server endpoints
-- (apps/storefront/server/api/customer/profile.patch.ts и т.п.) с
-- service_role-клиентом. Прямой клиентский UPDATE не используется.
-- Поэтому проще убрать policy полностью, чем городить tenant_id-фильтр через
-- custom JWT claims.
--
-- Аналогично для customer_addresses: policy "owner can manage" (FOR ALL)
-- заменяется на более узкую "owner can read", запись/удаление —
-- только через server endpoints.

DROP POLICY IF EXISTS "customers: user can update own" ON customers;

DROP POLICY IF EXISTS "customer_addresses: owner can manage" ON customer_addresses;

CREATE POLICY "customer_addresses: owner can read"
  ON customer_addresses FOR SELECT
  USING (
    customer_id IN (SELECT id FROM customers WHERE auth_user_id = auth.uid())
  );
