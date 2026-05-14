-- P1.3a — RLS cleanup
--
-- Изначальный план включал DROP'ы дубль-политик "members can insert" / "members can view"
-- на audit_logs (аудит P1.3 указывал их там) и DROP "Members can manage their delivery zones"
-- на delivery_zones, но при пересборке оказалось:
--
--   • На audit_logs таких политик никогда не было — миграция 153 создаёт ровно
--     "settings viewers can view" + "members can insert own" (с actor_id = auth.uid()).
--     Имена "members can insert"/"members can view" живут на order_events (025) и
--     appointment_events (191) — там есть аналогичный OR-loose-wins (INSERT без
--     actor_id-чека), но это отдельный фикс — записан в LATER.md.
--
--   • На delivery_zones legacy политика уже была удалена миграцией 035 ещё в апреле.
--
-- Остаётся единственный реальный фикс этой миграции — догнать REVOKE для
-- consume_rate_limit. Миграция 264 сделала REVOKE FROM PUBLIC, но в pg_proc.proacl
-- у anon/authenticated остался EXECUTE (default GRANT сохранился другим путём).

REVOKE EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, integer) FROM anon, authenticated;
