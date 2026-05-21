---
phase: 02-observability
reviewed: 2026-05-21T12:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - apps/storefront/nuxt.config.ts
  - apps/admin/nuxt.config.ts
  - apps/storefront/server/middleware/tenant.ts
  - scripts/audit/realtime-channel-audit.sh
  - .github/workflows/ci.yml
findings:
  critical: 1
  warning: 3
  info: 1
  total: 5
status: issues_found
---

# Phase 02: Observability — Code Review Report

**Reviewed:** 2026-05-21T12:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Phase 02 wires Sentry/GlitchTip into the storefront and admin Nuxt apps, tags server errors with tenant slug in the storefront middleware, adds a realtime-channel cleanup audit script, and gates that audit in CI. The implementation is largely sound. One critical issue was found in the CI pipeline (security check is blind to PRs), three warnings around error handling gaps and a tracing config trap, and one info item on a redundant exit-code pattern.

---

## Critical Issues

### CR-01: `service_role` bundle check runs only on `main` — PRs merge undetected

**File:** `.github/workflows/ci.yml:91`
**Issue:** The `security` job carries `if: github.ref == 'refs/heads/main'`, so the `check service_role not in public bundle` scan never runs on pull requests. A PR that accidentally moves Supabase service-role key material into the client-facing bundle would pass all PR checks, get merged, and only be caught post-merge on main — at which point the secret is already in git history and potentially in a deployed artifact. The whole point of the SEC-02 / D-04 gate is to block bad code before it lands.

**Fix:** Remove the `if:` condition from the `security` job, or extract the service_role scan into a separate job that runs on every PR. If the full storefront build is considered too expensive for every PR, gate only that job on `main` and add a lighter grep-based check (against source files, not the bundle) to the `check` job:

```yaml
  security:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    needs: check
    # Remove the main-only guard so PRs are also protected:
    # if: github.ref == 'refs/heads/main'   ← DELETE THIS LINE
    steps:
      ...
```

Or, to keep the full build on `main` only, add a fast source-level guard to the `check` job:

```yaml
      - name: check service_role not in source (PR guard)
        if: github.event_name == 'pull_request'
        run: |
          if grep -r --include="*.ts" --include="*.vue" "service_role" apps/storefront/features/ apps/storefront/shared/ apps/storefront/pages/ 2>/dev/null; then
            echo "::error::SECURITY: service_role literal found in storefront source"
            exit 1
          fi
```

---

## Warnings

### WR-01: `computeDeliveryAvailable` silently swallows DB errors — delivery silently defaults to unavailable

**File:** `apps/storefront/server/middleware/tenant.ts:180-187`
**Issue:** The `delivery_zones` count query at line 180 destructures only `{ count }`, discarding the `error` field. If the query fails (DB hiccup, RLS issue), `count` is `undefined`, and `(count ?? 0) > 0` evaluates to `false` — so `tenant.deliveryAvailable` is silently set to `false`. This cached tenant will then serve "delivery unavailable" to all customers for up to 60 seconds, and neither Sentry nor logs will know why. The error is unreported.

```typescript
// current (line 180):
const { count } = await supabase
  .from('delivery_zones')
  ...

// fix: surface the error
const { count, error: zoneError } = await supabase
  .from('delivery_zones')
  .select('id, branches!inner(id)', { count: 'exact', head: true })
  .eq('tenant_id', tenant.id)
  .eq('is_active', true)
  .eq('branches.is_active', true)
  .is('branches.archived_at', null)
if (zoneError) {
  reportError(zoneError)
  // Fail-open: keep deliveryAvailable undefined/false rather than caching stale false
  return
}
tenant.deliveryAvailable = (count ?? 0) > 0
```

### WR-02: `tracesSampleRate` of `0` cannot be set via env var — tracing cannot be disabled without a code change

**File:** `apps/storefront/sentry.client.config.ts:12`, `apps/storefront/sentry.server.config.ts:9`, `apps/admin/sentry.client.config.ts:13`, `apps/admin/sentry.server.config.ts:10`

**Issue:** All four Sentry config files share the same pattern:

```typescript
tracesSampleRate: Number.isFinite(envRate) && envRate > 0 ? envRate : 0.01
```

`Number("0")` is `0`, which is finite but fails the `> 0` guard, so `SENTRY_TRACES_SAMPLE_RATE=0` falls back silently to `0.01` instead of disabling tracing. If an operator needs to turn off tracing under high load (quota exhaustion, noisy data, debugging) they cannot do so by setting the env var to `0` — they must redeploy with a code change. This is a correctness trap disguised as a safety default.

**Fix:** Allow `0` explicitly:

```typescript
const envRate = Number(process.env.SENTRY_TRACES_SAMPLE_RATE)
const tracesSampleRate = Number.isFinite(envRate) && envRate >= 0 ? envRate : 0.01
//                                                          ^^ was: > 0
Sentry.init({ dsn, tracesSampleRate })
```

This change must be applied in all four files.

### WR-03: Audit script uses relative paths — silently produces wrong results if run from wrong CWD

**File:** `scripts/audit/realtime-channel-audit.sh:28`
**Issue:** The `grep -rl "\.channel(" apps/ packages/` invocation uses paths relative to the current working directory. If the script is run from any directory other than the repo root (e.g., `bash scripts/audit/realtime-channel-audit.sh` from inside `scripts/audit/`), grep will fail to find either `apps/` or `packages/`, emit nothing (zero files), and the script will print `AUDIT_CLEAN: 0 file(s) checked` and exit 0 — a false pass. The CI step runs from repo root so it works there, but local developer invocations and pre-commit hooks running from non-root directories are vulnerable.

**Fix:** Anchor to the script's own directory:

```bash
#!/usr/bin/env bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

...

grep -rl "\.channel(" "$REPO_ROOT/apps/" "$REPO_ROOT/packages/" \
  ...
```

---

## Info

### IN-01: CI audit step double-prints the error message on failure

**File:** `.github/workflows/ci.yml:57-59`
**Issue:** When `realtime-channel-audit.sh` exits with code 1, the script already emits `::error file=...::VIOLATION:` annotations and a summary line. The wrapping `if !` block then emits a second `::error::REL-01:` annotation. GitHub Actions will display two separate error annotations for the same failure, creating noise in PR checks UI.

**Fix:** Either let the script speak for itself:

```yaml
      - name: realtime channel cleanup audit (REL-01)
        run: bash scripts/audit/realtime-channel-audit.sh
```

Or keep the wrapper but suppress duplicate output:

```yaml
        run: |
          bash scripts/audit/realtime-channel-audit.sh || {
            echo "::error::REL-01: fix the violations listed above."
            exit 1
          }
```

---

_Reviewed: 2026-05-21T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
