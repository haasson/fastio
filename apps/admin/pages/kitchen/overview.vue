<template>
  <div class="overview-root">
    <KitchenStatCards :items="statCards" @select="onStatSelect" />

    <div v-if="loading" class="loading">
      <UiSkeleton :repeat="8" />
    </div>

    <UiEmpty v-else-if="!filteredItems.length" icon="chefHat" text="Нет блюд" />

    <UiDataTable
      v-else
      :columns="columns"
      :data="filteredItems"
      :row-key="(row: KitchenQueueItem) => row.id"
      :bordered="false"
      size="small"
      :scroll-x="700"
    />
  </div>
</template>

<script setup lang="ts">
import { h, ref, computed, watch, onUnmounted } from 'vue'
import { useNow } from '@vueuse/core'
import { UiDataTable, UiEmpty, UiSkeleton, UiTag, UiText } from '@fastio/ui'
import KitchenStatCards from '~/components/kitchen/KitchenStatCards.vue'
import type { StatCardItem } from '~/components/kitchen/KitchenStatCards.vue'
import type { DataTableColumns } from '@fastio/ui'
import { type KitchenQueueItem, getKitchenUrgencyLevel, formatKitchenElapsed } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'
import { useTenantStore } from '~/stores/tenant'
import { kitchenQueueEvents } from '~/composables/data/useKitchenQueueChannel'
import { DELIVERY_TYPE_LABELS } from '~/config/order-options'
import { mergeRealtimeItem } from '~/utils/api/kitchen-queue'

const api = useDatabase()
const tenantStore = useTenantStore()
const now = useNow({ interval: 30_000 })

// --- Filters ---

type StatusFilter = 'queued' | 'in_progress' | 'done' | 'cancelled' | 'warning' | 'critical' | null
const statusFilter = ref<StatusFilter>(null)

const onStatSelect = (key: string) => {
  statusFilter.value = key === 'all' ? null : statusFilter.value === key ? null : key as StatusFilter
}

// --- Data ---

const loading = ref(false)
const items = ref<KitchenQueueItem[]>([])

const urgencyMinutes = computed(() => tenantStore.tenant?.kitchenUrgencyMinutes ?? 15)

const getUrgencyLevel = (createdAt: string) => getKitchenUrgencyLevel(createdAt, now.value, urgencyMinutes.value)

const formatElapsed = (isoDate: string) => formatKitchenElapsed(isoDate, now.value)

const load = async () => {
  const tenantId = tenantStore.tenant?.id

  if (!tenantId) return

  loading.value = true
  try {
    items.value = await api.kitchenQueue.listActive(tenantId)
  } finally {
    loading.value = false
  }
}

watch(() => tenantStore.tenant?.id, (id) => {
  if (id) load()
}, { immediate: true })

// --- Computed ---

const filteredItems = computed(() => items.value.filter((item) => {
  if (statusFilter.value) {
    if (statusFilter.value === 'warning') {
      return (item.status === 'queued' || item.status === 'in_progress') && getUrgencyLevel(item.createdAt) === 'warning'
    }
    if (statusFilter.value === 'critical') {
      return (item.status === 'queued' || item.status === 'in_progress') && getUrgencyLevel(item.createdAt) === 'critical'
    }
    if (statusFilter.value === 'done') {
      return item.status === 'done' || item.status === 'served'
    }

    return item.status === statusFilter.value
  }

  return true
}))

const activeItems = computed(() => items.value.filter((i) => i.status === 'queued' || i.status === 'in_progress'))

const categoryFilterOptions = computed(() => {
  const cats = new Set<string>()

  for (const item of items.value) {
    if (item.categoryName) cats.add(item.categoryName)
  }

  return [...cats].sort().map((name) => ({ label: name, value: name }))
})

const counts = computed(() => ({
  queued: items.value.filter((i) => i.status === 'queued').length,
  inProgress: items.value.filter((i) => i.status === 'in_progress').length,
  done: items.value.filter((i) => i.status === 'done' || i.status === 'served').length,
  cancelled: items.value.filter((i) => i.status === 'cancelled').length,
  warning: activeItems.value.filter((i) => getUrgencyLevel(i.createdAt) === 'warning').length,
  critical: activeItems.value.filter((i) => getUrgencyLevel(i.createdAt) === 'critical').length,
}))

