-- Migration 208: revoke overzealous appointments.manage backfill from
-- custom (non-default) roles.
--
-- Why: 203 copied appointments.manage := reservations.manage for every
-- existing role. That handed appointments-level write access to any custom
-- role that managed table reservations — most notably tenant-created
-- "Хостес" / "Host" roles, which only need to manage reservations and
-- tables, not appointments. The intent of split keys (see useGate.ts:225-226)
-- was specifically to avoid this leak.
--
-- Default roles (Администратор / Менеджер / Сотрудник, is_default=true,
-- created by 112/203 trigger) already have correct values and are not
-- touched. View access stays as-is — read-only is harmless.
--
-- After this: tenants explicitly grant appointments.manage to whoever they
-- choose; no automatic leak from the reservations side.

UPDATE tenant_roles
   SET permissions = jsonb_set(permissions, '{appointments.manage}', 'false'::jsonb, false)
 WHERE is_default = false
   AND (permissions->>'appointments.manage')::boolean = true;
