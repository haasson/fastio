-- Тенанты сферы услуг работают только в режиме per_branch:
-- юзер выбирает филиал в шапке (BranchPickerModal в storefront), и весь каталог
-- услуг/мастеров/слотов считается под этот филиал. Unified-режим оставляем для
-- ритейла (общее меню по филиалам).

UPDATE tenants
SET branch_selection_mode = 'per_branch'
WHERE (modules->>'services')::boolean = true
  AND branch_selection_mode <> 'per_branch';

ALTER TABLE tenants
  ADD CONSTRAINT services_requires_per_branch
  CHECK (
    (modules->>'services') IS DISTINCT FROM 'true'
    OR branch_selection_mode = 'per_branch'
  );
