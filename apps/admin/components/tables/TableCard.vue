<template>
  <UiCard size="small" class="table-card" :class="{ 'table-card--open': table.isOpen, 'table-card--calling': calls.length > 0, 'table-card--ready': readyDishes?.length }">
    <div class="card-header">
      <div class="card-title">
        <UiIcon name="tableIcon" :size="18" class="card-icon" />
        <UiText size="medium" class="card-name">{{ table.name }}</UiText>
      </div>
      <span v-if="table.capacity" class="card-cap">{{ table.capacity }}p</span>
    </div>

    <!-- Calls indicator -->
    <div v-if="calls.length" class="calls">
      <div v-for="call in calls" :key="call.id" class="call-item">
        <UiIcon name="messageCircle" :size="14" class="call-icon" />
        <span class="call-name">{{ call.callTypeName }}</span>
        <span class="call-time">{{ formatRelativeTime(call.createdAt, now) }}</span>
        <UiButton
          size="small"
          type="text"
          icon="check"
          @click="$emit('resolve-call', call.id)"
        />
      </div>
    </div>

    <!-- Open state -->
    <template v-if="table.isOpen">
      <UiText size="tiny" class="card-opened">Открыт {{ openedAgo }}</UiText>

      <div v-if="session?.items.length" class="card-items">
        <div
          v-for="item in visibleItems"
          :key="item.dishName"
          class="card-item"
          :class="kitchenStatusClass(item.dishName)"
        >
          <span class="item-name">{{ item.dishName }}</span>
          <UiTag
            v-if="kitchenStatusLabel(item.dishName)"
            size="small"
            :type="kitchenStatusTag(item.dishName)"
            round
          >
            {{ kitchenStatusLabel(item.dishName) }}
          </UiTag>
          <span class="item-price">{{ item.price }} × {{ item.quantity }}</span>
          <span class="item-total">{{ item.price * item.quantity }} ₽</span>
        </div>
        <button v-if="session.items.length > PREVIEW" class="expand-btn" @click="expanded = !expanded">
          {{ expanded ? 'Свернуть' : `+${session.items.length - PREVIEW} ещё` }}
        </button>
      </div>

      <div class="card-stats">
        <span class="stat-orders">{{ session?.count ?? 0 }} заказов</span>
        <span class="stat-sum">{{ session?.sum ?? 0 }} ₽</span>
      </div>

      <div v-if="readyDishes?.length" class="ready-dishes">
        <div v-for="dish in readyDishes" :key="dish.id" class="ready-item">
          <span class="ready-name">{{ dish.dishName }}</span>
          <UiButton size="small" type="success" @click="$emit('mark-served', dish.id)">Забрал</UiButton>
        </div>
      </div>

      <div class="card-btns">
        <UiButton size="small" type="primary" @click="$emit('add-dish')">+ Блюдо</UiButton>
        <UiButton size="small" type="default" @click="$emit('checkout')">Расчёт</UiButton>
      </div>
    </template>

    <!-- Closed state -->
    <template v-else>
      <UiButton
        size="small"
        full-width
        type="primary"
        @click="$emit('toggle-open')"
      >Открыть стол</UiButton>
    </template>
  </UiCard>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useNow } from '@vueuse/core'
import { UiCard, UiButton, UiIcon, UiText, UiTag } from '@fastio/ui'
import type { Table, TableCall, KitchenQueueItem, KitchenQueueStatus } from '@fastio/shared'
import type { TableSession } from '~/utils/api/tables'
import { formatRelativeTime } from '~/utils/formatRelativeTime'

const props = defineProps<{
  table: Table
  session?: TableSession
  calls: TableCall[]
  kitchenDishes?: KitchenQueueItem[]
  readyDishes?: KitchenQueueItem[]
}>()

defineEmits<{
  'add-dish': []
  'checkout': []
  'toggle-open': []
  'resolve-call': [id: string]
  'mark-served': [dishId: string]
}>()

const now = useNow({ interval: 30_000 })
const expanded = ref(false)
const PREVIEW = 3

