-- ═══════════════════════════════════════════════════════════════════════════════
-- 267: Закрываем две дыры в RLS — banners и order_number_counters.
--
-- Контекст: проверка реального состояния БД показала, что
--   • banners — pg_class.relrowsecurity = false (RLS дрифтнул в OFF, причина
--     не выявлена: возможно частичный rollback или ручной DISABLE),
--     при этом SELECT-политика «banners: public read» из 094 имела
--     USING (true) — это **исходная дыра в самой миграции 094**, а не drift:
--     даже при включённом RLS любой анон мог читать баннеры всех тенантов.
--   • order_number_counters — никогда не имела ни RLS, ни политик.
--
-- Эффект до фикса:
--   • banners — анон может SELECT (всегда мог — даже при ON, из-за USING true),
--     а из-за дрифта в OFF — ещё и INSERT/UPDATE/DELETE баннеры всех тенантов
--   • order_number_counters — анон может читать и подменять счётчики заказов
--     любого тенанта (сломать нумерацию, продублировать номера, утечь
--     метаданные «сколько заказов было»)
--
-- Стратегия:
--   • Идемпотентно включаем RLS на обеих таблицах
--   • banners: дропаем «public read» (USING true) и заменяем на политику
--     для членов тенанта. Admin читает с user-JWT и проходит; storefront
--     читает через server/api с service-role — RLS bypass, не ломается.
--     INSERT/UPDATE/DELETE уже описаны в 109 через 'promos.manage'.
--   • order_number_counters: служебная таблица — генератор номеров (триггер
--     set_order_number SECURITY DEFINER + функция generate_order_number)
--     работает от роли postgres и обходит RLS. Никаких app-доступов не нужно.
--     Оставляем только debug-SELECT для носителя 'orders.view' (для админки).
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── banners ────────────────────────────────────────────────────────────────────
ALTER TABLE banners ENABLE ROW LEVEL SECURITY;

-- Восстанавливаем SELECT для тенант-членов (политика была в 094, удалена в 109
-- вместе с заменой манагерских политик на permission-based — без замены SELECT).
DROP POLICY IF EXISTS "banners: public read" ON banners;
DROP POLICY IF EXISTS "banners: tenant members can read" ON banners;
CREATE POLICY "banners: tenant members can read"
  ON banners FOR SELECT
  USING (is_tenant_member(tenant_id));


-- ─── order_number_counters ─────────────────────────────────────────────────────
ALTER TABLE order_number_counters ENABLE ROW LEVEL SECURITY;

-- Debug-SELECT для админки (нумерация заказов — часть orders-секции).
-- INSERT/UPDATE/DELETE не разрешены никому: запись идёт только через триггер
-- set_order_number (SECURITY DEFINER от postgres → bypass RLS).
DROP POLICY IF EXISTS "order_number_counters: orders.view can read" ON order_number_counters;
CREATE POLICY "order_number_counters: orders.view can read"
  ON order_number_counters FOR SELECT
  USING (has_permission(tenant_id, 'orders.view'));
