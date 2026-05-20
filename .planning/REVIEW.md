---
phase: PREPROD-019
reviewed: 2026-05-20T00:48:28Z
depth: deep
files_reviewed: 3
files_reviewed_list:
  - supabase/migrations/299_telegram_notify_appointments_and_calls.sql
  - apps/admin/server/api/telegram/notify-appointment-group.post.ts
  - apps/admin/server/api/telegram/notify-table-call.post.ts
findings:
  blocker: 1
  warning: 4
  info: 5
  total: 10
status: issues_found
---

# PREPROD-019: Code Review Report

**Reviewed:** 2026-05-20T00:48:28Z
**Depth:** deep
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Реализация в основном корректна и следует существующему паттерну (миграции 113/263/265 + notify-reservation.post.ts). SQL-триггеры написаны грамотно, vault-fallback логика идентична reference-миграции 265, security-обёртка через `requireInternalSecret` на месте, escapeHtml применён к user-controlled полям, cross-tenant guard через `.eq('tenant_id', tenantId)` присутствует, PII в логах не утекает.

**Однако обнаружен 1 BLOCKER:** endpoint `notify-appointment-group.post.ts` запрашивает колонки `total_price` и `total_duration_minutes` из `appointment_groups` — эти поля были **удалены миграцией 222** (`appointment_group_inbox`) и **никогда не возвращались**. PostgREST вернёт `column does not exist` ошибку → `data` будет `null` → endpoint silently завершится с `{ ok: true }` без отправки TG-уведомления. **Фича не будет работать ни для одной записи на услугу.**

Также найдено несколько warning-уровня замечаний по defense-in-depth и edge-cases.

---

## Critical Issues

### CR-01: Запрос несуществующих колонок `total_price` / `total_duration_minutes` ломает endpoint полностью

**File:** `apps/admin/server/api/telegram/notify-appointment-group.post.ts:36-42`

**Issue:** Endpoint select'ит из `appointment_groups`:

```ts
.select(`
  id, status,
  customer_name, customer_phone,
  notes, requested_services,
  total_price, total_duration_minutes,   // <-- НЕ СУЩЕСТВУЮТ
  created_at
`)
```

Эти колонки были **DROP'нуты в миграции 222** (`appointment_group_inbox`, строки 24-27):

```sql
ALTER TABLE appointment_groups
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS total_price,
  DROP COLUMN IF EXISTS total_duration_minutes;
```

Миграция 230 вернула только `status` (для гибрида request/active). `total_price` и `total_duration_minutes` **остались удалёнными**. Подтверждаю grep'ом: между 222 и 299 ни одна миграция не добавляет эти колонки обратно.

**Последствия:**
- PostgREST вернёт ошибку `column appointment_groups.total_price does not exist`
- `data` будет `null` → код пойдёт по `if (!group) return { ok: true }` (строка 51)
- `reportError(groupErr, ...)` залогирует, но это **не алертится** — обычная error-телеметрия
- Ни одно TG-уведомление о новой записи / заявке на услугу не отправится
- Услуги тенантам — обещание не сдержано, фича мертворождённая

**Fix:** Убрать несуществующие поля из select и из buildActiveText. Цена считается из суммы `service_price` слотов (snapshot есть в `appointments` начиная с миграции 217), продолжительность — из `ends_at - starts_at`:

```ts
.select(`
  id, status,
  customer_name, customer_phone,
  notes, requested_services,
  created_at
`)
```

Добавить snapshot `service_price` к select appointments:

```ts
.from('appointments')
.select(`
  starts_at, ends_at, service_name, service_price, status,
  resources ( name )
`)
```

Пересчитать итог в `buildActiveText`:

```ts
const total = slots.reduce((s, a) => s + (Number(a.service_price) || 0), 0)
if (total > 0) {
  text += `\n💰 Итого: ${formatRub(total)}\n`
}
```

Для request-ветки убрать упоминание total_price — там слотов нет, поле и так было undefined.

**Также:** добавить локальный smoke-test или хотя бы прогнать sql вручную:
```sql
SELECT total_price FROM appointment_groups LIMIT 1;
-- expected: ERROR: column "total_price" does not exist
```
— чтобы такой класс багов ловить до review.

---

## Warnings

### WR-01: Race-condition с status='cancelled' между триггером и handler'ом

**File:** `apps/admin/server/api/telegram/notify-appointment-group.post.ts:86-88`

