-- Realtime: доставка UPDATE/DELETE-событий гостю стола.
--
-- Supabase Realtime отдаёт UPDATE подписчику, только если может проверить RLS
-- против СТАРОГО кортежа строки. При REPLICA IDENTITY DEFAULT старый кортеж в WAL
-- содержит лишь PK (id), а политики anon_select_dine_in_* и фильтр канала
-- (tenant_id=eq) ссылаются на order_id/tenant_id — НЕ PK. Итог: смена статуса кухни
-- (kitchen_queue.status in_progress→done) и подтверждение позиции
-- (order_items.status pending→confirmed) не доезжали до гостя — блюда не
-- перемещались «готовится»→«готово» без ручного рефреша. INSERT работал (новый
-- кортеж полный). FULL кладёт в WAL весь старый кортеж → realtime проверяет RLS и
-- доставляет UPDATE. Таблицы низкочастотные (заказы), оверхед WAL пренебрежимо мал.
ALTER TABLE order_items REPLICA IDENTITY FULL;
ALTER TABLE kitchen_queue REPLICA IDENTITY FULL;
