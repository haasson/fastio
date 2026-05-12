# shared/ (storefront)

Cross-cutting инфра витрины: UI-компоненты (`shared/ui/`), общие composables/utils/stores. Не привязана к одной фиче.

Правила:
- shared НЕ импортит из `features/*` (зависимость только в одну сторону).
- shared НЕ должен знать о вертикалях (services↔retail).
- См. `docs/plans/2026-05-12-storefront-modular-migration.md`.
