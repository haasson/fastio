-- =====================================================================================
-- Migration 229: дропаем старые версии RPC без p_resource_assigned_by
-- =====================================================================================
--
-- В 228 мы переопределили четыре функции с новым параметром. Но CREATE OR REPLACE
-- НЕ удаляет функцию с другой сигнатурой — он создаёт новую и оставляет старую.
-- В итоге в БД сейчас по две версии add_service_to_visit / create_appointment /
-- update_appointment / move_appointment, и PostgREST матчит по аргументам запроса.
-- Если фронт зовёт без p_resource_assigned_by — попадает в старую версию,
-- которая просто ничего не пишет в новую колонку (resource_assigned_by = NULL).
-- В админке мастер выглядит как «без признака», бейдж «автоподбор» не появляется.
-- Дроп старых разрешает неоднозначность и заставляет всех использовать новую.
-- =====================================================================================

DROP FUNCTION IF EXISTS public.add_service_to_visit(
  uuid, uuid, uuid, timestamptz, timestamptz, text, numeric, appointment_status
);

DROP FUNCTION IF EXISTS public.create_appointment(
  uuid, uuid, uuid, uuid, uuid, uuid, text, text,
  timestamptz, timestamptz, appointment_status, text, boolean, boolean, text, numeric,
  text, text
);

DROP FUNCTION IF EXISTS public.update_appointment(
  uuid, uuid, timestamptz, timestamptz, uuid, text, numeric
);

DROP FUNCTION IF EXISTS public.move_appointment(
  uuid, timestamptz, timestamptz, uuid, uuid
);
