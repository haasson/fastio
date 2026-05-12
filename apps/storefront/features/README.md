# features/ (storefront)

Feature-based модули витрины. Каждый модуль — изолированная фича со своими `components/`, `composables/`, `api/`, `utils/`, `stores/`, `types.ts`, `index.ts`, `feature.manifest.ts`, `AGENTS.md`.

Правила:
- Cross-module импорты только через `index.ts` (barrel).
- Verticals: services↔retail взаимный запрет (см. `docs/vertical-isolation.md`).
- shared не импортит из features. Зависимость в одну сторону.
- Новая фича — через `pnpm new:storefront-feature <name>`.
- Подробности: `docs/plans/2026-05-12-storefront-modular-migration.md`.

Отличие от `apps/admin/features/` — в манифесте нет `permissions` и `tenantModule` (на витрине нет RBAC и module-toggle).
