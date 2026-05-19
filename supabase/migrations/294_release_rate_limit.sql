-- Откат счётчика rate-limit (PREPROD-116).
--
-- consume_rate_limit инкрементит счётчик ДО фактического выполнения операции
-- (send mail / send sms и т.п.). Если операция падает transient-ошибкой (SMTP
-- down, network), то «съеденный» слот несправедливо блокирует пользователя
-- на window — он не сможет ретраить пока окно не истечёт.
--
-- release_rate_limit декрементирует счётчик в каноническом edge-case'е
-- «consume прошёл → даунстрим упал → надо откатить». Декремент идёмпотентен:
-- если ключа нет или счётчик уже 0 — no-op.
--
-- ВАЖНО: это не «отмена консьюма». Если между consume и release пришёл
-- параллельный запрос — release уменьшит счётчик после его инкремента, и
-- параллельный запрос «съест» слот на одну попытку дольше. Это допустимо:
-- параллельный запрос всё равно прошёл бы при честном лимите, а release
-- защищает от deadlock'а юзера при системном даунтайме.

CREATE OR REPLACE FUNCTION release_rate_limit(
  _key text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE auth_rate_limits
     SET count = count - 1
   WHERE key = _key
     AND count > 0
     AND reset_at > now();
$$;

REVOKE ALL ON FUNCTION release_rate_limit(text) FROM public;
GRANT EXECUTE ON FUNCTION release_rate_limit(text) TO service_role;
