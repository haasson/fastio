---
focus: tech
mapped: 2026-05-10
---

# External Integrations

## Databases

### Supabase (PostgreSQL 17)
- **Client library:** `@supabase/supabase-js` `^2.98.0` in all apps; `@supabase/ssr` `^0.8.0` in storefront for cookie-based SSR auth
- **Local dev:** Docker-based via `supabase start` (port 54322 for DB, 54321 for API)
- **Remote project ref:** `fnfutanbnabaguylimvq` (referenced in `.github/workflows/migrate.yml`)
- **Connection approach:**
  - Admin app (`apps/admin`): anon key on the client side (RLS enforced); service-role key used in Nitro server routes (`apps/admin/server/utils/supabase.ts`)
  - Storefront (`apps/storefront`): service-role key for server-side rendering (`apps/storefront/server/utils/supabase.ts`); SSR-aware client via `@supabase/ssr` for auth-gated routes
  - Edge Functions: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` injected by Supabase runtime
- **Schema migrations:** 261 sequential SQL files in `supabase/migrations/`, applied via `supabase db push`
- **Realtime:** Supabase Realtime channels used extensively in admin for live updates (orders, reservations, kitchen queue, table calls) — composable-per-feature pattern in `apps/admin/composables/retail/*Channel.ts`
- **Row Level Security:** enabled on all tables; tenant isolation enforced by `is_tenant_member()` and similar PL/pgSQL helpers
- **Stored Procedures (RPC):** multiple domain RPCs — `get_best_promotion`, `check_promo_code`, `get_free_item_promotion`, `create_visit_request`, `create_appointments_bulk`, `billing_change_plan`, `self_register_tenant`, `get_user_id_by_email`, `check_unavailability`

### Supabase Storage
- **Buckets used:**
  - `dish-images` — dish/category/combo/service cover images (WebP)
  - `tenant-assets` — logos, banners, gallery photos, theme assets (WebP/PNG)
  - `documents` — PDF documents (e.g. legal docs)
  - `support-attachments` — support ticket image attachments (WebP)
- **Access:** via `sb.storage.from('<bucket>').upload()` / `.getPublicUrl()` in `apps/admin/utils/api/`

### Supabase Vault
- Stores sensitive runtime secrets for pg_cron jobs: `appointment_reminder_url`, `reminder_cron_secret`, `telegram_notify_url` (referenced in `supabase/migrations/113_telegram_notifications.sql`, `supabase/migrations/260_appointment_reminders_cron.sql`)

## Auth Providers

### Supabase Auth (email/password)
- **Admin app:** standard email + password sign-in via `sb.auth.signInWithPassword()` — `apps/admin/utils/api/auth.ts`
- **Password recovery:** custom flow — `send-recovery-email` Edge Function generates a magic link via Supabase Admin API and sends it via SMTP, bypassing Supabase's own email delivery
- **Team invitations:** `invite-member` Edge Function creates a Supabase auth user and sends invite email via SMTP

### Telegram Auth (storefront customers)
- **Flow:** Telegram Login Widget → `apps/storefront/server/api/auth/telegram/login.post.ts` verifies HMAC-SHA256 signature, finds/creates customer in `customers` table, issues a custom session token stored as a cookie
- **Bot token config:** `NUXT_TELEGRAM_AUTH_BOT_TOKEN` — shared between admin (webhook handler) and storefront
- **Session polling:** `apps/storefront/server/api/auth/telegram/poll.get.ts` for web-based auth flow
- **Rate limiting:** 10 attempts/minute per IP using `createRateLimiter` from `@fastio/shared`
- **Webhook registration:** admin app registers bot webhook on startup; handler in `apps/admin/server/api/telegram/auth-webhook.post.ts`

### Custom Cookie Sessions (storefront customers)
- Token-hash stored in `customer_sessions` table; resolved server-side on every request in `apps/storefront/server/utils/customerAuth.ts`
- TTL: 30 days

## External APIs

### OpenAI (GPT-4.1-nano)
- **SDK:** `@ai-sdk/openai` `^3.0.52` + Vercel AI SDK `ai` `^6.0.141`
- **Used in:** `apps/admin/server/api/ai/chat.post.ts` — streaming AI assistant for admin users
- **Model:** `gpt-4.1-nano`
- **Pattern:** `streamText()` with tool use (`stepCountIs(3)` limit), max 1024 output tokens
- **Tools:** `createSupportTicket` (creates support ticket in DB) — defined in `apps/admin/server/ai/tools.ts`
- **Knowledge:** loaded from Nitro fs-storage (`server/ai/knowledge/`) and tenant DB context
- **Config key:** `NUXT_OPENAI_API_KEY` (server-only)

### Telegram Bot API
- **Two bots:**
  1. **Notifications bot** (`NUXT_TELEGRAM_BOT_TOKEN`) — sends order/reservation notifications to restaurant operator's Telegram group/thread; handler in `apps/admin/server/api/telegram/notify.post.ts` and `notify-reservation.post.ts`
  2. **Auth bot** (`NUXT_TELEGRAM_AUTH_BOT_TOKEN`) — handles customer login via Telegram Login Widget; sends appointment reminders to customers
- **Appointment reminders:** `apps/admin/server/api/telegram/send-appointment-reminders.post.ts` — called by pg_cron every minute
- **Direct API calls:** `fetch('https://api.telegram.org/bot{token}/sendMessage', ...)` — no Telegram SDK, raw HTTP
- **Trigger mechanism (orders/reservations):** PostgreSQL trigger → `pg_net.http_post()` → admin Nitro endpoint (URL stored in Supabase Vault)

### DaData (address autocomplete)
- **Used for:** Russian address suggestions in admin (branch/delivery zone setup) and storefront (delivery address input)
- **Admin:** `apps/admin/server/api/dadata/suggest.post.ts` — proxies to `https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address` with geo-filter based on tenant's branch coordinates
- **Storefront/Edge Function:** `supabase/functions/dadata-suggest/index.ts` — standalone Edge Function proxy
- **Config key:** `NUXT_DADATA_API_KEY` / `DADATA_API_KEY`

### Yandex Maps
- **SDK:** `vue-yandex-maps` `^3.0.3` in admin and storefront
- **Used for:** displaying maps in admin (delivery zone editor, branch address) and storefront (address selection for delivery)
- **Config key:** `NUXT_PUBLIC_YANDEX_MAPS_API_KEY`

### Vercel Domains API
- **Used for:** custom domain management — tenant owners can add their own domain
- **Called from:** `supabase/functions/add-custom-domain/index.ts`
- **Endpoint:** `https://api.vercel.com/v10/projects/{VERCEL_PROJECT_ID}/domains`
- **Config:** `VERCEL_TOKEN` + `VERCEL_PROJECT_ID` as Edge Function secrets

### SendGrid
- **Used for:** transactional email — new order notification to restaurant
- **Called from:** `supabase/functions/send-order-email/index.ts`
- **Endpoint:** `https://api.sendgrid.com/v3/mail/send`
- **Config:** `SENDGRID_KEY` as Edge Function secret
- **From address:** `noreply@fastio.ru`

## Webhooks & Events

### Inbound Webhooks

| Webhook | File | Source | Purpose |
|---|---|---|---|
| YooKassa payment | `supabase/functions/payment-webhook/index.ts` | YooKassa | Handles `payment.succeeded` events; verifies HMAC-SHA256 signature via `Content-Signature` header |
| Telegram bot (auth) | `apps/admin/server/api/telegram/auth-webhook.post.ts` | Telegram | Processes `/start` deep-link commands for Telegram group linking |
| Telegram bot (general) | `apps/admin/server/api/telegram/webhook.post.ts` | Telegram | Handles bot interactions (start links, group linking) |

### Outbound Webhooks / Triggers

| Event | Mechanism | Destination |
|---|---|---|
| New order created | PostgreSQL trigger (`notify_new_order_telegram`) → `pg_net.http_post()` | Admin Nitro: `/api/telegram/notify` |
| New reservation created | PostgreSQL trigger → `pg_net.http_post()` | Admin Nitro: `/api/telegram/notify-reservation` |
| Appointment reminder due | `pg_cron` every minute → `net.http_post()` (URL from Vault) | Admin Nitro: `/api/telegram/send-appointment-reminders` |
| Reservations auto-complete | `pg_cron` every 30 min | Direct SQL UPDATE in `supabase/migrations/088_reservations_cron.sql` |
| Appointments auto-complete | `pg_cron` (defined in `supabase/migrations/215_appointments_auto_complete_grace_and_log.sql`) | Direct SQL UPDATE |
| Billing plan check | `pg_cron` (defined in `supabase/migrations/068_billing_cron.sql`) | Direct SQL |
| Support ticket auto-close | `pg_cron` (defined in `supabase/migrations/118_support_auto_close.sql`) | Direct SQL |

### Database Webhooks (Supabase → Edge Functions)
- `send-order-email`: triggered on INSERT into `orders` table (configured in Supabase Dashboard → Database → Webhooks)

### Supabase Realtime Channels (Admin → Browser Push)
- Orders channel, reservations channel, kitchen queue channel, table calls channel — managed in `apps/admin/composables/retail/*Channel.ts`

## Infrastructure

### Hosting
- **All apps deployed to Vercel** (region `fra1` — Frankfurt):
  - `apps/admin/vercel.json` — framework: nuxtjs, SPA output
  - `apps/storefront/vercel.json` — framework: nuxtjs, SSR `.output`
  - `apps/backoffice/vercel.json` — framework: nuxtjs, static `.output/public`
- **Custom domain support:** tenants can connect custom domains via Vercel Domains API (managed by `supabase/functions/add-custom-domain/`)

### Supabase Cloud
- **Project:** `fnfutanbnabaguylimvq` (Supabase hosted)
- **Services used:** PostgreSQL 17, Auth, Realtime, Storage, Edge Functions (Deno 2), pg_cron, pg_net, Vault
- **Analytics backend:** postgres (configured in `supabase/config.toml`)

### Email (SMTP)
- **Provider:** `smtp.timeweb.ru` (port 465, SSL) — default SMTP host in Edge Functions
- **Used in:** `supabase/functions/send-recovery-email/index.ts`, `supabase/functions/send-new-tenant-email/index.ts`, `supabase/functions/invite-member/index.ts`
- **Config:** `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` as Edge Function secrets
- **Fallback for orders:** SendGrid (`supabase/functions/send-order-email/index.ts`)

### Storage (Supabase Storage / S3-compatible)
- Supabase Storage with S3 protocol enabled (`config.toml` `[storage.s3_protocol]`)
- Max file size: 50 MiB
- Buckets: `dish-images`, `tenant-assets`, `documents`, `support-attachments`

### Error Monitoring (Sentry)
- **Admin:** DSN `https://a14669ef...@o4511110689980416.ingest.de.sentry.io/4511110706561104` — configured in `apps/admin/sentry.client.config.ts`
- **Storefront:** DSN `https://18e41139...@o4511110689980416.ingest.de.sentry.io/4511110692405328` — configured in `apps/storefront/sentry.client.config.ts`
- Both use `@sentry/nuxt` `^10.47.0`, production-only (`!import.meta.dev`), `tracesSampleRate: 1.0`

### Image Proxy
- `supabase/functions/proxy-image/index.ts` — SSRF-protected image proxy; validates `https://` only, blocks private IP ranges, 10 MB limit, 10s timeout
