# Phase 7: dine-in-tables-branch-id — Pattern Map

**Mapped:** 2026-06-01
**Files analyzed:** 12 (10 edits + 1 create + 1 regen)
**Analogs found:** 11 / 12 (database.types.ts is regen — no analog needed)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/307_tables_branch_id.sql` | migration | batch (DDL + backfill) | `supabase/migrations/029_orders_delivery_zone.sql` + `255_backfill_unavailability_from_overrides.sql` | role-match |
| `packages/shared/src/types/table.ts` | model | — | `packages/shared/src/types/table.ts` (self) | exact (edit) |
| `apps/admin/shared/data/database.types.ts` | config | — | — (regen via `supabase gen types`) | regen |
| `apps/admin/features/tables/api/tables.ts` | api | CRUD | `apps/admin/features/branches/api/branches.ts` | role-match |
| `apps/admin/features/branches/api/branches.ts` | api | CRUD | self (edit — add `hasTables`) | exact (edit) |
| `apps/admin/pages/branches/index.vue` | page | request-response | self (edit — expand `handleArchive`) | exact (edit) |
| `apps/admin/pages/tables.vue` | page (provider) | CRUD + realtime | `apps/admin/pages/orders/index.vue` (branch-scope pattern) | role-match |
| `apps/admin/pages/tables/list.vue` | component | request-response | self (edit — add summary branch, createTable branchId) | exact (edit) |
| `apps/admin/pages/tables/layout.vue` | component | request-response | self (edit — add summary guard) | exact (edit) |
| `apps/admin/features/tables/components/TablesBranchSummary.vue` | component | request-response | `apps/admin/features/catalog/components/CategoryList.vue` | role-match |
| `apps/admin/features/tables/feature.manifest.ts` | config | — | self (edit — add dependsOn entry) | exact (edit) |
| `apps/storefront/server/services/order-delivery.ts` | service | request-response | self (edit — D-11/D-12) | exact (edit) |

---

## Pattern Assignments

### `supabase/migrations/307_tables_branch_id.sql` (migration, DDL + backfill)

**Analog 1 (ADD COLUMN nullable FK):** `supabase/migrations/029_orders_delivery_zone.sql` (entire file, 1 line)

```sql
-- Exact pattern for nullable FK with ON DELETE SET NULL:
ALTER TABLE orders ADD COLUMN delivery_zone_id uuid REFERENCES delivery_zones(id) ON DELETE SET NULL;
```

Apply same shape:
```sql
ALTER TABLE tables
  ADD COLUMN branch_id UUID REFERENCES branches(id) ON DELETE SET NULL;

CREATE INDEX idx_tables_branch_id ON tables(branch_id);
```

**Analog 2 (backfill with idempotent UPDATE):** `supabase/migrations/255_backfill_unavailability_from_overrides.sql`

Key pattern — correlated subquery backfill with `WHERE NOT EXISTS`-equivalent (or count-guard):
```sql
-- Pattern: backfill only rows matching a single-value condition,
-- use subquery SELECT COUNT to guard the assignment target
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

**File header comment pattern** (from migration 255):
```sql
-- Migration NNN: <one-line purpose>
--
-- <Why: root cause + consequence>
--
-- <Backfill logic explanation>
-- <ON DELETE strategy rationale>
```

---

### `packages/shared/src/types/table.ts` (model, edit)

**Analog:** self (lines 21–53)

**Current `Table` type** (lines 21–39) — add `branchId: string | null` after `tenantId`:
```typescript
// packages/shared/src/types/table.ts — Table type (lines 21–39)
export type Table = {
  id: string
  tenantId: string
  // ADD: branchId: string | null
  name: string
  isOpen: boolean
  // ... rest unchanged
}
```

**Current `TableFormData` type** (lines 41–53) — add optional `branchId?`:
```typescript
// packages/shared/src/types/table.ts — TableFormData (lines 41–53)
export type TableFormData = {
  name: string
  capacity?: number | null
  // ADD: branchId?: string | null
  tags?: string[]
  // ... rest unchanged
}
```

**Convention note:** project uses `type` (not `interface`), camelCase mapping of `snake_case` DB columns (`branch_id` → `branchId`). No `interface` keyword anywhere in shared types.

