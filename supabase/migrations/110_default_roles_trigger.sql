-- ─────────────────────────────────────
-- Auto-create default roles when a tenant is created
-- ─────────────────────────────────────
CREATE OR REPLACE FUNCTION create_default_roles()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO tenant_roles (tenant_id, name, is_default, permissions) VALUES
    (NEW.id, 'Администратор', true, '{"menu.view":true,"menu.edit":true,"menu.delete":true,"orders.view":true,"orders.create":true,"orders.edit":true,"orders.status":true,"orders.cancel":true,"kitchen.view":true,"tables.view":true,"tables.manage":true,"reservations.view":true,"reservations.manage":true,"promos.view":true,"promos.manage":true,"content.view":true,"content.edit":true,"team.view":true,"team.manage":true,"roles.manage":true,"settings.view":true,"settings.edit":true,"analytics.view":true}'),
    (NEW.id, 'Менеджер зала', true, '{"menu.view":true,"orders.view":true,"orders.create":true,"orders.edit":true,"orders.status":true,"orders.cancel":true,"kitchen.view":true,"tables.view":true,"tables.manage":true,"reservations.view":true,"reservations.manage":true}'),
    (NEW.id, 'Кассир', true, '{"menu.view":true,"orders.view":true,"orders.create":true,"orders.edit":true,"orders.status":true}'),
    (NEW.id, 'Повар', true, '{"menu.view":true,"kitchen.view":true}'),
    (NEW.id, 'Хостес', true, '{"orders.view":true,"tables.view":true,"reservations.view":true,"reservations.manage":true}'),
    (NEW.id, 'Контент-менеджер', true, '{"menu.view":true,"menu.edit":true,"menu.delete":true,"promos.view":true,"promos.manage":true,"content.view":true,"content.edit":true}');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_default_roles
  AFTER INSERT ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION create_default_roles();
