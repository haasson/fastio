# Phase 7: dine-in-tables-branch-id — Research

**Researched:** 2026-06-01
**Domain:** Supabase schema migration + Vue 3 admin feature + Nitro storefront service layer
**Confidence:** HIGH

## Summary

Таблица `tables` (migration 059) создана без `branch_id`. Столы тенант-глобальны. В `order-delivery.ts` ветка `dine_in` не ставит `branchId`, потому что `TableRecord` не содержит `branch_id` — для мультифилиального тенанта заказ уходит с `branch_id=null` и не попадает ни в одну кухонную очередь (кухня фильтрует по `orders.branch_id` через RLS/queries). Это P0 на проде для любого мультибранч-тенанта с dine-in.

Все решения D-01…D-12 зафиксированы в CONTEXT.md и реализуемы чистым, понятным кодом. Ни одного нового npm-пакета не требуется. Миграционный бэкфилл прямолинеен (1 или N филиалов). RLS существующих политик (`is_tenant_member`) не нужно менять — они фильтруют по `tenant_id`, branch-scope на уровне БД для столов не нужен. Archive guard уже живёт в `apps/admin/pages/branches/index.vue` (138–197 строки) + `branchesApi.hasActiveOrders/Reservations/Appointments` — паттерн точный, нужно только добавить `hasTables`.

**Primary recommendation:** 1 миграция (307) + точечные правки в 7 файлах + 1 новый компонент (TablesBranchSummary) + тесты.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** `tables.branch_id` — nullable FK на `branches(id)`. Не NOT NULL.
- **D-02:** Нет пер-стольного дропдауна филиала. `branch_id = currentBranchId` в момент создания стола.
- **D-03:** Страница столов реагирует на глобальный селектор (как orders/kitchen).
- **D-04:** `branches.length <= 1` → всегда показываем все столы тенанта. `currentBranchId=null` при одном филиале не открывает саммари.
- **D-05:** `branches.length > 1` + конкретный филиал → столы этого филиала.
- **D-06:** `branches.length > 1` + «Все» (`null`) → лёгкая саммари-страница: список филиалов + `N столов · M занято`, клик → `setBranch(branchId)`.
- **D-07:** `/tables/layout` при «Все» (мультибранч) → та же саммари/редирект.
- **D-08:** Бэкфилл: тенант с 1 филиалом → все его столы к нему. Тенант с >1 → `null` + алерт в UI.
- **D-09:** Меню на `/table/<id>` остаётся тенант-глобальным. `dish_branches` НЕ трогаем.
- **D-10:** При архивации филиала с привязанными столами — блокировать с сообщением, аналогично гарду по броням/записям.
- **D-11:** `validateTable` добавляет `branch_id` в select и возвращает его в `TableRecord`. `resolveDelivery` для `dine_in` ставит `branchId = tableRecord.branchId`.
- **D-12:** Если `branch_id=null` у стола на мультибранч-тенанте — НЕ допускать тихого `null`. Ошибка чекаута (конфиг-ошибка тенанта).

### Claude's Discretion
- Точная форма саммари-карточки (UiCard/UiListRow), иконки, тексты.
- `ON DELETE` стратегия FK (в связке с реализацией archive guard).
- Где именно живёт алерт «назначьте филиал» (страница столов vs `/branches`).

### Deferred Ideas (OUT OF SCOPE)
- Богатый дашборд «Все филиалы»: реалтайм-занятость, вызовы по филиалам.
- Пофилиальное меню/доступность блюд (`dish_branches`).
- Перенос стола между филиалами как явная операция.
</user_constraints>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `tables.branch_id` schema + backfill | Database / Storage | — | DDL + backfill SQL в миграции 307 |
| `validateTable` + `TableRecord.branchId` | API / Backend (Nitro) | — | Серверный storefront endpoint |
| `resolveDelivery` dine_in branch fix | API / Backend (Nitro) | — | Серверная логика маршрутизации |
| Фильтрация столов по `currentBranchId` в админке | Frontend Server (Admin SPA) | — | `pages/tables.vue` реагирует на `branchStore.currentBranchId` |
| Саммари «Все филиалы» | Frontend Server (Admin SPA) | — | Новый компонент `TablesBranchSummary.vue` |
| `branch_id` при создании стола (`tablesApi.add`) | API / Backend (Supabase RLS) | Frontend Server | `branch_id` передаётся в insert-payload |
| Archive guard (столы → блокировка) | API / Backend (Supabase) | Frontend Server | `branchesApi.hasTables` + UI-guard в `pages/branches/index.vue` |
| Order number per_branch | Database / Storage | — | Триггер `set_order_number` автоматически использует `branch_id` из заказа |

