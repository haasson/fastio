-- Migration 178a: baseline for the `resources` table.
--
-- Why: the original migration that created `resources` was deleted from the
-- repo (it was part of a failed earlier attempt at appointments). The dev
-- DB still has the table, but a fresh `db reset` / Coolify+self-hosted
-- bootstrap would fail at 179_appointments_resources.sql, which assumes
-- `resources` already exists and runs ALTER TABLE on it.
--
-- This migration creates a minimal-but-sufficient baseline. 179+ then add
-- `type`, `updated_at`, capacity, applied_template_id, cycle_start_date,
-- branches/categories junctions, schedule tables, RLS, etc.
--
-- Idempotent on dev (CREATE TABLE IF NOT EXISTS): no-op when the table
-- already exists.

CREATE TABLE IF NOT EXISTS resources (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        text NOT NULL,
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resources_tenant ON resources(tenant_id);
