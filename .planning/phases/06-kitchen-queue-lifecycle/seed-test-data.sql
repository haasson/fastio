-- Phase 06 — тестовые данные для ручных сценариев §6.
-- Тенант «Вкусная точка». Идемпотентно: можно гонять повторно (сброс + пересев).
-- У каждого теста СВОЁ блюдо — чтобы карточки на KDS не путались.
-- Запуск: docker cp ... && docker exec -i supabase_db_fastio psql -U postgres -d postgres -f /tmp/seed.sql
--
--   ТЕСТ-1 (drawer-отмена,   delivery) → Маргарита ×3
--   ТЕСТ-2 (inline-отмена,    pickup)  → Чикен Бургер ×2
--   ТЕСТ-3 (правка поля,      delivery) → Картофель фри ×2
--   ТЕСТ-4 (сборка 2 кол.,    pickup)  → Куриные стрипсы ×1 (кухня) + Лимонад ×1 (skip)
--   ТЕСТ-5 (подмена C7,       delivery) → Четыре сыра ×3 (уникальное блюдо)
--   ТЕСТ-6 (зал разнос,  Стол 7)        → Кофе ×2
--   ТЕСТ-7 (зал отмена,  Стол 4)        → Барбекю Бургер ×2
--   ТЕСТ-8 (зал удаление,Стол 5)        → Классик Бургер ×1 + Пепперони ×1

\set tenant '00000000-0000-0000-0000-000000000002'
\set branch '6ee36e3b-0eaf-4ec3-bb09-5890616612db'

-- статусы
\set st_new    '00000000-0000-0000-0001-000000000001'
\set st_accept '00000000-0000-0000-0001-000000000002'

-- блюда (kitchen)
\set d_margarita '00000000-0000-0000-0005-000000000001'
\set d_pepperoni '00000000-0000-0000-0005-000000000002'
\set d_chetsyra  '00000000-0000-0000-0005-000000000003'
\set d_klassik   '00000000-0000-0000-0005-000000000004'
\set d_barbecue  '00000000-0000-0000-0005-000000000005'
\set d_chicken   '00000000-0000-0000-0005-000000000006'
\set d_fry       '00000000-0000-0000-0005-000000000007'
\set d_strips    '00000000-0000-0000-0005-000000000008'
\set d_coffee    '89b81b1d-355c-4ffd-8979-afd64130c4d8'
-- блюдо (НЕ kitchen — skip_kitchen)
\set d_limonade  '00000000-0000-0000-0005-000000000011'
-- кола (kitchen) — для теста подмены (ТЕСТ-9/10)
\set d_cola      '00000000-0000-0000-0005-000000000010'

-- столы (все is_active=true и размещены на схеме)
\set t_stol7 '02ae53de-58a1-444c-a7c8-8ac9815e0653'
\set t_stol4 'bc878f9b-ab27-415a-ac5a-00757771be9e'
\set t_stol5 '8049ed3d-3f4e-4f2a-a6cd-5aa39aa1b455'

BEGIN;

-- ─── 0. Чистим прошлые прогоны (свои фикс-UUID + старые dddd-заказы) ───
DELETE FROM kitchen_queue WHERE order_id IN (
  'ee000001-0000-0000-0000-000000000001','ee000002-0000-0000-0000-000000000002',
  'ee000003-0000-0000-0000-000000000003','ee000004-0000-0000-0000-000000000004',
  'ee000005-0000-0000-0000-000000000005','ee000006-0000-0000-0000-000000000006',
  'ee000007-0000-0000-0000-000000000007','ee000008-0000-0000-0000-000000000008',
  'ee000009-0000-0000-0000-000000000009','ee000010-0000-0000-0000-000000000010',
  'ddddbbbb-0000-0000-0000-000000000001','ddddaaaa-0000-0000-0000-000000000002'
);
DELETE FROM order_items WHERE order_id IN (
  'ee000001-0000-0000-0000-000000000001','ee000002-0000-0000-0000-000000000002',
  'ee000003-0000-0000-0000-000000000003','ee000004-0000-0000-0000-000000000004',
  'ee000005-0000-0000-0000-000000000005','ee000006-0000-0000-0000-000000000006',
  'ee000007-0000-0000-0000-000000000007','ee000008-0000-0000-0000-000000000008',
  'ee000009-0000-0000-0000-000000000009','ee000010-0000-0000-0000-000000000010',
  'ddddbbbb-0000-0000-0000-000000000001','ddddaaaa-0000-0000-0000-000000000002'
);
DELETE FROM orders WHERE id IN (
  'ee000001-0000-0000-0000-000000000001','ee000002-0000-0000-0000-000000000002',
  'ee000003-0000-0000-0000-000000000003','ee000004-0000-0000-0000-000000000004',
  'ee000005-0000-0000-0000-000000000005','ee000006-0000-0000-0000-000000000006',
  'ee000007-0000-0000-0000-000000000007','ee000008-0000-0000-0000-000000000008',
  'ee000009-0000-0000-0000-000000000009','ee000010-0000-0000-0000-000000000010',
  'ddddbbbb-0000-0000-0000-000000000001','ddddaaaa-0000-0000-0000-000000000002'
);

