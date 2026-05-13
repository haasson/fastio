-- Atomic accept_invitation: блокировка строки + проверки + INSERT + UPDATE в одной транзакции.
-- До этого Edge-функция accept-invite делала SELECT (с accepted_at IS NULL) и потом INSERT/UPDATE
-- без блокировки — два параллельных запроса с одним токеном оба проходили SELECT, оба пытались
-- INSERT в tenant_members (один валился на UNIQUE 23505, второй проходил), а accepted_at
-- мог обновиться дважды. Race нашёлся в аудите P1.2.
--
-- SECURITY DEFINER нужен потому что функция дёргается edge-функцией от service_role,
-- но логика валидации (email match, expiry) живёт здесь — Edge-функция остаётся тонким
-- транспортом. Доступ к SELECT/UPDATE на tenant_invitations и INSERT на tenant_members
-- даёт service_role, EXECUTE открыт только ему.

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
  SELECT * INTO v_inv
  FROM tenant_invitations
  WHERE token = _token
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
