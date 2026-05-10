---
focus: pitfalls
date: 2026-05-10
---
# Pitfalls Research

## Self-hosted Supabase Migration

### Storage
- **S3-compatible backend required** — self-hosted Supabase Storage uses an S3-compatible backend (MinIO by default in Docker). Files stored in Supabase Cloud DO NOT migrate automatically; you must manually sync bucket contents via `rclone` or `aws s3 sync`. Forgetting this = silent data loss on first access.
- **Storage URL breakage** — all public URLs change from `https://<project>.supabase.co/storage/v1/...` to your self-hosted domain. Any hardcoded URLs in DB rows (e.g., dish images, avatars) will 404 after migration. Must run a SQL update pass over all URL-containing columns.
- **imgproxy configuration** — Supabase Cloud has imgproxy built in for image transforms. Self-hosted setups need imgproxy configured separately; otherwise `?width=` / `?height=` transform params silently return originals or 500s.
- **Bucket CORS settings** — CORS configuration is not exported with the project schema. Must be recreated manually in the self-hosted dashboard.

### Auth
- **SMTP is your problem now** — Supabase Cloud has a built-in SMTP relay (capped at 3/hr on free, but it exists). Self-hosted: zero emails until you wire up SMTP (Resend, Postmark, SES). Auth confirmation emails, magic links, password resets = completely broken out of the box.
- **`GOTRUE_SITE_URL` misconfiguration** — this env var controls redirect URLs in auth emails. If it still points to the old Cloud project URL or is wrong, all email auth flows loop or 404.
- **OAuth redirect URIs** — Google/GitHub/Telegram OAuth apps have whitelisted redirect URIs. After migration, the domain changes. Every OAuth provider needs updated callback URLs. Easy to forget, hard to debug under time pressure.
- **JWT secret rotation** — if the JWT secret differs between Cloud and self-hosted, ALL existing sessions become invalid instantly. Users get silently logged out. The secret must be copied exactly from Supabase Cloud project settings.
- **`anon` / `service_role` key mismatch** — these keys are derived from the JWT secret. If you change the secret, keys change too. Any hardcoded keys in client config or Edge Functions env vars must be updated.

### Edge Functions
- **Deno runtime differences** — Supabase Cloud Edge Functions run on a managed Deno runtime with specific version pinning. Self-hosted uses `deno` in Docker; minor version differences can break `std/` imports or cause subtle behavior changes with `fetch`.
- **Edge Functions → Docker networking** — inside Docker Compose, Edge Functions call Supabase services via internal container names (`http://kong:8000`), not the public URL. Any function that calls `supabaseUrl` from env must use the internal URL for intra-container calls, or traffic routes externally and breaks in isolated networks.
- **No automatic function deployment** — Supabase Cloud has CI/CD for functions via the CLI. Self-hosted requires a manual deploy pipeline (`supabase functions deploy`). Forgetting to redeploy after code changes = production runs stale function code.
- **Secrets/env vars** — Edge Function secrets set via `supabase secrets set` on Cloud are NOT exported. Must be manually recreated via `supabase secrets set` against the self-hosted instance or via `docker-compose.yml` env injection.

### Database
- **`pg_net` and extension availability** — some extensions available on Supabase Cloud (pg_net, pg_graphql, timescaledb) may not be installed or may differ in version on self-hosted Postgres. Migrations referencing these extensions will fail.
- **Realtime publication** — tables need to be added to the `supabase_realtime` publication for Realtime to work. This config is not in standard migration SQL. Easy to lose when rebuilding from migrations on a fresh instance.
- **RLS policies with `auth.uid()`** — work fine, but if the JWT secret is wrong (see above), `auth.uid()` returns NULL everywhere, causing every RLS policy to silently deny all access. Very confusing to debug.
- **`pg_cron` jobs** — scheduled jobs created via pg_cron UI in Cloud are not in migration files. They live in the DB metadata only. Must be manually recreated or scripted.
- **Pooler differences** — Supabase Cloud uses PgBouncer in transaction mode. Self-hosted Docker setups often connect directly to Postgres or configure Supavisor differently. Apps using prepared statements (e.g., Drizzle with `pg` driver in transaction mode) may break.

