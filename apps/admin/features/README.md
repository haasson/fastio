# features/

Feature-based модули админки. Каждый модуль — изолированная фича со своими `components/`, `composables/`, `api/`, `utils/`, `stores/`, `types.ts`, `index.ts`.

> **Почему `features/` а не `modules/`:** Nuxt 3 автоматически сканирует `<srcDir>/modules/` как директорию **Nuxt-модулей** (это hardcoded convention фреймворка) и пытается каждый `.ts` подгрузить как Nuxt-модуль. Поэтому имя `features/`.

Правила:
- Cross-module импорты только через `index.ts` (barrel).
- Verticals: see `docs/vertical-isolation.md`.
- Подробности: `docs/plans/2026-05-10-modular-architecture-migration.md`.
