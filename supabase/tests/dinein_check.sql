-- ─────────────────────────────────────────────────────────────────────────────
-- SQL-level тесты dine-in «стол = один редактируемый чек».
-- Покрывает RPC из 327_dinein_check_rpcs.sql (open_table_check / add_items_to_check /
-- settle_table_check), delete_order_item_atomic и item-триггеры kitchen_queue.
--
-- Запуск:
--   docker exec -i supabase_db_fastio psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
--     < supabase/tests/dinein_check.sql
--
-- ВСЁ обёрнуто в один BEGIN … ROLLBACK — сид НЕ мутируется. Внутри транзакции
-- через `set local request.jwt.claims` имперсонируем владельца тенанта (auth.uid()
-- читает 'sub' из claims → has_permission видит owner-membership role_id IS NULL).
-- has_permission и RPC — SECURITY DEFINER на SQL/plpgsql, claims им видны.
--
-- Фикстура (демо-сид):
--   tenant  = 00000000-0000-0000-0000-000000000002 (retail, kitchen module = true)
--   owner   = 00000000-0000-0000-0000-000000000001 (role_id IS NULL → все права)
--   stranger= 99999999-9999-9999-9999-999999999999 (НЕ член тенанта → нет прав)
--   стол/блюда выбираем динамически из сида (ниже).
-- ─────────────────────────────────────────────────────────────────────────────

\set ON_ERROR_STOP on

BEGIN;

-- Создаём СОБСТВЕННЫЕ тестовые столы (8 шт) — не зависим от того, сколько
-- закрытых столов в сиде, и не упираемся в мутацию is_open между сценариями.
-- На tables только audit-триггер; всё откатывается в ROLLBACK.
INSERT INTO tables (tenant_id, name, branch_id, is_open)
SELECT
  '00000000-0000-0000-0000-000000000002'::uuid,
  '__test_dinein_' || g,
  (SELECT branch_id FROM tables
     WHERE tenant_id = '00000000-0000-0000-0000-000000000002'::uuid
       AND branch_id IS NOT NULL LIMIT 1),
  false
FROM generate_series(1, 8) AS g;

-- Фикстурные id в temp-таблицу (psql \set не доживает до DO-блоков).
CREATE TEMP TABLE _fx ON COMMIT DROP AS
SELECT
  '00000000-0000-0000-0000-000000000002'::uuid AS tenant_id,
  '00000000-0000-0000-0000-000000000001'::uuid AS owner_id,
  '99999999-9999-9999-9999-999999999999'::uuid AS stranger_id,
  (SELECT id FROM tables WHERE name = '__test_dinein_1') AS t1,
  (SELECT id FROM tables WHERE name = '__test_dinein_2') AS t2,
  (SELECT id FROM tables WHERE name = '__test_dinein_3') AS t3,
  (SELECT id FROM tables WHERE name = '__test_dinein_4') AS t4,
  (SELECT id FROM tables WHERE name = '__test_dinein_5') AS t5,
  (SELECT id FROM tables WHERE name = '__test_dinein_6') AS t6,
  (SELECT id FROM tables WHERE name = '__test_dinein_7') AS t7,
  (SELECT id FROM tables WHERE name = '__test_dinein_8') AS t8,
  -- два разных блюда, требующих кухню
  (SELECT id FROM dishes
     WHERE tenant_id = '00000000-0000-0000-0000-000000000002'::uuid
       AND requires_kitchen = true ORDER BY id LIMIT 1) AS dish1_id,
  (SELECT id FROM dishes
     WHERE tenant_id = '00000000-0000-0000-0000-000000000002'::uuid
       AND requires_kitchen = true ORDER BY id OFFSET 1 LIMIT 1) AS dish2_id;

DO $fx$
DECLARE r record;
BEGIN
  SELECT * INTO r FROM _fx;
  IF r.t8 IS NULL THEN RAISE EXCEPTION 'FIXTURE: test tables not created'; END IF;
  IF r.dish1_id IS NULL OR r.dish2_id IS NULL THEN
    RAISE EXCEPTION 'FIXTURE: need >=2 requires_kitchen dishes in tenant';
  END IF;
  RAISE NOTICE 'FIXTURE OK: 8 test tables created, dish1=% dish2=%', r.dish1_id, r.dish2_id;
