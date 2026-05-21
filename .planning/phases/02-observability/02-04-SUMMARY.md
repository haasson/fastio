---
plan: 02-04
phase: 02-observability
status: complete
completed: 2026-05-21
key-files:
  created:
    - scripts/audit/realtime-channel-audit.sh
  modified:
    - .github/workflows/ci.yml
---

## What Was Built

REL-01 audit: a bash script that checks every file containing `.channel(` also contains `removeChannel`, enforcing Supabase realtime channel cleanup across `apps/` and `packages/`.

Wired into the `check` CI job so it blocks pull requests (not just main).

## Tasks

| Task | Status | Commit |
|------|--------|--------|
| Task 1: realtime-channel-audit.sh | ✓ | ca187a3d |
| Task 2: CI wiring in check job | ✓ | a2d994c0 |

## Verification

- `bash scripts/audit/realtime-channel-audit.sh` → `AUDIT_CLEAN: 3 file(s) checked` (exit 0)
- Sham-file test: adding a file with `.channel(` and no `removeChannel` → exit 1 ✓
- `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"` → YAML_OK ✓
- `grep -q "realtime-channel-audit" .github/workflows/ci.yml` → present ✓

## Key Decisions

**CI placement (check vs security):** The `security` job is gated on `if: github.ref == 'refs/heads/main'`. REL-01 is a code-correctness gate that should block pull requests, not just main. Placed in `check` job instead.

**Corrected D-09 formula:** The original formula in CONTEXT.md was brittle (false positives on node_modules/.cache and legitimately-cleaned files). Used per-file co-presence check instead: if a file has `.channel(` it must also have `removeChannel`. This is what D-09's intent actually requires and what returns zero violations on the current tree.

## Self-Check: PASSED
