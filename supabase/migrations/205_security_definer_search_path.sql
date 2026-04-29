-- Migration 205: harden SECURITY DEFINER functions with explicit search_path.
--
-- Why: SECURITY DEFINER functions inherit the caller's search_path unless
-- explicitly overridden. A non-superuser can prepend their own schema with
-- shadow tables (e.g. their_schema.tenant_members) and execute these
-- functions, causing the SQL inside to read attacker-controlled data and
-- bypass RLS. CVE pattern; mitigated by `SET search_path = public, pg_temp`.
--
-- Already correct: 196, 200, 201, 202 (and 204).
-- Fixes here: 180.is_resource_tenant_member, 188.is_template_tenant_member,
-- 191.log_appointment_created.

ALTER FUNCTION public.is_resource_tenant_member(uuid)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.is_template_tenant_member(uuid)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.log_appointment_created()
  SET search_path = public, pg_temp;
