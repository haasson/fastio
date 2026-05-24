---
status: partial
phase: 05-operational-features
source: [05-VERIFICATION.md]
started: 2026-05-24T10:05:00Z
updated: 2026-05-24T10:05:00Z
---

## Current Test

[awaiting human testing — already completed during Task 4 checkpoint 2026-05-23]

## Tests

### 1. /terms page renders with complete legalInfo
expected: Page renders with tenant's legalName as heading, 6 §-sections, mailto link for privacyEmail, breadcrumb "Главная / Оферта"
result: [pending]

### 2. /terms page shows SfEmptyState with incomplete legalInfo
expected: SfEmptyState with title "Документ недоступен" — no broken layout, no partial sections
result: [pending]

### 3. Footer conditional rendering and label disambiguation
expected: "Оферта" NuxtLink visible when isLegalInfoComplete=true; "Оферта (PDF)" visible when offerUrl set; both can coexist
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
