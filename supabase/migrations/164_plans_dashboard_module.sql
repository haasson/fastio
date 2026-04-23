-- ═══════════════════════════════════════════════════════════════════════════════
-- 164: Add dashboard to plan features (available from Start)
-- ═══════════════════════════════════════════════════════════════════════════════

UPDATE plans
SET features = jsonb_set(features, '{modules,dashboard}', 'true')
WHERE key IN ('retail-start', 'retail-pro', 'services-start', 'services-pro');
