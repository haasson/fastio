-- 331: fix open_table_check — открыть стол ДО вставки чека.
--
-- Легаси-триггер trg_orders_check_table_open (миграция 060, BEFORE INSERT на
-- orders) запрещает dine_in-вставку, если стол не is_open. open_table_check
-- (327) вставлял пустой чек ДО `UPDATE tables SET is_open=true`, поэтому триггер
-- валил вставку с 'Table is not open or not active' на свежесмигрированной БД
-- (CI/prod). Локалка дева триггер не имела (дрейф) → баг не ловился до nightly.
--
-- Триггер-sweep (326) свёл прочие dine_in-триггеры, но этот legacy-гард не
-- тронул — он остался единственным, кого бьёт insert open_table_check.
-- Фикс: сначала открыть стол (is_open/opened_at), потом вставлять чек. Порядок
-- внутри одной транзакции; при двойном open INSERT ловит партиал-уникальный
-- индекс → re-raise откатывает и преждевременный UPDATE. Триггер 060 оставляем
-- бэкстопом для случайных dine_in-вставок на закрытый стол.

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
    INSERT INTO orders (
      tenant_id, delivery_type, table_id, table_name, branch_id,
      check_status, status, subtotal, total, discount_amount, payment_type
    ) VALUES (
      v_tenant_id, 'dine_in', p_table_id, v_name, v_branch_id,
      'open', 'new', 0, 0, 0, 'cash'   -- payment_type='cash' плейсхолдер, перезапишет settle
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