---

## Investigation Target 1: Схема `tables` + миграция

### Текущая DDL (migration 059_tables.sql)

```sql
CREATE TABLE tables (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          VARCHAR(100) NOT NULL,
  is_open       BOOLEAN NOT NULL DEFAULT false,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  opened_at     TIMESTAMPTZ,
  capacity      INTEGER,
  tags          TEXT[] NOT NULL DEFAULT '{}',
  position_x    NUMERIC,
  position_y    NUMERIC,
  shape         TEXT NOT NULL DEFAULT 'rectangle',
  table_width   NUMERIC NOT NULL DEFAULT 120,
  table_height  NUMERIC NOT NULL DEFAULT 80,
  rotation      SMALLINT NOT NULL DEFAULT 0,
  color         TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Нет `branch_id`.** Последняя проде-миграция — 306. Новая миграция будет `307_tables_branch_id.sql`.

### Рекомендуемая миграция 307

```sql
-- 307: привязка dine-in столов к филиалу (P0 для мультибранч dine-in)
--
-- Добавляем nullable FK branch_id (D-01). ON DELETE SET NULL: при архивации
-- филиала стол не удаляется, branch_id обнуляется. Административный guard
-- (D-10) блокирует архивацию в UI ДО этого момента — FK SET NULL как
-- последняя защита, не основной механизм.
--
-- Бэкфилл (D-08):
--   - Тенанты с ровно 1 активным филиалом → все их столы привязываем к нему.
--   - Тенанты с >1 активным филиалом → branch_id остаётся NULL.
--   - Тенанты без активных филиалов → branch_id NULL (ок, нет dine-in пути).

ALTER TABLE tables
  ADD COLUMN branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

CREATE INDEX idx_tables_branch_id ON tables(branch_id);

-- Бэкфилл: одиночный-филиал тенант
UPDATE tables t
SET branch_id = (
  SELECT id FROM branches b
  WHERE b.tenant_id = t.tenant_id
    AND b.archived_at IS NULL
  LIMIT 1
)
WHERE (
  SELECT COUNT(*) FROM branches b
  WHERE b.tenant_id = t.tenant_id
    AND b.archived_at IS NULL
) = 1;
```

**Подводные камни:**
- `ON DELETE CASCADE` нельзя (уничтожило бы стол при архивации). `ON DELETE RESTRICT` + только app-level guard — рискованно. `ON DELETE SET NULL` правильно.
- `archived_at IS NULL` в бэкфилле — считаем только активные филиалы (архивированный не должен быть целью).
- Нет `CONCURRENTLY` для индекса — таблица маленькая, ok.
- После миграции нужно обновить `database.types.ts` (генерируется `supabase gen types`).

### RLS политики на `tables`

Существующие политики [VERIFIED: migration 059 + 112]:
- `"tables: members can select"` — `USING (is_tenant_member(tenant_id))` — фильтрует по `tenant_id`, НЕ по `branch_id`. Не нужно менять.
- `"tables: tables.manage can insert/update/delete"` — `has_permission(tenant_id, 'tables.manage')` — аналогично.

**Вывод:** RLS полностью по `tenant_id`. Добавление `branch_id` в схему не ломает ни одну политику.

### RLS на `table_calls`

Migration 289: `ALTER TABLE table_calls FORCE ROW LEVEL SECURITY;` (TOCTOU guard для storefront insert через service-role). Политики также по `tenant_id`. Не нужно менять.

---

## Investigation Target 2: `order-delivery.ts` фикс (ядро P0, D-11/D-12)

### Файл: `apps/storefront/server/services/order-delivery.ts`

**Текущее состояние (строки 7–42):**

```typescript
// Стр. 7–10: TableRecord НЕ содержит branch_id
export type TableRecord = {
  id: string
  name: string
}

// Стр. 31–33: select без branch_id
const { data: tableData } = await supabase
  .from('tables')
  .select('id, name, is_open')   // ← нет branch_id
  .eq('id', tableId)
  ...

