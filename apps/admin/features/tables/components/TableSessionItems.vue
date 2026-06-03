<template>
  <div class="session-items-root" :class="{ 'session-items-root--compact': compact }">
    <!-- Заказ со стола: новые позиции, ждут подтверждения официантом.
         Всегда виден целиком (не сворачивается превью) — это hot-path действия. -->
    <div v-if="pendingItems.length" class="block block--pending">
      <div class="block-head">
        <span class="block-title">Заказ со стола</span>
        <UiButton
          :size="compact ? 'small' : 'medium'"
          type="warning"
          @click="$emit('confirm-all')"
        >
          Подтвердить все ({{ pendingItems.length }})
        </UiButton>
      </div>
      <div class="block-rows">
        <div v-for="item in pendingItems" :key="item.id!" class="action-row">
          <div class="action-main">
            <span class="row-name">{{ item.dishName }}</span>
            <div v-if="showCategory && item.categoryName" class="row-category">{{ item.categoryName }}</div>
            <div v-if="hasCustomizations(item)" class="row-extras">
              <span v-for="mod in item.modifiers" :key="mod.optionName" class="extra">{{ mod.optionName }}</span>
              <span v-for="addon in item.addons" :key="addon.addonName" class="extra extra--addon">+ {{ addon.addonName }}</span>
              <span v-for="ing in item.removedIngredients" :key="ing" class="extra extra--removed">− {{ ing }}</span>
            </div>
          </div>
          <span class="row-qty">×{{ item.quantity }}</span>
          <UiButton
            size="small"
            type="text"
            icon="check"
            class="act-confirm"
            @click="$emit('confirm-item', item.id!)"
          />
          <UiButton
            size="small"
            type="text"
            icon="close"
            class="act-reject"
            @click="$emit('reject-item', item.id!)"
          />
        </div>
      </div>
    </div>

    <!-- Готовка на кухне: queued / in_progress. Bulk-действия тут нет —
         нельзя «доготовить всё» одной кнопкой. -->
    <div v-if="cookingRows.length" class="block block--cooking">
      <div class="block-head">
        <span class="block-title">Готовка на кухне</span>
      </div>
      <div class="block-rows">
        <div v-for="row in cookingRows" :key="row.key" class="cooking-row">
          <span class="cooking-dot" :class="row.dotClass" />
          <span class="row-name">{{ row.dishName }}</span>
          <span class="row-qty">×{{ row.count }}</span>
          <span class="row-price">{{ formatPrice(row.totalPrice) }}</span>
          <UiMenuDropdown
            v-if="checkoutMode"
            :items="kitchenMenuItems(row)"
            compact
            trigger="click"
            @item-click="onKitchenMenuClick($event, row)"
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
    </div>

    <!-- Готовые — забрать: done. Per-item «Забрал» + bulk «Забрал все». -->
    <div v-if="!checkoutMode && readyRows.length" class="block block--ready">
      <div class="block-head">
        <span class="block-title">Готовые — забрать</span>
        <UiButton
          v-if="readyIds.length > 1"
          :size="compact ? 'small' : 'medium'"
          type="success"
          @click="$emit('mark-served-all', readyIds)"
        >
          Забрал все ({{ readyIds.length }})
        </UiButton>
      </div>
      <div class="block-rows">
        <div v-for="row in readyRows" :key="row.key" class="action-row">
          <span class="cooking-dot dot--ready" />
          <span class="row-name">{{ row.dishName }}</span>
          <span class="row-qty">×{{ row.count }}</span>
          <UiButton size="small" type="success" @click="$emit('mark-served-all', row.ids)">Забрал</UiButton>
        </div>
      </div>
    </div>

    <!-- Чек: только поданные позиции (confirmed минус всё, что ещё в кухонном
         пайплайне). Превью (listPreviewRows) сворачивает именно этот список. -->
    <div v-if="servedItems.length || showStats" class="check">
      <div v-if="servedItems.length" class="check-rows">
        <div
          v-for="item in visibleServed"
          :key="item.id ?? `${item.dishName}::${orderItemKey(item.modifiers, item.addons, item.removedIngredients)}`"
          class="check-row"
        >
          <div class="check-main">
            <span class="row-name">{{ item.dishName }}</span>
            <div v-if="showCategory && item.categoryName" class="row-category">{{ item.categoryName }}</div>
            <div v-if="hasCustomizations(item)" class="row-extras">
              <span v-for="mod in item.modifiers" :key="mod.optionName" class="extra">{{ mod.optionName }}</span>
              <span v-for="addon in item.addons" :key="addon.addonName" class="extra extra--addon">+ {{ addon.addonName }}</span>
              <span v-for="ing in item.removedIngredients" :key="ing" class="extra extra--removed">− {{ ing }}</span>
            </div>
          </div>
          <span class="row-price">{{ formatPrice(item.price) }} × {{ item.quantity }}</span>
          <span class="row-total">{{ formatPrice(item.price * item.quantity) }}</span>
          <template v-if="!compact && !noAdd">
            <UiStepper
              :model-value="item.quantity"
              :min="0"
              size="small"
              @update:model-value="val => val > item.quantity ? $emit('repeat-item', item) : $emit('remove-dish', item)"
            />
          </template>
          <UiButton
            v-else-if="!noAdd"
            size="small"
            type="text"
            icon="close"
            class="act-remove"
            @click="$emit('remove-dish', item)"
          />
        </div>

        <button v-if="hasMore" class="expand-btn" @click="expanded = !expanded">
          {{ expanded ? 'Свернуть' : `+${servedItems.length - previewCount!} ещё` }}
        </button>
      </div>

      <div v-if="showStats" class="stats">
        <span class="stat-orders">{{ positionsCount }} {{ pluralize(positionsCount, 'позиция', 'позиции', 'позиций') }}</span>
        <span class="stat-sum">{{ formatPrice(session?.sum ?? 0) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { UiButton, UiStepper, UiMenuDropdown } from '@fastio/ui'
import type { UiMenuDropdownItem } from '@fastio/ui'
import type { KitchenQueueItem } from '@fastio/shared'
import { orderItemKey, pluralize, formatPrice } from '@fastio/shared'
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
  showCategory?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  compact: false,
  showStats: true,
  noAdd: false,
  checkoutMode: false,
  showCategory: false,
})

