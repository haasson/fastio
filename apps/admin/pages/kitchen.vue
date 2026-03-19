<template>
  <div class="kitchen-root">
    <div class="tabs-row">
      <UiTabs v-model="activeTab" :tabs="TABS" prevent-compact />
      <div class="tabs-meta">
        <span class="tabs-count">{{ itemCount }} в работе</span>
        <UiTag size="small" round :type="isConnected ? 'success' : 'error'">
          {{ isConnected ? 'Live' : 'Переподключение...' }}
        </UiTag>
      </div>
    </div>

    <KitchenQueue v-if="activeTab === 'kitchen'" />
    <KitchenAssembly v-else-if="activeTab === 'assembly'" />
    <KitchenSettings v-else-if="activeTab === 'settings'" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { UiTabs, UiTag } from '@fastio/ui'
import type { KitchenQueueItem } from '@fastio/shared'
import { usePermissions } from '~/composables/auth/usePermissions'
import { useDatabase } from '~/composables/data/useDatabase'
import { useTenantStore } from '~/stores/tenant'
import { kitchenQueueEvents } from '~/composables/data/useKitchenQueueChannel'
import { realtimeConnected } from '~/composables/data/useOrdersChannel'
import KitchenQueue from '~/components/kitchen/KitchenQueue.vue'
import KitchenAssembly from '~/components/kitchen/KitchenAssembly.vue'
import KitchenSettings from '~/components/kitchen/KitchenSettings.vue'

const { canEditSettings } = usePermissions()
const isConnected = realtimeConnected
const itemCount = ref(0)

// Lightweight counter — load once, then track via realtime
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
  if (item.status === 'done' || item.status === 'served') itemCount.value = Math.max(0, itemCount.value - 1)
})

const offDelete = kitchenQueueEvents.onDelete(() => {
  itemCount.value = Math.max(0, itemCount.value - 1)
})

onUnmounted(() => {
  offInsert()
  offUpdate()
  offDelete()
})

const activeTab = ref('kitchen')

// Re-sync counter on tab switch or realtime reconnect (drift protection)
watch(activeTab, () => {
  loadCount()
})

watch(isConnected, (connected) => {
  if (connected) loadCount()
})

const TABS = computed(() => [
  { value: 'kitchen', label: 'Кухня' },
  { value: 'assembly', label: 'Сборка' },
  ...(canEditSettings.value ? [{ value: 'settings', label: 'Настройки' }] : []),
])
</script>

<style scoped lang="scss">
.kitchen-root {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: calc(100vh - var(--content-padding) * 2);
  overflow: hidden;
}

.tabs-row {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
}

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