---

### `apps/admin/shared/data/database.types.ts` (regen)

**No analog — generated file.** After applying migration 307, run:
```bash
supabase gen types typescript --local > apps/admin/shared/data/database.types.ts
```

The regen adds `branch_id: string | null` to `tables.Row`, `tables.Insert`, `tables.Update`, and adds a `Relationships` entry for the FK.

`db-types.ts` re-exports `TableRow = Tables<'tables'>` (line 127) — will automatically pick up the new column after regen.

---

### `apps/admin/features/tables/api/tables.ts` (api, CRUD edit)

**Analog:** `apps/admin/features/branches/api/branches.ts` (mapper + list + insert patterns)

**Mapper pattern** — `mapBranch` (lines 8–31) is the exact pattern for `mapTable`. Add `branchId` field:
```typescript
// apps/admin/features/tables/api/tables.ts — mapTable (lines 27–49, edit)
// PATTERN SOURCE: mapBranch at apps/admin/features/branches/api/branches.ts:8
export const mapTable = (raw: Record<string, unknown>): Table => {
  const row = raw as TableRow

  return {
    id: row.id,
    tenantId: row.tenant_id,
    branchId: row.branch_id ?? null,  // ADD — maps new DB column
    name: row.name,
    // ... all other existing fields unchanged
  }
}
```

**list with optional branch filter** — `ordersApi.list` branch filter pattern (RESEARCH.md lines 268–274):
```typescript
// apps/admin/features/tables/api/tables.ts — tablesApi.list (line 52)
async list(sb: SupabaseClient, tenantId: string, branchId?: string | null): Promise<Table[]> {
  let q = sb.from('tables')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('created_at')

  if (branchId !== undefined && branchId !== null) {
    q = q.eq('branch_id', branchId)
  }
  // branchId=undefined OR null → no branch filter (all tables, D-04 case)

  const data = await query(q)

  return (data ?? []).map(mapTable)
},
```

**add with branch_id** — `branchesApi.add` pattern (lines 91–97):
```typescript
// apps/admin/features/tables/api/tables.ts — tablesApi.add (line 60, edit)
async add(sb: SupabaseClient, tenantId: string, data: TableFormData): Promise<Table | null> {
  const result = await query(
    sb.from('tables').insert({
      tenant_id: tenantId,
      name: data.name,
      branch_id: data.branchId ?? null,  // ADD
      capacity: data.capacity ?? null,
      // ... all other existing fields unchanged
    }).select().single(),
  )

  return result ? mapTable(result) : null
},
```

---

### `apps/admin/features/branches/api/branches.ts` (api, edit — add `hasTables`)

**Analog:** `branchesApi.hasActiveAppointments` (lines 217–235) — simplest of the three guards (single count query, no status lookup)

```typescript
// apps/admin/features/branches/api/branches.ts — new method after hasActiveAppointments
// PATTERN SOURCE: hasActiveAppointments lines 217–235 (same shape, simpler)
async hasTables(sb: SupabaseClient, branchId: string): Promise<boolean> {
  const { count, error } = await sb
    .from('tables')
    .select('id', { count: 'exact', head: true })
    .eq('branch_id', branchId)
    .eq('is_active', true)

  if (error) {
    reportError(error, { context: 'branches.hasTables', branchId })

    // Fail-safe: блокируем архивацию при ошибке (парность с hasActiveReservations).
    return true
  }

  return (count ?? 0) > 0
},
```

**Import pattern** (line 4): `reportError` is already imported at the top of `branches.ts`:
```typescript
import { reportError } from '@fastio/shared/observability'
```

No new imports needed.

---

### `apps/admin/pages/branches/index.vue` (page, edit — expand `handleArchive`)

**Analog:** self, lines 144–197 (the existing `handleArchive` function)

**Exact expansion pattern** — add `hasTables` to the `Promise.all` and add an `if (hasTables)` block in the same style as `hasAppointments` (lines 177–186):

