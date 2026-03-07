-- Soft delete for branches: archive instead of physical delete
ALTER TABLE branches ADD COLUMN archived_at timestamptz DEFAULT NULL;

CREATE INDEX idx_branches_archived_at ON branches(archived_at) WHERE archived_at IS NULL;