const emit = defineEmits<{
  'remove-dish': [item: TableSessionItem]
  'repeat-item': [item: TableSessionItem]
  'confirm-item': [itemId: string]
  'reject-item': [itemId: string]
  'confirm-all': []
  'mark-served-all': [dishIds: string[]]
  'cancel-kitchen': [ids: string[], amount: number, charged: boolean]
  'serve-kitchen': [ids: string[]]
}>()

const expanded = ref(false)

const pendingItems = computed(() => (props.session?.items ?? []).filter((i) => i.status === 'pending'))

// Кол-во позиций на столе = сумма количеств всех блюд (pending + confirmed).
// Раньше показывали session.count — число строк orders, которое не сходится ни с
// чем: админский «+Блюдо» плодит по заказу на блюдо, а корзина гостя кладёт N блюд
// в один заказ. Сумма quantity сходится с тем, что видит официант в блоках/чеке.
const positionsCount = computed(() => (props.session?.items ?? []).reduce((sum, i) => sum + i.quantity, 0))

const hasCustomizations = (item: TableSessionItem) => item.modifiers.length > 0 || item.addons.length > 0 || item.removedIngredients.length > 0

const { kitchenProgress } = useKitchenProgress(
  () => props.kitchenDishes,
  () => props.session,
  { includeDone: true },
)

// Кухонный пайплайн делим на «готовится» и «готово». В checkoutMode done-позиции
// показываются среди готовки (includeDone), вне его — отдельным блоком «Готовые».
const cookingRows = computed(() => kitchenProgress.value.filter((r) => r.status === 'queued' || r.status === 'in_progress'
  || (props.checkoutMode && r.status === 'done')),
)
const readyRows = computed(() => kitchenProgress.value.filter((r) => r.status === 'done'))
const readyIds = computed(() => readyRows.value.flatMap((r) => r.ids))

