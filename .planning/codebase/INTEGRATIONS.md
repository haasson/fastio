# External Integrations

**Analysis Date:** 2026-05-20

## APIs & External Services

### Supabase (BaaS — core infrastructure)
- Used for: PostgreSQL database, authentication (GoTrue), realtime subscriptions, file storage, Edge Functions
- SDK: `@supabase/supabase-js` ^2.98.0 (all apps); `@supabase/ssr` ^0.8.0 (storefront SSR)
- Self-hosted on VPS via Docker/Coolify — NOT managed Supabase cloud
- Auth env: `NUXT_PUBLIC_SUPABASE_URL`, `NUXT_PUBLIC_SUPABASE_ANON_KEY`, `NUXT_SUPABASE_SERVICE_ROLE_KEY`
- Client initialization: `apps/admin/server/utils/supabase.ts`, `apps/storefront/server/utils/supabase.ts`
- Realtime: `apps/admin/shared/data/useRealtimeList.ts`, `apps/admin/shared/data/useRealtimeWatch.ts`, `apps/admin/shared/data/createRealtimeBus.ts`

### OpenAI (AI Assistant)
- Used for: Admin AI chat assistant (`/help` page AI feature)
- SDK: `@ai-sdk/openai` ^3.0.52, `ai` ^6.0.141 (Vercel AI SDK)
- Server endpoint: `apps/admin/server/api/ai/chat.post.ts`
- Knowledge base: `apps/admin/server/ai/knowledge/` (fs storage via Nitro)
- Context fetching: `apps/admin/server/ai/fetchContext.ts`
- Auth env: `NUXT_OPENAI_API_KEY` (admin server-side only)
- Rate limits: 30 req/min per user, 500 req/day per tenant

### Telegram Bot API
- Used for: Order notifications to tenants, table call alerts, reservation notifications, appointment reminders, auth (QR login for storefront), ops alerts
- HTTP client: `undici` fetch with proxy support (`apps/admin/server/utils/telegramFetch.ts`)
- Base URL: `https://api.telegram.org` (constant in `telegramFetch.ts`)
- Proxy: `NUXT_TELEGRAM_PROXY_URL` — HTTP proxy for RKN-blocked regions (e.g. sing-box)
- Auth env:
  - `NUXT_TELEGRAM_TENANT_BOT_TOKEN` — notifications to restaurant owners
  - `NUXT_TELEGRAM_CLIENT_BOT_TOKEN` — customer-facing bot (storefront auth)
  - `NUXT_TELEGRAM_OPS_BOT_TOKEN` — ops/monitoring alerts
  - `NUXT_TELEGRAM_WEBHOOK_SECRET` — webhook verification
  - `NUXT_TELEGRAM_ALERT_CHAT_ID` — ops alert destination chat
- Webhook registration: `apps/admin/server/plugins/telegram-bot-setup.ts` (Nitro plugin, runs on server start)
- Incoming webhook endpoints:
  - `apps/admin/server/api/telegram/webhook.post.ts` — tenant bot
  - `apps/admin/server/api/telegram/auth-webhook.post.ts` — client auth bot
- Notification endpoints (internal, called by server-to-server):
  - `apps/admin/server/api/telegram/notify.post.ts` — new orders
  - `apps/admin/server/api/telegram/notify-reservation.post.ts`
  - `apps/admin/server/api/telegram/notify-table-call.post.ts`
  - `apps/admin/server/api/telegram/notify-alert.post.ts` — ops alerts
  - `apps/admin/server/api/telegram/notify-appointment-group.post.ts`
  - `apps/admin/server/api/telegram/send-appointment-reminders.post.ts`
- Env for webhook URLs: `NUXT_TELEGRAM_AUTH_WEBHOOK_URL`, `NUXT_TELEGRAM_TENANT_WEBHOOK_URL`

### DaData (Russian address autocomplete)
- Used for: Delivery address suggestions in storefront checkout and admin settings
- Integration: Supabase Edge Function `supabase/functions/dadata-suggest/` (proxied to protect API key)
- Also: Direct Nitro proxy in `apps/admin/server/api/dadata/suggest.post.ts`, `apps/storefront/server/api/dadata/suggest.post.ts`
- Auth env: `NUXT_DADATA_API_KEY` (server-side)

### Yandex Maps
- Used for: Delivery zone drawing (admin), address pin on storefront
- SDK: `vue-yandex-maps` ^3.0.3 (lazy-loaded, CSS in chunk alongside component)
- Auth env: `NUXT_PUBLIC_YANDEX_MAPS_API_KEY` (public, browser-side)