END
$fx$;

-- Имперсонируем владельца на всю транзакцию.
SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001"}';

-- ── Scenario 1: double-open guard ─────────────────────────────────────────────
DO $s1$
DECLARE
  r        record;
  v_check  uuid;
  v_open   boolean;
  v_cnt    int;
  v_raised boolean := false;
BEGIN
  SELECT * INTO r FROM _fx;

  v_check := open_table_check(r.t1);
  IF v_check IS NULL THEN RAISE EXCEPTION 'FAIL S1: open returned NULL'; END IF;

  SELECT is_open INTO v_open FROM tables WHERE id = r.t1;
  IF v_open IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL S1: table not is_open'; END IF;

  SELECT count(*) INTO v_cnt FROM orders
    WHERE table_id = r.t1 AND check_status = 'open';
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'FAIL S1: expected exactly 1 open check, got %', v_cnt; END IF;

  -- Второй open того же стола → P0001 'Table already has an open check'
  BEGIN
    PERFORM open_table_check(r.t1);
  EXCEPTION WHEN sqlstate 'P0001' THEN
    IF SQLERRM NOT LIKE '%already has an open check%' THEN
      RAISE EXCEPTION 'FAIL S1: wrong P0001 message: %', SQLERRM;
    END IF;
    v_raised := true;
  END;
  IF NOT v_raised THEN RAISE EXCEPTION 'FAIL S1: double-open did not raise'; END IF;

  RAISE NOTICE 'OK S1: double-open guard — open ok, is_open=true, 1 open check, 2nd open blocked (P0001)';
END
$s1$;

-- ── Scenario 2: add confirmed ×2 → один чек, kitchen_queue для confirmed ──────
DO $s2$
DECLARE
  r        record;
  v_check  uuid;
  v_items  int;
  v_sub    numeric;
  v_total  numeric;
  v_expect numeric;
  v_kq     int;
  p1 numeric; p2 numeric;
BEGIN
  SELECT * INTO r FROM _fx;
  SELECT price INTO p1 FROM dishes WHERE id = r.dish1_id;
  SELECT price INTO p2 FROM dishes WHERE id = r.dish2_id;

  v_check := open_table_check(r.t2);

  PERFORM add_items_to_check(
    r.t2,
    jsonb_build_array(jsonb_build_object(
      'dish_id', r.dish1_id, 'dish_name', 'D1', 'price', p1, 'quantity', 2,
      'added_by', r.owner_id)),
    'confirmed');
  PERFORM add_items_to_check(
    r.t2,
    jsonb_build_array(jsonb_build_object(
      'dish_id', r.dish2_id, 'dish_name', 'D2', 'price', p2, 'quantity', 1,
      'added_by', r.owner_id)),
    'confirmed');

  SELECT count(*) INTO v_items FROM order_items WHERE order_id = v_check;
  IF v_items <> 2 THEN RAISE EXCEPTION 'FAIL S2: expected 2 items in same check, got %', v_items; END IF;

  v_expect := p1 * 2 + p2 * 1;
  SELECT subtotal, total INTO v_sub, v_total FROM orders WHERE id = v_check;
  IF v_sub <> v_expect OR v_total <> v_expect THEN
    RAISE EXCEPTION 'FAIL S2: subtotal/total %/% expected %', v_sub, v_total, v_expect;
  END IF;

  -- kitchen module включён → confirmed item-insert триггер кладёт в очередь.
  -- qty 2 + qty 1 = 3 строки (триггер пишет по строке на единицу).
  SELECT count(*) INTO v_kq FROM kitchen_queue WHERE order_id = v_check;
  IF v_kq <> 3 THEN RAISE EXCEPTION 'FAIL S2: expected 3 kitchen_queue rows, got %', v_kq; END IF;

  RAISE NOTICE 'OK S2: 2 confirmed items → один чек, items=2, subtotal=total=%, kitchen_queue=3', v_expect;
END
$s2$;

-- ── Scenario 3: pending → нет кухни до confirm ───────────────────────────────
DO $s3$
DECLARE
  r       record;
  v_check uuid;
  v_item  uuid;
  v_kq    int;
  p1 numeric;
