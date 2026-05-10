<template>
  <div class="session-items-root" :class="{ 'session-items-root--compact': compact }">
    <!-- Pending confirm all -->
    <UiButton
      v-if="pendingCount > 0"
      :size="compact ? 'small' : 'medium'"
      type="warning"
      full-width
      @click="$emit('confirm-all')"
    >
      Подтвердить все ({{ pendingCount }})
    </UiButton>

    <!-- Items list -->
    <div v-if="visibleItems.length" class="items">
      <div
        v-for="item in visibleItems"
        :key="item.id ?? `${item.dishName}::${orderItemKey(item.modifiers, item.addons, item.removedIngredients)}`"
        class="item-wrap"
        :class="{ 'item-wrap--pending': item.status === 'pending' }"
      >
        <div class="item-row">
          <span class="item-name">{{ item.dishName }}</span>
          <template v-if="item.status === 'pending'">
            <UiTag type="warning" size="small">Ожидает</UiTag>
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
          <template v-else-if="compact">
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
          <template v-else>
            <span class="item-price">{{ item.price }} ₽</span>
            <span class="item-total">{{ item.price * item.quantity }} ₽</span>
            <UiStepper
              :model-value="item.quantity"
              :min="0"
              :max="noAdd ? item.quantity : undefined"
              size="small"
              @update:model-value="val => val > item.quantity ? $emit('repeat-item', item) : $emit('remove-dish', item)"
            />
          </template>
        </div>
        <div v-if="hasCustomizations(item)" class="item-extras">
          <span v-for="mod in item.modifiers" :key="mod.optionName" class="extra">{{ mod.optionName }}</span>
          <span v-for="addon in item.addons" :key="addon.addonName" class="extra extra--addon">+ {{ addon.addonName }}</span>
          <span v-for="ing in item.removedIngredients" :key="ing" class="extra extra--removed">− {{ ing }}</span>
        </div>
      </div>

      <button v-if="hasMore" class="expand-btn" @click="expanded = !expanded">
        {{ expanded ? 'Свернуть' : `+${session!.items.length - previewCount!} ещё` }}
      </button>
    </div>

    <!-- Kitchen progress -->
    <div v-if="kitchenProgress.length" class="cooking-block">
      <div class="cooking-header">На кухне</div>
      <div v-for="item in kitchenProgress" :key="item.key" class="cooking-row">
        <span class="cooking-dot" :class="item.dotClass" />
        <span class="cooking-name">{{ item.dishName }}</span>
        <span class="cooking-qty">×{{ item.count }}</span>
        <span class="cooking-price">{{ item.totalPrice }} ₽</span>
        <UiMenuDropdown
          v-if="checkoutMode"
          :items="kitchenMenuItems(item)"
          compact
          trigger="click"
          @item-click="onKitchenMenuClick($event, item)"
        >
          <template #trigger>
            <UiButton
              size="small"
              type="text"
              icon="moreVertical"
              class="cooking-menu"
            />
          </template>
        </UiMenuDropdown>
      </div>
    </div>

    <!-- Ready dishes -->
    <div v-if="!checkoutMode && readyDishes?.length" class="ready-dishes">
      <div v-for="dish in readyDishes" :key="dish.id" class="ready-item">
        <span class="ready-name">{{ dish.dishName }}</span>
        <UiButton size="small" type="success" @click="$emit('mark-served', dish.id)">Забрал</UiButton>
      </div>
    </div>

    <!-- Stats -->
    <div v-if="showStats" class="stats">
      <span class="stat-orders">{{ session?.count ?? 0 }} {{ pluralize(session?.count ?? 0, 'заказ', 'заказа', 'заказов') }}</span>
      <span class="stat-sum">{{ session?.sum ?? 0 }} ₽</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { UiButton, UiTag, UiStepper, UiMenuDropdown } from '@fastio/ui'
import type { UiMenuDropdownItem } from '@fastio/ui'
import type { KitchenQueueItem } from '@fastio/shared'
import { orderItemKey, pluralize } from '@fastio/shared'
import type { TableSession, TableSessionItem } from '../api/tables'
import { useKitchenProgress, type KitchenProgressRow } from '~/features/kitchen'

type Props = {
  session?: TableSession
  kitchenDishes?: KitchenQueueItem[]
  readyDishes?: KitchenQueueItem[]
  compact?: boolean
  previewCount?: number
  showStats?: boolean
  noAdd?: boolean
  checkoutMode?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  compact: false,
  showStats: true,
  noAdd: false,
  checkoutMode: false,
})

const emit = defineEmits<{
  'remove-dish': [item: TableSessionItem]
  'repeat-item': [item: TableSessionItem]
  'confirm-item': [itemId: string]
  'reject-item': [itemId: string]
  'confirm-all': []
  'mark-served': [dishId: string]
  'cancel-kitchen': [ids: string[], amount: number, charged: boolean]
  'serve-kitchen': [ids: string[]]
}>()

const expanded = ref(false)

const hasMore = computed(() => props.previewCount != null && (props.session?.items.length ?? 0) > props.previewCount)

const visibleItems = computed(() => {
  const items = props.session?.items ?? []

  if (props.previewCount != null && !expanded.value) return items.slice(0, props.previewCount)

  return items
})

const pendingCount = computed(() => (props.session?.items ?? []).filter((i) => i.status === 'pending').length)

const hasCustomizations = (item: TableSessionItem) => item.modifiers.length > 0 || item.addons.length > 0 || item.removedIngredients.length > 0

const { kitchenProgress } = useKitchenProgress(
  () => props.kitchenDishes,
  () => props.session,
  { includeDone: props.checkoutMode },
)