### Operational
- **No automatic backups** — Cloud does daily backups. Self-hosted: zero backups until you set up `pg_dump` cron jobs or WAL archiving yourself. First production incident without backups = catastrophic.
- **SSL termination** — Cloud handles TLS. Self-hosted needs a reverse proxy (Caddy/nginx) with valid certs. Running without HTTPS in production is a security violation and breaks `Secure` cookie flags.
- **Kong configuration** — Supabase's API gateway (Kong) uses `kong.yml`. Misconfigured routes cause specific API endpoints to 404. The default Docker Compose config works, but custom domain setups or path prefix changes require careful Kong config edits.

---

## SaaS Onboarding Launch

### Abandonment at Registration
- **Too many required fields** — asking for company name, phone, billing, team size at signup = 40-60% drop. Minimal signup (email + password only) dramatically improves completion. Collect the rest progressively.
- **Email confirmation as a blocker** — if users must confirm email before accessing the product, many never do (email in spam, wrong email entered, can't be bothered). Either skip confirmation initially or show the product in a "pending confirmation" state.
- **No "what happens next" clarity** — users don't know what they signed up for until they're inside. A 3-step progress indicator or a "here's what you'll set up" screen reduces bounce.
- **Redirect to empty state with no guidance** — landing on a blank dashboard with no data, no tooltips, no CTA = cognitive overload. First session must have an explicit "next action" visible immediately.

### First-Session Drop
- **TTFV (Time to First Value) > 5 minutes** — if the user hasn't seen their core "aha moment" in 5 minutes, most churn. For FastIO: the aha moment is probably seeing their menu published on the storefront. Every step before that is friction.
- **Complex tenant/branch setup before seeing anything** — forcing business setup (address, working hours, tax info) before showing the product = premature optimization of data collection. Show value first.
- **No sample/demo data** — empty state for a menu, timeline, or order list is demoralizing. Offer "populate with sample data" or a sandbox mode on first login.
- **Broken mobile onboarding** — majority of first visits happen on mobile. If the admin panel is desktop-only or buggy on mobile, first impression is permanently damaged.

### Technical Onboarding Failures
- **Tenant provisioning race condition** — if tenant creation involves multiple async steps (create row, create default branch, assign roles, seed default settings), a crash midway leaves the tenant in a half-initialized state. Users see random errors or missing functionality. Needs transactional provisioning or idempotent retry logic.
- **First email never arrives** — welcome/confirmation emails go to spam. No SPF/DKIM = near-certain spam folder for new domains. Set up email authentication before first user.
- **Invitation flow not tested** — "invite team member" flows are often undertested. Invitee gets an email, clicks link, lands on 404 or blank page because the token expired or the route isn't implemented.
- **Password reset broken** — almost always broken in staging, only discovered in production. Test it explicitly before launch.
- **OAuth "sign in" creates a second account** — user registers with email, then tries Google OAuth — two separate accounts for the same email if `link_identity` isn't set up. Confusing and data-splitting.

### Support & Communication
- **No in-app error feedback** — generic "something went wrong" with no next step = user closes the tab. Every error state needs a recovery action.
- **No onboarding checklist persistence** — if an onboarding checklist doesn't persist between sessions (stored only in localStorage), returning users see "welcome" flows repeatedly or lose progress.
- **No re-engagement for stalled users** — users who complete registration but don't finish setup are your highest-value leads. No email sequence = they're gone. Even a single "you haven't finished setting up X" email at 24h significantly improves activation.

---

## Multi-tenant Security

### Row-Level Security (RLS)
- **Missing RLS on new tables** — adding a table in a migration without immediately adding RLS policies leaves it world-readable/writable via the Supabase REST API. The Supabase dashboard warns about this, but it's easy to ignore. Audit: `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT IN (SELECT relname FROM pg_class JOIN pg_policies ON pg_class.oid = pg_policies.polrelid);`
- **RLS enabled but no policies = deny all** — enabling RLS on a table with zero policies silently denies ALL access, including your own application. Can cause mysterious 403s or empty results that look like bugs.
- **`service_role` key in client-side code** — the service role key bypasses ALL RLS. If it leaks into the client bundle (via env vars prefixed `NUXT_PUBLIC_` or `VITE_`), any user can read/write any tenant's data. Must be server-side only.
- **Tenant isolation gaps in complex queries** — `tenant_id = auth.jwt() ->> 'tenant_id'` works for simple tables. But junction tables, many-to-many relations, and denormalized data can have missing tenant_id columns. If the RLS policy on a junction table only checks one side, cross-tenant reads are possible.
- **Admin bypass policies** — policies like `auth.role() = 'service_role' OR tenant_id = auth.uid()` are correct, but if you accidentally test with the service role key and declare RLS "working," you may never actually test the user-facing policy.

### API & Server Security
- **Nuxt server routes without auth checks** — `server/api/*.ts` routes that call Supabase with the service role key must manually verify the user session. There's no automatic auth middleware in Nuxt server routes. One forgotten check = unauthenticated data access.
- **IDOR (Insecure Direct Object Reference)** — passing `id` parameters in API calls without verifying the requesting user owns that resource. Even with RLS, if a server route fetches `supabase.from('orders').select().eq('id', params.id)` using the service role, RLS is bypassed.
- **Missing rate limiting** — Supabase Cloud has some built-in rate limiting. Self-hosted does not. Without rate limiting on auth endpoints (login, signup, password reset), credential stuffing and enumeration attacks are trivial.
- **Exposed tenant metadata** — API endpoints that return tenant configuration (theme, settings, slugs) often don't need auth and are intentionally public. But if they also return internal IDs, staff counts, or plan details, you're leaking competitive/sensitive info.
- **Storage bucket policies** — public buckets expose ALL objects to anyone with the URL (including guessable paths). Private buckets require signed URLs. Common mistake: make a bucket public for convenience, forget it contains PII (order receipts, customer data).

### Auth Security
- **No session invalidation on password change** — if a user changes their password, existing sessions in other browsers/devices should be revoked. Supabase doesn't do this automatically; must call `supabase.auth.signOut({ scope: 'others' })` server-side.
- **Magic link / OTP brute force** — without rate limiting, OTP codes (6-digit) are brutable in ~1M attempts. Supabase has some limits but they're configurable and can be set too loosely.
- **`redirect_to` open redirect** — Supabase auth allows `redirect_to` in email links. If not restricted to your own domain in `Site URL` + `Additional Redirect URLs` settings, attackers can craft phishing links that appear to come from your domain.

### Data Isolation
- **Shared Postgres schema = schema-level isolation only** — in a shared-schema multi-tenant model (all tenants in same tables, distinguished by `tenant_id`), a single bug in RLS can expose all tenants' data. Unlike schema-per-tenant, there's no hard boundary. Requires rigorous RLS testing.
- **Realtime subscriptions cross-tenant leak** — Realtime filters are advisory, not enforced at the DB level in all cases. Subscribing to a table with `filter: tenant_id=eq.X` client-side is NOT security. RLS on the underlying table is the only actual enforcement. If RLS is misconfigured, Realtime pushes cross-tenant updates.
- **Background jobs / cron without tenant scoping** — a pg_cron job that runs a maintenance query without a `WHERE tenant_id = X` clause processes all tenants together, potentially leaking data between them in result sets or logs.

---

## Migration Squashing Risks

### Schema Drift
- **Squash doesn't equal exact current schema** — `supabase db diff` after a squash sometimes reveals divergence between the squashed migration and actual running DB. Happens when migrations were applied out of order, manually hotfixed in production, or edited after application. Always `supabase db diff` against a fresh DB seeded from the squashed migration before deploying.
- **Function/trigger bodies not captured** — `pg_dump` and Supabase's squash process may not correctly capture complex PL/pgSQL function bodies, especially if they were edited via SQL editor (not migration files). Verify all functions are present and correct in the squashed output.
- **Extension creation order** — `CREATE EXTENSION` statements must precede any objects that depend on them. Squashed migrations sometimes reorder statements alphabetically or by type, breaking dependency order.
- **RLS policy names lost** — policy names are important for `ALTER POLICY` / `DROP POLICY` in future migrations. If squash renames or loses policy names, future incremental migrations that reference those names will fail.

### Data Risks
- **Squash is schema-only** — `supabase db diff --use-migra` generates DDL only. Any data migrations (UPDATE statements, backfills, seed data inserts) that were in previous migration files are NOT included in the squash. If you ever rebuild from scratch (new environment, new dev), the data migrations are silently gone.
- **Idempotency assumptions broken** — some migrations use `IF NOT EXISTS` guards. After squashing, those guards may be stripped, causing "already exists" errors on re-apply. Or guards may be incorrectly added where the object shouldn't pre-exist in a clean environment.
- **Seed data vs migration data confusion** — data that started in a migration (e.g., default plan tiers, default roles) may be in neither the squash nor the seed file after a squash operation. New environments come up with no default data.

### Operational Risks
- **Existing environments can't apply the squash** — a squashed migration replaces N migration files with one. Any environment that already has those N migrations applied will see the squash as a "new" migration and try to apply it, causing "relation already exists" errors. Must handle this with version checks or by managing migration history manually.
- **CI breaks after squash** — CI pipelines that run `supabase db reset` + apply all migrations will fail if the squash migration conflicts with itself on a pre-seeded DB. Test CI explicitly after squashing.
- **`supabase_migrations.schema_migrations` table divergence** — Supabase tracks applied migrations in this table. After squash, the history must match. If a developer applies the squash on a DB that already has the constituent migrations, manual surgery on `schema_migrations` is needed.
- **Timing: squash during active development** — squashing while other developers have in-flight migration PRs causes merge conflicts in migration numbering. In a solo context, this is less of a problem, but self-imposed workflow (multiple branches) can still cause this.

### Safe Squash Process
1. Tag the current working state (git tag pre-squash)
2. `supabase db diff --use-migra --schema public > squashed.sql` against production DB
3. Review the diff manually — especially functions, triggers, policies
4. Test on a fresh local DB: `supabase db reset` + apply squashed migration
5. Compare `\d+ tablename` outputs before/after for critical tables
6. Deploy squash as a new migration on top of existing ones in production (not as a replacement) if existing DBs are in play

---

## Solo SaaS Launch Anti-patterns

### Building Instead of Shipping
- **Perfectionism loop** — "one more feature before launch" is the single most common solo SaaS killer. Features added after the first 80% are often not validated by real users and delay the feedback loop that actually tells you what to build.
- **Over-engineering for scale that doesn't exist** — building multi-region failover, advanced caching, and microservices architecture for 1 customer is wasted effort. Optimize for correctness and observability first.
- **Building features vs building distribution** — solo founders over-invest in product, under-invest in the channel that gets users. A product with 10 features and 100 users beats a product with 100 features and 10 users.

### Operations & Monitoring
- **No error monitoring before first customer** — without Sentry (or equivalent), you have no visibility into what's breaking in production. First customer hits a bug → they leave silently → you never know. Set up error monitoring before any real user touches the product.
- **No uptime monitoring** — self-hosted infra goes down. Without uptime monitoring (UptimeRobot, Better Uptime), you find out from a customer complaint, not an alert.
- **No structured logging** — `console.log` in production Edge Functions doesn't give you the context to debug issues after the fact. Structured logs with request IDs and tenant IDs are essential from day one.
- **No alerting on key metrics** — failed payments, auth errors, DB connection exhaustion, disk full — all of these need alerts. Finding out after the fact is avoidable.
- **Skipping backup verification** — backups that have never been tested are not backups. They're hopes. `pg_dump` + never restore-tested = discovered broken at the worst moment.

### Business & Support
- **No way to contact users** — if you don't capture email (or use a communication channel), you can't notify about downtime, breaking changes, or request feedback. Transactional email and a user comms channel (even just email list) are non-negotiable.
- **No feedback mechanism** — users who hit problems and can't report them just leave. An in-app "report a problem" button or chat widget pays for itself many times over.
- **Underestimating support load** — the first customer generates 10x more support requests than subsequent ones because everything is new. No async support process (docs, FAQ, email template) = founder burnout within weeks.
- **Not dog-fooding** — not using your own product as if you were a customer means you don't discover onboarding friction, confusing UX, or slow flows until a real user complains.

### Technical Debt at Launch
- **No feature flags** — pushing breaking changes directly to production for a live customer with no rollback mechanism. Even a simple boolean in `.env` to disable a feature is better than nothing.
- **Skipping smoke tests** — no automated smoke test suite means each deploy is a prayer. Even 5 Playwright tests covering signup → core action → data visible is enough to catch regressions.
- **Deployment with zero downtime not considered** — Nuxt SSR apps need graceful restarts. If the deploy process kills the old process before the new one is ready, you get a gap in availability that's especially visible for the first customer.
- **Secrets in environment variables not rotated** — launching with development-era secrets (Supabase keys, Telegram tokens, payment provider keys) that were created during prototyping and shared around. Rotate all secrets before first real customer data enters the system.
- **No database connection pooling** — direct Postgres connections from serverless/edge functions exhaust the connection limit fast. With Supabase, use the pooler URL for app queries; use the direct URL only for migrations.

### Growth & Iteration
- **Changing too much between iterations** — when something doesn't work, changing 5 things at once makes it impossible to know what fixed it. Solo = no A/B testing, so change one thing, measure, repeat.
- **Ignoring churned users** — every user who leaves is a data point. A 2-question exit survey ("why did you leave?") answered by even 20% of churners is priceless. Most solo founders never implement this.
- **Not versioning the API/schema early** — adding breaking schema changes for a single customer is manageable but sets a precedent. After customer 5, unversioned schema migrations become a coordination nightmare.

---

## Prevention Strategies

### Self-hosted Supabase
| Risk | Mitigation |
|---|---|
| Storage URL breakage | SQL audit: find all `storage.objects` URL columns; write migration to bulk-update URLs |
| Auth emails broken | Configure and test SMTP (Resend/Postmark) in staging before cutover; test every auth flow |
| JWT secret mismatch | Copy JWT secret from Cloud dashboard FIRST, before any other config |
| Missing RLS policies | Automated check: `supabase db diff` will surface unprotected tables; add to CI |
| Edge Functions broken | Test all functions against local self-hosted before cutover; use `supabase functions serve` |
| No backups | `pg_dump` cron job from day one; test restore monthly |
| Extension availability | `supabase db diff` a fresh self-hosted against Cloud schema to surface extension issues |

### SaaS Onboarding
| Risk | Mitigation |
|---|---|
| Email confirmation blocking | Use "soft confirmation" — let user in, show persistent banner to confirm email |
| Empty state paralysis | Seed demo data on first login; "Load sample menu" one-click |
| Tenant provisioning race | Wrap in a DB transaction or use a state machine with explicit `initialized` flag |
| TTFV too high | Map every step from signup to first value; cut anything that isn't directly on that path |
| Re-engagement failure | Implement single 24h "finish your setup" email; track who hasn't completed onboarding |

### Multi-tenant Security
| Risk | Mitigation |
|---|---|
| Missing RLS | Pre-launch audit query against all public tables; add to migration linting |
| service_role in client | Grep codebase for `service_role` / `SERVICE_ROLE`; ensure it only appears in server-side files |
| Server route without auth | Code review checklist: every `server/api/` handler checks session before service_role ops |
| Public storage buckets with PII | Audit bucket policies; convert receipt/PII buckets to private + signed URLs |
| Realtime cross-tenant | Never rely on client-side Realtime filters for security; verify RLS covers Realtime channel data |

### Migration Squashing
| Risk | Mitigation |
|---|---|
| Schema drift | Always run `supabase db diff` after squash against a fresh DB |
| Data migrations lost | Extract data migrations to a separate `seeds/` directory; document them explicitly |
| CI breaks | Test full `supabase db reset` + squash migration in CI before merging |
| Existing envs can't apply | Plan squash at a synchronization point (e.g., all envs migrated to latest before squash deploy) |
| Policy/function loss | Manual review of squashed SQL for all `CREATE FUNCTION`, `CREATE POLICY` statements |

### Solo SaaS Launch
| Risk | Mitigation |
|---|---|
| No error visibility | Sentry (or equivalent) before first user; budget $0 using free tier |
| No uptime monitoring | UptimeRobot free tier: 5-minute checks on `/api/health` endpoint |
| No backups | Automate `pg_dump` + upload to object storage from day one |
| Feature perfectionism | Define "launch criteria" as a written checklist; ship when checklist is done, not when "ready" |
| Support overload | Write 10-question FAQ; create canned responses for top issues; set response time expectations |
| No dog-fooding | Use your own product for a real use case for 1 week before accepting first customer |
| Secrets not rotated | Checklist item: rotate all dev-era secrets before first customer data enters production |
