-- Migration 176: Payment methods per tenant
--
-- Tenants can now configure which payment methods are available to customers.
-- Default is cash + card (current behaviour). 'online' reserved for future
-- online acquiring integration.

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS payment_methods text[] NOT NULL DEFAULT ARRAY['cash', 'card'];
