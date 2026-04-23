-- ═══════════════════════════════════════════════════════════════════════════════
-- 162: Add team module to start/pro plans (showcase has no team management)
-- ═══════════════════════════════════════════════════════════════════════════════

UPDATE plans SET features = features || '{"modules": {"team": true}}'::jsonb
WHERE key IN ('retail-start', 'retail-pro', 'services-start', 'services-pro');
