# Phase 2: Observability - Context

**Gathered:** 2026-05-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Ошибки и сбои в production немедленно видны команде без ручного рытья в логах.

Scope: OBS-01 (GlitchTip + @sentry/nuxt), OBS-02 (Telegram алерты через GlitchTip native integration), REL-01 (аудит Realtime channel cleanup).
E2E тесты, performance, operational features — отдельные фазы.

</domain>

<decisions>
## Implementation Decisions

### OBS-01 — GlitchTip & Sentry SDK

- **D-01:** Tenant context: `Sentry.setTag('tenant', tenant.slug)` добавляется в `apps/storefront/server/middleware/tenant.ts` после успешного resolve тенанта. Автоматически тегирует все серверные ошибки без доп. кода в каждом catch-блоке.
- **D-02:** `--import` флаг и source maps: используем `@sentry/nuxt` module-level опции в `nuxt.config.ts` — `autoInstrument` (добавляет `--import` в prod start-команду через Node.js loader) + `autoUploadSourceMaps: true` (заливает source maps в GlitchTip при каждом билде). `SENTRY_AUTH_TOKEN` — в Coolify env для admin и storefront.
- **D-03:** Sentry SDK уже установлен (`@sentry/nuxt` ^10.47.0), конфиги `sentry.server.config.ts` и `sentry.client.config.ts` существуют в admin и storefront. DSN env var: `NUXT_PUBLIC_SENTRY_DSN`. Только добавить DSN от GlitchTip и module options.

### OBS-02 — Telegram алерты

- **D-04:** GlitchTip → Telegram: используем native GlitchTip Telegram integration (webhook в GlitchTip UI). Нулевой код. GlitchTip сам форматирует и шлёт сообщение при каждой новой issue. Конфиг: Project Settings → Alerts → Telegram в GlitchTip UI.
- **D-05:** Существующий `notify-alert.post.ts` (threshold-based, Edge Function мониторинг) остаётся без изменений — другой purpose. GlitchTip integration работает параллельно и независимо.

### GlitchTip deployment (Coolify)

- **D-06:** Стек: docker-compose с отдельными контейнерами: `web`, `worker`, `postgres`, `redis`. Официальный рекомендуемый стек из GlitchTip docs. Своя Postgres БД — изолирована от Supabase (не шарим).
- **D-07:** Размещение: Coolify, тот же VPS (109.71.242.205). Домен: `errors.fastio.ru` (или `glitchtip.fastio.ru`). Open registration: отключить после создания admin-аккаунта.

### REL-01 — Realtime channel cleanup

- **D-08:** Все существующие realtime composables уже имеют cleanup: `useRealtimeList`, `useRealtimeWatch` (`api.realtime.removeChannel()` в `onUnmounted`), `useTableRealtime` (`supabase.removeChannel()` в `onUnmounted`). `createRealtimeBus` делегирует `useRealtimeWatch` — cleanup транзитивен.
- **D-09:** Аудит-метод: grep по всему codebase на `.channel(` — проверить, что каждый вызов либо в centralized utils (useRealtimeList/Watch/createRealtimeBus/realtime.ts), либо сопровождается `removeChannel` в том же файле. Acceptance criteria: `grep -rn "\.channel(" apps/ | grep -v "removeChannel\|useRealtimeList\|useRealtimeWatch\|createRealtimeBus\|realtime.ts\|.output\|.nuxt"` возвращает пустой вывод.

### Claude's Discretion

- GlitchTip версия (latest stable из official image)
- Rate в `sentry.server.config.ts` — оставить `0.01` (1%)
- Exact docker-compose.yml values (ports, volumes, SECRET_KEY generation)
- GlitchTip project naming scheme

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Sentry SDK — существующая конфигурация
- `apps/storefront/sentry.server.config.ts` — текущий server Sentry init (добавляем tenant tag)
- `apps/storefront/sentry.client.config.ts` — текущий client Sentry init
- `apps/storefront/nuxt.config.ts` — Sentry module config (добавляем `autoInstrument` + `autoUploadSourceMaps`)
- `apps/admin/sentry.server.config.ts` — аналогичный server config для admin
- `apps/admin/nuxt.config.ts` — аналогичный module config для admin
- `packages/shared/src/observability/reportError.ts` — unified `reportError()` через `captureException`

