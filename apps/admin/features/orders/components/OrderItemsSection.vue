<template>
  <section class="section" data-testid="order-items-section">
    <ul class="items-list">
      <DishItemRow
        v-for="(item, idx) in items"
        :key="`${item.dishId}-${idx}`"
        data-testid="order-item-row"
        :name="item.dishName"
        :category-name="item.comboId ? 'Комбо' : item.categoryName"
        :modifiers="item.modifiers.map((m) => ({ name: m.optionName, priceDelta: m.priceDelta }))"
        :removed-ingredients="item.removedIngredients"
        :addons="item.addons?.map((a) => ({ name: a.addonName, price: a.price }))"
        :price="item.price"
      >
        <template v-if="showItemActions">
          <div class="qty-controls">
            <UiButton
              type="text"
              size="small"
              icon="minusRound"
              :disabled="isLocked(item) || ctrlBusy"
              @click="changeQty(idx, -1)"
            />
            <span class="qty-value">{{ item.quantity }}</span>
            <UiButton
              type="text"
              size="small"
              icon="plusRound"
              :disabled="isLocked(item) || ctrlBusy"
              @click="changeQty(idx, 1)"
            />
          </div>
        </template>
        <template v-else>
          <span class="qty-value qty-readonly">× {{ item.quantity }}</span>
        </template>
        <span class="item-price">{{ formatPrice(getItemUnitPrice(item) * item.quantity) }}</span>

        <UiRowActions
          v-if="showItemActions"
          size="small"
          :disable-edit="isLocked(item) || !isItemEditable(item) || ctrlBusy || (allowEdit && !!item.comboId)"
          :disable-delete="isLocked(item) || isLastItem || ctrlBusy"
          :edit-title="isLocked(item) ? 'Уже готовится' : (allowEdit && item.comboId) ? 'Правка комбо в принятом заказе недоступна' : undefined"
          :delete-title="isLocked(item) ? 'Уже готовится' : isLastItem ? 'Нельзя удалить последнюю позицию' : undefined"
          @edit="openEditItem(idx)"
          @delete="onDeleteClick(idx)"
        />
      </DishItemRow>
    </ul>

    <div v-if="!readonly || allowAdd" class="add-dish-row">
      <UiButton
        type="primary"
        size="small"
        icon="plus"
        @click="openAddDishModal()"
      >
        {{ `Добавить ${item.acc}` }}
      </UiButton>
    </div>

    <DishPickerModal
      :model-value="addDishModalOpen"
      :tenant-id="tenantId"
      :edit-item="editingItem"
      show-combos
      :show-ingredients="gate.ingredients.value.enabled"
      @select="onPickerSelect"
      @update:model-value="onAddDishModalClose"
    />
  </section>
</template>

<script setup lang="ts">
import { UiButton, UiRowActions } from '@fastio/ui'
import { computed } from 'vue'
import { useConfirm } from '@fastio/kit'
import { getItemUnitPrice, formatPrice } from '@fastio/shared'
import { useGate } from '~/shared/plan/useGate'
import type { OrderItem } from '@fastio/shared'

import { DishPickerModal, type DishPickerResult } from '~/features/menu'
import DishItemRow from '~/shared/ui/components/DishItemRow.vue'
import useDrawer from '~/shared/ui/composables/useDrawer'
import { useTerms } from '~/features/legal'

const props = defineProps<{
  items: OrderItem[]
  tenantId: string
  readonly?: boolean
  // Режим дозаказа: секция остаётся readonly (существующие позиции залочены),
  // но кнопка «Добавить» доступна и новые позиции уходят наружу через emit('addItem'),
  // а не мутируют in-memory список (родитель дёргает RPC сразу).
  allowAdd?: boolean
  // Срез 3: правка/удаление существующих позиций принятого заказа. Тоже через
  // emit→RPC (removeItem/editItem), не in-memory. Гейтится по item.kitchenLocked
  // и last-item. Отдельно от allowAdd, т.к. это операции над существующими строками.
  allowEdit?: boolean
  // Инфлайт RPC-операции родителя — дизейблим контролы (защита от дабл-клика).
  busy?: boolean
}>()

const emit = defineEmits<{
  'update:items': [items: OrderItem[]]
  'addItem': [item: OrderItem]
  'removeItem': [item: OrderItem]
  'editItem': [item: OrderItem]
}>()

// Показывать ли контролы кол-ва/правки/удаления на позиции:
// группа new (не readonly) — старый in-memory путь; принятый заказ — allowEdit.
const showItemActions = computed(() => !props.readonly || props.allowEdit)
const isLocked = (it: OrderItem) => it.kitchenLocked === true
const isLastItem = computed(() => props.items.length <= 1)
// Инфлайт RPC-операции родителя (только в режиме правки принятого заказа).
const ctrlBusy = computed(() => props.allowEdit === true && props.busy === true)

const { confirm } = useConfirm()
const { item } = useTerms()
const gate = useGate()

