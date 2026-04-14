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
import { usePermissions } from '~/composables/auth/usePermissions'
import { useDatabase } from '~/composables/data/useDatabase'
import { useTenantStore } from '~/stores/tenant'
import { kitchenQueueEvents } from '~/composables/data/useKitchenQueueChannel'
import { realtimeConnected } from '~/composables/data/useOrdersChannel'
import TabsLayout from '~/components/ui/TabsLayout.vue'
import { usePageTitle } from '~/composables/usePageTitle'

usePageTitle('Кухня')

const { canEditSettings, canViewKitchen, canViewKitchenOverview } = usePermissions()
const isConnected = realtimeConnected
const itemCount = ref(0)

const api = useDatabase()
const tenantStore = useTenantStore()

const loadCount = async () => {
  const tenantId = tenantStore.tenant?.id

  if (!tenantId) return

  const items = await api.kitchenQueue.listActive(tenantId)

  itemCount.value = items.length
}

watch(() => tenantStore.tenant?.id, (id) => {
  if (id) loadCount()
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
  ...(canViewKitchen.value ? [{ value: 'queue', label: 'Кухня' }, { value: 'assembly', label: 'Сборка' }] : []),
  ...(canViewKitchenOverview.value ? [{ value: 'overview', label: 'Обзор' }] : []),
  ...(canEditSettings.value ? [{ value: 'settings', label: 'Настройки' }] : []),
])
</script>

<style scoped lang="scss">
.tabs-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.tabs-count {
  font-size: 13px;
  color: var(--color-text-hint);
  white-space: nowrap;
}
</style>
