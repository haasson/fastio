# FastIO Backlog — что осталось после pre-prod

> **Назначение:** единый источник правды о том, что НЕ закрыто. Заменяет
> огромные `docs/plans/2026-05-17-pre-prod/stage-*.md` (можно архивировать).
> **Pre-prod план закрыт на ~95%.** Здесь — оставшиеся 5% и long-term направления.

**Обновлён:** 2026-05-20

---

## 🔴 P0 — делать до первого платного клиента

Эти задачи дают реальный production-bear гарантий поверх текущей защиты.

### B1 — `RELAY_SECRET` deployment (1 час)

PREPROD-212 закрыт в коде. Осталось **руками** настроить env-переменные:

```bash
# 1. Сгенерить секрет
openssl rand -hex 32
# (например: a7c3e5f4b2d1...)

# 2. Vercel relay project (для tg-webhook-relay)
# https://vercel.com/<your-team>/tg-webhook-relay/settings/environment-variables
RELAY_SECRET=a7c3e5f4b2d1...

# 3. Coolify admin env
# https://coolify.fastio.ru → admin project → env
NUXT_RELAY_SECRET=a7c3e5f4b2d1...

# 4. Redeploy admin + relay
# 5. Проверить: tg-login через бота отрабатывает (на проде relay-secret теперь требуется)
```

**Если не сделать:** Telegram-webhook'и через relay будут 500'иться → tg-login для тенантов сломается.

### B2 — `pending_domains` миграция вместо advisory lock в `add-custom-domain`

TECHDEBT.md → WR-05. Сейчас advisory_xact_lock отпускается через секунды после
RPC-вызова, между ним и Coolify GET/PATCH остаётся 1% race-окно (compensation
rollback из PREPROD-119 закрывает большую часть, но не 100%).

**Триггер:** когда compensation rollback в Sentry начнёт срабатывать >0.1% от
попыток в течение 30 дней — приоритезировать. Сейчас вероятность race ~нулевая.

**Effort:** S — `CREATE TABLE pending_domains (fqdn text PRIMARY KEY, tenant_id uuid, attempted_at timestamptz)` + INSERT перед Coolify-flow + DELETE/UPDATE по результату + cleanup cron на stale rows > 5 мин.

### B3 — Финальный шаг GOTRUE_DISABLE_SIGNUP

TECHDEBT.md → после PREPROD-099 (storefront tg-only auth) код готов: invite-flow для admin, storefront только через TG. Осталось **выставить env** `GOTRUE_DISABLE_SIGNUP=true` в Coolify admin/storefront чтобы Supabase Auth не позволял signup'ы из обхода (например через прямой API call).

**Effort:** XS — одна env-переменная + redeploy. Закрывает security-vector.

---

## 🟡 P1 — следующая 1-2 недели (M-effort, можно одной волной)

### B4 — PREPROD-222: дедупликация SMTP/HTML в edge-функциях (M)

Файлы: `supabase/functions/{send-new-tenant-email, send-recovery-email, invite-member}/`. Вынести SMTP-helper, HTML-escape, safe-admin-url в общий `supabase/functions/_shared/email.ts`.

**Зачем:** один баг в SMTP-обработке проявится в трёх местах. Сейчас уже дважды правили issues в каждой отдельно.

### B5 — PREPROD-231: `monitor_edge_errors` + pg_net partitions (S)

