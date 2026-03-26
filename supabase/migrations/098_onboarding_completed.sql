-- Add onboarding_completed flag to tenants
ALTER TABLE tenants
  ADD COLUMN onboarding_completed boolean NOT NULL DEFAULT false;

-- Existing tenants are already set up — mark them as completed
UPDATE tenants SET onboarding_completed = true;
