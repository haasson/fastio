# apps/admin

Административная панель FastIO. Nuxt 3 SPA (`ssr: false`), Supabase, Pinia.

---

## Стек

- **Nuxt 3** — SPA-режим, без SSR
- **Supabase** — PostgreSQL, Auth, Realtime, Edge Functions
- **Pinia** — глобальное состояние
- **@fastio/ui** — компонентная библиотека (использовать до написания своих!)
- **@fastio/shared** — общие типы домена

---

## Работа с базой данных

### Слои архитектуры

```
utils/api/*.ts
      ↓
useDatabase()
      ↓
composables/use*.ts
      ↓
stores/*.ts  (опционально)
      ↓
компоненты
```

#### 1. `utils/api/*.ts` — Supabase-запросы

Чистые функции без реактивности. Каждая принимает `sb: SupabaseClient` первым аргументом. Здесь маппинг `snake_case → camelCase` и вся работа с Supabase напрямую.

```ts
// utils/api/branches.ts
export const branchesApi = {
  list: async (sb: SupabaseClient, tenantId: string): Promise<Branch[]> => { ... },
  add:  async (sb: SupabaseClient, tenantId: string, data: BranchFormData): Promise<Branch> => { ... },
}
```

#### 2. `useDatabase()` — DI-слой

Биндит `sb` ко всем методам через `bindAll()` и собирает все модули в одном месте. Это единственное место, где `SupabaseClient` достаётся из контекста Nuxt.

```ts
const api = useDatabase()
await api.branches.list(tenantId) // sb уже привязан
```

**Правило:** компоненты и composables берут API только через `useDatabase()`, никогда не импортируют `supabase` напрямую.

#### 3. `composables/use*.ts` — бизнес-логика и реактивность

Вызывают `api.*`, управляют состоянием, возвращают удобный интерфейс. Вся логика работы с данными — здесь.

```ts
const { branches, loading, add, archive } = useBranches(tenantId)
```

**Правило:** никаких прямых вызовов `api.*` в компонентах или сторах.

#### 4. `stores/*.ts` — глобальное состояние

Используются только когда данные нужны в нескольких несвязанных частях приложения (tenant, branch, auth, статусы заказов). Стор сам логики не содержит — создаёт composable и пробрасывает наружу.

#### 5. Компоненты

Только рендер и вызов методов из composable. Никаких `api.*`, никакого `useDatabase()`.

---

## Realtime

Supabase Realtime позволяет получать изменения из БД в реальном времени через WebSocket, без опроса сервера. Используется для мгновенного обновления UI при изменениях данных — заказы, статусы, настройки.

### Примитивы

#### `useRealtimeList(options)` — реактивный список с подпиской

Для коллекций. Делает начальный fetch, затем подписывается на INSERT/UPDATE/DELETE и обновляет список на месте.

```ts
const { items: branches, loading } = useRealtimeList({
  channelKey: computed(() => `branches:${tenantId.value}`),
  table: 'branches',
  filter: computed(() => `tenant_id=eq.${tenantId.value}`),
  fetch: () => api.branches.list(tenantId.value),
  mapper: mapBranch,
  shouldInclude: (branch) => !branch.archivedAt, // опционально: фильтр на клиенте
})
```

- `channelKey = null` — подписка неактивна (например, tenantId ещё не загружен)
- `shouldInclude` — позволяет исключать элементы из списка без повторного fetch (например, архивированные)
- Автоматически отписывается при размонтировании компонента

#### `useRealtimeWatch(table, id, handlers)` — подписка на одну строку или набор строк

Для одиночных объектов и кастомных случаев. Управляет lifecycle канала — создаёт при появлении `id`, пересоздаёт при смене, удаляет при `null`.

```ts
// Следим за строкой в таблице 'tenants' где id = currentTenantId
useRealtimeWatch('tenants', currentTenantId, {
  onUpdate: () => fetchTenant(),
})

// Следим за всеми заказами тенанта (другая колонка)
useRealtimeWatch('orders', tenantId, {
  column: 'tenant_id', // по умолчанию 'id'
  onInsert: (row) => ...,
  onUpdate: (row) => ...,
  onDelete: (row) => ...,
})
```

- Ключ канала (`${table}:${id}`) и фильтр (`${column}=eq.${id}`) строятся автоматически
- Колонка по умолчанию — `id`
- Handlers получают уже распакованный `row: Record<string, unknown>` (без Supabase-обёртки `{ new: row }`)
- Возвращает `{ dispose }` для явной очистки вне компонентного контекста
- В компонентах — `onUnmounted` регистрируется автоматически

### Канал заказов

`useOrdersChannel(tenantId)` — singleton-канал для заказов всего тенанта, который живёт в лейауте. Создаётся один раз на всё приложение.

Другие composables подписываются на события через `orderEvents`:

```ts
// Внутри composable:
const off = orderEvents.onInsert((order) => { ... })
onUnmounted(off) // отписка при размонтировании
```

Такой подход позволяет иметь один WebSocket-канал на заказы вместо отдельного канала на каждый компонент.

### Правила

- `useRealtimeList` и `useRealtimeWatch` используются **только внутри composables**, не в компонентах и не в сторах
- Supabase `realtime.subscribeToTable()` вызывается **только внутри этих примитивов**
- В composable не должно быть ни `api.realtime.*`, ни ручного управления `RealtimeChannel`
