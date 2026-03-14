-- Привязка применённой акции к заказу
ALTER TABLE orders ADD COLUMN promotion_id uuid REFERENCES promotions(id) ON DELETE SET NULL;
