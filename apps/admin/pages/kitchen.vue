<template>
  <div class="kitchen-root">
    <div class="kitchen-meta">
      <span class="kitchen-count">{{ activeOrders.length }} активных</span>
      <div class="kitchen-status" :class="{ connected: isConnected }">
        {{ isConnected ? 'Live' : 'Переподключение...' }}
      </div>
    </div>

    <div v-if="loading" class="kitchen-grid">
      <div v-for="i in 4" :key="i" class="order-card order-card--skeleton">
        <UiSkeleton :repeat="4" />
      </div>
    </div>

    <div v-else-if="activeOrders.length" class="kitchen-grid">
      <div
        v-for="order in activeOrders"
        :key="order.id"
        class="order-card"
        :class="`order-card--${order.statusGroup}`"
      >
        <div class="card-header">
          <div class="card-id">#{{ order.id.slice(0, 6).toUpperCase() }}</div>
          <div class="card-table">
            <template v-if="order.tableName">
              <UiIcon name="tableIcon" :size="14" />
              {{ order.tableName }}
            </template>
            <template v-else-if="order.deliveryType === 'delivery'">
              <UiIcon name="bike" :size="14" />
              Доставка
            </template>
            <template v-else>
              <UiIcon name="cart" :size="14" />
              Самовывоз
            </template>
          </div>
          <div class="card-time">{{ order.elapsed }}</div>
        </div>

        <div class="card-customer">{{ order.customerName || order.customerPhone }}</div>

        <ul class="card-items">
          <li v-for="item in order.items" :key="item.id ?? item.dishName" class="card-item">
            <span class="item-qty">{{ item.quantity }}×</span>
            <span class="item-name">{{ item.dishName }}</span>
            <span v-if="item.modifiers?.length" class="item-mods">
              {{ item.modifiers.map((m) => m.optionName).join(', ') }}
            </span>
          </li>
        </ul>

        <div v-if="order.comment" class="card-comment">
          <UiIcon name="messageCircle" :size="13" class="comment-icon" />
          {{ order.comment }}
        </div>

        <div class="card-footer">
          <button
            v-for="action in order.quickActions"
            :key="action.id"
            class="action-btn"
            :class="`action-btn--${action.group}`"
            @click="changeStatus(order.id, action.id)"
          >
            {{ action.name }}
          </button>
        </div>
      </div>
    </div>

    <div v-else-if="error" class="kitchen-empty">
      <UiIcon name="alertCircle" :size="48" class="empty-icon" />
      <p>Не удалось загрузить заказы</p>
      <UiButton type="default" @click="load">Повторить</UiButton>
    </div>

    <div v-else class="kitchen-empty">
      <UiIcon name="chefHat" :size="48" class="empty-icon" />
      <p>Новых заказов нет</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useNow } from '@vueuse/core'
import { UiIcon, UiSkeleton, UiButton } from '@fastio/ui'
import type { Order } from '@fastio/shared'
import { useDatabase } from '~/composables/data/useDatabase'
import { useTenantStore } from '~/stores/tenant'
import { useOrderStatusesStore } from '~/stores/order-statuses'
import { orderEvents, realtimeConnected } from '~/composables/data/useOrdersChannel'
import { formatRelativeTime } from '~/utils/formatRelativeTime'

const api = useDatabase()
const tenantStore = useTenantStore()
const { statuses } = storeToRefs(useOrderStatusesStore())
const now = useNow({ interval: 30_000 })

const loading = ref(false)
const error = ref(false)
const isConnected = realtimeConnected
const orders = ref<Order[]>([])

const activeStatuses = computed(() => statuses.value.filter((s) => s.kitchenVisible))
const activeStatusIds = computed(() => new Set(activeStatuses.value.map((s) => s.id)))

// Separate filter from map+sort so now-tick doesn't trigger re-sort
const filteredOrders = computed(() => orders.value.filter((o) => activeStatusIds.value.has(o.status)),
)