// Стр. 41: маппинг без branchId
return { id: tableData.id as string, name: tableData.name as string }
```

**Текущее состояние (строки 116–131, `resolveDelivery`):**

```typescript
// Строки 116–131: dine_in НЕ получает branchId из стола
if (!branchId) {
  if (deliveryType === 'pickup' && body.branchId) { ... branchId = body.branchId }
  else if (branchRows?.length === 1) { branchId = branchRows[0].id }
  // ↑ для dine_in: если >1 филиал — branchId остаётся null
}

// Строка 129: dine_in пропускает ошибку если null
if (!branchId && deliveryType !== 'dine_in') {
  throw createError(...)  // ← dine_in тихо уходит с null
}
```

### Рекомендуемые изменения

**Шаг 1:** Обновить `TableRecord` и `validateTable`:

```typescript
// БЫЛО:
export type TableRecord = {
  id: string
  name: string
}

// СТАЛО:
export type TableRecord = {
  id: string
  name: string
  branchId: string | null   // добавлено
}

// validateTable: строка ~31
const { data: tableData } = await supabase
  .from('tables')
  .select('id, name, is_open, branch_id')   // добавить branch_id
  ...

// строка ~41:
return {
  id: tableData.id as string,
  name: tableData.name as string,
  branchId: tableData.branch_id as string | null,   // добавить
}
```

**Шаг 2:** Обновить `resolveDelivery` (блок `if (!branchId)`, строки ~116–131):

```typescript
// После получения tableRecord для dine_in, внутри блока if (!branchId):
if (deliveryType === 'dine_in' && tableRecord) {
  if (tableRecord.branchId) {
    branchId = tableRecord.branchId
  } else if (branchRows?.length === 1) {
    // Fallback: стол без branch_id на single-branch тенанте (D-12 fallback)
    branchId = branchRows[0].id
  } else if (branchRows && branchRows.length > 1) {
    // D-12: мультибранч + стол без branch_id = конфиг-ошибка тенанта
    throw createError({
      statusCode: 400,
      message: 'Стол не привязан к филиалу. Обратитесь к администратору заведения.',
    })
  }
}
```

**Подводные камни:**
- После `await validateTable(...)` стол уже проверен (is_open, is_active) — `tableRecord` не null внутри `if (deliveryType === 'dine_in')`.
- `branchRows` уже загружены через `Promise.all` к этому моменту (строка 64) — нет лишних запросов.
- Строка 121 в `orders.post.ts`: `branch_id: branchId ?? null` — уже готова принять корректный branchId.
- TypeScript: после добавления `branchId` в `TableRecord` нужно убедиться, что Supabase-клиент знает о новой колонке (через обновлённые `database.types.ts`).

---

## Investigation Target 3: Админка `apps/admin/features/tables/`

### Файлы и их роли

| Файл | Текущее состояние | Что менять |
|------|------------------|------------|
| `packages/shared/src/types/table.ts:21` | `type Table` — нет `branchId` | Добавить `branchId: string \| null` |
| `packages/shared/src/types/table.ts:41` | `type TableFormData` — нет `branchId` | Добавить `branchId?: string \| null` |
| `apps/admin/shared/data/database.types.ts:3381` | `tables Row/Insert/Update` — нет `branch_id` | Регенерировать после миграции |
| `apps/admin/features/tables/api/tables.ts:28` | `mapTable` — не маппит `branchId` | Добавить `branchId: row.branch_id ?? null` |
| `apps/admin/features/tables/api/tables.ts:52` | `tablesApi.list` — нет фильтра по `branch_id` | Добавить опциональный `branchId` параметр |
| `apps/admin/features/tables/api/tables.ts:60` | `tablesApi.add` — нет `branch_id` в insert | Добавить `branch_id: data.branchId ?? null` |
| `apps/admin/pages/tables.vue:158` | `load(id)` вызывает `api.tables.list(id)` | Передавать `currentBranchId` с учётом D-04 |

### Паттерн: как orders использует branchId (эталон для копирования)

В `apps/admin/pages/orders/index.vue:37`:
```typescript
const branchId = computed(() => branchStore.currentBranchId)
// Передаётся в компонент OrderList как prop :branch-id="branchId"
```

В `ordersApi.list` (строки 250–253):
```typescript
if (filterBranchIds.length > 0) {
  q = q.in('branch_id', filterBranchIds)
} else if (branchId !== null) {
  q = q.eq('branch_id', branchId)
}
```

### Как добавить branch-scope в tablesApi.list

```typescript
// apps/admin/features/tables/api/tables.ts
async list(sb: SupabaseClient, tenantId: string, branchId?: string | null): Promise<Table[]> {
  let q = sb.from('tables')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('created_at')

  if (branchId !== undefined && branchId !== null) {
    q = q.eq('branch_id', branchId)
  }
  // branchId=undefined или null → все столы тенанта (single-branch case, D-04)

  const data = await query(q)
  return (data ?? []).map(mapTable)
}
```

### Создание стола с branch_id (D-02/D-03)

В `apps/admin/pages/tables/list.vue:119–133`:
```typescript
const createTable = async () => {
  const tenantId = ctx.tenantId
  if (!tenantId) return
  const n = allTables.value.length + 1
  const created = await api.tables.add(tenantId, {
    name: `Стол ${n}`,
    // branch_id передаётся через TableFormData.branchId
  })
  // ...
}
```

`tablesApi.add` нужно расширить: принимать `branchId` из `TableFormData`, передавать в insert. В момент вызова `createTable` `branchStore.currentBranchId` доступен.

**Подводные камни:**
- `list.vue` вызывает `api.tables.add(tenantId, { name: ... })` без `branchId` — нужно дополнить этот call, чтобы передавать `branchStore.currentBranchId`. Доступ к `branchStore` нужно добавить в `list.vue`.
- При `branches.length <= 1` (D-04) и `currentBranchId = null` — стол должен создаться с `branch_id = branches[0].id` (единственный филиал). Логику развилки лучше поместить в вызывающем коде в `list.vue`, а не в `tablesApi`.

### Фильтрация в `pages/tables.vue` (load logic)

Текущий `load(id)` (строка 158) не учитывает филиал. Нужно:

```typescript
// В pages/tables.vue
const branchStore = useBranchStore()
const { currentBranchId } = storeToRefs(branchStore)  // или computed

