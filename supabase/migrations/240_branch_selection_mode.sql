ALTER TABLE tenants
  ADD COLUMN branch_selection_mode text NOT NULL DEFAULT 'unified'
  CHECK (branch_selection_mode IN ('unified', 'per_branch'));
