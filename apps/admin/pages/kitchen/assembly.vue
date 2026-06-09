<template>
  <div class="assembly-root">
    <div v-if="loading" class="kanban">
      <div class="kanban-col">
        <UiCard v-for="i in 2" :key="i">
          <UiSkeleton :repeat="4" />
        </UiCard>
      </div>
    </div>

    <template v-else-if="allOrderGroups.length">
      <UiTabs
        v-model="mobilePhase"
        :tabs="mobilePhaseTabs"
        class="phase-tabs"
      />

      <div class="kanban" data-tour="kitchen-kanban">
        <div class="kanban-col" data-tour="kitchen-assembly-cooking" :class="{ 'hidden-mobile': mobilePhase !== 'cooking' }">
          <div class="kanban-header">
            <span class="kanban-title">Готовится на кухне</span>
            <span class="kanban-count">{{ cookingGroups.length }}</span>
          </div>
          <KitchenAssemblyCard
            v-for="group in cookingGroups"
            :key="group.orderId"
            data-tour="kitchen-assembly-card"
            :order-id="group.orderId"
            :order-number="group.orderNumber"
            :delivery-type="group.deliveryType"
            :items="group.items"
            @collect-item="onCollectItem"
          />
          <UiEmpty
            v-if="!cookingGroups.length"
            icon="chefHat"
            text="Всё приготовлено"
          />
        </div>

        <div class="kanban-col kanban-col--ready" data-tour="kitchen-assembly-ready" :class="{ 'hidden-mobile': mobilePhase !== 'ready' }">
          <div class="kanban-header">
            <span class="kanban-title">Готово</span>
            <span class="kanban-count kanban-count--green">{{ readyGroups.length }}</span>
          </div>
          <KitchenAssemblyCard
            v-for="group in readyGroups"
            :key="group.orderId"
            data-tour="kitchen-assembly-card"
            :order-id="group.orderId"
            :order-number="group.orderNumber"
            :delivery-type="group.deliveryType"
            :items="group.items"
            @assembled="onAssembled"
            @collect-item="onCollectItem"
          />
          <UiEmpty
            v-if="!readyGroups.length"
            icon="cart"
            text="Нет заказов к сборке"
          />
        </div>

        <div v-if="cancelledGroups.length" class="kanban-col kanban-col--cancelled" :class="{ 'hidden-mobile': mobilePhase !== 'cancelled' }">
          <div class="kanban-header">
            <span class="kanban-title">Отменено</span>
            <span class="kanban-count kanban-count--red">{{ cancelledGroups.length }}</span>
          </div>
          <KitchenAssemblyCard
            v-for="group in cancelledGroups"
            :key="group.orderId"
            :order-id="group.orderId"
            :order-number="group.orderNumber"
            :delivery-type="group.deliveryType"
            :items="group.items"
            :cancelled="true"
            @dismissed="onDismissed"
          />
        </div>
      </div>
    </template>

    <UiEmpty v-else icon="check" text="Нет активных заказов" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { UiCard, UiSkeleton, UiEmpty, UiTabs } from '@fastio/ui'
import { type KitchenQueueItem, type OrderEvent, type OrderPhase, getOrderPhase, getAssemblyColumn } from '@fastio/shared'
import { useDatabase } from '~/shared/data/useDatabase'
import { useTenantStore } from '~/shared/stores/tenant'
import { useAuthStore } from '~/shared/stores/auth'
import { kitchenQueueEvents } from '~/features/kitchen'
import KitchenAssemblyCard from '~/features/kitchen/components/KitchenAssemblyCard.vue'
import { reportError } from '@fastio/shared/observability'
import { mergeRealtimeItem } from '~/features/kitchen'

const api = useDatabase()
const tenantStore = useTenantStore()
const authStore = useAuthStore()

const mobilePhase = ref<'cooking' | 'ready' | 'cancelled'>('ready')

const loading = ref(false)
const items = ref<KitchenQueueItem[]>([])

type OrderGroup = {
  orderId: string
  orderNumber: string | null
  deliveryType: string
  items: KitchenQueueItem[]
  phase: OrderPhase
}

const allOrderGroups = computed<OrderGroup[]>(() => {
  const map = new Map<string, OrderGroup>()

  for (const item of items.value) {
    let group = map.get(item.orderId)

    if (!group) {
      group = { orderId: item.orderId, orderNumber: item.orderNumber, deliveryType: item.deliveryType, items: [], phase: 'ready' }
      map.set(item.orderId, group)
    }

    group.items.push(item)
  }

  const groups = [...map.values()]

  for (const g of groups) {
    g.phase = getOrderPhase(g.items)
  }

  return groups
})

const cookingGroups = computed(() => allOrderGroups.value.filter((g) => getAssemblyColumn(g.phase) === 'cooking'))
// «Готово» = collecting + ready (см. getAssemblyColumn). Сначала те, где надо
// ещё собрать некухонные позиции (collecting), потом полностью готовые к выдаче (ready).
const readyGroups = computed(() => {
  const inReady = allOrderGroups.value.filter((g) => getAssemblyColumn(g.phase) === 'ready')

  return [...inReady.filter((g) => g.phase === 'collecting'), ...inReady.filter((g) => g.phase === 'ready')]
})
const cancelledGroups = computed(() => allOrderGroups.value.filter((g) => getAssemblyColumn(g.phase) === 'cancelled'))