**Issue:** Триггер `WHEN (NEW.status IN ('active', 'request'))` фильтрует на момент INSERT. Но pg_net отправляет HTTP **асинхронно** (worker раз в ~100мс). За это окно админ может cancel'нуть группу через UI. Endpoint увидит `status='cancelled'`:

```ts
const text = group.status === 'request'
  ? buildRequestText(group, tz)
  : buildActiveText(group, slots, tz)
```

Условие — `=== 'request'`, иначе buildActiveText. Для cancelled → пойдёт в `buildActiveText`. Slots будут пусты (все appointments отменены, `.neq('status', 'cancelled')` отфильтрует все), и текст будет 👤+📞+(без секции слотов)+notes. **Менеджер получит "Новая запись" про только что отменённую запись.**

Маловероятно (нужно успеть отменить за <200мс), но возможно при тестировании / e2e сценариях. Также возможно если RPC-обработчик отмены работает синхронно сразу после insert.

**Fix:** Добавить guard на cancelled:

```ts
if (!group) return { ok: true }
if (group.status === 'cancelled') return { ok: true }  // <-- добавить
```

---

### WR-02: `formatPhone()` возвращает raw input при невалидном телефоне → возможен HTML-injection через `customer_phone`

**File:** `apps/admin/server/api/telegram/notify-appointment-group.post.ts:125`

**Issue:**
```ts
text += `📞 ${formatPhone(group.customer_phone)}\n`
```

`formatPhone()` из `@fastio/shared/utils/phone.ts` при невалидном входе **возвращает исходную строку без изменений** (строка 14: `return phone`):

```ts
export const formatPhone = (phone: string): string => {
  const digits = normalizePhone(phone)
  if (digits.length === 11 && digits.startsWith('7')) {
    return `+7 (${digits.slice(1, 4)}) ...`
  }
  return phone  // <-- raw input, не escaped
}
```

Если по какой-то причине в `customer_phone` оказалась строка с HTML (формально база допускает любой `text`, фронт валидирует — но **defense-in-depth**): `formatPhone` пропустит её raw в текст с `parse_mode: 'HTML'` → телеграм отрендерит `<b>` / `<a>` либо вернёт 400 на сломанный HTML.

Существующий `notify-reservation.post.ts` имеет ту же проблему и для phone, и для `guest_name`, и для `comment` — pre-existing, но в задаче сказано «доверять». Наш файл уже улучшил большинство полей через escapeHtml; phone остался без.

**Fix:** Phone после `normalizePhone` всегда digits-only, поэтому надёжно — обернуть в escapeHtml финальный результат formatPhone:

```ts
text += `📞 ${escapeHtml(formatPhone(group.customer_phone))}\n`
```

Telegram-маркетинговую визуальную мимикрию формат не потеряет (там только `+`, `(`, `)`, ` `, `-`, цифры).

---

### WR-03: `parseRequestedServices` не trim'ит строки и не алертит при unparseable входе

**File:** `apps/admin/server/api/telegram/notify-appointment-group.post.ts:174-189`

**Issue:** `requested_services jsonb` — schema-less, форма произвольная. Парсер обрабатывает `string` и `{service_name: string}`. Однако `name.trim()` не вызывается перед итоговым выводом:

```ts
return typeof name === 'string' ? name : null
...
.filter((s): s is string => Boolean(s && s.trim()))
```

Фильтр проверяет trim, но в **выводе** строка не trimmed:

```ts
text += `• ${escapeHtml(s)}\n`
```

→ если `service_name = "  Стрижка  "`, попадёт в TG с лишними пробелами. **Cosmetic, не критично.**

Также: storefront RPC `create_visit_request` принимает `p_requested_services jsonb` без strict-валидации структуры. Если фронт когда-нибудь пошлёт `[{name: "..."}]` вместо `[{service_name: "..."}]` — весь массив отфильтруется, секция услуг пропадёт. Это **acceptable degradation**, но без алерта мы об этом не узнаем.

**Fix:**
```ts
function parseRequestedServices(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((entry) => {
      if (typeof entry === 'string') return entry.trim()
      if (entry && typeof entry === 'object' && 'service_name' in entry) {
        const name = (entry as { service_name?: unknown }).service_name
        return typeof name === 'string' ? name.trim() : null
      }
      return null
    })
    .filter((s): s is string => Boolean(s && s.length))
}
```

И в endpoint после parseRequestedServices добавить телеметрию:
```ts
const services = parseRequestedServices(group.requested_services)
if (group.status === 'request' && services.length === 0 && group.requested_services) {
  reportError(new Error('requested_services has unparseable shape'), {
    ctx: 'notify-appointment-group.parseRequestedServices',
    appointmentGroupId,
  })
}
```

