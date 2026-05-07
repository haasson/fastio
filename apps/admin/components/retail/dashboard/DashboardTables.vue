<template>
  <UiCard class="tables-root">
    <div class="header">
      <UiText size="small" class="label">Столы</UiText>
      <UiButton type="text" size="small" @click="$router.push('/tables')">Управление</UiButton>
    </div>

    <div v-if="loading" class="stat-row">
      <UiSkeleton height="40" />
    </div>

    <div v-else-if="totalTables > 0" class="stat-row">
      <div class="stat-item">
        <UiTitle size="h3" class="occupied">{{ openTables }}</UiTitle>
        <UiText size="small" class="stat-label">Занято</UiText>
      </div>
      <div class="divider" />
      <div class="stat-item">
        <UiTitle size="h3">{{ freeTables }}</UiTitle>
        <UiText size="small" class="stat-label">Свободно</UiText>
      </div>
      <div class="divider" />
      <div class="stat-item">
        <UiTitle size="h3" class="occupancy-rate">{{ occupancyRate }}%</UiTitle>
        <UiText size="small" class="stat-label">Загрузка</UiText>
      </div>
    </div>

    <div v-else class="empty">
      <UiText size="small" class="empty-text">Нет активных столов</UiText>
    </div>
  </UiCard>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { UiCard, UiText, UiTitle, UiButton, UiSkeleton } from '@fastio/ui'
import type { Table } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'
import { useRealtimeWatch } from '~/composables/data/useRealtimeWatch'

type Props = {
  tenantId: string
}

const props = defineProps<Props>()

const api = useDatabase()
const tables = ref<Table[]>([])
const loading = ref(true)

const fetchTables = async () => {
  loading.value = true
  try {
    tables.value = await api.tables.list(props.tenantId)
  } finally {
    loading.value = false
  }
}

watch(() => props.tenantId, fetchTables, { immediate: true })

const tenantIdRef = computed(() => props.tenantId || null)

useRealtimeWatch('tables', tenantIdRef, {
  column: 'tenant_id',
  onInsert: () => fetchTables(),
  onUpdate: () => fetchTables(),
  onDelete: () => fetchTables(),
})

const totalTables = computed(() => tables.value.length)
const openTables = computed(() => tables.value.filter((t) => t.isOpen).length)
const freeTables = computed(() => totalTables.value - openTables.value)
const occupancyRate = computed(() => totalTables.value > 0 ? Math.round((openTables.value / totalTables.value) * 100) : 0,
)
</script>

<style scoped lang="scss">
.tables-root {
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

.stat-row {
  display: flex;
  align-items: center;
  gap: var(--space-16);
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
}

.stat-label {
  color: var(--color-text-secondary);
}

.occupied {
  color: var(--color-primary);
}

.occupancy-rate {
  color: var(--color-text);
}

.divider {
  width: 1px;
  height: 36px;
  background: var(--color-border);
}

.empty {
  padding: var(--space-8) 0;
  display: flex;
  justify-content: center;
}

.empty-text {
  color: var(--color-text-hint);
}
</style>
