-- Fix: anon dine-in realtime не работал с миграции 084 (мёртвая RLS-политика).
--
-- Политики anon_select_dine_in_* проверяли доступ через EXISTS(SELECT ... FROM orders
-- JOIN tables ...). Но подзапрос внутри USING-политики САМ подчиняется RLS вызывающей
-- роли на orders/tables, а у тех для anon политик нет (только is_tenant_member) →
-- для anon подзапрос = 0 строк → EXISTS всегда false → anon не видит kitchen_queue/
-- order_items вообще. Realtime прогоняет политику от имени anon перед доставкой,
-- получает «не видно» и роняет КАЖДОЕ событие (статус кухни не доезжал до гостя).
-- Серверный page-load под service-role это маскировал (RLS обходится), поэтому баг
-- был виден только на realtime-канале в браузере.
--
-- Чиним каноничным паттерном: SECURITY DEFINER-функция читает orders/tables мимо
-- RLS и отдаёт булево. Поверхность утечки минимальна — факт «dine-in заказ за
-- открытым столом» по неугадываемому order UUID (модель «UUID = токен доступа» из 084).
--
-- Политики для anon И authenticated: гость стола может быть и незалогинен (anon, QR
-- без логина), и залогинен (Telegram-auth → роль authenticated). Оба ходят в realtime
-- под своей ролью, поэтому покрываем обе. Доступ узкий (тот же хелпер), staff-политики
-- (is_tenant_member) не затрагиваются — RLS-политики складываются по OR.

CREATE OR REPLACE FUNCTION public.is_dine_in_open_order(p_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM orders o
    JOIN tables t ON t.id = o.table_id
    WHERE o.id = p_order_id
      AND o.delivery_type = 'dine_in'
      AND t.is_open = true
  );
$$;

REVOKE ALL ON FUNCTION public.is_dine_in_open_order(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_dine_in_open_order(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_dine_in_items" ON order_items;
CREATE POLICY "anon_select_dine_in_items" ON order_items
FOR SELECT TO anon, authenticated
USING (public.is_dine_in_open_order(order_items.order_id));

DROP POLICY IF EXISTS "anon_select_dine_in_kitchen" ON kitchen_queue;
CREATE POLICY "anon_select_dine_in_kitchen" ON kitchen_queue
FOR SELECT TO anon, authenticated
USING (public.is_dine_in_open_order(kitchen_queue.order_id));
