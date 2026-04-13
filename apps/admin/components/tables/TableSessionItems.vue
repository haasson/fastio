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
import type { TableSession, TableSessionItem } from '~/utils/api/tables'
import useKitchenProgress, { type KitchenProgressRow } from '~/composables/ui/useKitchenProgress'

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
  gap: 16px;
}

.session-items-root--compact {
  gap: 10px;
}

.items {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.item-wrap + .item-wrap {
  border-top: 1px dashed var(--color-border);
  padding-top: 4px;
}

.session-items-root--compact .item-wrap + .item-wrap {
  padding-top: 3px;
}

.item-wrap--pending {
  background: var(--color-warning-light);
  border-radius: 6px;
  padding: 4px 8px;
}

.session-items-root--compact .item-wrap--pending {
  border-radius: 4px;
  padding: 3px 4px;
}

.item-row {
  display: flex;
  align-items: center;
  gap: 8px;

  .item-confirm { flex-shrink: 0; color: var(--color-success); }
  .item-reject  { flex-shrink: 0; color: var(--color-error); }
  .item-remove  { flex-shrink: 0; color: var(--color-text-hint); }
}

.session-items-root--compact .item-row {
  gap: 6px;
}

.item-name {
  flex: 1;
  font-size: 13px;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-items-root--compact .item-name {
  font-size: 12px;
}

.item-price {
  font-size: 13px;
  color: var(--color-text-hint);
  flex-shrink: 0;
  white-space: nowrap;
}

.session-items-root--compact .item-price {
  font-size: 12px;
}

.item-total {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-title);
  flex-shrink: 0;
  min-width: 60px;
  text-align: right;
}

.session-items-root--compact .item-total {
  font-size: 12px;
  min-width: 50px;
}

.item-extras {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding-left: 2px;
}

.session-items-root--compact .item-extras {
  gap: 3px;
}

.extra {
  font-size: 11px;
  color: var(--color-text-secondary);

  &--addon   { color: var(--color-primary); }
  &--removed { color: var(--color-error); }
}

.session-items-root--compact .extra {
  font-size: 10px;
}

.cooking-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  background: var(--color-bg-subtle);
  border-radius: 8px;
}

.session-items-root--compact .cooking-block {
  gap: 3px;
  padding: 6px 8px;
  border-radius: 6px;
}

.cooking-header {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-hint);
}

.session-items-root--compact .cooking-header {
  font-size: 10px;
}

.cooking-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.session-items-root--compact .cooking-row {
  gap: 6px;
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
  font-size: 13px;
  font-weight: 500;
  color: var(--color-title);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cooking-qty    { font-size: 13px; color: var(--color-text-hint); flex-shrink: 0; }
.cooking-price  { font-size: 13px; font-weight: 600; color: var(--color-title); flex-shrink: 0; }
.cooking-menu { flex-shrink: 0; color: var(--color-text-hint); }

.session-items-root--compact .cooking-name  { font-size: 12px; }
.session-items-root--compact .cooking-qty   { font-size: 12px; }
.session-items-root--compact .cooking-price { font-size: 12px; }

.ready-dishes {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  background: var(--color-success-light);
  border-radius: 8px;
  border: 1px solid var(--color-success);
}

.session-items-root--compact .ready-dishes {
  gap: 4px;
  padding: 6px 8px;
  border-radius: 6px;
}

.ready-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.session-items-root--compact .ready-item {
  gap: 6px;
}

.ready-name {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-title);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-items-root--compact .ready-name {
  font-size: 12px;
}

.stats {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 8px;
  border-top: 1px solid var(--color-border);
}

.stat-orders { font-size: 13px; color: var(--color-text-hint); }

.stat-sum {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-title);
}

.session-items-root--compact .stat-orders { font-size: 12px; }
.session-items-root--compact .stat-sum    { font-size: 16px; }

.expand-btn {
  font-size: 11px;
  color: var(--color-primary);
  background: none;
  border: none;
  padding: 2px 0;
  cursor: pointer;
  text-align: left;
}
</style>