BEGIN
  SELECT * INTO r FROM _fx;
  SELECT price INTO p1 FROM dishes WHERE id = r.dish1_id;

  v_check := open_table_check(r.t3);

  PERFORM add_items_to_check(
    r.t3,
    jsonb_build_array(jsonb_build_object(
      'dish_id', r.dish1_id, 'dish_name', 'P1', 'price', p1, 'quantity', 1)),
    'pending');

  SELECT id INTO v_item FROM order_items WHERE order_id = v_check ORDER BY sort_order DESC LIMIT 1;

  SELECT count(*) INTO v_kq FROM kitchen_queue WHERE order_item_id = v_item;
  IF v_kq <> 0 THEN RAISE EXCEPTION 'FAIL S3: pending item должен НЕ иметь kitchen_queue, got %', v_kq; END IF;

  -- Подтверждаем → on_item_confirmed триггер кладёт в очередь.
  UPDATE order_items SET status = 'confirmed', confirmed_by = r.owner_id WHERE id = v_item;

  SELECT count(*) INTO v_kq FROM kitchen_queue WHERE order_item_id = v_item;
  IF v_kq <> 1 THEN RAISE EXCEPTION 'FAIL S3: после confirm ожидаем 1 kitchen_queue, got %', v_kq; END IF;

  RAISE NOTICE 'OK S3: pending → 0 kitchen, после confirm → 1 kitchen (on_item_confirmed)';
END
$s3$;

-- ── Scenario 4: удалить последнюю позицию → чек остаётся открытым ─────────────
DO $s4$
DECLARE
  r       record;
  v_check uuid;
  v_item  uuid;
  v_res   jsonb;
  v_sub   numeric;
  v_exists boolean;
  p1 numeric;
