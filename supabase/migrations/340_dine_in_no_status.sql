-- 340: dine-in заказы не имеют статуса — orders.status = NULL вместо литерала 'new'.
--
-- Корень бага «invalid input syntax for type uuid: new» на клейме блюда со стола:
-- у заказа-чека (dine_in) жизненный цикл идёт через check_status (open/settled/
-- cancelled), а НЕ через orders.status (uuid → order_statuses, флоу навынос).
-- open_table_check (327/331) пихал в status литерал 'new' как NOT-NULL-плейсхолдер.
-- Любой консьюмер, кастящий orders.status::uuid, на dine-in взрывался — первым
-- словил триггер kitchen_queue_check_cooking_started (134), у которого 326-sweep
-- проглядел dine_in-гард.
--
-- Почему NULL, а не «настоящий» id статуса: у стола статуса нет концептуально.
-- NULL = «нет статуса» — честная модель. NULL::uuid = NULL (не падает), а схема
-- УЖЕ это закладывала: orders_init_visited_status (143) содержит `IF NEW.status
-- IS NOT NULL`. Колонка получила NOT NULL DEFAULT 'new' в 001, а 013 при переходе
-- статусов на uuid забыл это снять — отсюда токсичный дефолт.
--
-- Делаем разом весь класс (источник + поведение + данные), без латок:
--   1) источник: open_table_check вставляет NULL; колонка теряет DEFAULT/NOT NULL;
--   2) поведение: status-воркфлоу триггеры явно НЕ трогают dine_in (это верная
--      семантика — даже на NULL триггер cooking_started иначе припишет столу
--      cookingStatusId через UPDATE orders SET status);
--   3) данные: существующие dine-in чеки с 'new' → NULL.
--
-- NB по search_path: 271 выставил proconfig только cooking_started. order_complete
-- его не имел вовсе. CREATE OR REPLACE без явного SET search_path сбросил бы
-- proconfig в NULL (см. предупреждение 271) — поэтому задаём явно всем троим.

-- ── 1. Источник: снять токсичный дефолт и разрешить NULL ──
ALTER TABLE orders ALTER COLUMN status DROP DEFAULT;
ALTER TABLE orders ALTER COLUMN status DROP NOT NULL;

