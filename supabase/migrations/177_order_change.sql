-- Migration 177: Cash change request on orders
--
-- Customers paying cash can optionally request change.
-- needs_change: did the customer request change?
-- change_from: the bill denomination they'll pay with (must be > total)

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS needs_change boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS change_from  numeric        DEFAULT NULL;
