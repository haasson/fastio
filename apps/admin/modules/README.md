# modules/

Feature-based модули админки. Каждый модуль — изолированная фича со своими `components/`, `composables/`, `api/`, `utils/`, `stores/`, `types.ts`, `index.ts`.

Правила:
- Cross-module импорты только через `index.ts` (barrel).
- Verticals: see `docs/vertical-isolation.md`.
- Подробности: `docs/plans/2026-05-10-modular-architecture-migration.md`.
