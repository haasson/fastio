---
focus: architecture
date: 2026-05-10
---
# Architecture Research

## Tenant Provisioning on Registration

### What Happens at Registration

Registration in a multi-tenant SaaS is a **compound transaction**: you create an auth user AND a tenant record atomically. If any step fails, rollback everything.

**Recommended flow:**

1. **Supabase Auth signup** → `auth.users` row created, `user_id` known
2. **Supabase DB trigger OR Edge Function** creates the `tenants` row with `owner_id = user_id`
3. **Seed initial data** (in same transaction or Edge Function call)
4. **Create `tenant_members` row** linking owner to tenant with `role = 'owner'`
5. **Assign default plan** → insert into `tenant_subscriptions` (or update `subscription` jsonb in `tenants`)
6. **Return** tenant slug → redirect to admin `/onboarding`

### Where to Put Provisioning Logic

**Option A: DB trigger on `tenants` INSERT** — fast, atomic, no extra roundtrip. Good for minimal seed (default branch, default role). Bad: hard to test, hard to debug, can't call external services.

**Option B: Supabase Edge Function `POST /provision`** — called after signup, runs seed steps sequentially. Good: testable, can send welcome email, call Telegram, etc. Bad: one more HTTP call, must handle partial failure.

**Recommended for FastIO:** Edge Function `provision-tenant`, called from storefront's `server/api/auth/register.post.ts`. The function:
- Creates `tenants` row (with `service_role` key bypassing RLS)
- Inserts owner into `tenant_members`
- Inserts default `branch` ("Основной филиал")
- Assigns free plan in `subscription` jsonb (or `tenant_plan` table)
- Optionally seeds 1 example category + 1 dish for retail (improves "first run" UX)

### Seed Content Strategy

Two approaches:
- **Minimal seed** (recommended): only create structural records (branch, owner member). No content. Show empty state with onboarding CTA.
- **Demo seed**: create a template category + 2–3 dishes from a `seed_templates` table keyed by `business_type`. Reduces "blank page" anxiety but adds complexity.

For FastIO v1: **minimal seed** + guided onboarding wizard. Demo content creates support burden ("how do I delete the sample data?").

### Idempotency

Provisioning must be idempotent — if called twice (network retry), don't create duplicate tenants. Use `INSERT ... ON CONFLICT DO NOTHING` keyed on `owner_id` for tenant creation. Return the existing tenant if already provisioned.

---

## Plan Limits Architecture

### Where to Store Limits

**Option A: Hardcoded in application code** — `const LIMITS = { free: { dishes: 20 }, pro: { dishes: 500 } }`. Zero DB calls. Bad: changing limits requires a deploy.

**Option B: Plans table with `features` jsonb** — already exists in FastIO (`PlanFeatures` type, `plans` table). Each plan row stores its delta of features. `ResolvedFeatures` accumulates all tiers ≤ current. This is the right pattern.

**Option C: Separate `plan_limits` table** — normalized, easier to query with SQL. Overkill for < 10 plans.

**FastIO already has Option B** — extend `PlanFeatures` with limit fields:
```ts
limits?: {
  dishes?: number        // 0 = unlimited
  categories?: number
  members?: number
  branches?: number
  monthlyOrders?: number // soft limit for billing
}
```

### Where to Enforce Limits

**Layer 1 — DB (hard enforcement):** PostgreSQL `BEFORE INSERT` trigger checks count against plan limit. Returns `P0001` error if exceeded. This is the only truly reliable layer — client code can be bypassed.