const activeOrders = computed(() => filteredOrders.value
  .map((o) => {
    const status = statuses.value.find((s) => s.id === o.status)
    const quickActions = statuses.value
      .filter((s) => status?.quickActions?.includes(s.id))
      .map((s) => ({ id: s.id, name: s.name, group: s.groupType }))

    return {
      ...o,
      statusGroup: status?.groupType ?? 'new',
      elapsed: formatRelativeTime(o.createdAt, now.value),
      quickActions,
    }
  })
  .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
)

const load = async () => {
  const ids = activeStatuses.value.map((s) => s.id)

  if (!ids.length) return
  loading.value = true
  error.value = false
  try {
    const tenantId = tenantStore.tenant?.id

    if (!tenantId) return

    const result = await api.orders.list(tenantId, null, { statusIds: ids, pageSize: 200, sortDir: 'asc' })

    orders.value = result.orders
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}

watch(activeStatuses, load, { immediate: true })

const changeStatus = async (orderId: string, statusId: string) => {
  await api.orders.updateStatus(orderId, statusId)
}

// Realtime
const offInsert = orderEvents.onInsert((order) => {
  if (activeStatusIds.value.has(order.status)) {
    orders.value = [order, ...orders.value.filter((o) => o.id !== order.id)]
  }
})

const offUpdate = orderEvents.onUpdate((order) => {
  if (activeStatusIds.value.has(order.status)) {
    const idx = orders.value.findIndex((o) => o.id === order.id)

    if (idx !== -1) orders.value[idx] = order
    else orders.value.push(order)
  } else {
    orders.value = orders.value.filter((o) => o.id !== order.id)
  }
})

const offDelete = orderEvents.onDelete(({ id }) => {
  orders.value = orders.value.filter((o) => o.id !== id)
})

onUnmounted(() => {
  offInsert()
  offUpdate()
  offDelete()
})
</script>

<style scoped lang="scss">
@use '@fastio/styles/mixins/media-queries' as *;

.kitchen-root {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 100vh;
  background: var(--color-bg-subtle);
  padding: 20px;
}

.kitchen-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.kitchen-count {
  font-size: 14px;
  color: var(--color-text-hint);
}

.kitchen-status {
  font-size: 12px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 20px;
  background: var(--color-error-bg);
  color: var(--color-error);

  &.connected {
    background: var(--color-success-bg);
    color: var(--color-success);
  }
}

.kitchen-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  align-items: start;

  @include mq-m {
    grid-template-columns: repeat(2, 1fr);
  }

  @include mq-l {
    grid-template-columns: repeat(3, 1fr);
  }
}

.order-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: var(--color-bg);
  border-radius: 14px;
  border: 2px solid var(--color-border);

  &--new {
    border-color: var(--color-warning);
  }

  &--in_progress {
    border-color: var(--color-primary);
  }

  &--skeleton {
    border-color: var(--color-border);
  }
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-id {
  font-size: 16px;
  font-weight: 800;
  color: var(--color-text);
  flex: 1;
}

.card-table {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.card-time {
  font-size: 12px;
  color: var(--color-text-hint);
  flex-shrink: 0;
}

.card-customer {
  font-size: 14px;
  color: var(--color-text-secondary);
}

.card-items {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.card-item {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 15px;
  font-weight: 500;
}

.item-qty {
  color: var(--color-text-hint);
  font-size: 13px;
  flex-shrink: 0;
}

.item-name {
  color: var(--color-text);
}

.item-mods {
  font-size: 12px;
  color: var(--color-text-hint);
}

.card-comment {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 13px;
  color: var(--color-text-secondary);
  background: var(--color-bg-subtle);
  padding: 8px 10px;
  border-radius: 8px;
}

.comment-icon {
  flex-shrink: 0;
  margin-top: 1px;
  color: var(--color-text-hint);
}

.card-footer {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.action-btn {
  flex: 1;
  padding: 10px 14px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  background: var(--color-primary);
  color: #fff;

  &--completed {
    background: var(--color-success);
  }

  &--cancelled {
    background: var(--color-bg-subtle);
    color: var(--color-text-secondary);
  }
}

.kitchen-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 60px 0;
  color: var(--color-text-hint);
  font-size: 16px;
}

.empty-icon {
  opacity: 0.3;
}
</style>