### YooKassa (Online Payments — disabled in production)
- Used for: Subscription billing (not yet launched)
- Supabase Edge Function: `supabase/functions/payment-webhook/index.ts`
- Kill-switch: `YOOKASSA_INTEGRATION_ENABLED='true'` — returns HTTP 410 until explicitly enabled
- Auth env: `YOOKASSA_WEBHOOK_SECRET` (HMAC-SHA256 signature verification)
- Status: Function deployed but disabled; full billing flow deferred (see LATER.md → PREPROD-001)

### Coolify API
- Used for: Programmatically adding custom domains for storefront tenants
- Supabase Edge Function: `supabase/functions/add-custom-domain/index.ts`
- Auth env: `COOLIFY_API_URL`, `COOLIFY_TOKEN`, `COOLIFY_STOREFRONT_UUID` (set in Supabase service secrets)
- DNS ownership verified via TXT record `_fastio-verify.<domain>` before domain registration

### Google Fonts
- Used for: Unbounded 800 font in admin; dynamic font loading for storefront tenant themes
- Integration: CDN link tags in Nuxt `app.head` (`apps/admin/nuxt.config.ts`)
- Dynamic URL builder: `apps/admin/config/google-fonts.ts`, `apps/storefront/shared/utils/google-fonts.ts`
- Preconnect to `fonts.googleapis.com` and `fonts.gstatic.com`

### Sentry (Error Tracking)
- Used for: Frontend error tracking (admin, storefront, help), Edge Function error tracking
- Module: `@sentry/nuxt` ^10.47.0 (admin, storefront, backoffice)
- Edge Functions: `@sentry/deno` via `supabase/functions/_shared/sentry.ts` wrapper
- Auth env: `NUXT_PUBLIC_SENTRY_DSN` (public, browser-side) — empty = Sentry disabled (safe for local dev)
- Edge env: `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_TRACES_SAMPLE_RATE` (default 1%)
- Shared observability helper: `packages/shared/src/observability/index.ts`

## Data Storage

**Primary Database:**
- PostgreSQL 17 (local dev), 15.8 (production)
- Self-hosted via Supabase Docker stack
- 301 migrations in `supabase/migrations/`
- Connection: via Supabase JS client (no direct psql from app code)
- Type generation: `pnpm db:gen-types` → `apps/admin/shared/data/database.types.ts`

**File Storage:**
- Supabase Storage (self-hosted)
- Production: MinIO container (migration to Timeweb S3 planned but not completed)
- Target: Timeweb S3 (`s3.twcstorage.ru`, bucket `fastio-backups`)
- CDN: `cdn.fastio.ru` → `qjb8tvuohx.cdn.twcstorage.ru` (Timeweb CDN)
- Image proxy: `supabase/functions/proxy-image/` — authenticates user, rate-limits, proxies Supabase Storage

**Caching:**
- In-process LRU cache (lru-cache ^11.3.6) — server-side per-nitro-instance
  - `apps/admin/server/api/dadata/suggest.post.ts`: tenant coords, TTL 1h, max 1000 entries

**AI Knowledge:**
- Filesystem storage (Nitro fs driver): `apps/admin/server/ai/knowledge/`
- KB content: `packages/kb/content/*.md` (mounted as Nitro storage `kb`)

## Authentication & Identity

**Auth Provider:**
- Supabase GoTrue (self-hosted) — email/password auth with JWT tokens
- JWT expiry: 3600s (1h), refresh token rotation enabled
- Redirect URLs configured for `admin.fastio.ru` and `localhost:4710`

**Admin Auth:**
- Supabase JWT verification via `apps/admin/server/utils/auth.ts`
- `requireMemberOfTenant()` — server middleware verifying user belongs to tenant
- `requireInternalSecret()` — server-to-server auth via `NUXT_INTERNAL_API_SECRET`

**Storefront Auth:**
- Supabase SSR (`@supabase/ssr`) — cookie-based session for SSR compatibility
- Tenant-scoped: `apps/storefront/server/middleware/tenant.ts` resolves tenant from subdomain
- Telegram QR login: `apps/admin/server/api/telegram/auth-webhook.post.ts`

**Backoffice Auth:**
- HTTP Basic Auth middleware: `apps/backoffice/server/middleware/auth.ts`
- Env: `NUXT_BACKOFFICE_USER`, `NUXT_BACKOFFICE_PASS`

**Email Auth Templates:**
- Invite: `supabase/templates/invite.html`
- Password recovery: `supabase/templates/recovery.html`
- Confirmation: `supabase/templates/confirm_signup.html`

## Email

**SMTP:**
- Provider: Timeweb mail — `smtp.timeweb.ru:465`
- From address: `noreply@fastio.ru`
- Configured in Supabase GoTrue for system emails
- Transactional emails (new tenant welcome): `supabase/functions/send-new-tenant-email/` using nodemailer ^6
- Recovery emails: `supabase/functions/send-recovery-email/`
- Auth env: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (in Supabase service config)