```typescript
// apps/admin/pages/branches/index.vue — handleArchive (lines 144+, edit)
// PATTERN SOURCE: lines 149–186 (existing guard sequence)
const handleArchive = async (branch: Branch) => {
  const [hasOrders, hasReservations, hasAppointments, hasTables] = await Promise.all([
    api.branches.hasActiveOrders(branch.id, tenantId.value),
    api.branches.hasActiveReservations(branch.id, tenantId.value),
    api.branches.hasActiveAppointments(branch.id, tenantId.value),
    api.branches.hasTables(branch.id),   // ADD — no tenantId needed (branch_id filter)
  ])

  // ... existing hasOrders / hasReservations / hasAppointments checks unchanged ...

  if (hasTables) {
    await confirm({
      title: 'Нельзя архивировать филиал',
      message: `У филиала «${branch.name}» есть столы. Перенесите или удалите их, а затем попробуйте снова.`,
      confirmText: false,
      cancelText: 'Понятно',
    })

    return
  }

  // ... existing final confirm unchanged ...
}
```

**`confirm` call shape** (lines 155–163) — `title`, `message`, `confirmText: false`, `cancelText: 'Понятно'` for blocking messages; `confirmText: 'Архивировать'` for action confirmation.

---

### `apps/admin/pages/tables.vue` (page/provider, edit — add branch-scope)

**Analog:** `apps/admin/pages/orders/index.vue` (lines 33–37) for branch-scope pattern; self for realtime/provide structure

**Branch store import + computed** (from `orders/index.vue:33–37`):
```typescript
// apps/admin/pages/tables.vue — add to script setup imports + store setup
// PATTERN SOURCE: apps/admin/pages/orders/index.vue lines 33–37
import { useBranchStore } from '~/shared/stores/branch'
// ...
const branchStore = useBranchStore()
const { branches } = storeToRefs(branchStore)    // for D-04 check

const effectiveBranchId = computed<string | undefined>(() => {
  // D-04: один филиал → не фильтруем (показываем все)
  if (branchStore.branches.length <= 1) return undefined
  // D-05/D-06: конкретный → фильтруем; null → без фильтра (саммари-режим)
  return branchStore.currentBranchId ?? undefined
})
```

**watch pattern for branch-reactive reload** (from `tables.vue:179–181` existing watch on `tenantId`):
```typescript
// apps/admin/pages/tables.vue — replace tenantId watch with dual watch
// PATTERN SOURCE: existing watch(tenantId, ...) line 179
watch([tenantId, effectiveBranchId], ([id]) => {
  if (id) void load(id)
}, { immediate: true })
```

**`load` signature extension**:
```typescript
// apps/admin/pages/tables.vue — load function (line 158)
const load = async (id: string) => {
  loading.value = true
  try {
    const [loadedTables, tags, types, calls] = await Promise.all([
      api.tables.list(id, effectiveBranchId.value),  // ADD second arg
      // ... rest unchanged
    ])
    // ...
  } finally {
    loading.value = false
  }
}
```

**`tableCountByBranch` computed for summary** (RESEARCH.md code example):
```typescript
// apps/admin/pages/tables.vue — new computed for D-06 summary
const tableCountByBranch = computed(() => {
  const map: Record<string, { total: number; open: number }> = {}

  for (const t of tables.value) {
    if (!t.branchId) continue
    const entry = (map[t.branchId] ??= { total: 0, open: 0 })
    entry.total++
    if (t.isOpen) entry.open++
  }

  return map
})
```

**`showSummary` flag and `upsertTableFromRealtime` branch guard**:
```typescript
// apps/admin/pages/tables.vue — add to provide context and realtime
const showSummary = computed(() =>
  branchStore.branches.length > 1 && branchStore.currentBranchId === null
)

// upsertTableFromRealtime — add branch guard (RESEARCH.md Investigation 7)
const upsertTableFromRealtime = (table: Table) => {
  if (!table.isActive) {
    tables.value = tables.value.filter((t) => t.id !== table.id)
    return
  }
  // ADD: don't add tables from other branches when filtered
  if (effectiveBranchId.value && table.branchId && table.branchId !== effectiveBranchId.value) return
  const idx = tables.value.findIndex((t) => t.id === table.id)
  if (idx !== -1) tables.value[idx] = table
  else tables.value.push(table)
}
```

**Provide context extension** — add `showSummary`, `tableCountByBranch`, `branches` to `TablesContextKey` provide object (line 488).

---

### `apps/admin/pages/tables/list.vue` (component, edit)

