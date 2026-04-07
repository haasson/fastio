-- Автоматически добавляем owner в tenant_members при создании тенанта.
-- Защита от ситуации, когда owner_id есть в tenants, но нет записи в tenant_members.

CREATE OR REPLACE FUNCTION auto_create_owner_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO tenant_members (tenant_id, user_id)
  VALUES (NEW.id, NEW.owner_id)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_owner_membership
  AFTER INSERT ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_owner_membership();

-- Backfill: добавить membership для всех owner, у которых записи нет
INSERT INTO tenant_members (tenant_id, user_id)
SELECT t.id, t.owner_id
FROM tenants t
LEFT JOIN tenant_members tm ON tm.tenant_id = t.id AND tm.user_id = t.owner_id
WHERE tm.id IS NULL
ON CONFLICT DO NOTHING;