const statCards = computed((): StatCardItem[] => {
  const c = counts.value
  const cards: StatCardItem[] = [
    { key: 'all', label: 'Все', value: items.value.length, active: statusFilter.value === null },
    { key: 'queued', label: 'В очереди', value: c.queued, active: statusFilter.value === 'queued' },
    { key: 'in_progress', label: 'В работе', value: c.inProgress, active: statusFilter.value === 'in_progress' },
    { key: 'done', label: 'Готово', value: c.done, color: 'green', active: statusFilter.value === 'done' },
    { key: 'cancelled', label: 'Отменено', value: c.cancelled, color: 'red', active: statusFilter.value === 'cancelled' },
  ]

  if (c.warning) {
    cards.push({ key: 'warning', label: 'Опаздывают', value: c.warning, color: 'orange', variant: 'warning', active: statusFilter.value === 'warning' })
  }
  if (c.critical) {
    cards.push({ key: 'critical', label: 'Критично', value: c.critical, color: 'red', variant: 'critical', active: statusFilter.value === 'critical' })
  }

  return cards
})

// --- Table columns ---

const STATUS_LABELS: Record<string, string> = {
  queued: 'В очереди',
  in_progress: 'В работе',
  done: 'Готово',
  served: 'Выдано',
  cancelled: 'Отменено',
}

const STATUS_TYPES: Record<string, 'default' | 'primary' | 'success' | 'error' | 'warning'> = {
  queued: 'default',
  in_progress: 'primary',
  done: 'success',
  served: 'success',
  cancelled: 'error',
}

const DELIVERY_TAG_TYPES: Record<string, 'default' | 'primary' | 'success'> = {
  delivery: 'primary',
  pickup: 'success',
  dine_in: 'default',
}

const columns = computed((): DataTableColumns<KitchenQueueItem> => [
  {
    title: '',
    key: 'urgency',
    width: 8,
    render: (row) => {
      if (row.status !== 'queued' && row.status !== 'in_progress') return null
      const level = getUrgencyLevel(row.createdAt)

      if (level === 'normal') return null

      return h('div', {
        class: `urgency-dot urgency-dot--${level}`,
        title: level === 'critical' ? 'Критично опаздывает' : 'Опаздывает',
      })
    },
  },
  {
    title: 'Блюдо',
    key: 'dishName',
    minWidth: 180,
    sorter: (a, b) => a.dishName.localeCompare(b.dishName),
    render: (row) => h('div', { class: 'dish-cell' }, [
      h(UiText, { size: 'small', class: 'dish-name' }, () => row.dishName),
      row.comboName
        ? h(UiText, { size: 'tiny', style: 'color: var(--color-text-hint)' }, () => `Комбо: ${row.comboName}`)
        : null,
    ]),
  },
  {
    title: 'Категория',
    key: 'categoryName',
    width: 150,
    sorter: (a, b) => (a.categoryName ?? '').localeCompare(b.categoryName ?? ''),
    filterOptions: categoryFilterOptions.value,
    filter: (value, row) => row.categoryName === value,
  },
  {
    title: 'Тип',
    key: 'deliveryType',
    width: 120,
    render: (row) => h(UiTag, {
      size: 'small',
      type: DELIVERY_TAG_TYPES[row.deliveryType] ?? 'default',
      empty: true,
      round: true,
    }, () => DELIVERY_TYPE_LABELS[row.deliveryType] ?? row.deliveryType),
  },
  {
    title: 'Статус',
    key: 'status',
    width: 120,
    render: (row) => h(UiTag, {
      size: 'small',
      type: STATUS_TYPES[row.status] ?? 'default',
      round: true,
    }, () => STATUS_LABELS[row.status] ?? row.status),
  },
  {
    title: 'В очереди',
    key: 'elapsed',
    width: 110,
    render: (row) => {
      const level = (row.status === 'queued' || row.status === 'in_progress')
        ? getUrgencyLevel(row.createdAt)
        : 'normal'
      const color = level === 'critical'
        ? 'var(--color-error)'
        : level === 'warning'
          ? 'var(--color-warning)'
          : 'var(--color-text-secondary)'

      return h(UiText, { size: 'small', style: `color: ${color}; font-weight: ${level !== 'normal' ? 600 : 400}` }, () => formatElapsed(row.createdAt))
    },
  },
  {
    title: 'Заказ',
    key: 'orderId',
    width: 90,
    render: (row) => h(UiText, { size: 'tiny', style: 'color: var(--color-text-hint)' }, () => `#${row.orderNumber}`),
  },
])

// --- Realtime (only for today) ---

const offInsert = kitchenQueueEvents.onInsert((item) => {
  if (!items.value.some((i) => i.id === item.id)) items.value.push(item)
})

const offUpdate = kitchenQueueEvents.onUpdate((item) => {
  const idx = items.value.findIndex((i) => i.id === item.id)

  if (idx !== -1) items.value[idx] = mergeRealtimeItem(item, items.value[idx])
  else items.value.push(item)
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
.overview-root {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
}

.loading {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

// ── Table cells ──

.dish-cell {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-4) 0;
}

.dish-name {
  font-weight: var(--font-weight-semibold);
}

.urgency-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;

  &--warning { background: var(--color-warning); }
  &--critical {
    background: var(--color-error);
    animation: pulse 1.5s ease-in-out infinite;
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
</style>
