-- Migration 137: Remove auto-complete trigger from kitchen queue
--
-- Previously: when all dishes marked as 'done', the order automatically
-- transitioned to the completedStatusMap status, skipping the assembly step.
--
-- Now: the assembly page handles the status transition when the assembler
-- clicks "Собрано". The trigger is no longer needed.

DROP TRIGGER IF EXISTS trg_kitchen_queue_check_complete ON kitchen_queue;
DROP FUNCTION IF EXISTS kitchen_queue_check_order_complete();