Проверить как pg_net хранит response (есть ли partition'ирование). Если есть — `monitor_edge_errors` query через `pg_partman` или UNION ALL. Сейчас query может молча игнорировать старые partitions.

**Триггер:** проверить ASAP — если edge-functions ошибки маскируются от мониторинга, инциденты обнаружим только по жалобам юзеров.

### B6 — Codegen types follow-up (M)

После PREPROD-246 (codegen Supabase types) осталось 50 `as unknown as Row` (было 64). Дальнейшее уменьшение требует протянуть `SupabaseClient<Database>` через 45 api/\*.ts файлов. Делается итеративно — при каждом касании api-файла подменять generic.

**Делать:** инкрементально, не отдельной волной. По мере касания.

### B7 — Codemap описания для не-описанных файлов

При работе codemap-precommit-hook требует `purpose` для новых файлов. Накопится через несколько коммитов. Раз в месяц прогнать `pnpm codemap:scan --all` + дозаполнить null'ы — поддерживает discoverability.

**Effort:** XS-S разово.

---

## 🟡 P1 — Frontend polish (по мере касания)

### B8 — PREPROD-240: декомпозиция больших компонентов (L)

Файлы > 500 строк, кандидаты:
- `apps/admin/features/menu/components/DishPickerModal.vue` (771)
- `apps/admin/features/tables/components/TablesCanvas.vue` (734)
- `apps/admin/features/appointments/components/TemplateDrawer.vue` (696)
- `apps/admin/features/orders/components/OrderFormFields.vue` (648)
- `apps/admin/features/appointments/components/AppointmentTimelineGrid.vue` (622)
- `apps/admin/features/appointments/components/StaffScheduleModal.vue` (575)
- `apps/admin/shared/ui/components/RichTextEditor.vue` (580)
- `apps/admin/layouts/default.vue` (542 — стили в scss-файл)

**Подход:** **НЕ батчем.** Декомпозить только при касании по другой причине
(новая фича, фикс бага). Тогда профит реальный и риск низкий.

### B9 — PREPROD-241: hardcoded color/padding (39 мест)

Большинство в preview-компонентах (намеренно — имитирует storefront-стили, не использует токены админки). Несколько мест в `DeliveryZoneMap.vue` — там можно заменить на токены.

**Подход:** при касании этих файлов. Не отдельной волной.

### B10 — `branches` как plan-capability вместо ручного тогла (M, billing/gating)

Найдено в тестинге 3.16 (2026-06-12). Сейчас `branches` — ручной тогл в `/settings/modules`, как combos/delivery. Это даёт две проблемы:
- **Ловушка:** выключение при 2+ филиалах оставляет живые филиалы на витрине (`storefront/server/api/branches.get.ts` игнорирует `modules.branches`), а управление в админке пропадает → неуправляемый продающий филиал.
- **Бессмысленность:** `branches` по природе — capability Pro-плана (`useBranchLimit.ts:11`: `branches ? безлимит : 1`), а не «фича по настроению».

**Решение (юзер, 2026-06-12):** убрать ручной тогл, `branches` управляется **чисто планом** (Pro = вкл, start = locked).

**Объём (не тривиально — billing-рефактор):**
1. Убрать `branches` из тогл-UI `pages/settings/modules.vue`.
2. `billing_change_plan` RPC: сейчас даунгрейд блокируется conflict-check'ом, требуя ручного выключения pro-модулей (`migrations/165,319`). Без тогла branches → **дедлок даунгрейда**. Нужно: исключить branches из conflict-листа + авто-гасить при даунгрейде.
3. Over-limit филиалы при даунгрейде Pro→start (лимит 1, а филиалов 2): авто-архив лишних или блок «заархивируй лишние».
4. Авто-включение `branches:true` при апгрейде на Pro (сейчас модули не выводятся из плана автоматически).
5. Витрина: решить, должна ли она схлопываться в один филиал при single-branch плане (или это ок как есть).
6. Миграция данных: существующие Pro-тенанты с `branches:false` → `true`.

Отдельный дизайн-док перед реализацией.

---

## 🔵 P2 — Архитектура (long-term, отдельные программы)

Stage-3 архитектура из `docs/plans/2026-05-17-pre-prod/stage-3-architecture.md`. Каждая — отдельный проект на недели-месяц. **Сейчас не нужны.**

### ARCH-A1 — Multi-AZ HA на Timeweb Cloud (XL)

Trigger: 50+ активных тенантов / SLA 99.95% становится contractual.

### ARCH-A2 — TanStack Query вместо `useDatabase()` агрегатора (L)

Trigger: cache-invalidation logic становится сложной (3+ места требуют ручного `invalidate`).

### ARCH-A4 — Edge Functions → Nitro server routes (M)

Trigger: первая фича где нужна shared TS-логика между Nitro и Edge (сейчас Deno vs Node — копи-паста). Storage-policy / email-templates кандидаты.

### ARCH-A5 — `SET LOCAL app.tenant_id` GUC pattern (RLS perf) (L)

Trigger: при 100+ активных тенантах RLS на каждый запрос начнёт сказываться на p99. Сейчас не нужно.

### ARCH-A6 — Bundle splitting / Lazy routes — ✅ done (PREPROD-280)

### ARCH-A7 — Observability stack (M)

PREPROD-281 deferred (отложено по решению). Sentry Performance + Grafana Free + Checkly synthetic. Триггер: первый платный клиент с SLA.

### ARCH-A8 — AI prompt caching + опц. gateway (S)

Если AI-assistant фича взлетит и расходы на API заметны → cache prompts, batch evaluation.

---

## ⏸ Deferred (отложено с триггером)

| ID | Что | Триггер возврата |
|---|---|---|
| **PREPROD-022** | Squash миграций | won't-fix — multi-statement DO ломает supabase migration squash. Профит ~30-60 сек в CI |
| **PREPROD-023** | Offsite backup (S3-bucket в другом провайдере) | первый платный тенант / 5+ активных / инцидент с восстановлением |
| **PREPROD-132** | `payment_type='online'` cleanup | подключение реальной онлайн-оплаты (ЮKassa / etc) |
| **PREPROD-142** | k6 нагрузочный тест Realtime | 20-30 активных тенантов (тогда замер даст реальный baseline) |
| **PREPROD-281** | Checkly synthetic checks | после первых платных клиентов с SLA |
| **WR-01** | auto-promo bookkeeping в `update_order_with_items` для админских edit | edge-case, фикс при следующем касании RPC |
| **Docker cleanup filter** | 72h → 168h (weekly) | стабилизация релизного цикла (раз в неделю-две, не 10 раз в день) |
| **Restore-test cron** | weekly → monthly | После нескольких месяцев без инцидентов с backup-цепочкой |

---

## ❌ Won't fix (не делать, не предлагать заново)

| ID | Почему |
|---|---|
| **PREPROD-100, 101** | После PREPROD-099 storefront-register удалён → не релевантно |
| **PREPROD-265, 267** | Storefront email-auth удалён, валидация и sync не нужны |
| **PREPROD-282, 283, 284** | Codemap tooling — не критично, поддерживается через hook'и |

---

## 📚 Связанные документы

- `docs/disaster-recovery.md` — что делать если БД дропнули (PITR + logical restore + storage)
- `docs/secrets-rotation.md` — runbook ротации Vault/Coolify/edge/GitHub secrets
- `docs/coolify-migration-handoff.md` — состояние Coolify-миграции
- `TECHDEBT.md` (memory) — детальные технические долги с контекстом

---

## 📦 Архивирование больших pre-prod планов

После создания этого документа `docs/plans/2026-05-17-pre-prod/{README,stage-0,stage-1,stage-2,stage-3}.md` можно архивировать или удалить — всё актуальное теперь здесь.

Не делать прямо сейчас — там осталась полезная история решений. Раз в полгода
проверять и постепенно дропать устаревшее.
