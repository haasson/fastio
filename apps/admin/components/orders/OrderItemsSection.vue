<template>
  <section class="section">
    <div class="section-label">Состав</div>
    <ul class="items-list">
      <li v-for="(item, idx) in items" :key="`${item.dishId}-${idx}`" class="item-row">
        <div class="item-body">
          <div class="item-title-row">
            <span v-if="item.categoryName" class="item-category">{{ item.categoryName }}</span>
            <span class="item-name">{{ item.dishName }}</span>
          </div>
          <div v-if="item.modifiers?.length" class="item-mods">
            <UiTag
              v-for="mod in item.modifiers"
              :key="mod.groupName + mod.optionName"
              size="tiny"
              secondary
            >
              {{ mod.optionName }}
              <template v-if="mod.priceDelta > 0"> +{{ mod.priceDelta }}₽</template>
            </UiTag>
          </div>
          <div v-if="item.removedIngredients?.length" class="item-mods">
            <UiTag
              v-for="ing in item.removedIngredients"
              :key="ing"
              size="tiny"
              type="error"
              secondary
            >
              <UiIcon name="minusRound" :size="11" class="mod-icon" />{{ ing }}
            </UiTag>
          </div>
        </div>
        <div class="item-controls">
          <template v-if="!readonly">
            <div class="qty-controls">
              <button class="qty-btn" @click="changeQty(idx, -1)">
                <UiIcon name="minusRound" :size="16" />
              </button>
              <span class="qty-value">{{ item.quantity }}</span>
              <button class="qty-btn" @click="changeQty(idx, 1)">
                <UiIcon name="plusRound" :size="16" />
              </button>
            </div>
          </template>
          <template v-else>
            <span class="qty-value qty-readonly">× {{ item.quantity }}</span>
          </template>
          <span class="item-price">{{ getItemUnitPrice(item) * item.quantity }} ₽</span>
          <template v-if="!readonly">
            <button class="edit-item-btn" title="Изменить состав" @click="openEditItem(idx)">
              <UiIcon name="pencil" :size="13" />
            </button>
            <button class="remove-btn" title="Удалить" @click="removeItem(idx)">
              <UiIcon name="close" :size="13" />
            </button>
          </template>
        </div>
      </li>
    </ul>

    <div v-if="!readonly" class="add-dish-row">
      <UiButton
        type="default"
        size="small"
        icon="plus"
        @click="openAddDishModal()"
      >
        Добавить блюдо
      </UiButton>
    </div>

    <OrderAddDishModal
      :model-value="addDishModalOpen"
      :tenant-id="tenantId"
      :edit-item="editingItem"
      @add="addDish"
      @update="updateDishItem"
      @update:model-value="onAddDishModalClose"
    />
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { UiButton, UiIcon, UiTag } from '@fastio/ui'
import type { OrderItem } from '@fastio/shared'
import { getItemUnitPrice } from '@fastio/shared'
import OrderAddDishModal from './OrderAddDishModal.vue'
import useDrawer from '~/composables/ui/useDrawer'

const props = defineProps<{
  items: OrderItem[]
  tenantId: string
  readonly?: boolean
}>()

const emit = defineEmits<{
  'update:items': [items: OrderItem[]]
}>()

const { isOpen: addDishModalOpen, data: editingItemIndex, open: openAddDishModal, close: closeAddDishModal } = useDrawer<number>()

const editingItem = computed(() => editingItemIndex.value !== null ? props.items[editingItemIndex.value!] : undefined,
)

const mutate = (fn: (items: OrderItem[]) => void) => {
  const copy = props.items.map((i) => ({ ...i }))

  fn(copy)
  emit('update:items', copy)
}

const changeQty = (idx: number, delta: number) => {
  mutate((items) => {
    const next = items[idx].quantity + delta

    if (next <= 0) items.splice(idx, 1)
    else items[idx] = { ...items[idx], quantity: next }
  })
}

const removeItem = (idx: number) => mutate((items) => items.splice(idx, 1))

const openEditItem = (idx: number) => openAddDishModal(idx)

const onAddDishModalClose = (open: boolean) => {
  if (!open) closeAddDishModal()
}

const addDish = (item: OrderItem) => {
  mutate((items) => {
    const existing = items.find((i) => i.dishId === item.dishId)

    if (existing && !item.removedIngredients?.length) {
      existing.quantity += 1
    } else {
      items.push({ ...item })
    }
  })
  closeAddDishModal()
}

const updateDishItem = (item: OrderItem) => {
  if (editingItemIndex.value !== null) {
    mutate((items) => {
      items[editingItemIndex.value!] = item
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

.section-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--color-text-secondary);
}

.items-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border-light);
  border-radius: 10px;
  overflow: hidden;
}

.item-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--color-bg-card);

  & + & {
    border-top: 1px solid var(--color-border-light);
  }
}

.item-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.item-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.item-category {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 600;
  color: var(--color-text-secondary);
  background: var(--color-bg-subtle);
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.item-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-title);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-mods {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.mod-icon {
  margin-right: 3px;
  flex-shrink: 0;
}

.item-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.qty-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.qty-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  padding: 2px;
  cursor: pointer;
  color: var(--color-text-secondary);
  border-radius: 4px;
  transition: color 0.12s;

  &:hover {
    color: var(--color-primary);
  }
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
  font-size: 13px;
  font-weight: 600;
  color: var(--color-title);
  min-width: 60px;
  text-align: right;
  flex-shrink: 0;
}

.edit-item-btn,
.remove-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: var(--color-text-secondary);
  border-radius: 6px;
  transition: background 0.1s, color 0.1s;
  flex-shrink: 0;
}

.edit-item-btn:hover {
  background: var(--blue-50);
  color: var(--blue-500);
}

.remove-btn:hover {
  background: var(--red-50);
  color: var(--red-500);
}

.add-dish-row {
  margin-top: 4px;
}
</style>