**Analog:** self (existing structure) + `orders/index.vue` (branch-scope pattern)

**`showSummary` conditional render** — add at top of `<template>` wrapper, before existing content:
```vue
<!-- apps/admin/pages/tables/list.vue — add v-if/v-else top-level -->
<!-- PATTERN SOURCE: structure of existing template v-if="ctx.loading" / v-else -->
<template v-if="ctx.showSummary">
  <TablesBranchSummary
    :branches="ctx.branches"
    :table-count-by-branch="ctx.tableCountByBranch"
  />
</template>
<template v-else>
  <!-- existing list content unchanged -->
</template>
```

**`createTable` branch-aware** — `useBranchStore` already available via ctx; add branchId resolution:
```typescript
// apps/admin/pages/tables/list.vue — createTable (line 119)
// PATTERN SOURCE: D-04/D-05 logic; branchStore via ctx or direct import
const createTable = async () => {
  const tenantId = ctx.tenantId
  if (!tenantId) return

  // Resolve branchId per D-04/D-05: single branch → use it; multi + null → hidden (user sees summary)
  const branchId = ctx.branches.length === 1
    ? ctx.branches[0].id
    : branchStore.currentBranchId  // non-null when not in summary mode

  const n = allTables.value.length + 1
  const created = await api.tables.add(tenantId, { name: `Стол ${n}`, branchId })
  // ... rest unchanged
}
```

**Unassigned tables alert** — show when `branches.length > 1 && hasUnassignedTables`:
```vue
<!-- apps/admin/pages/tables/list.vue — add alert after UiTag ready count -->
<!-- PATTERN SOURCE: UiTag usage pattern in existing list.vue line 3 -->
<UiTag
  v-if="ctx.branches.length > 1 && ctx.hasUnassignedTables"
  type="warning"
>
  Некоторые столы не привязаны к филиалу. Отредактируйте их, чтобы dine-in заказы поступали на нужную кухню.
</UiTag>
```

Add `hasUnassignedTables` computed to `tables.vue` provide context: `tables.value.some((t) => !t.branchId)`.

---

### `apps/admin/pages/tables/layout.vue` (component, edit — summary guard)

**Analog:** self (existing inject + template structure, lines 1–60)

**Summary guard at template top** — same `showSummary` from context:
```vue
<!-- apps/admin/pages/tables/layout.vue — add at top of template -->
<!-- PATTERN SOURCE: same context injection as list.vue (useTablesContext()) -->
<template v-if="ctx.showSummary">
  <TablesBranchSummary
    :branches="ctx.branches"
    :table-count-by-branch="ctx.tableCountByBranch"
  />
</template>
<template v-else>
  <!-- existing TablesCanvas + drawers unchanged -->
</template>
```

Add to `<script setup>` imports:
```typescript
import TablesBranchSummary from '~/features/tables/components/TablesBranchSummary.vue'
```

---

### `apps/admin/features/tables/components/TablesBranchSummary.vue` (new component)

**Analog:** `apps/admin/features/catalog/components/CategoryList.vue` (UiListRow list with count meta)

**Full component shape:**

Template (from `CategoryList.vue` UiListRow pattern + `branches/index.vue` branch-row div pattern):
```vue
<template>
  <div class="summary-root">
    <UiSectionHeader title="Выберите филиал" />
    <UiCard size="large">
      <div
        v-for="branch in branches"
        :key="branch.id"
        class="summary-row"
        @click="selectBranch(branch.id)"
      >
        <UiText size="medium">{{ branch.name }}</UiText>
        <UiText size="tiny" color="tertiary">
          {{ countLabel(branch.id) }}
        </UiText>
      </div>
      <UiEmpty v-if="!branches.length" icon="building" text="Нет активных филиалов" />
    </UiCard>
  </div>
</template>
```

Script setup (conventions: type for props, named exports, explicit imports, storeToRefs):
```typescript
<script setup lang="ts">
import { computed } from 'vue'
import { UiCard, UiText, UiEmpty, UiSectionHeader } from '@fastio/ui'
import type { Branch } from '@fastio/shared'
import { useBranchStore } from '~/shared/stores/branch'

const props = defineProps<{
  branches: Branch[]
  tableCountByBranch: Record<string, { total: number; open: number }>
}>()

const branchStore = useBranchStore()

const selectBranch = (id: string) => {
  branchStore.setBranch(id)
}

const countLabel = (branchId: string) => {
  const counts = props.tableCountByBranch[branchId]
  if (!counts) return 'Нет столов'
  const { total, open } = counts
  return open > 0
    ? `${total} столов · ${open} открыто`
    : `${total} столов`
}
</script>
```

