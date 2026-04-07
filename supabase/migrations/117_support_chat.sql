-- Support chat: tickets + messages

-- ============================================================
-- Tables
-- ============================================================

CREATE TABLE support_tickets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subject     text NOT NULL,
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'waiting_for_reply', 'resolved')),
  created_by  uuid NOT NULL,
  tenant_last_seen_at  timestamptz DEFAULT now(),
  support_last_seen_at timestamptz,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE TABLE support_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_type text NOT NULL CHECK (sender_type IN ('tenant', 'support')),
  sender_id   uuid NOT NULL,
  body        text NOT NULL,
  image_urls  text[],
  created_at  timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_support_tickets_tenant_id ON support_tickets(tenant_id);
CREATE INDEX idx_support_tickets_status    ON support_tickets(status);
CREATE INDEX idx_support_messages_ticket_id ON support_messages(ticket_id);

-- ============================================================
-- Trigger: auto-update updated_at on ticket
-- ============================================================

CREATE OR REPLACE FUNCTION update_support_ticket_timestamp()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_support_ticket_updated
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION update_support_ticket_timestamp();

-- ============================================================
-- Trigger: auto-update ticket on new message + status transitions
-- ============================================================

CREATE OR REPLACE FUNCTION on_support_message_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE support_tickets
  SET updated_at = now(),
      status = CASE
        WHEN NEW.sender_type = 'support' THEN 'waiting_for_reply'
        WHEN NEW.sender_type = 'tenant' AND status = 'resolved' THEN 'open'
        WHEN NEW.sender_type = 'tenant' THEN 'open'
        ELSE status
      END
  WHERE id = NEW.ticket_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_support_message_insert
  AFTER INSERT ON support_messages
  FOR EACH ROW EXECUTE FUNCTION on_support_message_insert();

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

-- Tickets: tenant member can read
CREATE POLICY "support_tickets: member can select"
  ON support_tickets FOR SELECT
  USING (is_tenant_member(tenant_id));

-- Tickets: tenant member can create
CREATE POLICY "support_tickets: member can insert"
  ON support_tickets FOR INSERT
  WITH CHECK (is_tenant_member(tenant_id));

-- Tickets: tenant member can update (e.g. last_seen_at)
CREATE POLICY "support_tickets: member can update"
  ON support_tickets FOR UPDATE
  USING (is_tenant_member(tenant_id));

-- Messages: tenant member can read via ticket
CREATE POLICY "support_messages: member can select"
  ON support_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM support_tickets t
      WHERE t.id = support_messages.ticket_id
        AND is_tenant_member(t.tenant_id)
    )
  );

-- Messages: tenant member can insert via ticket
CREATE POLICY "support_messages: member can insert"
  ON support_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM support_tickets t
      WHERE t.id = support_messages.ticket_id
        AND is_tenant_member(t.tenant_id)
    )
  );

-- ============================================================
-- Realtime
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE support_tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE support_messages;

-- ============================================================
-- Storage bucket for attachments
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('support-attachments', 'support-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Member can upload to their tenant's folder
CREATE POLICY "support-attachments: member can upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'support-attachments' AND
    split_part(name, '/', 1) IS NOT NULL AND
    is_tenant_member(split_part(name, '/', 1)::uuid)
  );

-- Member can read their tenant's attachments
CREATE POLICY "support-attachments: member can read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'support-attachments' AND
    is_tenant_member(split_part(name, '/', 1)::uuid)
  );

-- ============================================================
-- RPC: unread support count for tenant
-- ============================================================

CREATE OR REPLACE FUNCTION get_tenant_unread_support_count(p_tenant_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT coalesce(sum(cnt), 0)::integer
  FROM (
    SELECT count(*) AS cnt
    FROM support_tickets t
    JOIN support_messages m ON m.ticket_id = t.id
    WHERE t.tenant_id = p_tenant_id
      AND t.status IN ('open', 'waiting_for_reply')
      AND m.sender_type = 'support'
      AND m.created_at > coalesce(t.tenant_last_seen_at, '1970-01-01'::timestamptz)
  ) sub
$$;
