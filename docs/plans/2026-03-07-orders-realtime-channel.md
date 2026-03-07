# Orders Realtime: Single Channel

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace two duplicate realtime channels for orders (useOrderAlerts + useRealtimeList) with one shared channel at layout level.

**Architecture:** Module-level composable `useOrdersChannel` manages a single Supabase Realtime channel for the `orders` table per tenant. Consumers (alerts, order list) subscribe to its events via callback registration. `useRealtimeList` remains untouched for other entities.

**Tech Stack:** Vue 3 composables, Supabase Realtime, module-level state pattern (same as `useNewOrderCounter`)

---

### Task 1: Create `useOrdersChannel` composable

**Files:**
- Create: `apps/admin/composables/useOrdersChannel.ts`

**Step 1: Create the composable**

```ts
import { watch, onUnmounted } from 'vue'
import { useNuxtApp } from '#imports'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Order } from '@fastio/shared'
import { mapOrder } from '~/utils/api/orders'

type Handler<T> = (payload: T) => void

// Module-level — shared across the app
const insertHandlers = new Set<Handler<Order>>()
const updateHandlers = new Set<Handler<Order>>()
const deleteHandlers = new Set<Handler<{ id: string }>>()

export const orderEvents = {
  onInsert(handler: Handler<Order>) {
    insertHandlers.add(handler)
    return () => insertHandlers.delete(handler)
  },
  onUpdate(handler: Handler<Order>) {
    updateHandlers.add(handler)
    return () => updateHandlers.delete(handler)
  },
  onDelete(handler: Handler<{ id: string }>) {
    deleteHandlers.add(handler)
    return () => deleteHandlers.delete(handler)
  },
}

/**
 * Call ONCE in layout. Creates a single realtime channel for orders.
 */
export function useOrdersChannel(tenantId: Ref<string | null>) {
  const { $supabase } = useNuxtApp()
  let channel: RealtimeChannel | null = null

  const setup = async (id: string) => {
    const { data: { session } } = await $supabase.auth.getSession()
    if (session?.access_token) $supabase.realtime.setAuth(session.access_token)

    channel = $supabase
      .channel(`orders:${id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'orders',
        filter: `tenant_id=eq.${id}`,
      }, ({ new: row }) => {
        const order = mapOrder(row as Record<string, unknown>)
        insertHandlers.forEach((h) => h(order))
      })
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'orders',
        filter: `tenant_id=eq.${id}`,
      }, ({ new: row }) => {
        const order = mapOrder(row as Record<string, unknown>)
        updateHandlers.forEach((h) => h(order))
      })
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'orders',
      }, ({ old: row }) => {
        deleteHandlers.forEach((h) => h({ id: (row as { id: string }).id }))
      })
      .subscribe()
  }

  watch(tenantId, (id) => {
    channel?.unsubscribe()
    channel = null
    if (id) setup(id)
  }, { immediate: true })

  onUnmounted(() => channel?.unsubscribe())
}
```

**Step 2: Verify file created, no syntax errors**

Run: `cd apps/admin && npx vue-tsc --noEmit --pretty 2>&1 | grep useOrdersChannel || echo "OK"`

---

### Task 2: Wire channel into layout, replace `useOrderAlerts`

**Files:**
- Modify: `apps/admin/layouts/default.vue` (lines 77, 104-106)

**Step 1: Replace imports and usage**

Replace:
```ts
import { useOrderAlerts } from '~/composables/useOrderAlerts'
```
With:
```ts
import { useOrdersChannel } from '~/composables/useOrdersChannel'
```

Replace:
```ts
// Уведомления о новых заказах
const { count: newOrderCount } = useNewOrderCounter()
useOrderAlerts(computed(() => tenantStore.currentTenantId))
```
With:
```ts
// Уведомления о новых заказах
const { count: newOrderCount } = useNewOrderCounter()
useOrdersChannel(computed(() => tenantStore.currentTenantId))
```

**Step 2: Move alert logic into a small composable**

Create: `apps/admin/composables/useOrderAlertHandler.ts`

```ts
import { onUnmounted } from 'vue'
import { orderEvents } from '~/composables/useOrdersChannel'
import { useNewOrderCounter } from '~/composables/useNewOrderCounter'
import { useNotificationPrefs } from '~/composables/useNotificationPrefs'
import { playNotificationSound } from '~/utils/notificationSound'