### Tenant middleware (место для D-01)
- `apps/storefront/server/middleware/tenant.ts` — tenant resolution, место для `Sentry.setTag('tenant', ...)`

### Realtime cleanup (REL-01 аудит)
- `apps/admin/shared/data/useRealtimeList.ts` — centralized realtime, cleanup через `onUnmounted`
- `apps/admin/shared/data/useRealtimeWatch.ts` — single-record realtime, cleanup через `onUnmounted`
- `apps/storefront/features/table-mode/composables/useTableRealtime.ts` — прямой channel, cleanup через `onUnmounted`
- `apps/admin/shared/data/api/realtime.ts` — low-level Supabase channel wrapper

### Requirements
- `.planning/REQUIREMENTS.md` §Observability (OBS-01, OBS-02) и §Reliability (REL-01) — acceptance criteria

### Telegram инфраструктура (для понимания существующего)
- `apps/admin/server/api/telegram/notify-alert.post.ts` — существующий threshold-based алерт (НЕ изменяется)
- `.planning/codebase/INTEGRATIONS.md` §Telegram Bot API — env vars: `NUXT_TELEGRAM_OPS_BOT_TOKEN`, `NUXT_TELEGRAM_ALERT_CHAT_ID`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@sentry/nuxt` ^10.47.0 уже установлен в admin и storefront — нет новых npm пакетов
- `sentry.server.config.ts` и `sentry.client.config.ts` уже существуют — только добавить tenant tag в server config
- Telegram ops bot инфраструктура (`NUXT_TELEGRAM_OPS_BOT_TOKEN`, `NUXT_TELEGRAM_ALERT_CHAT_ID`) уже работает

### Established Patterns
- Sentry init: conditional на `!import.meta.dev && dsn` — отключается локально без DSN (безопасно)
- DSN загружается из `NUXT_PUBLIC_SENTRY_DSN` (storefront) или `NUXT_PUBLIC_SENTRY_DSN` / `SENTRY_DSN` (admin server)
- `reportError(error, context?)` — uniformly through `@sentry/nuxt` `captureException` — не менять

### Integration Points
- GlitchTip DSN → `NUXT_PUBLIC_SENTRY_DSN` в Coolify env для admin и storefront (два отдельных проекта в GlitchTip или один — на усмотрение)
- `SENTRY_AUTH_TOKEN` → новый env var в Coolify для source map upload при билде
- `errors.fastio.ru` → новый DNS-запись, Coolify wildcard cert уже покрывает `*.fastio.ru`

</code_context>

<specifics>
## Specific Ideas

- STATE.md Known Risk: "Sentry `--import` flag in Nitro start command is mandatory — without it, zero server-side errors are captured in GlitchTip" → решается через `@sentry/nuxt` autoInstrument (D-02)
- Acceptance criterion 1: ошибка появляется в GlitchTip ≤60 сек — нужен `--import` флаг (иначе серверный Sentry не инициализируется)
- Acceptance criterion 2: Telegram ≤5 мин — GlitchTip native Telegram webhook (D-04)
- Acceptance criterion 3: grep audit returns zero violations — формула grep из D-09

</specifics>

<deferred>
## Deferred Ideas

- Uptime monitoring (OBS-v2-02: Uptime Kuma) — v2 requirement, явно отложено
- Log aggregation (OBS-v2-01: Grafana + Loki) — v2 requirement
- Отдельные GlitchTip проекты для admin vs storefront vs edge functions — можно добавить позже

</deferred>

---

*Phase: 02-observability*
*Context gathered: 2026-05-21*