## Monitoring & Observability

**Error Tracking:**
- Sentry (see above)

**Backup Monitoring:**
- Telegram alerts to ops chat (daily backup status, monthly restore tests)
- Alert endpoint: `apps/admin/server/api/telegram/notify-alert.post.ts`

**Database Backups:**
- WAL-G continuous archiving → Timeweb S3 `twS3:fastio-backups/wal-g/` (RPO ~60s)
- Daily pg_dump → S3 `twS3:fastio-backups` at 19:00 UTC (RPO 24h)
- Weekly WAL-G basebackup (Sunday 20:00 UTC)
- Monthly automated restore tests with Telegram alerts
- Scripts on VPS: `/usr/local/bin/fastio-backup.sh`, `/usr/local/bin/fastio-restore-pitr.sh`

## CI/CD & Deployment

**Hosting:**
- Coolify v4 (self-hosted PaaS) on VPS 109.71.242.205 (Timeweb Cloud)
- Auto-deploy on `git push origin main` for Nuxt apps
- SSL: Traefik with wildcard cert `*.fastio.ru` via Timeweb DNS-01 ACME

**DNS:**
- Provider: Timeweb
- `admin.fastio.ru`, `fastio.ru`, `backoffice.fastio.ru`, `help.fastio.ru` → VPS
- `*.fastio.ru` → VPS (wildcard for tenant storefronts)
- `cdn.fastio.ru` → Timeweb CDN CNAME

**Edge Functions:**
- NOT auto-deployed via git push
- Manual deploy: rsync to Coolify volumes + Docker restart of `supabase-edge-runtime` container

**CI Pipeline:**
- Not detected (no GitHub Actions / GitLab CI files found)

## Webhooks & Callbacks

**Incoming:**
- `POST /api/telegram/webhook` — Telegram Bot API (tenant bot messages/callbacks)
- `POST /api/telegram/auth-webhook` — Telegram Auth Bot (storefront customer login)
- `POST /payment-webhook` (Edge Function) — YooKassa payment events (disabled, kill-switch)

**Outgoing:**
- Telegram Bot API — order/reservation/appointment/alert notifications
- DaData API — address autocomplete requests (proxied server-side)
- OpenAI API — AI assistant streaming responses
- Coolify API — tenant custom domain registration
- Google Fonts CDN — font loading (browser-side)
- Yandex Maps API — map rendering (browser-side)

## Environment Configuration

**Admin app required env vars:**
- `NUXT_PUBLIC_SUPABASE_URL` — Supabase API URL
- `NUXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key
- `NUXT_SUPABASE_SERVICE_ROLE_KEY` — Supabase service role (server-side)
- `NUXT_OPENAI_API_KEY` — OpenAI API key
- `NUXT_TELEGRAM_TENANT_BOT_TOKEN` — Telegram bot token
- `NUXT_TELEGRAM_CLIENT_BOT_TOKEN` — Telegram client bot token
- `NUXT_TELEGRAM_OPS_BOT_TOKEN` — Telegram ops bot
- `NUXT_TELEGRAM_WEBHOOK_SECRET` — Telegram webhook secret
- `NUXT_TELEGRAM_ALERT_CHAT_ID` — Telegram ops alert chat
- `NUXT_TELEGRAM_PROXY_URL` — HTTP proxy for Telegram (optional, RKN bypass)
- `NUXT_DADATA_API_KEY` — DaData address API
- `NUXT_PUBLIC_YANDEX_MAPS_API_KEY` — Yandex Maps
- `NUXT_PUBLIC_SENTRY_DSN` — Sentry DSN (optional, disables Sentry if empty)
- `NUXT_INTERNAL_API_SECRET` — server-to-server internal token
- `NUXT_ADMIN_URL` — public admin URL (for email links)
- `NUXT_REMINDER_CRON_SECRET` — cron job auth secret

**Storefront app required env vars:**
- `NUXT_PUBLIC_SUPABASE_URL`, `NUXT_PUBLIC_SUPABASE_ANON_KEY`
- `NUXT_SUPABASE_SERVICE_ROLE_KEY`
- `NUXT_DADATA_API_KEY`
- `NUXT_TELEGRAM_CLIENT_BOT_TOKEN`, `NUXT_TELEGRAM_PROXY_URL`
- `NUXT_PUBLIC_YANDEX_MAPS_API_KEY`
- `NUXT_PUBLIC_TELEGRAM_CLIENT_BOT_USERNAME`
- `NUXT_PUBLIC_SENTRY_DSN`

**Secrets location:**
- `.env.local` — local development (not committed)
- Coolify environment variable UI — production per-app env vars
- Supabase service secrets (for Edge Functions) — via `supabase secrets set`

---

*Integration audit: 2026-05-20*
