ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS onboarding_state jsonb NOT NULL DEFAULT '{
    "current_step_id": null,
    "completed_at": null,
    "dismissed_at": null
  }'::jsonb;

COMMENT ON COLUMN tenants.onboarding_state IS
  'Onboarding checklist widget state. Shape: { current_step_id: string|null, completed_at: timestamp|null, dismissed_at: timestamp|null }. Линейный флоу: всё до current_step_id — пройдено, всё после — locked.';
