-- Migration 190: sort_order для schedule_templates + связь applied_template_id
--
-- 1) Добавляем sort_order в schedule_templates чтобы юзер мог раскладывать
--    шаблоны в нужном порядке (drag-n-drop в админке).
-- 2) Добавляем resources.applied_template_id — какой шаблон последним применён
--    к ресурсу. ON DELETE RESTRICT: БД не даст удалить шаблон, пока он
--    привязан хотя бы к одному ресурсу.

ALTER TABLE schedule_templates
  ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX idx_schedule_templates_tenant_sort
  ON schedule_templates (tenant_id, sort_order, name);

ALTER TABLE resources
  ADD COLUMN applied_template_id UUID
    REFERENCES schedule_templates(id) ON DELETE RESTRICT;

CREATE INDEX idx_resources_applied_template
  ON resources (applied_template_id)
  WHERE applied_template_id IS NOT NULL;