Style (SCSS tokens, no hardcode, no BEM, root class = component-relevant):
```scss
<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;

.summary-root {
  @include flex-col(var(--space-16));
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-12) var(--space-16);
  border-radius: var(--radius-8);
  cursor: pointer;

  &:hover {
    background: var(--color-bg-hover);
  }
}
</style>
```

---

### `apps/admin/features/tables/feature.manifest.ts` (config, edit)

**Analog:** self (lines 30–45, `dependsOn` array)

**Add entry** to `dependsOn`:
```typescript
// apps/admin/features/tables/feature.manifest.ts — dependsOn array (line 30+)
dependsOn: [
  // ... existing entries ...
  'shared.stores.branch',  // ADD — for D-02/D-03/D-04 branch-aware logic
],
```

---

### `apps/storefront/server/services/order-delivery.ts` (service, edit — D-11/D-12)

**Analog:** self (the file being edited; the `pickup` branch at lines 117–122 is the exact shape to copy for `dine_in`)

**Step 1 — `TableRecord` type** (lines 7–10):
```typescript
// БЫЛО (lines 7–10):
export type TableRecord = {
  id: string
  name: string
}

// СТАЛО:
export type TableRecord = {
  id: string
  name: string
  branchId: string | null  // D-11: добавлено для маршрутизации dine_in
}
```

**Step 2 — `validateTable` select** (line 32):
```typescript
// БЫЛО:
.select('id, name, is_open')

// СТАЛО:
.select('id, name, is_open, branch_id')
```

**Step 3 — `validateTable` return** (line 41):
```typescript
// БЫЛО:
return { id: tableData.id as string, name: tableData.name as string }

// СТАЛО:
return {
  id: tableData.id as string,
  name: tableData.name as string,
  branchId: tableData.branch_id as string | null,
}
```

**Step 4 — `resolveDelivery` dine_in block** (lines 116–131) — copy `pickup` branch shape:
```typescript
// apps/storefront/server/services/order-delivery.ts
// PATTERN SOURCE: pickup branch lines 117–123 (same shape)
// Insert BEFORE the existing "else if (branchRows?.length === 1)" fallback:
if (!branchId) {
  if (deliveryType === 'pickup' && body.branchId) {
    // ... existing pickup logic unchanged ...
  } else if (deliveryType === 'dine_in' && tableRecord) {    // ADD dine_in block
    if (tableRecord.branchId) {
      branchId = tableRecord.branchId
    } else if (branchRows?.length === 1) {
      // D-12 fallback: стол без branch_id на single-branch тенанте
      branchId = branchRows[0].id as string
    } else if (branchRows && branchRows.length > 1) {
      // D-12: мультибранч + стол без branch_id = конфиг-ошибка тенанта
      throw createError({
        statusCode: 400,
        message: 'Стол не привязан к филиалу. Обратитесь к администратору заведения.',
      })
    }
  } else if (branchRows?.length === 1) {
    branchId = branchRows[0].id as string
  }
}

// Change the dine_in null bypass (line 129):
// БЫЛО:
if (!branchId && deliveryType !== 'dine_in') {
  throw createError(...)
}

// СТАЛО (dine_in теперь всегда имеет branchId после блока выше, убираем исключение):
if (!branchId) {
  throw createError({ statusCode: 400, message: 'Не удалось определить филиал для заказа' })
}
```

**Error pattern** (existing `createError` calls in same file):
```typescript
throw createError({ statusCode: 400, message: '...' })  // Nitro auto-import, no explicit import needed
```

---

## Shared Patterns

### Branch Store Access
**Source:** `apps/admin/pages/orders/index.vue` lines 33–37
**Apply to:** `pages/tables.vue`, `pages/tables/list.vue`, `features/tables/components/TablesBranchSummary.vue`
```typescript
import { useBranchStore } from '~/shared/stores/branch'
import { storeToRefs } from 'pinia'

const branchStore = useBranchStore()
const { branches } = storeToRefs(branchStore)
const branchId = computed(() => branchStore.currentBranchId)
```

