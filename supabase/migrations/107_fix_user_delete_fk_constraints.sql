-- Allow user deletion by fixing FK constraints on auth.users
-- All tracking/audit fields → ON DELETE SET NULL
-- NOT NULL columns that reference users → drop NOT NULL first

-- order_items: added_by, confirmed_by
ALTER TABLE order_items
  DROP CONSTRAINT IF EXISTS order_items_added_by_fkey,
  ADD CONSTRAINT order_items_added_by_fkey
    FOREIGN KEY (added_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE order_items
  DROP CONSTRAINT IF EXISTS order_items_confirmed_by_fkey,
  ADD CONSTRAINT order_items_confirmed_by_fkey
    FOREIGN KEY (confirmed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- orders: accepted_by
ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_accepted_by_fkey,
  ADD CONSTRAINT orders_accepted_by_fkey
    FOREIGN KEY (accepted_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- kitchen_queue: served_by, assigned_to
ALTER TABLE kitchen_queue
  DROP CONSTRAINT IF EXISTS kitchen_queue_served_by_fkey,
  ADD CONSTRAINT kitchen_queue_served_by_fkey
    FOREIGN KEY (served_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE kitchen_queue
  DROP CONSTRAINT IF EXISTS kitchen_queue_assigned_to_fkey,
  ADD CONSTRAINT kitchen_queue_assigned_to_fkey
    FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE SET NULL;

-- tenant_invitations: invited_by (NOT NULL → nullable)
ALTER TABLE tenant_invitations ALTER COLUMN invited_by DROP NOT NULL;
ALTER TABLE tenant_invitations
  DROP CONSTRAINT IF EXISTS tenant_invitations_invited_by_fkey,
  ADD CONSTRAINT tenant_invitations_invited_by_fkey
    FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- order_notes: author_id (NOT NULL → nullable)
ALTER TABLE order_notes ALTER COLUMN author_id DROP NOT NULL;
ALTER TABLE order_notes
  DROP CONSTRAINT IF EXISTS order_notes_author_id_fkey,
  ADD CONSTRAINT order_notes_author_id_fkey
    FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- reservations: confirmed_by
ALTER TABLE reservations
  DROP CONSTRAINT IF EXISTS reservations_confirmed_by_fkey,
  ADD CONSTRAINT reservations_confirmed_by_fkey
    FOREIGN KEY (confirmed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- billing_transactions: created_by
ALTER TABLE billing_transactions
  DROP CONSTRAINT IF EXISTS billing_transactions_created_by_fkey,
  ADD CONSTRAINT billing_transactions_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- tenants: owner_id (NOT NULL → nullable)
ALTER TABLE tenants ALTER COLUMN owner_id DROP NOT NULL;
ALTER TABLE tenants
  DROP CONSTRAINT IF EXISTS tenants_owner_id_fkey,
  ADD CONSTRAINT tenants_owner_id_fkey
    FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;
