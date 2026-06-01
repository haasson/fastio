-- Migration 307: привязка столов dine-in к филиалу — обязательный FK tables.branch_id.
--
-- Корень бага (ручное тестирование 3.7): dine-in заказ резолвился с branch_id=null,
-- т.к. у столов не было связи с филиалом. Заказ уходил мимо нужной кухни/нумерации.
--
-- Продуктовый инвариант: стол создаётся в контексте филиала → у стола ВСЕГДА есть
-- филиал. Поэтому колонка делается NOT NULL, а FK — ON DELETE RESTRICT (филиал со
-- столами удалить нельзя; парно с archive-guard D-10). NULL — невалидное состояние.
--
-- Бэкфилл: каждый существующий стол привязывается к СТАРШЕМУ активному филиалу
-- своего тенанта. Условие активного филиала совпадает с рантаймом
-- (resolveDelivery: .eq('is_active', true).is('archived_at', null)). После 282
-- у каждого тенанта есть хотя бы один филиал, поэтому бэкфилл покрывает все строки;
-- если у тенанта со столами не окажется активного филиала — SET NOT NULL упадёт
-- (намеренный fail-safe: миграция не пройдёт, пока данные не приведут инвариант
-- в порядок). RLS не трогаем: политики на tables фильтруют по tenant_id.

-- 1) Колонка + FK RESTRICT (пока nullable — заполним бэкфиллом ниже).
ALTER TABLE tables
  ADD COLUMN branch_id UUID REFERENCES branches(id) ON DELETE RESTRICT;

CREATE INDEX idx_tables_branch_id ON tables(branch_id);

-- 2) Бэкфилл: стол → старший активный филиал тенанта.
UPDATE tables t
SET branch_id = (
  SELECT b.id FROM branches b
  WHERE b.tenant_id = t.tenant_id
    AND b.is_active = true
    AND b.archived_at IS NULL
  ORDER BY b.created_at ASC
  LIMIT 1
)
WHERE t.branch_id IS NULL;

-- 3) Инвариант на уровне БД: branch_id обязателен.
ALTER TABLE tables ALTER COLUMN branch_id SET NOT NULL;
