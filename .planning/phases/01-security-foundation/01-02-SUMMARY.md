---
plan: 01-02
phase: 01-security-foundation
status: complete
completed: 2026-05-21
tasks_total: 2
tasks_complete: 2
key-files:
  created: []
  modified:
    - .github/workflows/ci.yml
---

## Summary

Added a `security` CI job to `.github/workflows/ci.yml` that builds the storefront and greps the public output bundle for the string `service_role`. Closes SEC-02: any future refactor that accidentally ships the service-role key to the client bundle will fail the workflow on the next push to main.

## Tasks

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Add security job to ci.yml | ✓ | Job needs `check`, gates on `push to main`, scans `.output/public/` only |
| 2 | Local smoke test — build + grep | ✓ | Public bundle clean; server bundle has 3 files (confirms public-only scope) |

## Key Decisions

- **Public-only scan**: `.output/server/` legitimately contains `service_role` in `@supabase/auth-js` docstrings (3 files found in smoke test). Scanning it would produce false positives that hide real leaks. Plan scoped to `.output/public/` per D-04, D-05, Pitfall 1.
- **Runs on push to main only**: PRs don't pay the storefront-build cost. The `if: github.ref == 'refs/heads/main'` gate enforces D-04.
- **Needs `check`**: job runs only after typecheck/lint/tests pass — avoids wasted build minutes on broken branches.

## Verification

- `grep -c 'security:' .github/workflows/ci.yml` → 1 ✓
- `grep -c 'refs/heads/main' .github/workflows/ci.yml` → 1 ✓
- `grep -c 'apps/storefront/.output/public/' .github/workflows/ci.yml` → 1 ✓
- `grep -c 'apps/storefront/.output/server' .github/workflows/ci.yml` → 0 (not scanned) ✓
- YAML parses valid ✓
- Local build: `pnpm build --filter storefront` exits 0 ✓
- `grep -r service_role apps/storefront/.output/public/` → no matches (exit 1) ✓
- `grep -rc service_role apps/storefront/.output/server/` → 3 files with hits ✓

## Deviations

None.

## Self-Check: PASSED
