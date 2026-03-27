ALTER TABLE modifier_groups ADD COLUMN affects_weight boolean NOT NULL DEFAULT false;
ALTER TABLE modifier_groups ADD COLUMN weight_mode text NOT NULL DEFAULT 'per_dish';
ALTER TABLE modifier_options ADD COLUMN weight_delta int DEFAULT NULL;
