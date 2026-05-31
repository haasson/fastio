-- Migration 304: Kitchen queue lifecycle decoupling (Phase 06)
--
-- Проблема: строки kitchen_queue намертво привязаны к order/order_item через
-- ON DELETE CASCADE (071). Любое физическое удаление order_items/orders
-- (update_order_with_items reinsert, delete_order_item_atomic, удаление заказа)
-- молча сносило строки кухни → realtime DELETE → карточки пропадали с KDS,
-- хотя UI рассчитан на мягкую отмену (status='cancelled', перечёркнуто).
--
-- Доменная модель: kitchen_queue = независимый контейнер клонов-блюд. Каждый
-- клон хранит денормализованную копию (dish_name, modifiers, addons,
-- removed_ingredients, category_name, delivery_type). Для готовки и отрисовки
-- живой order_items ему НЕ нужен. Удаление/правка заказа НЕ должны уничтожать
-- строку кухни — вместо этого строка получает событие 'cancelled'.
--
-- Этот change set:
--   C1 — снять ON DELETE CASCADE → SET NULL (клон выживает при удалении).
--   C3 — BEFORE DELETE на order_items → мягкая отмена его строк кухни.
--   C2 — AFTER UPDATE на orders → при переходе в группу 'cancelled' мягко
--        отменить строки кухни заказа (единый исход для любого UI-пути:
--        inline-смена статуса, drawer-сохранение, RPC update_order_status).
--
-- Безопасность C3 при reinsert внутри update_order_with_items: позиции
-- редактируемы только в группе 'new' (useOrderStatus.can.editItems), а кухня
-- наполняется при sourceStatusId (группа in_progress) — пересечения нет.
-- Фронт (C4) дополнительно не шлёт items вне группы 'new', поэтому
-- update_order_with_items для заказа на кухне вообще не трогает order_items.

-- ─── C1: decouple kitchen_queue from order/item physical deletion ───

ALTER TABLE kitchen_queue ALTER COLUMN order_id DROP NOT NULL;
ALTER TABLE kitchen_queue ALTER COLUMN order_item_id DROP NOT NULL;

ALTER TABLE kitchen_queue DROP CONSTRAINT kitchen_queue_order_id_fkey;
ALTER TABLE kitchen_queue ADD CONSTRAINT kitchen_queue_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;

ALTER TABLE kitchen_queue DROP CONSTRAINT kitchen_queue_order_item_id_fkey;
ALTER TABLE kitchen_queue ADD CONSTRAINT kitchen_queue_order_item_id_fkey
  FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE SET NULL;

-- ─── C3: soft-cancel kitchen rows on order_item delete ──────────────
-- BEFORE DELETE: успеваем отметить строки кухни как cancelled до того, как
-- FK SET NULL отвяжет их. Точечная отмена при удалении ОДНОГО блюда
-- (dine_in «удалить блюдо», delete_order_item_atomic, удаление пустого заказа).

CREATE OR REPLACE FUNCTION kitchen_queue_on_item_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE kitchen_queue
  SET status = 'cancelled'
  WHERE order_item_id = OLD.id
    AND status IN ('queued', 'in_progress');

  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_kitchen_queue_on_item_delete
  BEFORE DELETE ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION kitchen_queue_on_item_delete();

-- ─── C2: soft-cancel kitchen rows when order enters cancelled group ─
-- AFTER UPDATE: единый исход отмены для любого пути, меняющего orders.status
-- (update_order_status RPC, update_order_with_items, прямой UPDATE).
-- Сравниваем по тексту (id::text = NEW.status) как остальные RPC — без cast,
-- чтобы не падать на легаси-данных с невалидным uuid в status.

CREATE OR REPLACE FUNCTION kitchen_queue_on_order_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _new_group text;
BEGIN
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

CREATE TRIGGER trg_kitchen_queue_on_order_cancel
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION kitchen_queue_on_order_cancel();