const effectiveBranchId = computed(() => {
  // D-04: один филиал → не фильтруем по нему (показываем все)
  if (branchStore.branches.length <= 1) return undefined
  // D-05: конкретный филиал → фильтруем
  return branchStore.currentBranchId ?? undefined
  // null → undefined → API не фильтрует (но это дошло до саммари, не до load)
})
```

Саммари (D-06): рендерится не в `pages/tables.vue`, а в child-компоненте/route. `pages/tables.vue` провайдит `TablesContextKey` — нужно решить: саммари рендерить как отдельное состояние в `pages/tables/list.vue` или как отдельный компонент-заглушку.

### Алерт «назначьте филиал»

Столы с `branchId=null` на мультибранч-тенанте (результат бэкфилла D-08) — показывать алерт. Логичное место: внутри `pages/tables/list.vue` + условие `branches.length > 1 && hasUnassignedTables`. Не на `/branches` (нет модуля dineIn там).

---

## Investigation Target 4: Глобальный branch-селектор

### Где живёт

`apps/admin/shared/stores/branch.ts` — Pinia store, экспортирует:
- `branches: Ref<Branch[]>`
- `currentBranchId: Ref<string | null>` — `null` = «Все филиалы»
- `currentBranch: ComputedRef<Branch | null>`
- `hasBranches: ComputedRef<boolean>`
- `setBranch(id: string | null)`

### Паттерн использования (orders, `pages/orders/index.vue:34–37`)

```typescript
const branchStore = useBranchStore()
const branchId = computed(() => branchStore.currentBranchId)
// Передаётся как prop в компонент
```

### Реактивность при смене

`useBranch.ts:68`: `setBranch` обновляет `currentBranchId` реактивно + `localStorage`. Страницы, подписанные через `computed(() => branchStore.currentBranchId)`, реагируют автоматически.

### D-04: развязка single-branch

В `pages/tables.vue` нужен `watch` на `currentBranchId` для reload:

```typescript
watch([tenantId, effectiveBranchId], ([id]) => {
  if (id) load(id, effectiveBranchId.value)
}, { immediate: true })
```

При одном филиале `effectiveBranchId = undefined` → `tablesApi.list(tenantId, undefined)` → все столы (нет branch-фильтра). UX «как раньше».

### Саммари «Все филиалы» (D-06)

Не является отдельным роутом. Варианты реализации (на выбор планера):

**Вариант A (рекомендован):** В `pages/tables/list.vue` добавить условный рендер:
```vue
<template v-if="showSummary">
  <TablesBranchSummary :branches="branchStore.branches" :tables="allTablesForSummary" />
</template>
<template v-else>
  <!-- текущий список столов -->
