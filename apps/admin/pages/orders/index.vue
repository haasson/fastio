<template>
  <div class="orders-root">
    <!-- Фильтр-табы -->
    <UiSegmentedControl v-model="filter" :items="segmentedTabs" />

    <!-- Загрузка -->
    <div v-if="loading" class="state-msg">Загрузка…</div>

    <!-- Пусто -->
    <div v-else-if="orders.length === 0" class="state-msg">
      <span class="state-icon">{{ emptyIcon }}</span>
      <span>{{ emptyText }}</span>
    </div>

    <!-- Список -->
    <div v-else class="grid">
      <OrderCard
        v-for="order in orders"
        :key="order.id"
        :order="order"
        :updating="updatingIds.has(order.id)"
        @advance="handleAdvance"
        @cancel="handleCancel"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { UiSegmentedControl } from '@fastio/ui'
import type { SegmentedControlItem } from '@fastio/ui'
import type { OrderStatus } from '@fastio/shared'
import { useTenantStore } from '~/stores/tenant'

definePageMeta({ middleware: 'auth' })

const tenantStore = useTenantStore()
onMounted(() => tenantStore.init())

const tenantId = computed(() => tenantStore.tenant?.id ?? '')

const filter = ref<OrderFilter>('active')
const { orders, loading, updateStatus, cancel } = useOrders(tenantId, filter)

const newCount = computed(() => orders.value.filter((o) => o.status === 'new').length)

const tabs: { label: string; value: OrderFilter }[] = [
  { label: 'Активные', value: 'active' },
  { label: 'Завершённые', value: 'completed' },
  { label: 'Отменённые', value: 'cancelled' },
  { label: 'Все', value: 'all' },
]

const segmentedTabs = computed<SegmentedControlItem[]>(() =>
  tabs.map((tab) => ({
    label: tab.label,
    value: tab.value,
    tag: tab.value === 'active' && newCount.value > 0 ? String(newCount.value) : undefined,
  })),
)

const emptyText = computed(() => {
  if (filter.value === 'active') return 'Активных заказов нет'
  if (filter.value === 'completed') return 'Завершённых заказов нет'
  if (filter.value === 'cancelled') return 'Отменённых заказов нет'
  return 'Заказов пока нет'
})

const emptyIcon = computed(() => {
  if (filter.value === 'active') return '📭'
  if (filter.value === 'completed') return '✅'
  if (filter.value === 'cancelled') return '🚫'
  return '📋'
})

// Блокируем кнопки пока идёт запрос
const updatingIds = reactive(new Set<string>())

async function handleAdvance(id: string, status: string) {
  updatingIds.add(id)
  try {
    await updateStatus(id, status as OrderStatus)
  } finally {
    updatingIds.delete(id)
  }
}

async function handleCancel(id: string) {
  if (!confirm('Отменить заказ?')) return
  updatingIds.add(id)
  try {
    await cancel(id)
  } finally {
    updatingIds.delete(id)
  }
}
</script>

<style scoped lang="scss">
@use '@fastio/ui/styles/mixins/media-queries' as *;

.orders-root {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.state-msg {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 60px 0;
  color: #bbb;
  font-size: 15px;
}

.state-icon {
  font-size: 40px;
}

.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
  align-items: start;

  @include mq-m {
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  }
}
</style>