```sql
CREATE OR REPLACE FUNCTION check_dish_limit() RETURNS trigger AS $$
DECLARE
  current_count int;
  max_dishes int;
BEGIN
  SELECT COUNT(*) INTO current_count FROM dishes WHERE tenant_id = NEW.tenant_id;
  SELECT (features->'limits'->>'dishes')::int INTO max_dishes
    FROM plans p JOIN tenant_subscriptions ts ON ts.plan_id = p.id
    WHERE ts.tenant_id = NEW.tenant_id;
  IF max_dishes > 0 AND current_count >= max_dishes THEN
    RAISE EXCEPTION 'plan_limit_exceeded' USING HINT = 'dishes';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Layer 2 — RPC/API (soft enforcement):** Before creating a resource, call a helper RPC `check_tenant_limit(tenant_id, resource)` that returns `{ allowed: bool, current: int, max: int }`. Use this in admin API routes to return a friendly 402 error before hitting the DB trigger.

**Layer 3 — Frontend (UX only):** Disable "Add dish" button when `current >= max`. Use `useGate` (already exists in FastIO) extended with limit data. This is purely UX — never trust frontend enforcement alone.

### Caching Strategy

Plan limits change rarely (only on plan upgrade). Cache resolved features in:
- `tenantStore` (already exists) — loaded once on init, refreshed on plan change
- Add `resolvedLimits` alongside `resolvedFeatures` in tenant store
- Cache current resource counts in store too, increment/decrement optimistically on CRUD

No Redis needed at v1 scale. Supabase RLS + triggers are the source of truth.

### Soft vs Hard Limits

- **Hard limits** (enforced at DB): dish count, category count, branch count, member count
- **Soft limits** (warning, not blocked): monthly order count (for billing signals), storage MB
- **Feature gates** (binary on/off, already in `PlanModuleFeatures`): modules like `delivery`, `reservations`, `services`

---

## Supabase Cloud → Self-hosted Migration

### Prerequisites

- Self-hosted Supabase running (Docker Compose or Kubernetes)
- Same Postgres major version as Cloud (currently 15)
- All Edge Functions deployable to self-hosted (Deno runtime)

### Step-by-Step (Zero-Downtime)

**Phase 1: Prepare self-hosted**
1. Stand up self-hosted Supabase with same Postgres version
2. Apply all migrations (`001` → `261`) to fresh self-hosted DB
3. Configure same auth providers (email, Telegram OAuth)
4. Deploy all Edge Functions
5. Configure storage buckets (same names as Cloud)

**Phase 2: Dual-write period (optional, for zero downtime)**
- Enable Postgres logical replication from Cloud → self-hosted
- Cloud DB becomes primary, self-hosted becomes replica
- Requires Supabase Cloud "Read Replicas" feature or manual `pg_logical` setup
- For FastIO v1 scale: scheduled maintenance window is simpler and safer

**Phase 3: Data migration (maintenance window, ~30 min)**
1. Put app in maintenance mode (Nuxt 500 page or Cloudflare maintenance redirect)
2. `pg_dump` from Cloud: `pg_dump --no-owner --no-acl -Fc -d $CLOUD_DB_URL > fastio.dump`
3. Restore to self-hosted: `pg_restore --no-owner --no-acl -d $SELF_HOSTED_DB_URL fastio.dump`
4. Migrate storage files: `supabase storage cp` or rclone between S3 buckets
5. Update `.env` in all apps to point to self-hosted Supabase URL
6. Deploy new app version
7. Smoke test, then disable maintenance mode

**Phase 4: Cutover**
- Update DNS if using custom Supabase domain
- Revoke Cloud API keys
- Keep Cloud DB in read-only mode for 48h as fallback

### Gotchas

- **Auth JWT secret** must be identical between Cloud and self-hosted — existing user sessions will break if it changes. Copy `JWT_SECRET` from Cloud dashboard.
- **Storage URLs** in DB data (dish photos stored as full URLs) will need a migration or a proxy if the bucket domain changes.
- **Realtime** channels need reconnection — clients auto-reconnect but there's a brief gap.
- **Edge Function env vars** must be re-configured on self-hosted (no automatic import from Cloud).
- **`auth.users` table** is not exported by default `pg_dump` — needs `--schema=auth` explicitly, or use Supabase's own export tool.
- **RLS policies** reference `auth.uid()` — these work identically on self-hosted as long as JWT secret matches.
- **Cron jobs** (`pg_cron` extension, e.g. `260_appointment_reminders_cron.sql`) must be re-enabled on self-hosted — `pg_cron` may not be installed by default in self-hosted Supabase Docker.

### Tooling

```bash
# Export from Cloud (including auth schema)
pg_dump --no-owner --no-acl -Fc \
  --schema=public --schema=auth --schema=storage \
  -d $CLOUD_DB_URL > fastio_full.dump

