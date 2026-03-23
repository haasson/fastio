<template>
  <UiCard size="small" class="table-card" :class="{ 'table-card--open': table.isOpen, 'table-card--calling': calls.length > 0, 'table-card--ready': readyDishes?.length }">
    <div class="card-header">
      <div class="card-title">
        <UiIcon name="tableIcon" :size="18" class="card-icon" />
        <UiText size="medium" class="card-name">{{ table.name }}</UiText>
      </div>
      <UiTag v-if="pendingCount > 0" type="warning" size="small">{{ pendingCount }} ожидают</UiTag>
      <span v-if="table.capacity" class="card-cap"><UiIcon name="users" :size="12" /> {{ table.capacity }}</span>
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
          :key="item.id ?? `${item.dishName}::${orderItemKey(item.modifiers, item.addons, item.removedIngredients)}`"
          class="card-item-wrap"
          :class="{ 'card-item-wrap--pending': item.status === 'pending' }"
        >
          <div class="card-item">
            <span class="item-name">{{ item.dishName }}</span>
            <template v-if="item.status === 'pending'">
              <UiTag type="warning" size="small" class="item-pending-tag">Ожидает</UiTag>
              <UiButton
                size="small"
                type="text"
                icon="check"
                class="item-confirm"
                @click="$emit('confirm-item', item.id!)"
              />
              <UiButton
                size="small"
                type="text"
                icon="close"
                class="item-reject"
                @click="$emit('reject-item', item.id!)"
              />
            </template>
            <template v-else>
              <span class="item-price">{{ item.price }} × {{ item.quantity }}</span>
              <span class="item-total">{{ item.price * item.quantity }} ₽</span>
              <UiButton
                size="small"
                type="text"
                icon="close"
                class="item-remove"
                @click="$emit('remove-dish', item)"
              />
            </template>
          </div>
          <div v-if="hasCustomizations(item)" class="item-extras">
            <span v-for="mod in item.modifiers" :key="mod.optionName" class="extra">{{ mod.optionName }}</span>
            <span v-for="addon in item.addons" :key="addon.addonName" class="extra extra--addon">+ {{ addon.addonName }}</span>
            <span v-for="ing in item.removedIngredients" :key="ing" class="extra extra--removed">− {{ ing }}</span>
          </div>
        </div>
        <button v-if="session.items.length > PREVIEW" class="expand-btn" @click="expanded = !expanded">
          {{ expanded ? 'Свернуть' : `+${session.items.length - PREVIEW} ещё` }}
        </button>
      </div>

      <UiButton
        v-if="pendingCount > 0"
        size="small"
        type="warning"
        full-width
        @click="$emit('confirm-all')"
      >
        Подтвердить все ({{ pendingCount }})
      </UiButton>

      <div v-if="kitchenProgress.length" class="cooking-block">
        <div class="cooking-header">Готовятся</div>
        <div v-for="item in kitchenProgress" :key="item.key" class="cooking-row">
          <span class="cooking-dot" :class="item.dotClass" />
          <span class="cooking-name">{{ item.dishName }}</span>
          <span class="cooking-qty">×{{ item.count }}</span>
          <span class="cooking-price">{{ item.totalPrice }} ₽</span>
        </div>
      </div>

      <div class="card-stats">
        <span class="stat-orders">{{ session?.count ?? 0 }} {{ pluralize(session?.count ?? 0, 'заказ', 'заказа', 'заказов') }}</span>
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
import type { Table, TableCall, KitchenQueueItem } from '@fastio/shared'
import { orderItemKey, pluralize } from '@fastio/shared'
import type { TableSession, TableSessionItem } from '~/utils/api/tables'
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
  'remove-dish': [item: TableSessionItem]
  'confirm-item': [itemId: string]
  'reject-item': [itemId: string]
  'confirm-all': []
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

const pendingCount = computed(() => (props.session?.items ?? []).filter((i) => i.status === 'pending').length)

const hasCustomizations = (item: TableSessionItem) => item.modifiers.length > 0 || item.addons.length > 0 || item.removedIngredients.length > 0

// Kitchen progress — flat list grouped by dishName+status, with dot color and price
type KitchenProgressRow = { key: string; dishName: string; count: number; dotClass: string; totalPrice: number }

const kitchenProgress = computed<KitchenProgressRow[]>(() => {
  if (!props.kitchenDishes?.length) return []

  // Build price lookup keyed by dishName + customization fingerprint
  const priceMap = new Map<string, number>()

  for (const item of props.session?.items ?? []) {
    const fp = orderItemKey(item.modifiers, item.addons, item.removedIngredients)

    priceMap.set(`${item.dishName}::${fp}`, item.price)
  }

  const map = new Map<string, KitchenProgressRow>()

  for (const item of props.kitchenDishes) {
    if (item.status !== 'queued' && item.status !== 'in_progress') continue

    const fp = orderItemKey(item.modifiers, item.addons, item.removedIngredients)
    const key = `${item.dishName}::${fp}::${item.status}`
    let row = map.get(key)

    if (!row) {
      row = {
        key,
        dishName: item.dishName,
        count: 0,
        dotClass: item.status === 'in_progress' ? 'dot--cooking' : 'dot--queued',
        totalPrice: 0,
      }
      map.set(key, row)
    }

    row.count++
    row.totalPrice = row.count * (priceMap.get(`${item.dishName}::${fp}`) ?? 0)
  }

  return [...map.values()]
})
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
  display: inline-flex;
  align-items: center;
  gap: 3px;
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

.card-item-wrap + .card-item-wrap {
  border-top: 1px dashed var(--color-border);
  padding-top: 3px;
}

.card-item-wrap--pending {
  background: var(--color-warning-light);
  border-radius: 4px;
  padding: 3px 4px;
}

.card-item {
  display: flex;
  align-items: center;
  gap: 6px;

  .item-remove {
    flex-shrink: 0;
    color: var(--color-text-hint);
  }

  .item-confirm {
    flex-shrink: 0;
    color: var(--color-success);
  }

  .item-reject {
    flex-shrink: 0;
    color: var(--color-error);
  }

  .item-pending-tag {
    flex-shrink: 0;
  }
}

.item-extras {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  padding-left: 2px;
}

.extra {
  font-size: 10px;
  color: var(--color-text-secondary);

  &--addon { color: var(--color-primary); }
  &--removed { color: var(--color-error); }
}

.cooking-block {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 6px 8px;
  background: var(--color-bg-subtle);
  border-radius: 6px;
}

.cooking-header {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-hint);
}

.cooking-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.cooking-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;

  &.dot--queued { background: var(--color-primary); }
  &.dot--cooking { background: var(--color-warning); }
}

.cooking-name {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-title);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cooking-qty {
  font-size: 12px;
  color: var(--color-text-hint);
  flex-shrink: 0;
}

.cooking-price {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-title);
  flex-shrink: 0;
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