-- ─── 0b. Гасим старый шум: уже отменённые строки кухни прячем с экрана ───
UPDATE kitchen_queue SET dismissed_at = now()
WHERE tenant_id = :'tenant' AND status = 'cancelled' AND dismissed_at IS NULL;

-- ════════════════════ НАВЫНОС (retail) ════════════════════
-- Паттерн: заказ в статусе «Новый» → позиции → перевод в «Принят»
-- (sourceStatusId) → триггер наполняет кухню.

-- ТЕСТ-1: отмена через drawer, Маргарита ×3 (delivery)
INSERT INTO orders (id, tenant_id, branch_id, customer_name, customer_phone, delivery_type, address, status, payment_type, subtotal, total)
VALUES ('ee000001-0000-0000-0000-000000000001', :'tenant', :'branch', 'ТЕСТ-1 Drawer-отмена', '+79990000001', 'delivery', 'Тестовая ул., 1', :'st_new', 'cash', 1770, 1770);
INSERT INTO order_items (order_id, tenant_id, dish_id, dish_name, category_name, price, quantity, status, sort_order)
VALUES ('ee000001-0000-0000-0000-000000000001', :'tenant', :'d_margarita', 'Маргарита', 'Пиццы', 590, 3, 'confirmed', 0);
UPDATE orders SET status = :'st_accept' WHERE id = 'ee000001-0000-0000-0000-000000000001';

-- ТЕСТ-2: отмена через inline-статус, Чикен Бургер ×2 (pickup)
INSERT INTO orders (id, tenant_id, branch_id, customer_name, customer_phone, delivery_type, status, payment_type, subtotal, total)
VALUES ('ee000002-0000-0000-0000-000000000002', :'tenant', :'branch', 'ТЕСТ-2 Inline-отмена', '+79990000002', 'pickup', :'st_new', 'cash', 720, 720);
INSERT INTO order_items (order_id, tenant_id, dish_id, dish_name, category_name, price, quantity, status, sort_order)
VALUES ('ee000002-0000-0000-0000-000000000002', :'tenant', :'d_chicken', 'Чикен Бургер', 'Бургеры', 360, 2, 'confirmed', 0);
UPDATE orders SET status = :'st_accept' WHERE id = 'ee000002-0000-0000-0000-000000000002';

-- ТЕСТ-3: правка поля активного заказа, Картофель фри ×2 (delivery)
INSERT INTO orders (id, tenant_id, branch_id, customer_name, customer_phone, delivery_type, address, status, payment_type, subtotal, total)
VALUES ('ee000003-0000-0000-0000-000000000003', :'tenant', :'branch', 'ТЕСТ-3 Правка-поля', '+79990000003', 'delivery', 'Тестовая ул., 3', :'st_new', 'cash', 360, 360);
INSERT INTO order_items (order_id, tenant_id, dish_id, dish_name, category_name, price, quantity, status, sort_order)
VALUES ('ee000003-0000-0000-0000-000000000003', :'tenant', :'d_fry', 'Картофель фри', 'Закуски', 180, 2, 'confirmed', 0);
UPDATE orders SET status = :'st_accept' WHERE id = 'ee000003-0000-0000-0000-000000000003';

