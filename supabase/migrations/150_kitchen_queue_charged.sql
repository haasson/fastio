-- Migration 150: Add charged flag for cancelled kitchen items
--
-- When a kitchen item is cancelled, `charged` indicates whether
-- the customer was still billed for it:
--   false (default) = customer compensated, restaurant takes the loss
--   true = customer pays despite cancellation (e.g. had to leave)

ALTER TABLE kitchen_queue
  ADD COLUMN charged boolean NOT NULL DEFAULT false;
