-- Prevent soft-deleting a category that still has active (non-deleted) dishes
CREATE OR REPLACE FUNCTION prevent_category_soft_delete_with_dishes()
RETURNS trigger AS $$
BEGIN
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM dishes
      WHERE category_id = NEW.id AND deleted_at IS NULL
      LIMIT 1
    ) THEN
      RAISE EXCEPTION 'Cannot delete category that still contains dishes'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_category_soft_delete_with_dishes
  BEFORE UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION prevent_category_soft_delete_with_dishes();