-- ТЕСТ-4: сборка 2 колонки, Куриные стрипсы ×1 (кухня) + Лимонад ×1 (skip_kitchen) (pickup)
INSERT INTO orders (id, tenant_id, branch_id, customer_name, customer_phone, delivery_type, status, payment_type, subtotal, total)
VALUES ('ee000004-0000-0000-0000-000000000004', :'tenant', :'branch', 'ТЕСТ-4 Сборка', '+79990000004', 'pickup', :'st_new', 'cash', 460, 460);
INSERT INTO order_items (order_id, tenant_id, dish_id, dish_name, category_name, price, quantity, status, sort_order)
VALUES ('ee000004-0000-0000-0000-000000000004', :'tenant', :'d_strips', 'Куриные стрипсы', 'Закуски', 280, 1, 'confirmed', 0),
       ('ee000004-0000-0000-0000-000000000004', :'tenant', :'d_limonade', 'Лимонад Домашний', 'Напитки', 180, 1, 'confirmed', 1);
UPDATE orders SET status = :'st_accept' WHERE id = 'ee000004-0000-0000-0000-000000000004';

-- ТЕСТ-5: подмена C7, Четыре сыра ×3 (уникальное блюдо — нет кросс-заказ кандидатов) (delivery)
INSERT INTO orders (id, tenant_id, branch_id, customer_name, customer_phone, delivery_type, address, status, payment_type, subtotal, total)
VALUES ('ee000005-0000-0000-0000-000000000005', :'tenant', :'branch', 'ТЕСТ-5 Подмена', '+79990000005', 'delivery', 'Тестовая ул., 5', :'st_new', 'cash', 1950, 1950);
INSERT INTO order_items (order_id, tenant_id, dish_id, dish_name, category_name, price, quantity, status, sort_order)
VALUES ('ee000005-0000-0000-0000-000000000005', :'tenant', :'d_chetsyra', 'Четыре сыра', 'Пиццы', 650, 3, 'confirmed', 0);
UPDATE orders SET status = :'st_accept' WHERE id = 'ee000005-0000-0000-0000-000000000005';

-- ════════════════════ ЗАЛ (dine_in) ════════════════════
-- Паттерн: открываем стол → заказ-сессия (dine_in) + позиции (confirmed)
-- → AFTER INSERT триггер наполняет кухню по каждой позиции.

-- ТЕСТ-6: готовка + разнос, Стол 7, Кофе ×2
UPDATE tables SET is_open = true, opened_at = now() - interval '5 min' WHERE id = :'t_stol7';
INSERT INTO orders (id, tenant_id, branch_id, customer_name, delivery_type, table_id, table_name, status, payment_type, subtotal, total)
VALUES ('ee000006-0000-0000-0000-000000000006', :'tenant', :'branch', 'ТЕСТ-6 Зал-разнос', 'dine_in', :'t_stol7', 'Стол 7', :'st_new', 'cash', 398, 398);
INSERT INTO order_items (order_id, tenant_id, dish_id, dish_name, category_name, price, quantity, status, sort_order)
VALUES ('ee000006-0000-0000-0000-000000000006', :'tenant', :'d_coffee', 'Кофе', 'Напитки', 199, 2, 'confirmed', 0);

-- ТЕСТ-7: стол уходит / отмена блюд, Стол 4, Барбекю Бургер ×2
UPDATE tables SET is_open = true, opened_at = now() - interval '5 min' WHERE id = :'t_stol4';
INSERT INTO orders (id, tenant_id, branch_id, customer_name, delivery_type, table_id, table_name, status, payment_type, subtotal, total)
VALUES ('ee000007-0000-0000-0000-000000000007', :'tenant', :'branch', 'ТЕСТ-7 Зал-отмена', 'dine_in', :'t_stol4', 'Стол 4', :'st_new', 'cash', 900, 900);
INSERT INTO order_items (order_id, tenant_id, dish_id, dish_name, category_name, price, quantity, status, sort_order)
VALUES ('ee000007-0000-0000-0000-000000000007', :'tenant', :'d_barbecue', 'Барбекю Бургер', 'Бургеры', 450, 2, 'confirmed', 0);

