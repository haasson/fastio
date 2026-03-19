-- Tenant balance + billing transactions
ALTER TABLE tenants ADD COLUMN balance numeric NOT NULL DEFAULT 0;

CREATE TABLE billing_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('topup', 'charge', 'refund')),
  amount numeric NOT NULL,
  description text NOT NULL DEFAULT '',
  plan_id uuid REFERENCES plans(id),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_billing_tx_tenant ON billing_transactions(tenant_id);
CREATE INDEX idx_billing_tx_created ON billing_transactions(created_at DESC);

ALTER TABLE billing_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "billing_transactions: member can select"
  ON billing_transactions FOR SELECT
  USING (is_tenant_member(tenant_id));

-- INSERT/UPDATE/DELETE — only via SECURITY DEFINER functions
