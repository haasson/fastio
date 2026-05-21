# Phase 2: Observability - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the discussion.

**Date:** 2026-05-21
**Phase:** 02-observability
**Mode:** discuss (default)
**Areas discussed:** Tenant tag в ошибках, GlitchTip → Telegram, Source maps upload, GlitchTip стек в Coolify

---

## Areas Discussed

### Tenant tag в ошибках

**Question:** Где задавать tenant slug как Sentry-тег для серверных ошибок?

| Option | Description |
|--------|-------------|
| Nitro middleware ✓ | `tenant.ts` уже резолвит slug — один `Sentry.setTag()` тегирует все серверные ошибки |
| Только в тесте | Тег только в тестовом роуте, не в runtime |

**User choice:** Nitro middleware
**Rationale:** Автоматически покрывает все серверные ошибки без scatter-кода по каждому catch-блоку.

---

### GlitchTip → Telegram

**Question:** Как GlitchTip должен алертить Telegram?

| Option | Description |
|--------|-------------|
| GlitchTip webhook → Telegram напрямую ✓ | Native GlitchTip Telegram integration, нулевой код |
| GlitchTip webhook → Nitro endpoint | Полный контроль формата, нужно писать endpoint |

**User choice:** Прямой вебхук (native integration)
**Rationale:** Нулевой код, только конфиг в GlitchTip UI. Существующий `notify-alert.post.ts` остаётся без изменений.

---

### Source maps upload

**Question:** Как добавить `--import` флаг и source maps?

| Option | Description |
|--------|-------------|
| @sentry/nuxt autoInstrument + autoUploadSourceMaps ✓ | Module-level config, --import добавляется автоматически, maps при билде |
| Coolify start override + manual sentry-cli | Ручное управление, больше конфига |

**User choice:** `@sentry/nuxt` autoInstrument + autoUploadSourceMaps
**Rationale:** Меньше ручного конфига. `SENTRY_AUTH_TOKEN` в Coolify env.

---

### GlitchTip стек в Coolify

**Question:** Какой стек GlitchTip в Coolify?

| Option | Description |
|--------|-------------|
| docker-compose: web + worker + postgres + redis ✓ | Официальный рекомендуемый стек, изолированная Postgres |
| All-in-one контейнер + отдельный Postgres | Проще setup, worker не масштабируется |

**User choice:** docker-compose полный стек
**Rationale:** Официальный путь. Своя Postgres, изолирована от Supabase.

---

## Codebase Findings (не задавались вопросы — уже решено)

- `@sentry/nuxt` уже установлен, конфиги существуют — нет новых пакетов
- Все Realtime composables (`useRealtimeList`, `useRealtimeWatch`, `useTableRealtime`) уже имеют `removeChannel()` в `onUnmounted`
- Telegram ops bot инфраструктура (`NUXT_TELEGRAM_OPS_BOT_TOKEN`, `NUXT_TELEGRAM_ALERT_CHAT_ID`) уже работает
- `notify-alert.post.ts` — threshold-based, не конкурирует с GlitchTip per-error alerts

## Deferred

- Uptime monitoring (OBS-v2-02) — явно v2
- Log aggregation (OBS-v2-01) — явно v2