-- ── 2. open_table_check: dine-in чек создаётся БЕЗ статуса (NULL) ──
CREATE OR REPLACE FUNCTION public.open_table_check(p_table_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_tenant_id uuid;
  v_branch_id uuid;
  v_name      text;
  v_check_id  uuid;
BEGIN
  SELECT tenant_id, branch_id, name
    INTO v_tenant_id, v_branch_id, v_name
    FROM tables WHERE id = p_table_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Table not found' USING ERRCODE = 'P0001';
  END IF;
  IF NOT has_permission(v_tenant_id, 'tables.manage') THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  -- Открываем стол ДО вставки чека: BEFORE INSERT trg_orders_check_table_open
  -- требует is_open=true для dine_in. На двойном open ниже INSERT упадёт на
  -- партиал-уникальном индексе и откатит этот UPDATE вместе со всей функцией.
  UPDATE tables SET is_open = true, opened_at = now() WHERE id = p_table_id;

  BEGIN
    -- status = NULL: у стола нет статус-воркфлоу, он живёт по check_status.
    INSERT INTO orders (
      tenant_id, delivery_type, table_id, table_name, branch_id,
      check_status, status, subtotal, total, discount_amount, payment_type
    ) VALUES (
      v_tenant_id, 'dine_in', p_table_id, v_name, v_branch_id,
      'open', NULL, 0, 0, 0, 'cash'   -- payment_type='cash' плейсхолдер, перезапишет settle
    )
    RETURNING id INTO v_check_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Table already has an open check' USING ERRCODE = 'P0001';
  END;

  -- Линк seated-брони к чеку (если есть) — для истории. Не критично, без ошибки.
  UPDATE reservations
    SET order_id = v_check_id
    WHERE table_id = p_table_id AND status = 'seated' AND order_id IS NULL;

  RETURN v_check_id;
END;
$function$;

-- ── 3a. Триггер авто-перевода в «готовится»: пропускаем dine_in ──
CREATE OR REPLACE FUNCTION kitchen_queue_check_cooking_started()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _config        jsonb;
  _target_id     text;
  _tenant_id     uuid;
  _delivery_type text;
  _old_status    text;
  _old_name      text;
  _new_name      text;
  _already_started boolean;
BEGIN
  -- Only react to queued -> in_progress or queued -> done
  IF OLD.status != 'queued' OR NEW.status NOT IN ('in_progress', 'done') THEN
    RETURN NEW;
  END IF;

  -- Lock order row first to serialize concurrent claims on the same order
  SELECT t.kitchen_config, o.tenant_id, o.delivery_type, o.status
  INTO _config, _tenant_id, _delivery_type, _old_status
  FROM orders o
  JOIN tenants t ON t.id = o.tenant_id
  WHERE o.id = NEW.order_id
  FOR UPDATE OF o;

  -- dine_in живёт по check_status, у него нет orders.status-воркфлоу: не двигаем.
  IF _delivery_type = 'dine_in' THEN
    RETURN NEW;
  END IF;

  -- Check if any other item in this order already left 'queued' state
  -- (after lock, so we see committed changes from concurrent transactions)
  SELECT EXISTS (
    SELECT 1 FROM kitchen_queue
    WHERE order_id = NEW.order_id
      AND id != NEW.id
      AND status != 'queued'
  ) INTO _already_started;

  IF _already_started THEN
    RETURN NEW;
  END IF;

  _target_id := _config ->> 'cookingStatusId';

  IF _target_id IS NULL OR _target_id = _old_status THEN
    RETURN NEW;
  END IF;

  SELECT name INTO _old_name FROM order_statuses WHERE id = _old_status::uuid;
  SELECT name INTO _new_name FROM order_statuses WHERE id = _target_id::uuid;

  UPDATE orders SET status = _target_id WHERE id = NEW.order_id;

  INSERT INTO order_events (order_id, tenant_id, actor_id, actor_name, actor_role, event_type, meta)
  VALUES (
    NEW.order_id, _tenant_id, NULL, 'Кухня', NULL, 'status_changed',
    jsonb_build_object('from_id', _old_status, 'from_name', _old_name, 'to_id', _target_id, 'to_name', _new_name, 'auto', true)
  );

  RETURN NEW;
END;
$$;

-- ── 3b. Триггер авто-перевода в «выполнен» по завершению кухни: пропускаем dine_in ──
CREATE OR REPLACE FUNCTION kitchen_queue_check_order_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _all_done      boolean;
  _config        jsonb;
  _completed_map jsonb;
  _delivery_type text;
  _target_id     text;
  _tenant_id     uuid;
  _old_status    text;
  _old_name      text;
  _new_name      text;
BEGIN
  IF NEW.status != 'done' OR OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT NOT EXISTS (
    SELECT 1 FROM kitchen_queue
    WHERE order_id = NEW.order_id
      AND status NOT IN ('done', 'served')
  ) INTO _all_done;

  IF NOT _all_done THEN
    RETURN NEW;
  END IF;

  SELECT t.kitchen_config, o.delivery_type, o.tenant_id, o.status
  INTO _config, _delivery_type, _tenant_id, _old_status
  FROM orders o
  JOIN tenants t ON t.id = o.tenant_id
  WHERE o.id = NEW.order_id;

  -- dine_in не имеет orders.status-воркфлоу (живёт по check_status): не трогаем.
  IF _delivery_type = 'dine_in' THEN
    RETURN NEW;
  END IF;

  _completed_map := _config -> 'completedStatusMap';

  IF _completed_map IS NULL THEN
    RETURN NEW;
  END IF;

  _target_id := _completed_map ->> _delivery_type;

  IF _target_id IS NOT NULL THEN
    SELECT name INTO _old_name FROM order_statuses WHERE id = _old_status::uuid;
    SELECT name INTO _new_name FROM order_statuses WHERE id = _target_id::uuid;

    UPDATE orders SET status = _target_id WHERE id = NEW.order_id;

    INSERT INTO order_events (order_id, tenant_id, actor_id, actor_name, actor_role, event_type, meta)
    VALUES (
      NEW.order_id, _tenant_id, NULL, 'Кухня', NULL, 'status_changed',
      jsonb_build_object('from_id', _old_status, 'from_name', _old_name, 'to_id', _target_id, 'to_name', _new_name, 'auto', true)
    );
  END IF;

  RETURN NEW;
END;
$$;

-- ── 3c. Триггер каскада отмены заказа на кухню: пропускаем dine_in ──
-- dine_in отменяется через settle_table_check (check_status='cancelled'), который
-- сам гасит kitchen_queue. orders.status у стола не меняется, так что триггер и
-- так бы не сработал — но явный гард честнее и страхует от будущих правок.
CREATE OR REPLACE FUNCTION kitchen_queue_on_order_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _new_group text;
BEGIN
  IF NEW.delivery_type = 'dine_in' THEN
    RETURN NEW;
  END IF;

  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT group_type INTO _new_group
  FROM order_statuses
  WHERE id::text = NEW.status;

  IF _new_group = 'cancelled' THEN
    -- Отменяем ВСЕ незавершённые строки, включая уже приготовленные ('done'):
    -- отменённый заказ не принёс денег и не должен оставаться в «Готово»/влиять
    -- на аналитику — целиком уходит в «Отменено», даже если что-то успели сделать.
    -- 'served' не трогаем (еда физически отдана, исторический факт).
    UPDATE kitchen_queue
    SET status = 'cancelled'
    WHERE order_id = NEW.id
      AND status IN ('queued', 'in_progress', 'done');
  END IF;

  RETURN NEW;
END;
$$;

-- ── 4. Данные: существующие dine-in чеки с токсичным литералом 'new' → NULL ──
-- Цельно только dine_in+'new' (ровно то, что создал open_table_check). Историю
-- навынос не трогаем; валидные uuid-статусы старых dine_in (если есть) не ломались
-- и не переписываются.
UPDATE orders SET status = NULL WHERE delivery_type = 'dine_in' AND status = 'new';
