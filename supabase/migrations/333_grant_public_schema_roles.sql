-- Новые версии Supabase CLI (>= 2.76) больше не применяют дефолтные гранты
-- service_role/authenticated/anon на public-схему автоматически при суpabase start.
-- Явно задаём необходимый минимум: service_role обходит RLS через role-claim,
-- но ему всё равно нужен PostgreSQL-level GRANT на таблицы/sequences/functions.
-- Идемпотентно: повторный GRANT не ломает уже выданные права.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT ALL ON ALL TABLES     IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES  IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES   IN SCHEMA public TO anon, authenticated, service_role;

-- DEFAULT PRIVILEGES: новые таблицы/sequences/функции, созданные суперюзером
-- postgres, тоже получают эти гранты автоматически — следующие миграции
-- не придётся сопровождать ручными GRANT-ами.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES     TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES  TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON ROUTINES   TO anon, authenticated, service_role;