BEGIN
  SELECT * INTO r FROM _fx;
  SELECT price INTO p1 FROM dishes WHERE id = r.dish1_id;

  -- переиспользуем стол из S1 (он уже открыт с пустым чеком)
  SELECT id INTO v_check FROM orders WHERE table_id = r.t1 AND check_status = 'open';

  PERFORM add_items_to_check(
    r.t1,
    jsonb_build_array(jsonb_build_object(
      'dish_id', r.dish1_id, 'dish_name', 'X', 'price', p1, 'quantity', 1)),
    'confirmed');
  SELECT id INTO v_item FROM order_items WHERE order_id = v_check ORDER BY sort_order DESC LIMIT 1;

  v_res := delete_order_item_atomic(v_item);

  SELECT EXISTS(SELECT 1 FROM orders WHERE id = v_check AND check_status = 'open') INTO v_exists;
  IF NOT v_exists THEN RAISE EXCEPTION 'FAIL S4: открытый чек удалён, а должен жить'; END IF;
  IF (v_res->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FAIL S4: ok != true: %', v_res; END IF;
  IF (v_res->>'order_deleted')::boolean IS NOT FALSE THEN RAISE EXCEPTION 'FAIL S4: order_deleted != false: %', v_res; END IF;

  SELECT subtotal INTO v_sub FROM orders WHERE id = v_check;
  IF v_sub <> 0 THEN RAISE EXCEPTION 'FAIL S4: subtotal должен быть 0, got %', v_sub; END IF;

  RAISE NOTICE 'OK S4: delete последней позиции → чек жив (order_deleted=false), subtotal=0';
END
$s4$;

-- ── Scenario 5: settle happy path + завершение seated-брони ───────────────────
DO $s5$
DECLARE
  r        record;
  v_check  uuid;
  v_res_id uuid;
  v_status text;
  v_pt     text;
  v_disc   numeric;
  v_total  numeric;
  v_settled timestamptz;
  v_open   boolean;
  v_opened timestamptz;
  v_resv_status text;
  p1 numeric; p2 numeric; v_sub numeric;
BEGIN
  SELECT * INTO r FROM _fx;
  SELECT price INTO p1 FROM dishes WHERE id = r.dish1_id;
  SELECT price INTO p2 FROM dishes WHERE id = r.dish2_id;

  -- открыт в S2 (table2) с двумя позициями
  SELECT id INTO v_check FROM orders WHERE table_id = r.t2 AND check_status = 'open';

  -- посадим seated-бронь на стол → open уже отработал, привяжем вручную к чеку,
  -- имитируя что бронь была до открытия (open линкует order_id у seated без order_id).
  INSERT INTO reservations (id, tenant_id, table_id, guest_name, guest_phone, guest_count,
                            reserved_date, reserved_time, status, order_id)
  VALUES (gen_random_uuid(), r.tenant_id, r.t2, 'Тест', '+70000000000', 2,
          current_date, '19:00', 'seated', v_check)
  RETURNING id INTO v_res_id;

  v_sub := p1 * 2 + p2 * 1;

  PERFORM settle_table_check(v_check, 100, 'card');

  SELECT check_status, payment_type, discount_amount, total, settled_at
    INTO v_status, v_pt, v_disc, v_total, v_settled
    FROM orders WHERE id = v_check;

  IF v_status <> 'settled' THEN RAISE EXCEPTION 'FAIL S5: check_status=% expected settled', v_status; END IF;
  IF v_pt <> 'card' THEN RAISE EXCEPTION 'FAIL S5: payment_type=% expected card', v_pt; END IF;
  IF v_disc <> 100 THEN RAISE EXCEPTION 'FAIL S5: discount=% expected 100', v_disc; END IF;
  IF v_total <> v_sub - 100 THEN RAISE EXCEPTION 'FAIL S5: total=% expected %', v_total, v_sub - 100; END IF;
  IF v_settled IS NULL THEN RAISE EXCEPTION 'FAIL S5: settled_at is NULL'; END IF;

  SELECT is_open, opened_at INTO v_open, v_opened FROM tables WHERE id = r.t2;
  IF v_open IS DISTINCT FROM false OR v_opened IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL S5: стол не закрыт (is_open=%, opened_at=%)', v_open, v_opened;
  END IF;

  SELECT status INTO v_resv_status FROM reservations WHERE id = v_res_id;
  IF v_resv_status <> 'completed' THEN RAISE EXCEPTION 'FAIL S5: бронь status=% expected completed', v_resv_status; END IF;

  RAISE NOTICE 'OK S5: settle — settled/card, discount=100, total=%, стол закрыт, бронь completed', v_sub - 100;
END
$s5$;

-- ── Scenario 6: settle clamp (скидка > subtotal и отрицательная) ──────────────
DO $s6b$
DECLARE
  r       record;
  v_check uuid;
  v_disc  numeric; v_total numeric; v_sub numeric;
  v_tbl   uuid;
  p1 numeric;
BEGIN
  SELECT * INTO r FROM _fx;
  SELECT price INTO p1 FROM dishes WHERE id = r.dish1_id;

  -- clamp вверх
  v_tbl := r.t4;
  v_check := open_table_check(v_tbl);
  PERFORM add_items_to_check(v_tbl,
    jsonb_build_array(jsonb_build_object('dish_id', r.dish1_id,'dish_name','A','price', p1,'quantity',1)),
    'confirmed');
  v_sub := p1;
  PERFORM settle_table_check(v_check, v_sub + 99999, 'cash');
  SELECT discount_amount, total INTO v_disc, v_total FROM orders WHERE id = v_check;
  IF v_disc <> v_sub THEN RAISE EXCEPTION 'FAIL S6: clamp-up discount=% expected %', v_disc, v_sub; END IF;
  IF v_total <> 0 THEN RAISE EXCEPTION 'FAIL S6: clamp-up total=% expected 0', v_total; END IF;

  -- clamp вниз (отрицательная скидка → 0)
  v_tbl := r.t5;
  v_check := open_table_check(v_tbl);
  PERFORM add_items_to_check(v_tbl,
    jsonb_build_array(jsonb_build_object('dish_id', r.dish1_id,'dish_name','B','price', p1,'quantity',1)),
    'confirmed');
  PERFORM settle_table_check(v_check, -500, 'cash');
  SELECT discount_amount, total INTO v_disc, v_total FROM orders WHERE id = v_check;
  IF v_disc <> 0 THEN RAISE EXCEPTION 'FAIL S6: clamp-down discount=% expected 0', v_disc; END IF;
  IF v_total <> p1 THEN RAISE EXCEPTION 'FAIL S6: clamp-down total=% expected %', v_total, p1; END IF;

  RAISE NOTICE 'OK S6: clamp — скидка>subtotal→=subtotal,total=0; отрицательная→0,total=subtotal';
END
$s6b$;

-- ── Scenario 7: пустой чек → cancelled, стол закрыт ──────────────────────────
DO $s7$
DECLARE
  r       record;
  v_check uuid;
  v_status text;
  v_open  boolean;
  v_tbl   uuid;
BEGIN
  SELECT * INTO r FROM _fx;
  v_tbl := r.t6;
  v_check := open_table_check(v_tbl);  -- без позиций
  PERFORM settle_table_check(v_check, 0, 'cash');

  SELECT check_status INTO v_status FROM orders WHERE id = v_check;
  IF v_status <> 'cancelled' THEN RAISE EXCEPTION 'FAIL S7: пустой чек status=% expected cancelled', v_status; END IF;

  SELECT is_open INTO v_open FROM tables WHERE id = v_tbl;
  IF v_open IS DISTINCT FROM false THEN RAISE EXCEPTION 'FAIL S7: стол не закрыт'; END IF;

  RAISE NOTICE 'OK S7: пустой чек → cancelled, стол закрыт';
END
$s7$;

-- ── Scenario 8: permission denied ────────────────────────────────────────────
-- Переключаем claims на «чужака» (НЕ член тенанта) → has_permission=false → 42501.
DO $s8$
DECLARE
  r        record;
  v_tbl    uuid;
  v_check  uuid;
  v_raised boolean := false;
BEGIN
  SELECT * INTO r FROM _fx;

  -- сперва как owner откроем чек, чтобы было что «расчитывать»
  v_tbl := r.t7;
  v_check := open_table_check(v_tbl);

  -- меняем claims внутри блока (set_config local) на чужака
  PERFORM set_config('request.jwt.claims',
                     '{"sub":"99999999-9999-9999-9999-999999999999"}', true);

  -- open другого стола (t8) чужаком → 42501 (tables.manage)
  BEGIN
    PERFORM open_table_check(r.t8);
  EXCEPTION WHEN sqlstate '42501' THEN v_raised := true;
  END;
  IF NOT v_raised THEN RAISE EXCEPTION 'FAIL S8: open чужаком не дал 42501'; END IF;

  -- settle открытого чека чужаком → 42501 (orders.edit)
  v_raised := false;
  BEGIN
    PERFORM settle_table_check(v_check, 0, 'cash');
  EXCEPTION WHEN sqlstate '42501' THEN v_raised := true;
  END;
  IF NOT v_raised THEN RAISE EXCEPTION 'FAIL S8: settle чужаком не дал 42501'; END IF;

  RAISE NOTICE 'OK S8: permission denied — open и settle чужаком → 42501';

  -- вернём owner-claims (не обязательно: дальше только ROLLBACK)
  PERFORM set_config('request.jwt.claims',
                     '{"sub":"00000000-0000-0000-0000-000000000001"}', true);
END
$s8$;

-- ── Scenario 9: delete_order_item_atomic для НЕ-dine_in → заказ удаляется ─────
-- Регрессия sweep-триггера из 326: исходящий (delivery) заказ при удалении
-- последней позиции по-прежнему должен сноситься целиком (order_deleted=true),
-- а не «жить пустым» как открытый dine-in чек.
DO $s9$
DECLARE
  r        record;
  v_order  uuid;
  v_item   uuid;
  v_res    jsonb;
  v_cnt    int;
  p1 numeric;
BEGIN
  SELECT * INTO r FROM _fx;
  SELECT price INTO p1 FROM dishes WHERE id = r.dish1_id;

  -- delivery-заказ: check_status остаётся NULL (это не чек стола).
  INSERT INTO orders (tenant_id, delivery_type, subtotal, total, payment_type, status)
  VALUES (r.tenant_id, 'delivery', p1, p1, 'cash', 'new')
  RETURNING id INTO v_order;

  INSERT INTO order_items (order_id, tenant_id, dish_id, dish_name, price, quantity, status)
  VALUES (v_order, r.tenant_id, r.dish1_id, 'OUT', p1, 1, 'confirmed')
  RETURNING id INTO v_item;

  v_res := delete_order_item_atomic(v_item);

  IF (v_res->>'ok')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FAIL S9: ok != true: %', v_res; END IF;
  IF (v_res->>'order_deleted')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FAIL S9: order_deleted != true: %', v_res; END IF;

  SELECT count(*) INTO v_cnt FROM orders WHERE id = v_order;
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'FAIL S9: delivery-заказ не удалён, count=%', v_cnt; END IF;

  RAISE NOTICE 'OK S9: не-dine_in delete последней позиции → order_deleted=true, заказ снесён';
END
$s9$;

-- ── Scenario 10: open_table_check линкует уже сидящую (seated) бронь ──────────
-- Критический путь: бронь была seated ДО открытия чека (order_id IS NULL).
-- open_table_check должен сам прописать ей order_id = новый чек (в отличие от
-- S5, где линк делается руками). Иначе история стола теряет бронь.
DO $s10$
DECLARE
  r        record;
  v_check  uuid;
  v_res_id uuid;
  v_cnt    int;
  v_linked uuid;
BEGIN
  SELECT * INTO r FROM _fx;

  -- t8 ещё закрыт (S8 открыл t7, а t8 трогал только провалившийся open чужака).
  INSERT INTO reservations (tenant_id, table_id, guest_name, guest_phone, guest_count,
                            reserved_date, reserved_time, status, order_id)
  VALUES (r.tenant_id, r.t8, 'Сидящий', '+70000000001', 3,
          current_date, '20:00', 'seated', NULL)
  RETURNING id INTO v_res_id;

  v_check := open_table_check(r.t8);
  IF v_check IS NULL THEN RAISE EXCEPTION 'FAIL S10: open returned NULL'; END IF;

  -- (a) открытый чек для t8 существует и равен возвращённому.
  SELECT count(*) INTO v_cnt FROM orders
    WHERE table_id = r.t8 AND check_status = 'open' AND id = v_check;
  IF v_cnt <> 1 THEN RAISE EXCEPTION 'FAIL S10: ожидаем 1 open-чек = v_check, got %', v_cnt; END IF;

  -- (b) бронь теперь привязана к этому чеку (линк отработал внутри open).
  SELECT order_id INTO v_linked FROM reservations WHERE id = v_res_id;
  IF v_linked IS DISTINCT FROM v_check THEN
    RAISE EXCEPTION 'FAIL S10: бронь order_id=% expected % (линк не сработал)', v_linked, v_check;
  END IF;

  RAISE NOTICE 'OK S10: open_table_check сам залинковал seated-бронь к новому чеку';
END
$s10$;

-- ── Scenario 11: add_items_to_check confirmed без права → 42501 ───────────────
-- confirmed-путь гейтится has_permission('tables.manage'). Чужак (НЕ член
-- тенанта) должен ловить 42501. pending-путь permission-free — его НЕ проверяем.
DO $s11$
DECLARE
  r        record;
  v_tbl    uuid;
  v_check  uuid;
  v_raised boolean := false;
BEGIN
  SELECT * INTO r FROM _fx;

  -- открываем чек как owner (t3 уже открыт в S3 — переиспользуем его).
  SELECT id INTO v_check FROM orders WHERE table_id = r.t3 AND check_status = 'open';
  IF v_check IS NULL THEN RAISE EXCEPTION 'FIXTURE S11: t3 не имеет открытого чека'; END IF;
  v_tbl := r.t3;

  -- переключаемся на чужака
  PERFORM set_config('request.jwt.claims',
                     '{"sub":"99999999-9999-9999-9999-999999999999"}', true);

  BEGIN
    PERFORM add_items_to_check(
      v_tbl,
      '[{"dish_name":"X","price":100,"quantity":1}]'::jsonb,
      'confirmed');
  EXCEPTION WHEN sqlstate '42501' THEN v_raised := true;
  END;
  IF NOT v_raised THEN RAISE EXCEPTION 'FAIL S11: confirmed чужаком не дал 42501'; END IF;

  -- вернём owner-claims (дальше только финальный NOTICE + ROLLBACK).
  PERFORM set_config('request.jwt.claims',
                     '{"sub":"00000000-0000-0000-0000-000000000001"}', true);

  RAISE NOTICE 'OK S11: add_items_to_check confirmed чужаком → 42501';
END
$s11$;

DO $$ BEGIN RAISE NOTICE '── ВСЕ СЦЕНАРИИ ПРОЙДЕНЫ ──'; END $$;

ROLLBACK;
