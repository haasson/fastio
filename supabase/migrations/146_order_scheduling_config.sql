ALTER TABLE tenants ADD COLUMN IF NOT EXISTS order_scheduling_config jsonb NOT NULL DEFAULT '{}';
