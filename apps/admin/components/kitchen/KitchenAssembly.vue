<template>
  <div class="assembly-root">
    <div v-if="loading" class="assembly-grid">
      <UiCard v-for="i in 3" :key="i">
        <UiSkeleton :repeat="4" />
      </UiCard>
    </div>

    <div v-else-if="orderGroups.length" class="assembly-grid">
      <KitchenAssemblyCard
        v-for="group in orderGroups"
        :key="group.orderId"
        :order-id="group.orderId"
        :delivery-type="group.deliveryType"
        :items="group.items"
      />
    </div>

    <UiEmpty v-else icon="check" text="Нет активных заказов" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { UiCard, UiSkeleton, UiEmpty } from '@fastio/ui'
import type { KitchenQueueItem } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'
import { useTenantStore } from '~/stores/tenant'
import { kitchenQueueEvents } from '~/composables/data/useKitchenQueueChannel'
import KitchenAssemblyCard from '~/components/kitchen/KitchenAssemblyCard.vue'

const api = useDatabase()
const tenantStore = useTenantStore()

const loading = ref(false)
const items = ref<KitchenQueueItem[]>([])

type OrderGroup = {
  orderId: string
  deliveryType: string
  items: KitchenQueueItem[]
}

const orderGroups = computed<OrderGroup[]>(() => {
  const map = new Map<string, OrderGroup>()

  for (const item of items.value) {
    let group = map.get(item.orderId)

    if (!group) {
      group = { orderId: item.orderId, deliveryType: item.deliveryType, items: [] }
      map.set(item.orderId, group)
    }

    group.items.push(item)
  }

  // All-done orders at the bottom
  const groups = [...map.values()]

  groups.sort((a, b) => {
    const aDone = a.items.every((i) => i.status === 'done' || i.status === 'served')
    const bDone = b.items.every((i) => i.status === 'done' || i.status === 'served')

    if (aDone !== bDone) return aDone ? 1 : -1

    return 0
  })

  return groups
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

// --- Realtime ---

const offInsert = kitchenQueueEvents.onInsert((item) => {
  if (item.status !== 'served') {
    if (!items.value.some((i) => i.id === item.id)) {
      items.value.push(item)
    }
  }
})

const offUpdate = kitchenQueueEvents.onUpdate((item) => {
  if (item.status === 'served') {
    items.value = items.value.filter((i) => i.id !== item.id)
  } else {
    const idx = items.value.findIndex((i) => i.id === item.id)

    if (idx !== -1) items.value[idx] = item
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

.assembly-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  align-items: start;

  @include mq-m {
    grid-template-columns: repeat(2, 1fr);
  }

  @include mq-l {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