</template>
```
`showSummary = branches.length > 1 && currentBranchId === null`

**Вариант B:** Отдельный компонент в `pages/tables/layout.vue` тоже показывает саммари при `showSummary`.

Компонент `TablesBranchSummary.vue` (новый, в `features/tables/components/`):
- Принимает `branches` + число столов/занятых через props
- Клик по строке → `branchStore.setBranch(branch.id)`
- UI: `UiCard` → `UiListRow` или простой список
- Счётчики: `N столов · M занято` (на основе уже загруженных `tables`)

---

## Investigation Target 5: Archive Guard (D-10)

### Где живёт

**API-уровень** (`apps/admin/features/branches/api/branches.ts`):
- `branchesApi.hasActiveOrders(sb, branchId, tenantId): Promise<boolean>` — строки 146–177
- `branchesApi.hasActiveReservations(sb, branchId, tenantId): Promise<boolean>` — строки 188–209
- `branchesApi.hasActiveAppointments(sb, branchId, tenantId): Promise<boolean>` — строки 217–235

**UI-уровень** (`apps/admin/pages/branches/index.vue`):
```typescript
// Строки 144–197: handleArchive
const [hasOrders, hasReservations, hasAppointments] = await Promise.all([
  api.branches.hasActiveOrders(branch.id, tenantId.value),
  api.branches.hasActiveReservations(branch.id, tenantId.value),
  api.branches.hasActiveAppointments(branch.id, tenantId.value),
])
if (hasOrders) {
  await confirm({ title: 'Нельзя архивировать', message: '...', confirmText: false, cancelText: 'Понятно' })
  return
}
// ... hasReservations, hasAppointments ...
```

### Что добавить для D-10

**Новый метод** в `branchesApi`:
```typescript
async hasTables(sb: SupabaseClient, branchId: string): Promise<boolean> {
  const { count, error } = await sb
    .from('tables')
    .select('id', { count: 'exact', head: true })
    .eq('branch_id', branchId)
    .eq('is_active', true)

  if (error) {
    reportError(error, { context: 'branches.hasTables', branchId })
    return true  // fail-safe: блокируем архивацию при ошибке
  }

  return (count ?? 0) > 0
}
```

**В `pages/branches/index.vue`**, добавить в `handleArchive`:
```typescript
const [hasOrders, hasReservations, hasAppointments, hasTables] = await Promise.all([
  api.branches.hasActiveOrders(branch.id, tenantId.value),
  api.branches.hasActiveReservations(branch.id, tenantId.value),
  api.branches.hasActiveAppointments(branch.id, tenantId.value),
  api.branches.hasTables(branch.id),   // ← новое
])
// После проверок hasOrders/hasReservations/hasAppointments:
if (hasTables) {
  await confirm({
    title: 'Нельзя архивировать филиал',
    message: `У филиала «${branch.name}» есть столы. Перенесите или удалите их, а затем попробуйте снова.`,
    confirmText: false,
    cancelText: 'Понятно',
  })
  return
}
```

**FK стратегия:** `ON DELETE SET NULL` (в миграции) — страховка на уровне БД, если guard обойдён. Согласуется с решением D-10.

**Подводные камни:**
- `api.branches.hasTables` — нужно добавить `hasTables` в `useDatabase` binding (аналогично другим `hasActive*`).
- В `feature.manifest.ts` модуля `branches` уже указано `'tables'` в `db.tables` — не нужно менять.

---

## Investigation Target 6: Пер-филиальная нумерация

### Механизм (migration 080_order_numbering.sql)

Триггер `trg_set_order_number` (BEFORE INSERT на `orders`) вызывает функцию `set_order_number()`:
```sql
-- Строка 140:
NEW.order_number := generate_order_number(NEW.tenant_id, v_config, NEW.branch_id);
```

Функция `generate_order_number` (строки 54–65):
```sql
IF v_scope = 'per_branch' AND p_branch_id IS NOT NULL THEN
  -- период: branch_<branchId> или branch_<branchId>_<date>
  v_period := 'branch_' || p_branch_id::text || ...
ELSE
  v_period := 'global' || ...