const isItemEditable = (item: OrderItem) => {
  if (item.customizable !== undefined) return item.customizable

  // Фолбэк для айтемов из БД (без поля customizable): считаем редактируемым, если есть хоть что-то
  return item.modifiers.length > 0 || item.addons.length > 0 || item.removedIngredients.length > 0
}

const { isOpen: addDishModalOpen, data: editingItemIndex, open: openAddDishModal, close: closeAddDishModal } = useDrawer<number>()

const editingItem = computed(() => {
  if (editingItemIndex.value === null) return undefined
  const item = props.items[editingItemIndex.value!]

  return { dishId: item.dishId, comboId: item.comboId, modifiers: item.modifiers, removedIngredients: item.removedIngredients, addons: item.addons }
})

const mutate = (fn: (items: OrderItem[]) => void) => {
  const copy = props.items.map((i) => ({ ...i }))

  fn(copy)
  emit('update:items', copy)
}

const changeQty = async (idx: number, delta: number) => {
  const current = props.items[idx]
  const next = current.quantity + delta

  // Принятый заказ: правка кол-ва/удаление через RPC (родитель), не in-memory.
  if (props.allowEdit) {
    if (isLocked(current)) return
    if (next <= 0) {
      if (isLastItem.value) return
      const ok = await confirm({ title: `Удалить ${item.acc}?`, confirmText: 'Удалить', confirmType: 'error' })

      if (ok) emit('removeItem', current)
    } else {
      emit('editItem', { ...current, quantity: next })
    }

    return
  }

  if (next <= 0) {
    const ok = await confirm({ title: `Удалить ${item.acc}?`, confirmText: 'Удалить', confirmType: 'error' })

    if (ok) mutate((items) => items.splice(idx, 1))
  } else {
    mutate((items) => {
      items[idx] = { ...items[idx], quantity: next }
    })
  }
}

const onDeleteClick = async (idx: number) => {
  const current = props.items[idx]
  const ok = await confirm({ title: `Удалить ${item.acc}?`, confirmText: 'Удалить', confirmType: 'error' })

  if (!ok) return

  // Принятый заказ — удаление через RPC; группа new — in-memory splice.
  if (props.allowEdit) emit('removeItem', current)
  else mutate((items) => items.splice(idx, 1))
}

const openEditItem = (idx: number) => openAddDishModal(idx)

const onAddDishModalClose = (open: boolean) => {
  if (!open) closeAddDishModal()
}

const itemKey = (i: OrderItem) => [
  i.dishId ?? i.comboId,
  (i.modifiers ?? []).map((m) => m.optionName).sort().join('|'),
  (i.removedIngredients ?? []).sort().join('|'),
  (i.addons ?? []).map((a) => a.addonId).sort().join('|'),
].join('::')

const onPickerSelect = (result: DishPickerResult) => {
  const isEdit = editingItemIndex.value !== null

  const item: OrderItem = {
    dishId: result.dishId,
    comboId: result.comboId,
    dishName: result.dishName,
    categoryName: result.categoryName,
    price: result.price,
    quantity: isEdit ? props.items[editingItemIndex.value!].quantity : result.quantity,
    customizable: isEdit ? props.items[editingItemIndex.value!].customizable : result.customizable,
    removedIngredients: result.removedIngredients,
    modifiers: result.modifiers,
    addons: result.addons,
    completedAt: null,
    comboItems: null,
    addedBy: null,
    confirmedBy: null,
    status: 'pending',
  }

  // Дозаказ новой позиции в принятый заказ: не мутируем залоченный список, а
  // отдаём позицию родителю — он вызовет RPC add_items_to_order напрямую.
  if (props.allowAdd && !isEdit) {
    emit('addItem', item)
    closeAddDishModal()

    return
  }

  // Правка существующей позиции принятого заказа → RPC update_order_item.
  // Сохраняем DB id правимой строки, чтобы родитель адресовал RPC.
  if (props.allowEdit && isEdit) {
    emit('editItem', { ...item, id: props.items[editingItemIndex.value!].id })
    closeAddDishModal()

    return
  }

  if (isEdit) {
    mutate((items) => {
      items[editingItemIndex.value!] = item
    })
  } else {
    mutate((items) => {
      const key = itemKey(item)
      const existing = item.dishId ? items.find((i) => itemKey(i) === key) : undefined

      if (existing) existing.quantity += result.quantity
      else items.push({ ...item })
    })
  }
  closeAddDishModal()
}
</script>

<style scoped lang="scss">
.section {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.items-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-8);
  overflow: hidden;
}

.qty-controls {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  flex-shrink: 0;
}

.qty-value {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-title);
  min-width: 18px;
  text-align: center;
}

.qty-readonly {
  color: var(--color-text-secondary);
}

.item-price {
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
  color: var(--color-title);
  min-width: 60px;
  text-align: right;
  flex-shrink: 0;
}

.add-dish-row {
  margin-top: var(--space-4);
}
</style>