// Чек = подтверждённые позиции, которых уже нет в кухонном пайплайне (поданы /
// skip_kitchen). Активные кухонные единицы вычитаем по ключу dishName+фингерпринт,
// чтобы частично поданное блюдо (3 заказано, 1 ещё готовится) считалось верно.
const servedItems = computed<TableSessionItem[]>(() => {
  const confirmed = (props.session?.items ?? []).filter((i) => i.status === 'confirmed')

  const activeByKey = new Map<string, number>()

  for (const item of props.kitchenDishes ?? []) {
    if (item.status !== 'queued' && item.status !== 'in_progress' && item.status !== 'done') continue
    const key = `${item.dishName}::${orderItemKey(item.modifiers, item.addons, item.removedIngredients)}`

    activeByKey.set(key, (activeByKey.get(key) ?? 0) + 1)
  }

  const result: TableSessionItem[] = []

  for (const item of confirmed) {
    const key = `${item.dishName}::${orderItemKey(item.modifiers, item.addons, item.removedIngredients)}`
    const active = activeByKey.get(key) ?? 0
    const servedQty = item.quantity - active

    if (servedQty <= 0) {
      activeByKey.set(key, active - item.quantity)
      continue
    }

    activeByKey.set(key, 0)
    result.push(servedQty === item.quantity ? item : { ...item, quantity: servedQty })
  }

  return result
})

const hasMore = computed(() => props.previewCount != null && servedItems.value.length > props.previewCount)

const visibleServed = computed(() => {
  if (props.previewCount != null && !expanded.value) return servedItems.value.slice(0, props.previewCount)

  return servedItems.value
})

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

.block {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  padding: var(--space-8) var(--space-12);
  border-radius: var(--radius-8);
}

.session-items-root--compact .block {
  gap: var(--space-4);
  padding: var(--space-8);
}

.block--pending {
  background: var(--color-warning-light);
  border: 1px solid var(--color-warning);
}

.block--cooking {
  background: var(--color-bg-subtle);
}

.block--ready {
  background: var(--color-success-light);
  border: 1px solid var(--color-success);
}

.block-head {
  display: flex;
  align-items: center;
  gap: var(--space-8);
}

.block-title {
  flex: 1;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-hint);
}

.block-rows {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.action-row,
.cooking-row,
.check-row {
  display: flex;
  align-items: center;
  gap: var(--space-8);
}

.action-main,
.check-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.row-name {
  flex: 1;
  min-width: 0;
  font-size: var(--font-size-base);
  color: var(--color-title);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.session-items-root--compact .row-name {
  font-size: var(--font-size-sm);
}

.row-category {
  font-size: var(--font-size-xs);
  color: var(--color-text-hint);
}

.row-extras {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
}

.extra {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);

  &--addon   { color: var(--color-primary); }
  &--removed { color: var(--color-error); }
}

.row-qty {
  font-size: var(--font-size-base);
  color: var(--color-text-hint);
  flex-shrink: 0;
}

.session-items-root--compact .row-qty {
  font-size: var(--font-size-sm);
}

.row-price {
  font-size: var(--font-size-base);
  color: var(--color-text-hint);
  flex-shrink: 0;
  white-space: nowrap;
}

.session-items-root--compact .row-price {
  font-size: var(--font-size-sm);
}

.row-total {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-title);
  flex-shrink: 0;
  min-width: 60px;
  text-align: right;
}

.session-items-root--compact .row-total {
  font-size: var(--font-size-sm);
  min-width: 50px;
}

.act-confirm { flex-shrink: 0; color: var(--color-success); }
.act-reject  { flex-shrink: 0; color: var(--color-error); }
.act-remove  { flex-shrink: 0; color: var(--color-text-hint); }

.cooking-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;

  &.dot--queued  { background: var(--color-primary); }
  &.dot--cooking { background: var(--color-warning); }
  &.dot--ready   { background: var(--color-success); }
}

.cooking-menu { flex-shrink: 0; color: var(--color-text-hint); }

.check {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.check-rows {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.check-row + .check-row {
  border-top: 1px dashed var(--color-border);
  padding-top: var(--space-4);
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
