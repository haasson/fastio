<template>
  <FsDialog
    :model-value="modelValue"
    :title="item.name"
    size="md"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="content-root">
      <div class="dish-header">
        <img
          v-if="item.photos[0]"
          :src="item.photos[0]"
          :alt="item.name"
          class="photo"
          loading="lazy"
        >
        <div class="info">
          <FsText v-if="item.longDescription || item.description" variant="body-sm" color="secondary">
            {{ item.longDescription || item.description }}
          </FsText>
          <DishNutrition v-if="displayNutrition" :nutrition="displayNutrition" :weight-unit="weightUnit" size="md" />
        </div>
      </div>

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
        :currency="custCurrency"
        @select-modifier="selectModifier"
        @update:removed-ingredients="removedSet = new Set($event)"
        @update:selected-addon-ids="selectedAddonIds = new Set($event)"
      />

      <DishModalFooter v-if="!viewOnly" v-model="quantity" :total-price="totalPrice" :currency="custCurrency" :mode="mode" @confirm="onConfirm" />
    </div>
  </FsDialog>
</template>

<script setup lang="ts">
import type { DishModifierGroup, OrderItemModifier } from '@fastio/shared'
import type { CartItem } from '~/stores/cart'
import type { ClientAddon } from '~/stores/menu'
import type { ModalItem } from '~/composables/useDishCustomization'
import { FsDialog, FsText } from '@fastio/public-ui'
import DishCustomization from '~/components/sf/domain/DishCustomization.vue'
import DishNutrition from '~/components/sf/domain/DishNutrition.vue'
import DishModalFooter from '~/components/sf/domain/DishModalFooter.vue'
import { useDishCustomization } from '~/composables/useDishCustomization'

type Props = {
  modelValue: boolean
  item: ModalItem
  modifiers: DishModifierGroup[]
  addons: ClientAddon[]
  currency?: string
  viewOnly?: boolean
  mode?: 'add' | 'edit' | 'order'
  initialQuantity?: number
  initialRemovedIngredients?: string[]
  initialModifiers?: OrderItemModifier[]
  initialAddonIds?: string[]
  maxAddons?: number | null
}

const props = withDefaults(defineProps<Props>(), { currency: '₽', mode: 'add' })
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'add': [item: CartItem]
  'edit': [item: CartItem]
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
  currency: custCurrency,
  selectModifier,
  buildCartItem,
} = useDishCustomization({
  item: props.item,
  modifiers: props.modifiers,
  addons: props.addons,
  currency: props.currency,
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
  emit('update:modelValue', false)
}
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.content-root {
  @include flex-col(16px);
}

.dish-header {
  @include flex-col(8px);

  @include md {
    flex-direction: row;
    gap: 16px;
  }
}

.photo {
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  border-radius: var(--radius-card);

  @include md {
    width: 160px;
    flex-shrink: 0;
  }
}

.info {
  @include flex-col(4px);
  min-width: 0;
}
</style>
