-- try_advisory_xact_lock(p_key bigint) — обёртка над pg_try_advisory_xact_lock.
--
-- Зачем: edge-функция add-custom-domain делает PATCH в Coolify + UPDATE tenants.
-- Если два параллельных запроса от разных тенантов (или ретрая) пытаются добавить
-- один и тот же FQDN — между Coolify GET (текущий fqdn) и Coolify PATCH (новый список)
-- открывается окно race condition: оба прочитают одинаковый currentFqdn и оба попытаются
-- добавить домен. Advisory lock на хеш `custom-domain:<fqdn>` сериализует эти попытки.
--
-- pg_try_advisory_xact_lock — non-blocking: либо берёт лок (true) и держит его до
-- конца транзакции, либо сразу возвращает false. Транзакция тут — implicit
-- транзакция вокруг RPC-вызова из supabase-js (одна команда = одна транзакция),
-- ЭТОГО НЕДОСТАТОЧНО для удержания лока на всё время Coolify-флоу из edge-функции.
-- Поэтому используем как «дробящий barrier»: первый запрос успевает взять лок,
-- захватить «слот» во время своей RPC-транзакции, и тут же его отпускает. Но
-- параллельный конкурент в той же миллисекунде получит false. Окно гонки сужается
-- до миллисекунд между RPC-вызовом и Coolify GET. Полное решение — хранить
-- pending_domain в БД + UNIQUE constraint, но это бОльший рефакторинг (TECHDEBT).
--
-- Идемпотентно: CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION public.try_advisory_xact_lock(p_key bigint)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT pg_try_advisory_xact_lock(p_key);
$$;

REVOKE ALL ON FUNCTION public.try_advisory_xact_lock(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.try_advisory_xact_lock(bigint) TO authenticated, service_role;
