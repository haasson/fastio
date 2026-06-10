-- 325: Dine-in «стол = один чек». Ось жизненного цикла чека отдельной колонкой.
-- check_status: open|settled|cancelled, NULL для не-dine_in заказов.
-- payment_type ПЕРЕИСПОЛЬЗУЕМ (не добавляем paid_method) — он уже NOT NULL cash|card|online.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS check_status text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS settled_at  timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS settled_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_check_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_check_status_check
  CHECK (check_status IS NULL OR check_status IN ('open','settled','cancelled'));

-- ≤1 открытый чек на стол. Ловит гонку двойного open_table_check.
CREATE UNIQUE INDEX IF NOT EXISTS orders_one_open_check_per_table
  ON orders (table_id) WHERE check_status = 'open';

-- История фильтрует по check_status — частичный индекс под список закрытых чеков.
CREATE INDEX IF NOT EXISTS idx_orders_check_status
  ON orders (tenant_id, check_status) WHERE check_status IS NOT NULL;
