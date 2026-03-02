-- Tenants: быстрый поиск по slug и кастомному домену (для резолва тенанта в middleware)
CREATE INDEX ON tenants (slug);
CREATE INDEX ON tenants (custom_domain) WHERE custom_domain IS NOT NULL;

-- Categories
CREATE INDEX ON categories (tenant_id);
CREATE INDEX ON categories (tenant_id, sort_order);

-- Dishes
CREATE INDEX ON dishes (tenant_id);
CREATE INDEX ON dishes (category_id);
CREATE INDEX ON dishes (tenant_id, sort_order);

-- Orders: список заказов ресторана, сортированный по дате
CREATE INDEX ON orders (tenant_id);
CREATE INDEX ON orders (tenant_id, created_at DESC);
CREATE INDEX ON orders (tenant_id, status);

-- Promotions
CREATE INDEX ON promotions (tenant_id);
CREATE INDEX ON promotions (tenant_id, active);

-- Promo codes: поиск по коду при применении на витрине
CREATE INDEX ON promo_codes (tenant_id);
CREATE INDEX ON promo_codes (tenant_id, code);
