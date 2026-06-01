---
phase: 7
slug: dine-in-tables-branch-id
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-01
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x (unit, storefront server + admin), Deno test (edge/SQL смоук опц.) |
| **Config file** | `apps/storefront/vitest.config.ts`, `apps/admin/vitest.config.ts` |
| **Quick run command** | `pnpm vitest run <path>` |
| **Full suite command** | `pnpm test:run` |
| **Estimated runtime** | ~30–60 секунд |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run <path к затронутому тесту>`
- **After every plan wave:** Run `pnpm test:run`
- **Before `/gsd:verify-work`:** Full suite зелёный + ручная проверка branch-маршрутизации dine-in
- **Max feedback latency:** 60 секунд

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-* | 01 | 1 | TBD (migration tables.branch_id + backfill) | — | RLS tenant-isolation сохранена; FK ON DELETE SET NULL | manual/SQL | `docker exec <db> psql -f` + SELECT проверка | ❌ W0 | ⬜ pending |
| 07-02-* | 02 | 2 | TBD (order-delivery dine_in → tableRecord.branchId) | T-07-01 | dine_in заказ не уходит с branch_id=null на мультибранче | unit | `pnpm vitest run apps/storefront/server/services` | ❌ W0 | ⬜ pending |
| 07-03-1 | 03 | 2 (W0) | FIX-TABLE-BRANCH-ADMIN (api list/add + mapper + branch-filter test) | T-07-A1 | branch-фильтр не протекает: branchId undefined/null → без фильтра; branchId='X' → `.eq('branch_id','X')` | unit (tdd) | `pnpm vitest run apps/admin/features/tables/__tests__/tables.test.ts` | ✅ covered | ⬜ pending |
| 07-03-2 | 03 | 2 | FIX-TABLE-BRANCH-ADMIN (TablesContext type + TablesBranchSummary + manifest) | — | provide-контракт типобезопасен (typecheck-gate) | typecheck/grep | `pnpm --filter @fastio/admin typecheck` | n/a | ⬜ pending |
| 07-03-3 | 03 | 2 | FIX-TABLE-BRANCH-ADMIN (tables.vue branch-реактивность + provide) | T-07-A3 | realtime-guard от чужого филиала; effectiveBranchId computed | typecheck/grep | `pnpm --filter @fastio/admin typecheck` | n/a | ⬜ pending |
| 07-03-4 | 03 | 2 | FIX-TABLE-BRANCH-ADMIN (list.vue/layout.vue саммари + createTable branch_id) | T-07-A2 | createTable branch_id из branchStore; саммари-guard | typecheck/grep | `pnpm --filter @fastio/admin typecheck` | n/a | ⬜ pending |
| 07-04-* | 04 | 3 | TBD (archive guard hasTables) | — | архивация филиала со столами блокируется | unit | `pnpm vitest run apps/admin/features/branches` | ❌ W0 | ⬜ pending |

*Точная разбивка task ID и requirement — за планировщиком/Nyquist-аудитором. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Тест для `resolveDelivery` dine_in branch-routing (storefront server) — ключевой P0-кейс
- [x] Тест branch-фильтра списка столов (admin tables) — undefined/null при ≤1 филиале/«Все» → без фильтра, конкретный branchId → `.eq('branch_id', X)` — покрыт `apps/admin/features/tables/__tests__/tables.test.ts` (07-03 Task 1, type=tdd)
- [ ] Тест archive guard `hasTables`

*Существующая инфра (Vitest) покрывает; новые тест-файлы добавляются в Wave 0 соответствующих планов.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| dine-in заказ со стола Парка → виден в кухонной очереди Парка | P0 | E2E через витрину `/table/<id>` + realtime кухня | На проде T1 (2 филиала): создать столы в Центре и Парке, оформить заказ со стола Парка, проверить kitchen_queue branch=Парк (см. TESTING_PLAN 3.7) |
| Саммари «Все филиалы» → клик переключает глобальный селектор | D-06 | UI-интеракция | Мультибранч тенант, селектор «Все», клик по филиалу → попадаешь в его столы |
| Миграция backfill на проде | D-08 | DB-операция на проде | single-branch тенант → все столы к филиалу; мультибранч → null + алерт |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
