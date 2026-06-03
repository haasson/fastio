-- Тогглы режима стола (QR): заказ со стола и вызов официанта — каждый
-- опционален per-tenant. DEFAULT true сохраняет текущее поведение (оба включены)
-- для всех существующих тенантов. Витрина-стол гейтит UI и сервер по этим флагам:
-- showcase-only (оба false), call-only, ordering-only, both.
ALTER TABLE table_settings ADD COLUMN dine_in_ordering_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE table_settings ADD COLUMN waiter_call_enabled boolean NOT NULL DEFAULT true;