const mobilePhaseTabs = computed(() => {
  const tabs = [
    { value: 'cooking', label: `Готовится (${cookingGroups.value.length})` },
    { value: 'ready', label: `Готово (${readyGroups.value.length})` },
  ]

  if (cancelledGroups.value.length) {
    tabs.push({ value: 'cancelled', label: `Отменено (${cancelledGroups.value.length})` })
  }

  return tabs
})

const load = async () => {
  loading.value = true
  try {
    items.value = await api.kitchenQueue.listForAssembly(tenantStore.tenant.id)
  } catch (e) {
    reportError(e, { context: 'kitchen/assembly:load', tenantId: tenantStore.tenant.id })
  } finally {
    loading.value = false
  }
}

watch(() => tenantStore.tenant.id, () => {
  load()
}, { immediate: true })

const onCollectItem = (itemId: string, collected: boolean) => {
  const idx = items.value.findIndex((i) => i.id === itemId)

  if (idx === -1) return

  const prev = items.value[idx]
  const optimisticStatus = collected ? 'done' as const : 'queued' as const

  items.value[idx] = { ...prev, status: optimisticStatus }

  const promise = collected
    ? api.kitchenQueue.complete(itemId)
    : api.kitchenQueue.uncollect(itemId)

  promise.catch((err) => {
    items.value[idx] = prev
    reportError(err)
  })
}

const onDismissed = async (orderId: string) => {
  items.value = items.value.filter((i) => i.orderId !== orderId)
  try {
    await api.kitchenQueue.dismissCancelledOrder(orderId)
  } catch (e) {
    reportError(e, { context: 'kitchen/assembly:onDismissed', orderId })
    await load() // ресинк: если в БД не записалось, убранная локально карточка вернётся
  }
}

// Атрибуция сборки: кто нажал «Собрано». Готовка логируется на /queue
// (kitchen_claimed/completed), а сборка раньше нет — событие kitchen_served
// закрывает дыру, чтобы в таймлайне заказа было видно «собрал X».
const logServed = async (orderId: string, meta: Record<string, unknown>) => {
  const user = authStore.user

  if (!user) return
  await api.orderEvents.add({
    orderId,
    tenantId: tenantStore.tenant.id,
    actorId: user.id,
    actorName: user.user_metadata?.full_name || user.email || null,
    actorRole: tenantStore.currentRoleName ?? null,
    eventType: 'kitchen_served' as OrderEvent['eventType'],
    meta,
  }).catch(reportError)
}

const onAssembled = async (orderId: string, deliveryType: string) => {
  const targetStatusId = tenantStore.tenant.kitchenConfig?.completedStatusMap?.[deliveryType as 'delivery' | 'pickup']
  const group = allOrderGroups.value.find((g) => g.orderId === orderId)

  const promises: Promise<unknown>[] = [
    api.kitchenQueue.serveAllForOrders([orderId], authStore.user!.id),
    api.orders.markKitchenCompleted(orderId),
    logServed(orderId, { orderNumber: group?.orderNumber ?? null, itemCount: group?.items.length ?? null }),
  ]

  if (targetStatusId) {
    promises.push(api.orders.updateStatus(orderId, targetStatusId))
  }

  try {
    await Promise.all(promises)
  } catch (e) {
    reportError(e, { context: 'kitchen/assembly:onAssembled', orderId, deliveryType })
    await load() // ресинк состояния доски с БД
  }
}

// --- Realtime ---

const offInsert = kitchenQueueEvents.onInsert((item) => {
  if (item.deliveryType === 'dine_in') return
  if (item.status !== 'served') {
    if (!items.value.some((i) => i.id === item.id)) {
      items.value.push(item)
    }
  }
})

const offUpdate = kitchenQueueEvents.onUpdate((item) => {
  if (item.deliveryType === 'dine_in') return
  // served, либо отменённое и уже убранное (dismissed) → снять с экрана сборки.
  // Без проверки dismissedAt realtime-эхо «возвращало» убранную карточку.
  if (item.status === 'served' || (item.status === 'cancelled' && item.dismissedAt)) {
    items.value = items.value.filter((i) => i.id !== item.id)
  } else {
    const idx = items.value.findIndex((i) => i.id === item.id)

    if (idx !== -1) items.value[idx] = mergeRealtimeItem(item, items.value[idx])
    else items.value.push(item)
  }
})

const offDelete = kitchenQueueEvents.onDelete(({ id }) => {
  items.value = items.value.filter((i) => i.id !== id)
})

onUnmounted(() => {
  offInsert()
  offUpdate()
  offDelete()
})
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;
@use '@fastio/styles/mixins/media-queries' as *;

.assembly-root {
  @include flex-col(var(--space-16));
}

.phase-tabs {
  @include mq-m {
    display: none;
  }
}

.kanban {
  @include flex-col(var(--space-20));

  @include mq-m {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    align-items: start;
  }
}

.kanban-col {
  @include flex-col(var(--space-12));

  &.hidden-mobile {
    display: none;

    @include mq-m {
      display: flex;
    }
  }
}

.kanban-header {
  display: none;

  @include mq-m {
    @include flex-row;
    padding-bottom: var(--space-8);
    border-bottom: 2px solid var(--color-border);
  }
}

.kanban-col--ready .kanban-header {
  border-bottom-color: var(--color-success);
}

.kanban-col--cancelled .kanban-header {
  border-bottom-color: var(--color-error);
}

.kanban-title {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-secondary);
}

.kanban-count {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-hint);
  background: var(--color-bg-subtle);
  padding: var(--space-4) var(--space-8);
  border-radius: var(--radius-8);

  &--green {
    color: var(--color-success);
  }

  &--red {
    color: var(--color-error);
  }
}
</style>
