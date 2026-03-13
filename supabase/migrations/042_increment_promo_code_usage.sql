-- Инкрементирует used_count у промокода после успешного применения при создании заказа.
-- Вызывается с service_role из серверного API — RLS не применяется для service_role,
-- но функция также SECURITY DEFINER на случай вызова с другими ролями.
CREATE OR REPLACE FUNCTION increment_promo_code_usage(p_tenant_id uuid, p_code text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE promo_codes
  SET used_count = used_count + 1
  WHERE tenant_id = p_tenant_id
    AND upper(code) = upper(p_code)
    AND active = true
    AND deleted_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION increment_promo_code_usage(uuid, text) TO service_role;
