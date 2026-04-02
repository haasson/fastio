<template>
  <UiDrawer
    :model-value="modelValue"
    :title="table?.name ?? 'Стол'"
    :width="480"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <template v-if="table" #header-actions>
      <UiTag v-if="table.isOpen" type="success" size="small">Открыт {{ openedAgo }}</UiTag>
    </template>

    <div v-if="table" class="detail-root">
      <!-- Calls -->
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

      <!-- Pending confirmation -->
      <UiButton
        v-if="pendingCount > 0"
        size="small"
        type="warning"
        full-width
        @click="$emit('confirm-all')"
      >
        Подтвердить все ({{ pendingCount }})
      </UiButton>

      <!-- Items list -->
      <div v-if="session?.items.length" class="items">
        <div
          v-for="item in session.items"
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
            <template v-else>
              <span class="item-price">{{ item.price }} ₽</span>
              <span class="item-total">{{ item.price * item.quantity }} ₽</span>
              <UiStepper
                :model-value="item.quantity"
                :min="0"
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
      </div>

      <!-- Kitchen progress -->
      <div v-if="kitchenProgress.length" class="cooking-block">
        <div class="cooking-header">Готовятся</div>
        <div v-for="item in kitchenProgress" :key="item.key" class="cooking-row">
          <span class="cooking-dot" :class="item.dotClass" />
          <span class="cooking-name">{{ item.dishName }}</span>
          <span class="cooking-qty">×{{ item.count }}</span>
          <span class="cooking-price">{{ item.totalPrice }} ₽</span>
        </div>
      </div>

      <!-- Ready dishes -->
      <div v-if="readyDishes?.length" class="ready-dishes">
        <div v-for="dish in readyDishes" :key="dish.id" class="ready-item">
          <span class="ready-name">{{ dish.dishName }}</span>
          <UiButton size="small" type="success" @click="$emit('mark-served', dish.id)">Забрал</UiButton>
        </div>
      </div>

      <!-- Stats -->
      <div class="stats">
        <span class="stat-orders">{{ session?.count ?? 0 }} {{ pluralize(session?.count ?? 0, 'заказ', 'заказа', 'заказов') }}</span>
        <span class="stat-sum">{{ session?.sum ?? 0 }} ₽</span>
      </div>
    </div>

    <template v-if="table?.isOpen" #footer>
      <UiButton type="primary" @click="$emit('add-dish')">+ Блюдо</UiButton>
      <UiButton type="default" @click="$emit('checkout')">Расчёт</UiButton>
    </template>
  </UiDrawer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useNow } from '@vueuse/core'
import { UiDrawer, UiButton, UiIcon, UiTag, UiStepper } from '@fastio/ui'
import type { Table, TableCall, KitchenQueueItem } from '@fastio/shared'
import { orderItemKey, pluralize, formatRelativeTime } from '@fastio/shared'
import type { TableSession, TableSessionItem } from '~/utils/api/tables'
import useKitchenProgress from '~/composables/ui/useKitchenProgress'

type Props = {
  modelValue: boolean
  table: Table | null
  session?: TableSession
  calls: TableCall[]
  kitchenDishes?: KitchenQueueItem[]
  readyDishes?: KitchenQueueItem[]
}

const props = defineProps<Props>()

defineEmits<{
  'update:modelValue': [value: boolean]
  'add-dish': []
  'checkout': []
  'resolve-call': [id: string]
  'mark-served': [dishId: string]
  'remove-dish': [item: TableSessionItem]
  'repeat-item': [item: TableSessionItem]
  'confirm-item': [itemId: string]
  'reject-item': [itemId: string]
  'confirm-all': []
}>()

const now = useNow({ interval: 30_000 })

const openedAgo = computed(() => props.table?.openedAt ? formatRelativeTime(props.table.openedAt, now.value) : '',
)

const pendingCount = computed(() => (props.session?.items ?? []).filter((i) => i.status === 'pending').length)

const hasCustomizations = (item: TableSessionItem) => item.modifiers.length > 0 || item.addons.length > 0 || item.removedIngredients.length > 0

const { kitchenProgress } = useKitchenProgress(
  () => props.kitchenDishes,
  () => props.session,
)
</script>

<style scoped lang="scss">
.detail-root {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px 0;
}

.calls {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  background: var(--color-warning-light);
  border-radius: 8px;
  border: 1px solid var(--color-warning);
}

.call-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.call-icon {
  color: var(--color-warning);
  flex-shrink: 0;
}

.call-name {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-title);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.call-time {
  font-size: 12px;
  color: var(--color-text-hint);
  flex-shrink: 0;
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

.item-wrap--pending {
  background: var(--color-warning-light);
  border-radius: 6px;
  padding: 4px 8px;
}

.item-row {
  display: flex;
  align-items: center;
  gap: 8px;

  .item-confirm {
    flex-shrink: 0;
    color: var(--color-success);
  }

  .item-reject {
    flex-shrink: 0;
    color: var(--color-error);
  }

}

.item-name {
  flex: 1;
  font-size: 13px;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-price {
  font-size: 13px;
  color: var(--color-text-hint);
  flex-shrink: 0;
  white-space: nowrap;
}

.item-total {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-title);
  flex-shrink: 0;
  min-width: 60px;
  text-align: right;
}

.item-extras {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding-left: 2px;
}

.extra {
  font-size: 11px;
  color: var(--color-text-secondary);

  &--addon { color: var(--color-primary); }
  &--removed { color: var(--color-error); }
}

.cooking-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  background: var(--color-bg-subtle);
  border-radius: 8px;
}

.cooking-header {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-hint);
}

.cooking-row {
  display: flex;
  align-items: center;
  gap: 8px;
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
  font-size: 13px;
  font-weight: 500;
  color: var(--color-title);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cooking-qty {
  font-size: 13px;
  color: var(--color-text-hint);
  flex-shrink: 0;
}

.cooking-price {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-title);
  flex-shrink: 0;
}

.ready-dishes {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  background: var(--color-success-light);
  border-radius: 8px;
  border: 1px solid var(--color-success);
}

.ready-item {
  display: flex;
  align-items: center;
  gap: 8px;
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

.stats {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 8px;
  border-top: 1px solid var(--color-border);
}

.stat-orders {
  font-size: 13px;
  color: var(--color-text-hint);
}

.stat-sum {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-title);
}
</style>