# Restore to self-hosted
pg_restore --no-owner --no-acl \
  -d $SELF_HOSTED_DB_URL fastio_full.dump
```

---

## Migration Squashing

### Why Squash

261 migrations = slow `supabase db reset` in dev (applies all sequentially), slow CI, harder onboarding. Goal: one clean `000_schema.sql` representing current state.

### How to Squash

**Step 1: Generate clean schema dump from current DB**
```bash
pg_dump --schema-only --no-owner --no-acl \
  --schema=public \
  -d $LOCAL_DB_URL > supabase/migrations/000_schema.sql
```
This produces a single file with all tables, indexes, constraints, functions, triggers, RLS policies in correct dependency order.

**Step 2: Capture `seed.sql` separately**
```bash
pg_dump --data-only --no-owner \
  -t plans -t roles \
  -d $LOCAL_DB_URL > supabase/seed.sql
```
Reference/config data (plans, roles) lives in seed, not schema.

**Step 3: Archive old migrations**
```bash
mkdir supabase/migrations/archive
mv supabase/migrations/0{01..261}_*.sql supabase/migrations/archive/
```
Keep archive for git history reference.

**Step 4: Update `supabase/config.toml`** if it references specific migration files.

**Step 5: Test**
```bash
supabase db reset  # applies 000_schema.sql + seed.sql from scratch
pnpm typecheck     # verify generated types still match
```

### Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| `pg_dump` may miss custom search paths | Explicitly `SET search_path = public` at top of dump |
| Functions with `SECURITY DEFINER` may have wrong owner | Audit dump for `OWNER TO` clauses, strip with `--no-owner` |
| RLS policies order matters if they reference each other | Verify with `supabase db reset` on clean DB |
| `pg_cron` jobs not in `public` schema | Manually add cron re-registration at bottom of `000_schema.sql` |
| Existing production DB won't use `000_schema.sql` | Production uses incremental migrations — squash is only for dev/CI reset speed. Add a `supabase_migrations` table guard: skip `000_schema.sql` if tables already exist |

### Production Safety

**Never apply a squashed migration to production.** Production DB already has all 261 migrations applied. The squash is only for:
- `supabase db reset` in local dev
- CI pipelines that spin up fresh DBs
- New developer onboarding

For production, keep deploying incremental migrations (`262_*.sql`, etc.) as usual.

---

## Build Order Implications

The following dependencies constrain the implementation sequence:

### Must Be Done First

1. **Plan limits in DB** (`plans.features.limits` jsonb fields + DB triggers) — must exist before self-registration, otherwise new tenants land on unlimited free plan by accident.

2. **Tenant provisioning Edge Function** — must be deployed before self-registration UI is live.

3. **Migration squash** — do this before self-hosted migration (cleaner dump, faster restore). Do it before adding more migrations if possible.

### Can Be Parallelized

- Onboarding wizard UI (admin) and tenant provisioning backend are independent — can be built in parallel, integrated at the end.
- Self-hosted Supabase setup can run in parallel with feature development.

### Must Be Done Last

- **DNS cutover to self-hosted** — only after full smoke test, never before.
- **Remove Cloud subscription** — only after 48h monitoring on self-hosted with zero issues.
- **Disabling free unlimited access** — only after plan limits are fully tested in production.

### Critical Path

```
Squash migrations
  → Self-hosted setup + restore
    → DNS cutover

Plan limits (DB triggers + PlanFeatures types)
  → Provisioning Edge Function
    → Self-registration UI
      → Onboarding wizard
        → Paywall enforcement in admin
```
