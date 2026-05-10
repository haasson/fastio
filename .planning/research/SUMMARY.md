---
synthesized: 2026-05-10
---
# Research Summary — FastIO v1 Launch

## Recommended Stack / Infra

- **Coolify + self-hosted Supabase** on a single VPS (≥8 GB RAM): one-click Service template handles Docker Compose setup; set `POOLER_TENANT_ID` before first start and rotate all default credentials immediately.
- **Admin as static site** (`nuxt generate` → Coolify Static), **storefront as SSR Docker** (multi-stage build, start command via `node --import sentry.server.config.mjs`). No Node server needed for admin = cheaper and simpler.
- **Storage on external S3** from day one — Timeweb Cloud S3 for RU clients or Cloudflare R2 (no egress fees). Never store files in the local Supabase container.
- **Backups via `postgres-r2-backup` container**: daily at 03:00 UTC (30-day retention) + weekly (12-week retention) + manual pre-migration snapshot. Test restore before launch — untested backups are not backups.
- **Sentry** (`@sentry/nuxt` already in deps) + **UptimeRobot free tier** must be live before first real user. No visibility = silent churn.

## Table Stakes Features

Everything below must work before first client touches production:

- Email + password auth with **email verification** (soft-block: show product in read-only state with persistent banner, don't hard-wall)
- **Password reset** (nearly always broken in staging — test explicitly)
- **Self-serve registration** that creates a tenant atomically via `provision-tenant` Edge Function (branch + owner member + free plan seeded)
- **Business-type selection** at registration (food vs services) — determines which modules are enabled and which wizard path loads
- **Onboarding wizard** (4–6 steps, progress saved to DB, wizard-type-aware): user must reach "storefront live" moment in under 5 minutes
- **Plan limits enforced at DB level** (triggers on insert) before any tenant can reach production — free unlimited = revenue leak
- **SMTP configured and tested** (Resend / Postmark): auth emails, welcome emails, password reset all verified working
- **RLS audit**: every public table has policies; `service_role` key present only in server-side files
- SPF/DKIM configured for sending domain — otherwise auth emails go to spam on day one

## Critical Architecture Decisions

1. **Tenant provisioning via Edge Function, not DB trigger.** `provision-tenant` Edge Function (called from `storefront/server/api/auth/register.post.ts`) handles: create tenant row, insert owner into `tenant_members`, insert default branch, assign free plan. Must be idempotent (`INSERT ... ON CONFLICT DO NOTHING`) — network retries must not create duplicate tenants.

2. **Plan limits live in `plans.features.limits` jsonb (Option B already in codebase), enforced at 3 layers**: DB BEFORE INSERT trigger (source of truth) → RPC `check_tenant_limit` returning `{allowed, current, max}` (friendly 402 before hitting trigger) → frontend disable/hide (UX only, never trusted). Disable free unlimited access only after limits are fully tested in production.

3. **Copy Supabase Cloud JWT secret exactly before migration.** If the secret differs, ALL existing sessions immediately invalidate, RLS policies silently deny everything (auth.uid() returns NULL), and anon/service_role keys also change. This is the single highest-risk step of migration.

4. **Squash 261 migrations into `000_schema.sql` before self-hosted restore** — faster `supabase db reset`, cleaner dump, easier onboarding. Squash is for dev/CI only; production keeps receiving incremental migrations (`262_*.sql`+). Never apply squash to an existing production DB.

## Top Pitfalls to Avoid

1. **Storage URL breakage after migration** — all public URLs change from `*.supabase.co/storage/v1/...` to the self-hosted domain. Run a SQL audit to find every URL-containing column (dish images, avatars) and update them in a migration pass. Also: manually recreate bucket CORS settings and configure imgproxy separately.

2. **SMTP not configured = silent auth failure** — self-hosted Supabase ships with zero email relay. Every auth flow (confirmation, magic link, password reset, invitations) is completely broken until SMTP is wired. Configure and test all auth email flows in staging before cutover, not after.

3. **Tenant provisioning race condition** — if any step of provisioning (create tenant → branch → member → plan) fails midway, the tenant is half-initialized and produces mysterious errors. Wrap everything in a transaction or use an explicit `initialized` flag with idempotent retry. Never assume "it probably worked."

4. **Missing RLS on new tables** — adding a table in a migration without RLS leaves it world-readable via the REST API. Run the audit query before launch: `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT IN (SELECT relname FROM pg_class JOIN pg_policies ON pg_class.oid = pg_policies.polrelid)`. Add this to CI.

5. **Launching without error monitoring** — without Sentry, first-customer bugs are invisible. User hits an error, leaves silently, you never know. Sentry free tier covers early scale; `@sentry/nuxt` is already in deps — just add config files and DSN. Must be live before first real user.

## Build Order (Critical Path)

```
1. Squash migrations (000_schema.sql)
   → Self-hosted Supabase setup on VPS
     → Restore data from Cloud (maintenance window)
       → DNS cutover
         → Remove Cloud subscription (after 48h monitoring)

2. Plan limits (extend PlanFeatures.limits + DB BEFORE INSERT triggers)
   → provision-tenant Edge Function (idempotent)
     → Self-registration UI (storefront: email + business type)
       → Onboarding wizard (admin: type-aware, DB-persisted progress)
         → Paywall enforcement in admin (disable buttons + upgrade modals)

3. SMTP + SPF/DKIM setup (prerequisite for any auth testing)
4. Sentry + UptimeRobot (prerequisite for any real user)
5. Backup container live + restore tested (prerequisite for launch)
6. RLS audit pass (prerequisite for launch)
7. Secrets rotation (all dev-era keys replaced before first customer data)
```

Items in branch 1 and branch 2 can be parallelized with each other. Items 3–7 are independent and can be done alongside.

## Key Insights

- **The JWT secret is the single point of catastrophic failure in migration.** It controls sessions, RLS access, and API keys simultaneously. Copy it first, verify it twice — everything else in the migration is recoverable; a wrong secret is not.

- **"Free unlimited" is a silent revenue leak.** If plan limits are not enforced at the DB level before self-registration goes live, early adopters accrue data and usage patterns under a free tier that was never meant to be unlimited. Retroactive enforcement breaks their workflows and creates support burden. Limits must ship before registration opens.

- **TTFV (Time to First Value) is the only onboarding metric that matters for v1.** The aha moment for FastIO is the user seeing their actual storefront URL live. Every wizard step that doesn't directly lead to that moment is friction. Cut aggressively — research shows abandonment spikes hard past 5 minutes or 6 wizard steps.
