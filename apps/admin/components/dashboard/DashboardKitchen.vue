<template>
  <UiCard class="kitchen-root">
    <div class="header">
      <UiText size="small" class="label">Кухня</UiText>
      <UiButton type="text" size="small" @click="$router.push('/kitchen')">Перейти</UiButton>
    </div>

    <div v-if="loading" class="grid">
      <div v-for="i in 2" :key="i" class="group-item">
        <UiSkeleton height="20" />
        <UiSkeleton height="28" />
      </div>
    </div>

    <div v-else-if="hasItems" class="grid">
      <div class="group-item">
        <UiText size="small" class="group-label">В очереди</UiText>
        <UiTitle size="h3" :class="{ 'count-active': queuedCount > 0 }">{{ queuedCount }}</UiTitle>
      </div>
      <div class="group-item">
        <UiText size="small" class="group-label">В процессе</UiText>
        <UiTitle size="h3">{{ inProgressCount }}</UiTitle>
      </div>
    </div>

    <div v-else class="empty">
      <UiText size="small" class="empty-text">Очередь пуста</UiText>
    </div>
  </UiCard>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { UiCard, UiText, UiTitle, UiButton, UiSkeleton } from '@fastio/ui'
import type { KitchenQueueItem } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'
import { kitchenQueueEvents } from '~/composables/data/useKitchenQueueChannel'

type Props = {
  tenantId: string
}

const props = defineProps<Props>()

const api = useDatabase()
const items = ref<KitchenQueueItem[]>([])
const loading = ref(true)

const fetchItems = async () => {
  loading.value = true
  try {
    items.value = await api.kitchenQueue.listActive(props.tenantId)
  } finally {
    loading.value = false
  }
}

watch(() => props.tenantId, fetchItems, { immediate: true })

const offInsert = kitchenQueueEvents.onInsert(() => fetchItems())
const offUpdate = kitchenQueueEvents.onUpdate(() => fetchItems())
const offDelete = kitchenQueueEvents.onDelete(() => fetchItems())

onUnmounted(() => {
  offInsert()
  offUpdate()
  offDelete()
})

const queuedCount = computed(() => items.value.filter((i) => i.status === 'queued').length)
const inProgressCount = computed(() => items.value.filter((i) => i.status === 'in_progress').length)
const hasItems = computed(() => queuedCount.value + inProgressCount.value > 0)
</script>

<style scoped>
.kitchen-root {
  gap: var(--space-12);
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.label {
  color: var(--color-text-hint);
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-12);
}

.group-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.group-label {
  color: var(--color-text-secondary);
}

.count-active {
  color: var(--color-warning);
}

.empty {
  padding: var(--space-16) 0;
  display: flex;
  justify-content: center;
}

.empty-text {
  color: var(--color-text-hint);
}
</style>
