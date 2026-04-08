-- Сохраняем цену опции даже когда она временно отключена на блюде
ALTER TABLE dish_modifier_options ADD COLUMN active boolean NOT NULL DEFAULT true;