— чтобы если структура изменится, мы об этом узнали в Sentry.

---

### WR-04: SQL regex fallback `/notify$` ломается если базовый секрет НЕ кончается на `/notify`

**File:** `supabase/migrations/299_telegram_notify_appointments_and_calls.sql:56,112`

**Issue:** Fallback логика:
```sql
v_url := regexp_replace(v_base, '/notify$', '/notify-appointment-group');
```

Если базовый секрет `telegram_notify_url` указывает на путь без `/notify` в конце (например self-hosted администратор задал `https://admin.example.com/api/telegram/order` — теоретически возможно), `regexp_replace` **не найдёт match → вернёт исходную строку**. pg_net пошлёт payload `{appointmentGroupId, tenantId}` на endpoint, который ожидает payload `{orderId, tenantId}` → handler `notify.post.ts` отработает с `orderId=undefined` → silently return `{ ok: true }`.

Это **pre-existing pattern** (см. миграцию 265: «ломалось, если базовый секрет не заканчивался на /notify»), но в той миграции была написана ЗАМЕТКА — установить отдельный секрет. У нас в комментарии миграции **нет такой инструкции для DevOps**.

**Fix:** Добавить в шапку миграции 299:

```sql
-- После применения миграции (рекомендуется):
--   SELECT vault.create_secret(
--     'https://admin.example.com/api/telegram/notify-appointment-group',
--     'telegram_notify_appointment_group_url'
--   );
--   SELECT vault.create_secret(
--     'https://admin.example.com/api/telegram/notify-table-call',
--     'telegram_notify_table_call_url'
--   );
-- Иначе fallback работает только если telegram_notify_url оканчивается на /notify.
```

И в TECHDEBT.md / handoff-doc добавить запись, что для prod-Coolify-инсталляции нужно создать оба secret'а — это инструкция для следующего деплоя.

---

## Info

### IN-01: `broadcastToTenantTelegram` возвращает {sent, failed, removed} — не используется

**File:** `apps/admin/server/api/telegram/notify-appointment-group.post.ts:99-103`, `notify-table-call.post.ts:50-53`

**Issue:** `broadcastToTenantTelegram` возвращает счётчики (`{sent, failed, removed}`), но мы их игнорируем. Pre-existing pattern (`notify-reservation` тоже не читает). `broadcastToTenantTelegram` сам делает `console.error` на failures, поэтому Sentry-логи есть, но **бизнес-метрика "сколько уведомлений отвалилось"** нигде не собирается на уровне нашего endpoint'а.

**Fix (опционально):** Залогировать через `reportError`, если **все** подписки упали (полное молчание):

```ts
const result = await broadcastToTenantTelegram(...)
if (result.failed > 0 && result.sent === 0) {
  reportError(new Error('All telegram subscribers failed'), {
    ctx: 'notify-appointment-group',
    appointmentGroupId,
    tenantId,
    failed: result.failed,
  })
}
```

Дешёвая телеметрия — без неё «потерянные» уведомления не алертятся.

---

### IN-02: source-filtering не делается — admin-created записи тоже шлют TG (флуд)

**File:** `supabase/migrations/299_telegram_notify_appointments_and_calls.sql:83`

**Issue:** Триггер фильтрует только `WHEN (NEW.status IN ('active', 'request'))`. Это значит:
- storefront book_appointment → status='active', source='storefront' → шлёт TG ✅
- storefront request → status='request', source='request' → шлёт TG ✅
- **admin создаёт запись из UI** (менеджер сам вписывает клиента) → status='active', source='admin' → **тоже шлёт TG**, хотя менеджер только что её создал

Это либо feature (другие менеджеры/филиалы видят), либо noise.

Аргументы оставить как есть для V1:
1. Reservations работают так же — `notify_new_reservation_telegram` тоже не фильтрует по `source`
2. Если филиалов несколько, ночная смена создала из UI — дневная увидит в TG, это полезно
3. Если выяснится noise — фильтр добавить тривиально

**Fix:** Не нужен сейчас, но **добавить FAQ-комментарий** в миграцию:

```sql
-- Note: триггер шлёт TG для любого source (storefront/admin/request).
-- Если admin-created flood надоест — добавить `AND NEW.source <> 'admin'` в WHEN-clause.
```

---

### IN-03: Telegram rate-limit при много-чатовых тенантах

**File:** `apps/admin/server/utils/telegramBroadcast.ts:63` (pre-existing)

