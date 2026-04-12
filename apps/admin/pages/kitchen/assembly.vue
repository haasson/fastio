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

      <div class="kanban">
        <div class="kanban-col" :class="{ 'hidden-mobile': mobilePhase !== 'cooking' }">
          <div class="kanban-header">
            <span class="kanban-title">Готовится на кухне</span>
            <span class="kanban-count">{{ cookingGroups.length }}</span>
          </div>
          <KitchenAssemblyCard
            v-for="group in cookingGroups"
            :key="group.orderId"
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

        <div class="kanban-col kanban-col--collecting" :class="{ 'hidden-mobile': mobilePhase !== 'collecting' }">
          <div class="kanban-header">
            <span class="kanban-title">Требует сборки</span>
            <span class="kanban-count kanban-count--orange">{{ collectingGroups.length }}</span>
          </div>
          <KitchenAssemblyCard
            v-for="group in collectingGroups"
            :key="group.orderId"
            :order-id="group.orderId"
            :order-number="group.orderNumber"
            :delivery-type="group.deliveryType"
            :items="group.items"
            @collect-item="onCollectItem"
          />
          <UiEmpty
            v-if="!collectingGroups.length"
            icon="check"
            text="Нечего собирать"
          />
        </div>

        <div class="kanban-col kanban-col--ready" :class="{ 'hidden-mobile': mobilePhase !== 'ready' }">
          <div class="kanban-header">
            <span class="kanban-title">Готово</span>
            <span class="kanban-count kanban-count--green">{{ readyGroups.length }}</span>
          </div>
          <KitchenAssemblyCard
            v-for="group in readyGroups"
            :key="group.orderId"
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
            text="Нет собранных заказов"
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
import { type KitchenQueueItem, getOrderPhase } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'
import { useTenantStore } from '~/stores/tenant'
import { useAuthStore } from '~/stores/auth'
import { kitchenQueueEvents } from '~/composables/data/useKitchenQueueChannel'
import KitchenAssemblyCard from '~/components/kitchen/KitchenAssemblyCard.vue'
import { reportError } from '~/utils/reportError'
import { mergeRealtimeItem } from '~/utils/api/kitchen-queue'

const api = useDatabase()
const tenantStore = useTenantStore()
const authStore = useAuthStore()

const mobilePhase = ref<'cooking' | 'collecting' | 'ready' | 'cancelled'>('collecting')

const loading = ref(false)
const items = ref<KitchenQueueItem[]>([])

type OrderGroup = {
  orderId: string
  orderNumber: string | null
  deliveryType: string
  items: KitchenQueueItem[]
  phase: 'cooking' | 'collecting' | 'ready' | 'cancelled'
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

const cookingGroups = computed(() => allOrderGroups.value.filter((g) => g.phase === 'cooking'))
const collectingGroups = computed(() => allOrderGroups.value.filter((g) => g.phase === 'collecting'))
const readyGroups = computed(() => allOrderGroups.value.filter((g) => g.phase === 'ready'))
const cancelledGroups = computed(() => allOrderGroups.value.filter((g) => g.phase === 'cancelled'))

const mobilePhaseTabs = computed(() => {
  const tabs = [
    { value: 'cooking', label: `Кухня (${cookingGroups.value.length})` },
    { value: 'collecting', label: `Сборка (${collectingGroups.value.length})` },
    { value: 'ready', label: `Готово (${readyGroups.value.length})` },
  ]

  if (cancelledGroups.value.length) {
    tabs.push({ value: 'cancelled', label: `Отменено (${cancelledGroups.value.length})` })
  }

  return tabs
})

const load = async () => {
  const tenantId = tenantStore.tenant?.id

  if (!tenantId) return

  loading.value = true
  try {
    items.value = await api.kitchenQueue.listForAssembly(tenantId)
  } finally {
    loading.value = false
  }
}

watch(() => tenantStore.tenant?.id, (id) => {
  if (id) load()
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
  await api.kitchenQueue.dismissCancelledOrder(orderId)
}

const onAssembled = async (orderId: string, deliveryType: string) => {
  const targetStatusId = tenantStore.tenant?.kitchenConfig?.completedStatusMap?.[deliveryType as 'delivery' | 'pickup']

  const promises: Promise<unknown>[] = [
    api.kitchenQueue.serveAllForOrders([orderId], authStore.user!.id),
  ]

  if (targetStatusId) {
    promises.push(api.orders.updateStatus(orderId, targetStatusId))
  }

  await Promise.all(promises)
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
  if (item.status === 'served') {
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
@use '@fastio/styles/mixins/media-queries' as *;

.assembly-root {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.phase-tabs {
  @include mq-m {
    display: none;
  }
}

.kanban {
  display: flex;
  flex-direction: column;
  gap: 20px;

  @include mq-m {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    align-items: start;
  }
}

.kanban-col {
  display: flex;
  flex-direction: column;
  gap: 12px;

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
    display: flex;
    align-items: center;
    gap: 8px;
    padding-bottom: 8px;
    border-bottom: 2px solid var(--color-border);
  }
}

.kanban-col--collecting .kanban-header {
  border-bottom-color: var(--color-warning);
}

.kanban-col--ready .kanban-header {
  border-bottom-color: var(--color-success);
}

.kanban-col--cancelled .kanban-header {
  border-bottom-color: var(--color-error);
}

.kanban-title {
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-secondary);
}

.kanban-count {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-hint);
  background: var(--color-bg-subtle);
  padding: 2px 8px;
  border-radius: 10px;

  &--orange {
    color: var(--color-warning);
  }

  &--green {
    color: var(--color-success);
  }

  &--red {
    color: var(--color-error);
  }
}
</style>
