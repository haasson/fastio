-- Migration 076: Allow members to delete orders (for removing empty orders after item deletion)

CREATE POLICY "orders: member can delete"
  ON orders FOR DELETE
  USING (is_tenant_member(tenant_id));
