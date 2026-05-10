<template>
  <TabsLayout :tabs="tabs" base-path="/kitchen">
    <template #extra>
      <div class="tabs-meta">
        <span class="tabs-count">{{ itemCount }} в работе</span>
        <UiTag size="small" round :type="isConnected ? 'success' : 'error'">
          {{ isConnected ? 'Live' : 'Переподключение...' }}
        </UiTag>
      </div>
    </template>
  </TabsLayout>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { UiTag } from '@fastio/ui'
import type { KitchenQueueItem } from '@fastio/shared'
import { useGate } from '~/shared/plan/useGate'
import { useDatabase } from '~/shared/data/useDatabase'
import { useTenantStore } from '~/shared/stores/tenant'
import { kitchenQueueEvents } from '~/features/kitchen'
import { realtimeConnected } from '~/features/orders'
import TabsLayout from '~/shared/ui/components/TabsLayout.vue'
import { usePageTitle } from '~/shared/composables/usePageTitle'

usePageTitle('Кухня')

const gate = useGate()
const isConnected = realtimeConnected
const itemCount = ref(0)

const api = useDatabase()
const tenantStore = useTenantStore()

const loadCount = async () => {
  const items = await api.kitchenQueue.listActive(tenantStore.tenant.id)

  itemCount.value = items.length
}

watch(() => tenantStore.tenant.id, () => {
  loadCount()
}, { immediate: true })

const offInsert = kitchenQueueEvents.onInsert((item: KitchenQueueItem) => {
  if (item.status === 'queued' || item.status === 'in_progress') itemCount.value++
})

const offUpdate = kitchenQueueEvents.onUpdate((item: KitchenQueueItem) => {
  if (item.status === 'done' || item.status === 'served' || item.status === 'cancelled') itemCount.value = Math.max(0, itemCount.value - 1)
})

const offDelete = kitchenQueueEvents.onDelete(() => {
  itemCount.value = Math.max(0, itemCount.value - 1)
})

onUnmounted(() => {
  offInsert()
  offUpdate()
  offDelete()
})

watch(isConnected, (connected) => {
  if (connected) loadCount()
})

const tabs = computed(() => [
  ...(gate.viewKitchenQueue.value.enabled
    ? [
        { value: 'queue', label: 'Кухня', attrs: { 'data-tour': 'kitchen-tab-queue' } },
        { value: 'assembly', label: 'Сборка', attrs: { 'data-tour': 'kitchen-tab-assembly' } },
      ]
    : []),
  ...(gate.viewKitchenOverview.value.enabled
    ? [{ value: 'overview', label: 'Обзор', attrs: { 'data-tour': 'kitchen-tab-overview' } }]
    : []),
  ...(gate.editSettings.value.enabled
    ? [{ value: 'settings', label: 'Настройки', attrs: { 'data-tour': 'kitchen-tab-settings' } }]
    : []),
])
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/layout' as *;

.tabs-meta {
  @include flex-row;
  margin-left: auto;
}

.tabs-count {
  font-size: var(--font-size-base);
  color: var(--color-text-hint);
  white-space: nowrap;
}
</style>
