-- Размер карточек заказов в списке (вкладка «Заказы»): 's'/'m'/'l'.
-- Хранится колонкой на tenants (как payment_methods) — отдельной таблицы настроек
-- заказов нет. RLS не нужен: запись идёт через существующий UPDATE-policy tenants.
ALTER TABLE tenants
  ADD COLUMN orders_tile_size text NOT NULL DEFAULT 'm'
  CHECK (orders_tile_size IN ('s', 'm', 'l'));
