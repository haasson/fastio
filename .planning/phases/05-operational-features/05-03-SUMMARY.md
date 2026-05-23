---
phase: 05-operational-features
plan: 03
subsystem: planning
tags: [backlog, deferral, planning-only, ops]
dependency_graph:
  requires: []
  provides:
    - OPS-01 backlog spec at .planning/deferred/OPS-01-transactional-email-PLAN.md
  affects:
    - .planning/REQUIREMENTS.md (OPS-01 row)
    - .planning/ROADMAP.md (Phase 5 entry)
tech_stack:
  added: []
  patterns: []
key_files:
  created:
    - .planning/deferred/OPS-01-transactional-email-PLAN.md
  modified:
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
decisions:
  - "OPS-01 deferred per D-01 (05-CONTEXT.md): customer_email not collected at checkout; transactional email impossible without precursor checkout form change"
  - "Re-pickup signal: when customer_email field added to storefront checkout, OPS-01 is unblocked — pick up spec from .planning/deferred/OPS-01-transactional-email-PLAN.md"
metrics:
  duration: 5m
  completed: 2026-05-23
---

# Phase 5 Plan 03: OPS-01 Deferral Artifact Summary

**One-liner:** OPS-01 transactional email deferred to backlog with complete spec citing D-01 blocker (missing customer_email at checkout), updating REQUIREMENTS.md and ROADMAP.md with three cross-linked breadcrumbs.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create .planning/deferred/OPS-01-transactional-email-PLAN.md | 26209886 | .planning/deferred/OPS-01-transactional-email-PLAN.md |
| 2 | Update REQUIREMENTS.md and ROADMAP.md to reflect deferral | cc327325 | .planning/REQUIREMENTS.md, .planning/ROADMAP.md |

## What Was Done

### Task 1 — Backlog Spec
Created `.planning/deferred/OPS-01-transactional-email-PLAN.md` following the same structure as the sibling `SEC-04-staging-supabase-e2e-PLAN.md`. The spec includes:
- Frontmatter with `requirement: OPS-01`, `deferred_from_phase: 05-operational-features`, `deferred_date: 2026-05-23`, `decision_ref: D-01`, `blocker: customer_email field at checkout`
- All 8 required sections (Original Requirement, Why Deferred, Prerequisite Work, Implementation Outline, Acceptance Criteria, Out of Scope for OPS-01, Risk if Never Shipped, References)
- Explicit mention of `customer_email`, `/order/`, `guest_token`, `processed_webhook_events`, and `Resend` as required by the plan spec

### Task 2 — Planning Files Updated
Two targeted edits:
- **REQUIREMENTS.md** — OPS-01 line annotated with `[DEFERRED → .planning/deferred/OPS-01-transactional-email-PLAN.md, см. Phase 5 D-01]`; traceability table row changed from `Pending` to `Deferred → backlog`
- **ROADMAP.md** — Phase 5 success criterion 1 annotated with `(DEFERRED — see footnote)`; new `> **Отложено 2026-05-23:**` footnote paragraph inserted after success criteria, linking to the backlog spec and citing 05-CONTEXT.md D-01

## Deferral Summary

**Decision:** D-01 in `.planning/phases/05-operational-features/05-CONTEXT.md`
**Blocker:** `customer_email` field is not collected at checkout — no recipient address for the confirmation email
**Re-pickup signal:** When a `customer_email` field is added to the storefront checkout form (`apps/storefront/features/checkout/` or `apps/storefront/pages/checkout.vue`), OPS-01 becomes implementable. Pick up the complete spec from `.planning/deferred/OPS-01-transactional-email-PLAN.md`.

## Three Independent Breadcrumbs (anti-repudiation)

A future agent searching for `OPS-01` will find:
1. `.planning/deferred/OPS-01-transactional-email-PLAN.md` — the complete backlog spec
2. `.planning/REQUIREMENTS.md` — OPS-01 row with `[DEFERRED → ...]` marker and `Deferred → backlog` in traceability table
3. `.planning/ROADMAP.md` — Phase 5 footnote `> **Отложено 2026-05-23:**` with link to spec

## Verification

- `git diff HEAD~2 HEAD -- apps/ packages/ supabase/` is empty — zero production code touched
- Automated spec check passed: all required sections and keywords present
- Automated planning files check passed: REQUIREMENTS and ROADMAP markers verified

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this is a planning-only artifact, no UI or code stubs.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED

- `.planning/deferred/OPS-01-transactional-email-PLAN.md` — FOUND (commit 26209886)
- `.planning/REQUIREMENTS.md` OPS-01 deferral marker — FOUND (commit cc327325)
- `.planning/ROADMAP.md` Phase 5 footnote — FOUND (commit cc327325)
- No production code modified — VERIFIED
