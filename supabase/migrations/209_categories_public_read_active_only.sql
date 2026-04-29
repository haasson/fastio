-- Migration 209: tighten public-read policy on `categories` to active rows only.
--
-- Why: 186_unify_categories.sql merged the old `service_categories` table into
-- the unified `categories(kind='service')`. The dropped table had a public-read
-- policy `USING (active = true)`; the unified `categories` table only had
-- `USING (deleted_at IS NULL)`. Net effect: anon clients can read inactive
-- service categories of any tenant via direct PostgREST queries, exposing the
-- names of categories that the tenant has explicitly hidden.
--
-- Fix: require active=true for the public path. Tenant members keep full
-- access to their own (active+inactive) rows via `categories: member can
-- select all` — admin UI continues to work as before.
--
-- Storefront API endpoints (/api/menu.get.ts, /api/services-catalog.get.ts)
-- already filter `eq('active', true)`, so this RLS change is a no-op for
-- legitimate traffic; it only closes the direct-query loophole.

DROP POLICY IF EXISTS "categories: public read" ON categories;

CREATE POLICY "categories: public read"
  ON categories FOR SELECT
  USING (deleted_at IS NULL AND active = true);
