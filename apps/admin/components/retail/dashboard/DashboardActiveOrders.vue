<template>
  <UiCard class="active-orders-root">
    <div class="header">
      <UiText size="small" class="label">Активные заказы</UiText>
      <UiButton type="text" size="small" @click="$router.push('/orders')">Все заказы</UiButton>
    </div>

    <div v-if="loading" class="grid">
      <div v-for="i in 3" :key="i" class="group-item">
        <UiSkeleton height="20" />
        <UiSkeleton height="28" />
      </div>
    </div>

    <div v-else-if="hasOrders" class="grid">
      <div v-for="group in activeGroups" :key="group.key" class="group-item">
        <UiText size="small" class="group-label">{{ group.label }}</UiText>
        <UiTitle size="h3" class="group-count" :class="{ 'count-new': group.key === 'new' && group.count > 0 }">
          {{ group.count }}
        </UiTitle>
      </div>
    </div>

    <div v-else class="empty">
      <UiText size="small" class="empty-text">Нет активных заказов</UiText>
    </div>
  </UiCard>
</template>

<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { UiCard, UiText, UiTitle, UiButton, UiSkeleton } from '@fastio/ui'
import { useOrderStatusesStore } from '~/stores/retail/order-statuses'
import { useOrderCounts } from '~/composables/retail/useOrderCounts'
import { orderEvents } from '~/composables/retail/useOrdersChannel'

type Props = {
  tenantId: string
  branchId: string | null
}

const props = defineProps<Props>()

const tenantIdRef = computed(() => props.tenantId)
const branchIdRef = computed(() => props.branchId)

const { statuses } = storeToRefs(useOrderStatusesStore())
const { counts, fetchCounts } = useOrderCounts(tenantIdRef, branchIdRef)
const loading = ref(true)

watch(counts, () => {
  loading.value = false
}, { once: true })
watch([tenantIdRef, branchIdRef], () => {
  loading.value = true
})

const offInsert = orderEvents.onInsert(() => fetchCounts())
const offUpdate = orderEvents.onUpdate(() => fetchCounts())
const offDelete = orderEvents.onDelete(() => fetchCounts())

onUnmounted(() => {
  offInsert()
  offUpdate()
  offDelete()
})

const countByGroup = computed(() => {
  const result = { new: 0, in_progress: 0, completed: 0, cancelled: 0 }

  for (const status of statuses.value) {
    const statusCount = counts.value[status.id] ?? 0

    if (status.groupType in result) {
      result[status.groupType as keyof typeof result] += statusCount
    }
  }

  return result
})

const activeGroups = computed(() => [
  { key: 'new', label: 'Новые', count: countByGroup.value.new },
  { key: 'in_progress', label: 'В работе', count: countByGroup.value.in_progress },
])

const hasOrders = computed(() => activeGroups.value.some((g) => g.count > 0))
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/media-queries' as *;

.active-orders-root {
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

.group-count {
  color: var(--color-text);
}

.count-new {
  color: var(--color-primary);
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