/**
 * Reacts to new orders from the shared channel: sound + counter.
 * Call in layout after useOrdersChannel.
 */
export function useOrderAlertHandler() {
  const { increment } = useNewOrderCounter()
  const { soundEnabled } = useNotificationPrefs()

  const off = orderEvents.onInsert(() => {
    increment()
    if (soundEnabled.value) playNotificationSound()
  })

  onUnmounted(off)
}
```

**Step 3: Use it in layout**

Add import:
```ts
import { useOrderAlertHandler } from '~/composables/useOrderAlertHandler'
```

Add after `useOrdersChannel(...)`:
```ts
useOrderAlertHandler()
```

---

### Task 3: Rewrite `useOrders` to use shared channel

**Files:**
- Modify: `apps/admin/composables/useOrders.ts`

**Step 1: Replace implementation**

```ts
import { computed, ref, watch, onUnmounted } from 'vue'
import type { Order } from '@fastio/shared'
import type { OrderFilter } from '~/utils/api/orders'
import { orderEvents } from '~/composables/useOrdersChannel'
import { useSupabaseApi } from '~/composables/useSupabaseApi'

export function useOrders(
  tenantId: Ref<string>,
  filter: Ref<OrderFilter>,
  branchId: Ref<string | null> = ref(null),
) {
  const api = useSupabaseApi()
  const orders = ref<Order[]>([]) as Ref<Order[]>
  const loading = ref(false)

  const shouldInclude = (order: Order) =>
    filter.value !== null
    && order.status === filter.value
    && (branchId.value === null || order.branchId === branchId.value)

  // Fetch orders when filter/branch changes
  const fetchOrders = async () => {
    if (!tenantId.value || filter.value === null) {
      orders.value = []
      return
    }
    loading.value = true
    orders.value = await api.orders.list(tenantId.value, filter.value, branchId.value)
    loading.value = false
  }

  watch([tenantId, filter, branchId], fetchOrders, { immediate: true })

  // Subscribe to shared channel events
  const offInsert = orderEvents.onInsert((order) => {
    if (!shouldInclude(order)) return
    if (!orders.value.find((o) => o.id === order.id)) orders.value.push(order)
  })

  const offUpdate = orderEvents.onUpdate((order) => {
    const idx = orders.value.findIndex((o) => o.id === order.id)
    if (idx === -1) return
    if (!shouldInclude(order)) {
      orders.value.splice(idx, 1)
    } else {
      orders.value[idx] = order
    }
  })

  const offDelete = orderEvents.onDelete(({ id }) => {
    orders.value = orders.value.filter((o) => o.id !== id)
  })

  onUnmounted(() => { offInsert(); offUpdate(); offDelete() })

  const updateStatus = async (orderId: string, status: string) => {
    await api.orders.updateStatus(orderId, status)
    const i = orders.value.findIndex((o) => o.id === orderId)

    if (i === -1) return
    if (status !== filter.value) {
      orders.value.splice(i, 1)
    } else {
      orders.value[i] = { ...orders.value[i], status }
    }
  }

  return { orders, loading, updateStatus }
}
```

---

### Task 4: Delete old `useOrderAlerts`

**Files:**
- Delete: `apps/admin/composables/useOrderAlerts.ts`

**Step 1:** Delete the file.

**Step 2:** Verify no remaining imports:

Run: `grep -r "useOrderAlerts" apps/admin/`

Expected: no results.

---

### Task 5: Verify & commit

**Step 1:** Type-check:

Run: `cd apps/admin && npx vue-tsc --noEmit`

**Step 2:** Dev server check:

Run: `cd apps/admin && npx nuxt dev` — open orders page, verify no console errors.

**Step 3:** Manual test — insert order from psql, verify:
- Sound plays
- Counter increments
- Card appears in list without page reload

**Step 4:** Commit all changes.
