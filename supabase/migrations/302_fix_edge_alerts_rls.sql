-- ═══════════════════════════════════════════════════════════════════════════════
-- 302: Закрываем RLS на edge_alerts_state (последняя public-таблица без RLS).
--
-- Контекст: live-аудит БД (Phase 1, SEC-01) показал, что все 46 таблиц из
--   TENANT_TABLES уже имеют rowsecurity=true. Единственная public-таблица
--   с rowsecurity=false на момент аудита — edge_alerts_state.
--   Это singleton-таблица мониторинга: хранит агрегированное состояние
--   ошибок edge-функций. С ней работает только pg_cron через функцию
--   monitor_edge_errors, которая объявлена SECURITY DEFINER и выполняется
--   от роли postgres — то есть RLS для неё не применяется в любом случае.
--   Прямых обращений из app-кода (storefront, admin) нет.
--
-- Стратегия: включаем ENABLE ROW LEVEL SECURITY без создания политик.
--   Отсутствие политик = default-deny для ролей anon и authenticated:
--   ни один клиентский запрос не сможет прочитать или изменить строки.
--   Роль postgres (и любые SECURITY DEFINER-функции, работающие от неё)
--   bypass RLS по умолчанию — pg_cron и monitor_edge_errors продолжают
--   работать без изменений.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE edge_alerts_state ENABLE ROW LEVEL SECURITY;

-- Политики не создаются намеренно — default-deny для anon и authenticated.
-- pg_cron / SECURITY DEFINER функции bypass RLS и продолжают работать штатно.
