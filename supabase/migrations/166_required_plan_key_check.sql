-- ═══════════════════════════════════════════════════════════════════════════════
-- 166: Constrain module_configs.required_plan_key to valid tiers
-- required_plan_key хранит уровень тарифа (showcase/start/pro), а не ключ плана.
-- FK удалён в 160; добавляем CHECK чтобы схема была самодокументирующей
-- и защищена от случайной записи вида 'retail-start'.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE module_configs
  ADD CONSTRAINT module_configs_required_plan_key_check
  CHECK (required_plan_key IN ('showcase', 'start', 'pro'));
