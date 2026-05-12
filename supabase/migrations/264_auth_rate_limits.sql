-- Durable rate limit для критичных публичных endpoint'ов (forgot-password, и т.п.).
-- In-memory `createRateLimiter` из @fastio/shared не работает корректно на serverless,
-- где каждый warm container держит собственный Map → атакующий получает N×limit попыток.
--
-- Таблица + atomic upsert RPC, который инкрементит счётчик и возвращает true/false.

CREATE TABLE IF NOT EXISTS auth_rate_limits (
  key text PRIMARY KEY,
  count integer NOT NULL DEFAULT 0,
  reset_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS auth_rate_limits_reset_at_idx
  ON auth_rate_limits(reset_at);

ALTER TABLE auth_rate_limits ENABLE ROW LEVEL SECURITY;
-- Никаких политик — таблица доступна только через SECURITY DEFINER RPC ниже.

-- Атомарно проверяет и инкрементит счётчик. Возвращает true, если запрос разрешён.
-- Если окно истекло — обнуляет. Если лимит исчерпан — возвращает false.
CREATE OR REPLACE FUNCTION consume_rate_limit(
  _key text,
  _max integer,
  _window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_row auth_rate_limits;
BEGIN
  INSERT INTO auth_rate_limits (key, count, reset_at)
  VALUES (_key, 1, v_now + make_interval(secs => _window_seconds))
  ON CONFLICT (key) DO UPDATE
    SET count    = CASE WHEN auth_rate_limits.reset_at < v_now THEN 1 ELSE auth_rate_limits.count + 1 END,
        reset_at = CASE WHEN auth_rate_limits.reset_at < v_now THEN v_now + make_interval(secs => _window_seconds) ELSE auth_rate_limits.reset_at END
  RETURNING * INTO v_row;

  RETURN v_row.count <= _max;
END;
$$;

REVOKE ALL ON FUNCTION consume_rate_limit(text, integer, integer) FROM public;
GRANT EXECUTE ON FUNCTION consume_rate_limit(text, integer, integer) TO service_role;

-- Периодическая чистка истёкших записей (пусть админ настроит pg_cron при желании;
-- сам по себе размер таблицы остаётся маленьким, т.к. ключи переиспользуются).
CREATE OR REPLACE FUNCTION cleanup_auth_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM auth_rate_limits WHERE reset_at < now() - interval '1 hour';
$$;

REVOKE ALL ON FUNCTION cleanup_auth_rate_limits() FROM public;
GRANT EXECUTE ON FUNCTION cleanup_auth_rate_limits() TO service_role;