**Issue:** `Promise.allSettled(subs.map(...))` шлёт параллельно ко всем подпискам. Telegram global rate-limit — 30 msg/sec per bot. Если у тенанта 30+ подписок (несколько менеджеров в нескольких группах) при одновременных событиях (бронь+запись+вызов в одну секунду) — словим 429.

**Pre-existing pattern**, не от тебя. **Не блок**, но стоит добавить запись в TECHDEBT.md: когда у тенанта будет >30 подписок — переключиться на батчи с 50ms-delay через chunked отправку.

**Fix:** Запись в TECHDEBT.md:

```md
## broadcastToTenantTelegram — rate-limit на крупных тенантах
При >30 подписках одновременно отправляем параллельно, Telegram даст 429.
TODO: добавить chunk-with-delay (по 25 msg / sec), либо очередь pg_boss + worker.
```

---

### IN-04: logTag разный для request/active — мешает агрегировать metric'и

**File:** `apps/admin/server/api/telegram/notify-appointment-group.post.ts:97`

**Issue:**
```ts
const logTag = group.status === 'request' ? 'telegram notify-appointment-request' : 'telegram notify-appointment'
```

В Sentry / console.error'ах два разных тега. Это мешает делать единый dashboard «сколько appointment-уведомлений отвалилось». Не PII (там нет имени/телефона), но усложняет аналитику.

**Fix:** Унифицировать на один тег:

```ts
const logTag = 'telegram notify-appointment-group'
```

Если нужно различать ветку — добавить в `ctx` следующего `reportError`, а не в logTag самого broadcast'а.

---

### IN-05: SECURITY DEFINER функции без `REVOKE EXECUTE FROM PUBLIC`

**File:** `supabase/migrations/299_telegram_notify_appointments_and_calls.sql:30,88`

**Issue:** SECURITY DEFINER функции исполняются под привилегиями owner'а (postgres). Сейчас не REVOKE'нут от PUBLIC → теоретически любой authenticated user может вызвать их напрямую через `SELECT notify_new_appointment_group_telegram()` без аргументов — упадёт с ошибкой (нет триггер-контекста, NEW не определён), но это **plumbing-noise**.

Существующие миграции 113/263/265 тоже не делают `REVOKE FROM PUBLIC` на trigger-функции — pre-existing pattern, низкий риск (вызов без TG_OP / NEW падает с raise). **Не блок**, но рекомендация для best-practice:

**Fix:**
```sql
REVOKE EXECUTE ON FUNCTION notify_new_appointment_group_telegram() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION notify_new_table_call_telegram() FROM PUBLIC;
```

После CREATE.

---

## Verdict

**Блокирует коммит.**

CR-01 — фатальный. Без исправления TG-уведомления о записях/заявках на услуги **не будут работать ни для одного тенанта** (PostgREST вернёт ошибку на несуществующих колонках `total_price`/`total_duration_minutes`, endpoint silently возвратит `{ok:true}` без отправки). Это значит PREPROD-019 как «фича» = ноль impact, прод-инцидент при выкатке.

**План действий:**
1. **Сейчас:** убрать `total_price, total_duration_minutes` из select, пересчитать total из слотов через `service_price` (см. CR-01 fix). — обязательно
2. **Сейчас же:** добавить `if (group.status === 'cancelled') return { ok: true }` (WR-01) — defense против race. — обязательно
3. **Сейчас же:** обернуть phone в `escapeHtml` (WR-02) — 1 строка. — обязательно
4. **Сейчас же:** добавить в шапку миграции инструкцию по созданию vault-secret'ов (WR-04). — обязательно для прода
5. **Можно сразу или потом:** trim в parseRequestedServices + reportError на unparseable shape (WR-03), унификация logTag (IN-04), REVOKE FROM PUBLIC (IN-05). — желательно
6. **Запись в TECHDEBT.md:** rate-limit broadcastToTenantTelegram (IN-03). — потом

После пунктов 1+2+3+4 — можно коммитить.

**Ручной smoke-test после фиксов:**
- В локальном supabase выполнить миграцию 299
- Создать vault-secret'ы (по инструкции из 265 + новые)
- Через storefront /api/appointments/bulk создать запись → ждать TG в тестовом боте («Новая запись»)
- Через storefront /api/appointments/request создать заявку → ждать TG («Новая заявка»)
- Через QR /table-mode/call вызвать официанта → ждать TG («Вызов официанта»)
- В каждом случае убедиться, что в логах нет `column does not exist` и `failed=0` в broadcastToTenantTelegram

---

_Reviewed: 2026-05-20T00:48:28Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
