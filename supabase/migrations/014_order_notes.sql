-- order_notes: внутренние заметки операторов к заказу
CREATE TABLE order_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id),
  author_name text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_notes_order ON order_notes(order_id);
CREATE INDEX idx_order_notes_tenant ON order_notes(tenant_id);

ALTER TABLE order_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members can select order notes" ON order_notes
  FOR SELECT USING (is_tenant_member(tenant_id));

CREATE POLICY "members can insert order notes" ON order_notes
  FOR INSERT WITH CHECK (is_tenant_member(tenant_id) AND author_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE order_notes;
