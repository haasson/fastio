<template>
  <div class="orders-root">
    <!-- Фильтр-табы -->
    <div class="tabs">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        class="tab"
        :class="{ active: filter === tab.value }"
        @click="filter = tab.value"
      >
        {{ tab.label }}
        <span v-if="tab.value === 'active' && newCount > 0" class="new-badge">{{ newCount }}</span>
      </button>
    </div>

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
import type { OrderStatus } from '@fastfood-saas/shared'
import type { OrderFilter } from '~/composables/useOrders'
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

<style scoped>
.orders-root {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* ─── Табы ─── */
.tabs {
  display: flex;
  gap: 4px;
  background: #fff;
  border-radius: 12px;
  padding: 6px;
  width: fit-content;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.tab {
  height: 36px;
  padding: 0 16px;
  border-radius: 8px;
  border: none;
  font-size: 13px;
  font-weight: 600;
  color: #888;
  background: transparent;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  display: flex;
  align-items: center;
  gap: 6px;
}

.tab:hover {
  background: #f5f5f5;
  color: #333;
}

.tab.active {
  background: #ff6b35;
  color: #fff;
}

.new-badge {
  background: #fff;
  color: #ff6b35;
  font-size: 11px;
  font-weight: 800;
  border-radius: 10px;
  padding: 0 6px;
  min-width: 18px;
  text-align: center;
  line-height: 18px;
}

.tab.active .new-badge {
  background: rgba(255, 255, 255, 0.9);
}

/* ─── Пустые состояния ─── */
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

/* ─── Сетка карточек ─── */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 14px;
  align-items: start;
}

@media (max-width: 600px) {
  .tabs {
    width: 100%;
    overflow-x: auto;
  }

  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