### Archive Guard Pattern
**Source:** `apps/admin/pages/branches/index.vue` lines 149–196
**Apply to:** `pages/branches/index.vue` (edit), `features/branches/api/branches.ts` (new method)
```typescript
// API method: count query + reportError + fail-safe return true
const { count, error } = await sb.from('table').select('id', { count: 'exact', head: true })...
if (error) { reportError(error, { context: '...', branchId }); return true }
return (count ?? 0) > 0

// UI: Promise.all + if (hasX) { await confirm({ title, message, confirmText: false, cancelText: 'Понятно' }); return }
```

### reportError Convention
**Source:** `apps/admin/features/branches/api/branches.ts` lines 154, 172, 201, 229
**Apply to:** All new Supabase query error paths
```typescript
import { reportError } from '@fastio/shared/observability'
// In catch/error paths:
reportError(error, { context: 'featureName.methodName', branchId })
```

### Mapper camelCase Convention
**Source:** `apps/admin/features/branches/api/branches.ts` lines 8–31 (`mapBranch`)
**Apply to:** `mapTable` edit in `tables/api/tables.ts`
```typescript
// snake_case DB columns → camelCase domain model
const row = raw as TableRow
return {
  fieldName: row.field_name,        // direct
  nullableField: row.nullable ?? null,  // ?? null for nullable
}
```

### UiListRow / UiCard List Component
**Source:** `apps/admin/features/catalog/components/CategoryList.vue` lines 1–44
**Apply to:** `TablesBranchSummary.vue`
```typescript
// Imports: UiCard, UiText, UiEmpty, UiSectionHeader from '@fastio/ui'
// defineProps<{ items: T[], ... }>() — generic, no runtime validators
// No BEM, short class names (.summary-root, .summary-row)
// SCSS tokens only: var(--space-*), var(--radius-*), var(--color-*)
```

### useConfirm / Blocking Message
**Source:** `apps/admin/pages/branches/index.vue` lines 155–163
**Apply to:** `pages/branches/index.vue` hasTables block
```typescript
import { useConfirm } from '@fastio/kit'
const { confirm } = useConfirm()
await confirm({ title: 'Нельзя ...', message: '...', confirmText: false, cancelText: 'Понятно' })
return  // always return after blocking confirm
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `apps/admin/shared/data/database.types.ts` | config | — | Generated file — no analog; run `supabase gen types typescript --local` after migration 307 |

---

## Key Pitfalls Confirmed from Code Reading

1. **`mapTable` missing `branchId`** — confirmed: `apps/admin/features/tables/api/tables.ts:27–49` has no `branch_id` mapping. Must add simultaneously with `Table` type.

2. **`validateTable` cast** — storefront doesn't use typed Supabase client (no `database.types.ts` in storefront server). `tableData.branch_id` needs explicit cast: `tableData.branch_id as string | null`.

3. **`load` in `tables.vue` ignores branch** — confirmed: `tables.vue:158–177` calls `api.tables.list(id)` with only `tenantId`. Need to pass `effectiveBranchId.value` as second arg.

4. **`createTable` in `list.vue`** — confirmed: `list.vue:125` calls `api.tables.add(tenantId, { name })` without `branchId`. Needs `branchId` from resolved branch.

5. **`useDatabase` binding** — `hasTables` added to `branchesApi` will be automatically bound via `bindAll(branchesApi, sb)` at `useDatabase.ts:71`. No change to `useDatabase.ts` needed.

6. **`dine_in` null bypass removal** — confirmed at `order-delivery.ts:129`: `if (!branchId && deliveryType !== 'dine_in')` must become `if (!branchId)` once the dine_in block above always sets `branchId` or throws.

---

## Metadata

**Analog search scope:** `apps/admin/features/`, `apps/admin/pages/`, `apps/admin/shared/`, `apps/storefront/server/services/`, `supabase/migrations/`, `packages/shared/src/types/`
**Files read:** 14 source files + 3 migration files
**Pattern extraction date:** 2026-06-01
