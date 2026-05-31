-- Migration 305: Realtime для таблицы tables
--
-- Баг: страница «Столы» (admin) подписана на realtime по table_calls,
-- kitchen_queue и orders (вызовы/готовность/суммы обновляются), но сама
-- таблица tables НЕ была в публикации supabase_realtime. Из-за этого
-- create / activate (is_active) / open (is_open) / move (position_x/y) стола
-- не транслировались на другие вкладки и девайсы — официант на планшете не
-- видел стол, открытый на кассе, пока не перезагрузит страницу.
--
-- Фикс: добавляем tables в публикацию. RLS (is_tenant_member) уже включён,
-- realtime его уважает — кросс-тенант утечки нет. REPLICA IDENTITY по
-- умолчанию (primary key) достаточно: INSERT/UPDATE реплицируют полный NEW,
-- DELETE отдаёт id в OLD — этого хватает обработчикам в tables.vue.

ALTER PUBLICATION supabase_realtime ADD TABLE tables;
