-- accept_invitation_atomic падал 42883 (operator does not exist: uuid = text) на первом
-- же `SELECT ... WHERE token = _token FOR UPDATE`: колонка tenant_invitations.token имеет
-- тип uuid, а параметр _token объявлен text (миграция 269). Через PostgREST `.eq('token', …)`
-- каст text→uuid делался автоматически, поэтому get-invite и валидация в accept-invite
-- работали — а сырой SQL в RPC неявного каста не делает и падал. Из-за этого приём ЛЮБОГО
-- инвайта (new-user и authenticated) валился в HTTP 500 "Failed to accept invitation".
-- Фикс: кастуем _token::uuid в предикате. Тело и сигнатура в остальном без изменений.

CREATE OR REPLACE FUNCTION accept_invitation_atomic(
  _token text,
  _user_id uuid,
  _user_email text
)
RETURNS TABLE (tenant_id uuid, role_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv tenant_invitations%ROWTYPE;
BEGIN
  -- FOR UPDATE блокирует строку до конца транзакции — параллельный accept того же токена
  -- увидит уже-обновлённый accepted_at после своего FOR UPDATE и провалится на проверке.
  -- _token::uuid — колонка token имеет тип uuid (см. шапку миграции).
  SELECT * INTO v_inv
  FROM tenant_invitations
  WHERE token = _token::uuid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invitation_not_found' USING ERRCODE = '02000';
  END IF;

  IF v_inv.accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'invitation_already_accepted' USING ERRCODE = '23514';
  END IF;

  IF v_inv.expires_at < now() THEN
    RAISE EXCEPTION 'invitation_expired' USING ERRCODE = '22023';
  END IF;

  IF lower(v_inv.email) <> lower(_user_email) THEN
    RAISE EXCEPTION 'invitation_email_mismatch' USING ERRCODE = '42501';
  END IF;

  -- UNIQUE(tenant_id, user_id) → 23505 если юзер уже member. Прокидываем как есть,
  -- edge-функция разводит в HTTP 409.
  INSERT INTO tenant_members (tenant_id, user_id, role_id, branch_ids)
  VALUES (v_inv.tenant_id, _user_id, v_inv.role_id, COALESCE(v_inv.branch_ids, ARRAY[]::uuid[]));

  UPDATE tenant_invitations
  SET accepted_at = now()
  WHERE id = v_inv.id;

  RETURN QUERY SELECT v_inv.tenant_id, v_inv.role_id;
END;
$$;

REVOKE ALL ON FUNCTION accept_invitation_atomic(text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION accept_invitation_atomic(text, uuid, text) TO service_role;