const kitchenMenuItems = (item: KitchenProgressRow): UiMenuDropdownItem[] => {
  const items: UiMenuDropdownItem[] = []

  if (item.status !== 'queued') {
    items.push({ name: 'served', label: 'Подано', icon: 'check' })
  }

  items.push(
    { name: 'cancel-charged', label: 'Отменить и добавить в чек', icon: 'creditCard', iconColor: 'color-error' },
    { name: 'cancel-free', label: 'Отменить и убрать из чека', icon: 'ban', iconColor: 'color-error' },
  )

  return items
}

const onKitchenMenuClick = (name: string, item: KitchenProgressRow) => {
  if (name === 'served') emit('serve-kitchen', item.ids)
  else if (name === 'cancel-charged') emit('cancel-kitchen', item.ids, item.totalPrice, true)
  else if (name === 'cancel-free') emit('cancel-kitchen', item.ids, item.totalPrice, false)
}
</script>

<style scoped lang="scss">
.session-items-root {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
}

.session-items-root--compact {
  gap: var(--space-8);
}

.items {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.item-wrap + .item-wrap {
  border-top: 1px dashed var(--color-border);
  padding-top: var(--space-4);
}

.session-items-root--compact .item-wrap + .item-wrap {
  padding-top: var(--space-4);
}

.item-wrap--pending {
  background: var(--color-warning-light);
  border-radius: var(--radius-8);
  padding: var(--space-4) var(--space-8);
}

.session-items-root--compact .item-wrap--pending {
  border-radius: var(--radius-4);
  padding: var(--space-4);
}

.item-row {
  display: flex;
  align-items: center;
  gap: var(--space-8);

  .item-confirm { flex-shrink: 0; color: var(--color-success); }
  .item-reject  { flex-shrink: 0; color: var(--color-error); }
  .item-remove  { flex-shrink: 0; color: var(--color-text-hint); }
}

.session-items-root--compact .item-row {
  gap: var(--space-8);
}

.item-name {
  flex: 1;
  font-size: var(--font-size-base);
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-items-root--compact .item-name {
  font-size: var(--font-size-sm);
}

.item-price {
  font-size: var(--font-size-base);
  color: var(--color-text-hint);
  flex-shrink: 0;
  white-space: nowrap;
}

.session-items-root--compact .item-price {
  font-size: var(--font-size-sm);
}

.item-total {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-title);
  flex-shrink: 0;
  min-width: 60px;
  text-align: right;
}

.session-items-root--compact .item-total {
  font-size: var(--font-size-sm);
  min-width: 50px;
}

.item-extras {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  padding-left: var(--space-4);
}

.session-items-root--compact .item-extras {
  gap: var(--space-4);
}

.extra {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);

  &--addon   { color: var(--color-primary); }
  &--removed { color: var(--color-error); }
}

.session-items-root--compact .extra {
  font-size: var(--font-size-xs);
}

.cooking-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-8) var(--space-12);
  background: var(--color-bg-subtle);
  border-radius: var(--radius-8);
}

.session-items-root--compact .cooking-block {
  gap: var(--space-4);
  padding: var(--space-8);
  border-radius: var(--radius-8);
}

.cooking-header {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-hint);
}

.session-items-root--compact .cooking-header {
  font-size: var(--font-size-xs);
}

.cooking-row {
  display: flex;
  align-items: center;
  gap: var(--space-8);
}

.session-items-root--compact .cooking-row {
  gap: var(--space-8);
}

.cooking-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;

  &.dot--queued  { background: var(--color-primary); }
  &.dot--cooking { background: var(--color-warning); }
  &.dot--ready   { background: var(--color-success); }
}

.cooking-name {
  flex: 1;
  min-width: 0;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-title);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cooking-qty    { font-size: var(--font-size-base); color: var(--color-text-hint); flex-shrink: 0; }
.cooking-price  { font-size: var(--font-size-base); font-weight: var(--font-weight-semibold); color: var(--color-title); flex-shrink: 0; }
.cooking-menu { flex-shrink: 0; color: var(--color-text-hint); }

.session-items-root--compact .cooking-name  { font-size: var(--font-size-sm); }
.session-items-root--compact .cooking-qty   { font-size: var(--font-size-sm); }
.session-items-root--compact .cooking-price { font-size: var(--font-size-sm); }

.ready-dishes {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  padding: var(--space-8) var(--space-12);
  background: var(--color-success-light);
  border-radius: var(--radius-8);
  border: 1px solid var(--color-success);
}

.session-items-root--compact .ready-dishes {
  gap: var(--space-4);
  padding: var(--space-8);
  border-radius: var(--radius-8);
}

.ready-item {
  display: flex;
  align-items: center;
  gap: var(--space-8);
}

.session-items-root--compact .ready-item {
  gap: var(--space-8);
}

.ready-name {
  flex: 1;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  color: var(--color-title);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-items-root--compact .ready-name {
  font-size: var(--font-size-sm);
}

.stats {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: var(--space-8);
  border-top: 1px solid var(--color-border);
}

.stat-orders { font-size: var(--font-size-base); color: var(--color-text-hint); }

.stat-sum {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--color-title);
}

.session-items-root--compact .stat-orders { font-size: var(--font-size-sm); }
.session-items-root--compact .stat-sum    { font-size: var(--font-size-lg); }

.expand-btn {
  font-size: var(--font-size-xs);
  color: var(--color-primary);
  background: none;
  border: none;
  padding: var(--space-4) 0;
  cursor: pointer;
  text-align: left;
}
</style>