-- ТЕСТ-8: удаление одного блюда со стола, Стол 5, Классик ×1 + Пепперони ×1 (две разные позиции)
UPDATE tables SET is_open = true, opened_at = now() - interval '5 min' WHERE id = :'t_stol5';
INSERT INTO orders (id, tenant_id, branch_id, customer_name, delivery_type, table_id, table_name, status, payment_type, subtotal, total)
VALUES ('ee000008-0000-0000-0000-000000000008', :'tenant', :'branch', 'ТЕСТ-8 Зал-удаление', 'dine_in', :'t_stol5', 'Стол 5', :'st_new', 'cash', 1070, 1070);
INSERT INTO order_items (order_id, tenant_id, dish_id, dish_name, category_name, price, quantity, status, sort_order)
VALUES ('ee000008-0000-0000-0000-000000000008', :'tenant', :'d_klassik', 'Классик Бургер', 'Бургеры', 380, 1, 'confirmed', 0),
       ('ee000008-0000-0000-0000-000000000008', :'tenant', :'d_pepperoni', 'Пепперони', 'Пиццы', 690, 1, 'confirmed', 1);

-- ════════════════════ ПОДМЕНА (C7 позитив, навынос) ════════════════════
-- Две Колы из РАЗНЫХ заказов. ТЕСТ-9 «без льда» (removed=Лёд) повар берёт в
-- работу и заказ отменяет → подмена находит обычную Колу из ТЕСТ-10 (другой
-- заказ) → «похожая» (разница — лёд) → карточка подмены с кнопкой «Взять».

-- ТЕСТ-9: Кола БЕЗ ЛЬДА (её берут в работу, заказ отменяют)
INSERT INTO orders (id, tenant_id, branch_id, customer_name, customer_phone, delivery_type, address, status, payment_type, subtotal, total)
VALUES ('ee000009-0000-0000-0000-000000000009', :'tenant', :'branch', 'ТЕСТ-9 Замена-БЕЗ-ЛЬДА', '+79990000009', 'delivery', 'Тестовая ул., 9', :'st_new', 'cash', 120, 120);
INSERT INTO order_items (order_id, tenant_id, dish_id, dish_name, category_name, price, quantity, status, sort_order, removed_ingredients)
VALUES ('ee000009-0000-0000-0000-000000000009', :'tenant', :'d_cola', 'Кока-Кола 0.5л', 'Напитки', 120, 1, 'confirmed', 0, '{Лёд}');
UPDATE orders SET status = :'st_accept' WHERE id = 'ee000009-0000-0000-0000-000000000009';

-- ТЕСТ-10: обычная Кола — кандидат на подмену (другой заказ)
INSERT INTO orders (id, tenant_id, branch_id, customer_name, customer_phone, delivery_type, address, status, payment_type, subtotal, total)
VALUES ('ee000010-0000-0000-0000-000000000010', :'tenant', :'branch', 'ТЕСТ-10 Замена-ОБЫЧНАЯ', '+79990000010', 'delivery', 'Тестовая ул., 10', :'st_new', 'cash', 120, 120);
INSERT INTO order_items (order_id, tenant_id, dish_id, dish_name, category_name, price, quantity, status, sort_order)
VALUES ('ee000010-0000-0000-0000-000000000010', :'tenant', :'d_cola', 'Кока-Кола 0.5л', 'Напитки', 120, 1, 'confirmed', 0);
UPDATE orders SET status = :'st_accept' WHERE id = 'ee000010-0000-0000-0000-000000000010';

COMMIT;

-- ─── Контроль: блюдо + число карточек на каждый тест ───
SELECT o.customer_name, o.delivery_type, coalesce(o.table_name,'—') AS tbl,
       string_agg(DISTINCT kq.dish_name, ', ')          AS dishes,
       count(kq.id) FILTER (WHERE NOT kq.skip_kitchen)  AS kitchen_rows,
       count(kq.id) FILTER (WHERE kq.skip_kitchen)      AS skip_rows
FROM orders o
LEFT JOIN kitchen_queue kq ON kq.order_id = o.id
WHERE o.id::text LIKE 'ee0000%'
GROUP BY o.customer_name, o.delivery_type, o.table_name, o.created_at
ORDER BY o.customer_name;