const openedAgo = computed(() => props.table.openedAt ? formatRelativeTime(props.table.openedAt, now.value) : '',
)

const visibleItems = computed(() => {
  const items = props.session?.items ?? []

  return expanded.value ? items : items.slice(0, PREVIEW)
})

// Kitchen status per dish name — pick the "best" status from queue items
const kitchenStatusByDish = computed(() => {
  const map = new Map<string, KitchenQueueStatus>()

  if (!props.kitchenDishes?.length) return map

  const priority: Record<KitchenQueueStatus, number> = { done: 3, in_progress: 2, queued: 1, served: 0 }

  for (const item of props.kitchenDishes) {
    const current = map.get(item.dishName)

    if (!current || priority[item.status] > priority[current]) {
      map.set(item.dishName, item.status)
    }
  }

  return map
})

const KITCHEN_LABELS: Partial<Record<KitchenQueueStatus, string>> = {
  queued: 'В очереди',
  in_progress: 'Готовится',
  done: 'Готово',
}

const KITCHEN_TAG_TYPES: Partial<Record<KitchenQueueStatus, 'default' | 'warning' | 'success'>> = {
  queued: 'default',
  in_progress: 'warning',
  done: 'success',
}

const kitchenStatusLabel = (dishName: string) => {
  const status = kitchenStatusByDish.value.get(dishName)

  return status ? KITCHEN_LABELS[status] ?? null : null
}

const kitchenStatusTag = (dishName: string) => {
  const status = kitchenStatusByDish.value.get(dishName)

  return status ? KITCHEN_TAG_TYPES[status] ?? 'default' : 'default'
}

const kitchenStatusClass = (dishName: string) => {
  const status = kitchenStatusByDish.value.get(dishName)

  if (status === 'done') return 'card-item--ready'
  if (status === 'in_progress') return 'card-item--cooking'

  return ''
}
</script>

<style scoped lang="scss">
.table-card {
  border: 1.5px solid var(--color-border);
  gap: 10px;
  height: 100%;

  &--open {
    border-color: var(--color-success);
  }

  &--calling {
    border-color: var(--color-warning);
  }
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.card-icon { color: var(--color-text-hint); flex-shrink: 0; }

.card-name {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-cap {
  font-size: 11px;
  color: var(--color-text-hint);
  background: var(--color-bg-subtle);
  padding: 2px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}

.calls {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 8px;
  background: var(--color-warning-light);
  border-radius: 6px;
  border: 1px solid var(--color-warning);
}

.call-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.call-icon {
  color: var(--color-warning);
  flex-shrink: 0;
}

.call-name {
  flex: 1;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-title);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.call-time {
  font-size: 11px;
  color: var(--color-text-hint);
  flex-shrink: 0;
}

.card-opened {
  color: var(--color-success);
  font-size: 11px;
}

.card-items {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 6px 0;
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
}

.card-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 4px;
  border-radius: 4px;

  &--cooking {
    background: var(--color-warning-light);
  }

  &--ready {
    background: var(--color-success-light);
  }
}

.item-name {
  flex: 1;
  font-size: 12px;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-price {
  font-size: 12px;
  color: var(--color-text-hint);
  flex-shrink: 0;
  white-space: nowrap;
}

.item-total {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-title);
  flex-shrink: 0;
  min-width: 50px;
  text-align: right;
}

.expand-btn {
  font-size: 11px;
  color: var(--color-primary);
  background: none;
  border: none;
  padding: 2px 0;
  cursor: pointer;
  text-align: left;
}

.card-stats {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
}

.stat-orders { font-size: 12px; color: var(--color-text-hint); }

.stat-sum {
  font-size: 16px;
  font-weight: 700;
  color: var(--color-title);
}

.ready-dishes {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 8px;
  background: var(--color-success-light);
  border-radius: 6px;
  border: 1px solid var(--color-success);
}

.ready-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ready-name {
  flex: 1;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-title);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.table-card--ready {
  border-color: var(--color-success);
  box-shadow: 0 0 0 1px var(--color-success);
}

.card-btns {
  display: flex;
  gap: 6px;
  > * { flex: 1; }
}
</style>
