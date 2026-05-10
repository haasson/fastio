# shared/

Cross-cutting инфра, не привязанная к одному модулю. UI-компоненты, data-агрегаторы, plan/gate инфраструктура, утилиты.

Правила:
- shared НЕ импортит из `modules/*` (зависимость только в одну сторону).
- См. `docs/plans/2026-05-10-modular-architecture-migration.md`.
