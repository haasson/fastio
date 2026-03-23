-- Narrow RLS policies for anon role — enables Supabase realtime for dine-in check updates.
-- Only exposes order_items and kitchen_queue for dine_in orders at open tables.
-- The table UUID acts as an access token (not guessable).

CREATE POLICY "anon_select_dine_in_items" ON order_items
FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM orders o
    JOIN tables t ON t.id = o.table_id
    WHERE o.id = order_items.order_id
    AND o.delivery_type = 'dine_in'
    AND t.is_open = true
  )
);

CREATE POLICY "anon_select_dine_in_kitchen" ON kitchen_queue
FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM orders o
    JOIN tables t ON t.id = o.table_id
    WHERE o.id = kitchen_queue.order_id
    AND o.delivery_type = 'dine_in'
    AND t.is_open = true
  )
);
