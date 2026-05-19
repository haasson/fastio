<template>
  <div class="dish-body-root">
    <BranchAvailabilityHint v-if="fullItem" :branch-ids="fullItem.branchIds" />

    <DishNutrition
      v-if="displayNutrition"
      :nutrition="displayNutrition"
      :weight-unit="weightUnit"
      size="md"
    />

    <DishCustomization
      :combo-items="item.comboItems"
      :modifiers="modifiers"
      :selected-modifiers="selectedModifiers"
      :removable-ingredients="removableIngredients"
      :removed-ingredients="[...removedSet]"
      :addons="addons"
      :selected-addon-ids="[...selectedAddonIds]"
      :can-select-more-addons="canSelectMoreAddons"
      :addons-count-label="addonsCountLabel"
      @select-modifier="selectModifier"
      @update:removed-ingredients="removedSet = new Set($event)"
      @update:selected-addon-ids="selectedAddonIds = new Set($event)"
    />

    <DishModalFooter
      v-if="!viewOnly"
      v-model="quantity"
      :total-price="totalPrice"
      :mode="mode"
      @confirm="onConfirm"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { DishModifierGroup, OrderItemModifier } from '@fastio/shared'
import type { CartItem } from '~/features/cart'
import type { ClientAddon } from '../stores/menu'
import type { ModalItem } from '../composables/useDishCustomization'
import DishCustomization from './DishCustomization.vue'
import DishNutrition from './DishNutrition.vue'
import DishModalFooter from './DishModalFooter.vue'
import BranchAvailabilityHint from '~/features/branch/components/BranchAvailabilityHint.vue'
import { useDishCustomization } from '../composables/useDishCustomization'
import { useMenuStore } from '../stores/menu'

type Props = {
  item: ModalItem
  modifiers: DishModifierGroup[]
  addons: ClientAddon[]
  viewOnly?: boolean
  mode?: 'add' | 'edit' | 'order'
  initialQuantity?: number
  initialRemovedIngredients?: string[]
  initialModifiers?: OrderItemModifier[]
  initialAddonIds?: string[]
  maxAddons?: number | null
}

const props = withDefaults(defineProps<Props>(), { mode: 'add' })
const emit = defineEmits<{
  add: [item: CartItem]
  edit: [item: CartItem]
  close: []
}>()

const {
  quantity,
  removedSet,
  selectedModifiers,
  selectedAddonIds,
  removableIngredients,
  displayNutrition,
  weightUnit,
  totalPrice,
  canSelectMoreAddons,
  addonsCountLabel,
  selectModifier,
  buildCartItem,
} = useDishCustomization({
  item: props.item,
  modifiers: props.modifiers,
  addons: props.addons,
  initialQuantity: props.initialQuantity,
  initialRemovedIngredients: props.initialRemovedIngredients,
  initialModifiers: props.initialModifiers,
  initialAddonIds: props.initialAddonIds,
  maxAddons: props.maxAddons,
})

function onConfirm() {
  const item = buildCartItem()
  if (props.mode === 'edit') {
    emit('edit', item)
  } else {
    emit('add', item)
  }
  emit('close')
}

const menuStore = useMenuStore()

// Полный объект (блюдо или комбо) нужен ради `branchIds` — в ModalItem его нет.
const fullItem = computed(() => {
  const id = props.item.id
  return props.item.comboId
    ? menuStore.allCombos.find((c) => c.id === id) ?? null
    : menuStore.allDishes.find((d) => d.id === id) ?? null
})
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.dish-body-root {
  @include flex-col(16px);
}
</style>
