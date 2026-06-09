-- Migration 324: бэкфилл branch_id для dine-in заказов.
--
-- Контекст: createTableOrder (useAddDishToTable) исторически создавал заказы за столом
-- с branch_id = NULL, хотя стол всегда принадлежит филиалу (tables.branch_id NOT NULL).
-- Из-за этого фильтр по филиалу в списке заказов, аналитике и истории столов прятал
-- такие заказы. Код создания исправлен (наследует table.branch_id); здесь чиним легаси.
--
-- orders НЕ под audit-триггером (миграция 321 их намеренно не трогает — у заказов своя
-- лента order_events), так что лишних записей в audit_logs не будет.

UPDATE orders o
SET branch_id = t.branch_id
FROM tables t
WHERE o.table_id = t.id
  AND o.tenant_id = t.tenant_id
  AND o.branch_id IS NULL
  AND t.branch_id IS NOT NULL;