END IF;
```

**Вывод:** После D-11 (`branchId` правильно ставится в `orders.branch_id`) триггер автоматически применит пер-филиальный счётчик и префикс `order_number_prefix` ветки. Доп. кода не нужно — это работает уже сейчас для pickup/delivery, теперь заработает и для dine_in.

**Единственное условие:** `orders.post.ts:121` — `branch_id: branchId ?? null` — уже корректно передаёт значение в INSERT. После фикса `resolveDelivery` `branchId` будет не null для dine_in.

---

## Investigation Target 7: Realtime/RLS

### Realtime (migration 305)

`ALTER PUBLICATION supabase_realtime ADD TABLE tables;` — таблица уже в публикации.
Канал `useTablesChannel` (строки 44–65): подписка по `tenant_id=eq.${tenantId.value}`, `onInsert/onUpdate/onDelete`. Realtime сам фильтрует по RLS — выдаёт только строки, видимые пользователю.

**Вопрос:** Нужно ли добавить branch-фильтр в realtime-подписку (`useTablesChannel`)? Нет — realtime транслирует все изменения tables тенанта. `upsertTableFromRealtime` в `pages/tables.vue` (строки 239–256) не имеет branch-фильтра — значит, реалтайм-обновление стола другого филиала попадёт в `tables.value`. Это незначительная проблема (никогда не видна в UI при правильном branch-фильтре в `list`/`layout`). Если не хочется — можно добавить guard в `upsertTableFromRealtime`:

```typescript
const upsertTableFromRealtime = (table: Table) => {
  if (!table.isActive) { tables.value = tables.value.filter(...); return }
  // Не добавляем столы чужого филиала при наличии branch-фильтра
  if (effectiveBranchId.value && table.branchId && table.branchId !== effectiveBranchId.value) return
  // ...
}
```

Это edge case — на усмотрение планера.

### RLS (итог по обоим таблицам)

- `tables`: `is_tenant_member(tenant_id)` — не меняется.
- `table_calls`: `is_tenant_member(tenant_id)` + `FORCE RLS` — не меняется.
- Новое поле `branch_id` не требует отдельных политик (SELECT/INSERT/UPDATE/DELETE по `tenant_id` покрывают всё).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Хранение выбранного филиала | localStorage вручную | `useBranch.ts` (`setBranch`, `currentBranchId`) | Уже есть, персистит, реактивный |
| Archive guard | Своя модалка | `useConfirm()` из `@fastio/kit` + pattern из `pages/branches/index.vue` | Точная копия существующего кода |
| Branch-список для саммари | Отдельный fetch | `branchStore.branches` | Уже загружены глобально |
| Per-branch order numbers | Кастомная логика | Триггер `set_order_number` | Автоматически через `orders.branch_id` |
| Счётчик занятых столов в саммари | Отдельный запрос | `tables.value.filter(t => t.isOpen).length` по `branchId` | Данные уже в памяти |

---

## Common Pitfalls

### Pitfall 1: Тихий null при мультибранч + нет branch_id у стола

**What goes wrong:** После фикса D-11, если стол остался с `branch_id=null` (бэкфилл не накрыл мультибранч), `resolveDelivery` попадёт во флоубек → одиночный-филиал-fallback не сработает (их >1) → без явной ошибки `branchId` остаётся `null` → заказ уходит с `null`.

**How to avoid:** D-12 явно: при `branchRows.length > 1 && !tableRecord.branchId` → `throw createError(400, 'Стол не привязан...')`.

**Warning signs:** В тестах: dine_in заказ создаётся без `branch_id`.

### Pitfall 2: Саммари-loop при setBranch

**What goes wrong:** При клике на строку саммари вызывается `setBranch(branchId)` → `currentBranchId` меняется → страница перезагружает столы → показывает список (D-05). Если `watch` не разграничивает `null` и конкретный id — возможна двойная загрузка.

**How to avoid:** В `watch` на `effectiveBranchId` использовать `{ immediate: true }` но проверять `if (!id) return` для `tenantId`.

### Pitfall 3: mapTable не маппит branchId

**What goes wrong:** После миграции `database.types.ts` обновится, `TableRow` будет иметь `branch_id`, но `mapTable` не включает его → `Table.branchId` всегда `undefined`, `validateTable` в storefront тоже сломан.

**How to avoid:** Обновлять `mapTable` одновременно с добавлением поля в `Table` type.

### Pitfall 4: database.types.ts не обновлён

**What goes wrong:** TypeScript не знает о `branch_id` в `tables Row` → `tableData.branch_id` — ошибка типа.

**How to avoid:** После применения миграции 307 — `supabase gen types typescript --local > apps/admin/shared/data/database.types.ts` (и аналог для storefront если он имеет свои типы).

### Pitfall 5: branchId=null при D-04 создаёт стол без branch_id

**What goes wrong:** Владелец single-branch тенанта сидит в `currentBranchId=null`. При создании стола без специальной обработки `branch_id=null` → стол не будет привязан. Бэкфилл решает это для существующих, но новые столы создадутся без ветки.

**How to avoid:** В `createTable` (list.vue) — если `branches.length === 1`, брать `branches[0].id` как `branchId` для нового стола. Если `branches.length > 1 && currentBranchId === null` → пользователь видит саммари, кнопка «Новый стол» должна быть скрыта или недоступна.

---

## Code Examples

### Добавление branch_id в mapTable

```typescript
// apps/admin/features/tables/api/tables.ts
// Source: investigation of existing mapBranch pattern (branches/api/branches.ts:8)
export const mapTable = (raw: Record<string, unknown>): Table => {
  const row = raw as TableRow

  return {
    id: row.id,
    tenantId: row.tenant_id,
    branchId: row.branch_id ?? null,  // добавить
    name: row.name,
    // ... остальные поля без изменений
  }
}
```

### Счётчики для саммари (без доп. запросов)

```typescript
// В pages/tables.vue или TablesContext — вычисляемые счётчики
const tableCountByBranch = computed(() => {
  const map: Record<string, { total: number; open: number }> = {}
  for (const t of allTables.value) {
    if (!t.branchId) continue
    const entry = (map[t.branchId] ??= { total: 0, open: 0 })
    entry.total++
    if (t.isOpen) entry.open++
  }
  return map
})
```

`allTables` при «Все» (саммари-режим) = все столы тенанта (без branch-фильтра). Нужно в этом режиме загружать все столы, а не только одного филиала.

### hasActiveOrders — эталонный паттерн для hasTables

```typescript
// Source: apps/admin/features/branches/api/branches.ts:146
async hasTables(sb: SupabaseClient, branchId: string): Promise<boolean> {
  const { count, error } = await sb
    .from('tables')
    .select('id', { count: 'exact', head: true })
    .eq('branch_id', branchId)
    .eq('is_active', true)

  if (error) {
    reportError(error, { context: 'branches.hasTables', branchId })
    return true
  }
  return (count ?? 0) > 0
}
```

---

## Files to Create / Modify

| File | Action | Role |
|------|--------|------|
| `supabase/migrations/307_tables_branch_id.sql` | CREATE | DDL + бэкфилл |
| `packages/shared/src/types/table.ts` | EDIT | Добавить `branchId: string \| null` в `Table` + `branchId?: string \| null` в `TableFormData` |
| `apps/admin/shared/data/database.types.ts` | REGEN | `supabase gen types` после миграции |
| `apps/admin/features/tables/api/tables.ts` | EDIT | `mapTable` + `tablesApi.list(branchId?)` + `tablesApi.add(branchId)` |
| `apps/admin/features/branches/api/branches.ts` | EDIT | Добавить `hasTables(sb, branchId)` |
| `apps/admin/pages/branches/index.vue` | EDIT | Добавить `hasTables` check в `handleArchive` |
| `apps/admin/pages/tables.vue` | EDIT | Добавить `branchStore`, `effectiveBranchId`, передача в `load`, `tableCountByBranch` для саммари |
| `apps/admin/pages/tables/list.vue` | EDIT | Саммари-условие (`showSummary`), branch-aware `createTable`, алерт незакреплённых |
| `apps/admin/pages/tables/layout.vue` | EDIT | Саммари-условие или редирект при `showSummary` |
| `apps/admin/features/tables/components/TablesBranchSummary.vue` | CREATE | Новый компонент — список филиалов + счётчики + `setBranch` |
| `apps/admin/features/tables/feature.manifest.ts` | EDIT | Добавить `shared.stores.branch` в `dependsOn` |
| `apps/storefront/server/services/order-delivery.ts` | EDIT | `TableRecord.branchId` + `validateTable` select + `resolveDelivery` dine_in block |

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `apps/admin/vitest.config.ts` (или root `vitest.config.ts`) |
| Quick run command | `pnpm vitest run apps/admin/features/branches` |
| Full suite command | `pnpm test:run` |

### Phase Requirements → Test Map

| Req | Behavior | Test Type | Automated Command |
|-----|----------|-----------|-------------------|
| D-11/D-12 | `resolveDelivery` для dine_in ставит `branchId` из стола | Unit | `pnpm vitest run apps/storefront/server/services/__tests__/order-delivery` |
| D-10 | `branchesApi.hasTables` возвращает true при наличии столов | Unit | `pnpm vitest run apps/admin/features/branches/__tests__/branches` |
| D-08 | Бэкфилл: одиночный-филиал тенант привязывает столы | Manual (sql + inspect) | — |
| D-04/D-05/D-06 | Фильтрация столов по `currentBranchId` | Manual (E2E) | — |

### Wave 0 Gaps

- [ ] `apps/storefront/server/services/__tests__/order-delivery.test.ts` — покрыть D-11 (dine_in + branchId из стола), D-12 (null + мультибранч → ошибка)
- [ ] Дописать `apps/admin/features/branches/__tests__/branches.test.ts` — тест для `branchesApi.hasTables`

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Storefront также имеет `database.types.ts` или аналог — если нет, `tableData.branch_id` потребует явного cast | Target 2 | TypeScript-ошибка, не runtime |
| A2 | `allTables` в режиме саммари должны загружаться все (без branch-фильтра) — если `tables.vue` не хранит «все» отдельно, нужна вторая загрузка | Target 4 | Счётчики в саммари будут неверными |

---

## Open Questions (RESOLVED)

1. **Обновление `database.types.ts` в storefront**
   - Что знаем: storefront использует Supabase-клиент с `@supabase/ssr`, но его типы могут браться из `apps/admin` или из отдельного файла.
   - Что неясно: нужно ли регенерировать типы отдельно для storefront?
   - **RESOLVED:** проверить import `database.types.ts` в `apps/storefront/server/` — если storefront не использует типизированный клиент (просто `SupabaseClient` без generics), обойтись явным cast `tableData.branch_id as string | null`. (План 07-02 использует явный cast.)

2. **Саммари и `pages/tables.vue` TablesContext**
   - Что знаем: `TablesContextKey` провайдит `tables: Ref<Table[]>` — это уже filteredTables.
   - Что неясно: для саммари нужны ВСЕ столы тенанта (для счётчиков). Нужно либо загружать их отдельно, либо `tables.value` в режиме «Все» оставлять без branch-фильтра.
   - **RESOLVED:** в `pages/tables.vue` при `effectiveBranchId=undefined` (режим «Все») не фильтровать — `tables.value` содержит все. Счётчики считаются из `tables.value`. (План 07-03 Task 3 реализует.)

---

## Sources

### Primary (HIGH confidence)
- `supabase/migrations/059_tables.sql` — DDL таблицы `tables`
- `supabase/migrations/112_add_missing_permissions.sql` — актуальные RLS политики
- `supabase/migrations/289_table_calls_force_rls.sql` — RLS на `table_calls`
- `supabase/migrations/305_tables_realtime.sql` — добавление `tables` в realtime-публикацию
- `supabase/migrations/080_order_numbering.sql` — триггер + `generate_order_number` (строки 54–65, 127–144)
- `apps/storefront/server/services/order-delivery.ts` — полный файл, строки 1–171
- `apps/admin/features/branches/api/branches.ts` — `hasActiveOrders/Reservations/Appointments` pattern (строки 146–235)
- `apps/admin/pages/branches/index.vue` — archive guard UI (строки 144–197)
- `apps/admin/features/tables/api/tables.ts` — полный файл
- `packages/shared/src/types/table.ts` — `Table`, `TableFormData`
- `apps/admin/shared/data/database.types.ts:3381` — текущие типы таблицы `tables`

### Secondary (MEDIUM confidence)
- `apps/admin/pages/orders/index.vue` — эталонный паттерн branch-scope
- `apps/admin/pages/tables.vue` — полная логика провайда `TablesContext`
- `apps/admin/features/branches/composables/useBranch.ts` — `setBranch`, localStorage persistence

---

## Metadata

**Confidence breakdown:**
- Схема + миграция: HIGH — DDL прочитан, стратегия бэкфилла прямолинейна
- order-delivery.ts фикс: HIGH — все строки прочитаны, логика прозрачна
- Админка tables: HIGH — все файлы изучены, паттерны из orders скопированы
- Archive guard: HIGH — точная копия существующего кода, место найдено
- Пер-филиальная нумерация: HIGH — триггер читан, автоматизм подтверждён

**Research date:** 2026-06-01
**Valid until:** 2026-07-01 (стабильная кодовая база)
