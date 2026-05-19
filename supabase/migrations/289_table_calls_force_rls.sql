-- PREPROD-017 follow-up: WITH CHECK-политика "table_calls: insert for valid open table"
-- из миграции 061 не срабатывала при insert через service-role (BYPASSRLS по умолчанию).
-- Storefront-endpoint /api/table/[id]/call использует crossTenant (service-role) для insert,
-- т.к. tenantDb-Proxy запрещает .insert() на tenant-таблицах. Без FORCE RLS инвариант
-- «вызов только за валидный открытый стол этого тенанта» держится только на проверке
-- в endpoint, открывая TOCTOU-окно (стол могут закрыть между select и insert).
ALTER TABLE table_calls FORCE ROW LEVEL SECURITY;
