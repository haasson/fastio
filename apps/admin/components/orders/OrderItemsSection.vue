<template>
  <section class="section">
    <ul class="items-list">
      <DishItemRow
        v-for="(item, idx) in items"
        :key="`${item.dishId}-${idx}`"
        :name="item.dishName"
        :category-name="item.comboId ? 'Комбо' : item.categoryName"
        :modifiers="item.modifiers.map((m) => ({ name: m.optionName, priceDelta: m.priceDelta }))"
        :removed-ingredients="item.removedIngredients"
        :addons="item.addons?.map((a) => ({ name: a.addonName, price: a.price }))"
        :price="item.price"
      >
        <template v-if="!readonly">
          <div class="qty-controls">
            <UiButton
              type="text"
              size="small"
              icon="minusRound"
              @click="changeQty(idx, -1)"
            />
            <span class="qty-value">{{ item.quantity }}</span>
            <UiButton
              type="text"
              size="small"
              icon="plusRound"
              @click="changeQty(idx, 1)"
            />
          </div>
        </template>
        <template v-else>
          <span class="qty-value qty-readonly">× {{ item.quantity }}</span>
        </template>
        <span class="item-price">{{ getItemUnitPrice(item) * item.quantity }} ₽</span>

        <AppActionsBlock
          v-if="!readonly"
          size="small"
          :disable-edit="!isItemEditable(item)"
          @edit="openEditItem(idx)"
          @delete="removeItem(idx)"
        />
      </DishItemRow>
    </ul>

    <div v-if="!readonly" class="add-dish-row">
      <UiButton
        type="primary"
        size="small"
        icon="plus"
        @click="openAddDishModal()"
      >
        Добавить блюдо
      </UiButton>
    </div>

    <DishPickerModal
      :model-value="addDishModalOpen"
      :tenant-id="tenantId"
      :edit-item="editingItem"
      show-combos
      show-ingredients
      @select="onPickerSelect"
      @update:model-value="onAddDishModalClose"
    />
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { UiButton } from '@fastio/ui'
import { useConfirm } from '@fastio/kit'
import { getItemUnitPrice } from '@fastio/shared'
import AppActionsBlock from '~/components/ui/AppActionsBlock.vue'
import type { OrderItem } from '@fastio/shared'

import DishPickerModal, { type DishPickerResult } from '~/components/menu/DishPickerModal.vue'
import DishItemRow from '~/components/ui/DishItemRow.vue'
import useDrawer from '~/composables/ui/useDrawer'

const props = defineProps<{
  items: OrderItem[]
  tenantId: string
  readonly?: boolean
}>()

const emit = defineEmits<{
  'update:items': [items: OrderItem[]]
}>()

const { confirm } = useConfirm()

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
  const next = props.items[idx].quantity + delta

  if (next <= 0) {
    const ok = await confirm({ title: 'Удалить блюдо?', confirmText: 'Удалить', confirmType: 'error' })

    if (ok) mutate((items) => items.splice(idx, 1))
  } else {
    mutate((items) => {
      items[idx] = { ...items[idx], quantity: next }
    })
  }
}

const removeItem = async (idx: number) => {
  const ok = await confirm({ title: 'Удалить блюдо?', confirmText: 'Удалить', confirmType: 'error' })

  if (ok) mutate((items) => items.splice(idx, 1))
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
  gap: 10px;
}

.items-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border-light);
  border-radius: 10px;
  overflow: hidden;
}

.qty-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.qty-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-title);
  min-width: 18px;
  text-align: center;
}

.qty-readonly {
  color: var(--color-text-secondary);
}

.item-price {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-title);
  min-width: 60px;
  text-align: right;
  flex-shrink: 0;
}

.add-dish-row {
  margin-top: 4px;
}
</style>
