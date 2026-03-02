-- CHECK constraints для enum-полей
ALTER TABLE orders
  ADD CONSTRAINT orders_status_check
    CHECK (status IN ('new','accepted','cooking','ready','delivering','completed','cancelled')),
  ADD CONSTRAINT orders_delivery_type_check
    CHECK (delivery_type IN ('delivery','pickup')),
  ADD CONSTRAINT orders_payment_type_check
    CHECK (payment_type IN ('cash','card','online'));

ALTER TABLE promotions
  ADD CONSTRAINT promotions_discount_type_check
    CHECK (discount_type IN ('percent','fixed'));

ALTER TABLE promo_codes
  ADD CONSTRAINT promo_codes_discount_type_check
    CHECK (discount_type IN ('percent','fixed'));

-- Precision для денежных полей
ALTER TABLE dishes ALTER COLUMN price TYPE numeric(10,2);
ALTER TABLE orders
  ALTER COLUMN discount_amount TYPE numeric(10,2),
  ALTER COLUMN subtotal TYPE numeric(10,2),
  ALTER COLUMN delivery_fee TYPE numeric(10,2),
  ALTER COLUMN total TYPE numeric(10,2);
ALTER TABLE tenants
  ALTER COLUMN delivery_min_order TYPE numeric(10,2),
  ALTER COLUMN delivery_fee TYPE numeric(10,2);
ALTER TABLE promotions ALTER COLUMN discount_value TYPE numeric(10,2);
ALTER TABLE promo_codes ALTER COLUMN discount_value TYPE numeric(10,2);

-- updated_at для ключевых таблиц
ALTER TABLE tenants ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE orders ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE dishes ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE categories ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

-- Триггер автообновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_dishes_updated_at BEFORE UPDATE ON dishes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at();
