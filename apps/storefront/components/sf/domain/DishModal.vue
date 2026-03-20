<template>
  <!-- Mobile: bottom drawer -->
  <FsDrawer
    v-if="isMobile"
    :model-value="modelValue"
    size="lg"
    :title="item.name"
    :closable="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="drawer-content-root">
      <div v-if="item.description || item.nutrition" class="drawer-info">
        <span v-if="item.description" class="drawer-desc">{{ item.description }}</span>
        <DishNutrition v-if="item.nutrition" :nutrition="item.nutrition" size="sm" />
      </div>

      <DishCustomization
        :combo-items="item.comboItems"
        :modifiers="modifiers"
        :selected-modifiers="selectedModifiers"
        :removable-ingredients="removableIngredients"
        :removed-ingredients="[...removedSet]"
        :addons="addons"
        :selected-addon-ids="[...selectedAddonIds]"
        :currency="custCurrency"
        @select-modifier="selectModifier"
        @update:removed-ingredients="removedSet = new Set($event)"
        @update:selected-addon-ids="selectedAddonIds = new Set($event)"
      />

      <DishModalFooter v-model="quantity" :total-price="totalPrice" :currency="custCurrency" :mode="mode" @confirm="onConfirm" />
    </div>
  </FsDrawer>

  <!-- Desktop: centered dialog -->
  <FsDialog
    v-else
    :model-value="modelValue"
    size="md"
    :closable="true"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="dialog-content-root">
      <!-- Top: photo + info -->
      <div class="dialog-header">
        <img
          v-if="item.photos[0]"
          :src="item.photos[0]"
          :alt="item.name"
          class="dialog-photo"
          loading="lazy"
        />
        <div class="dialog-info">
          <FsHeading as="h3">{{ item.name }}</FsHeading>
          <FsText v-if="item.description" variant="body-sm" color="secondary" class="dialog-desc">
            {{ item.description }}
          </FsText>
          <DishNutrition v-if="item.nutrition" :nutrition="item.nutrition" size="md" />
        </div>
      </div>

      <!-- Body: scrollable sections -->
      <div class="dialog-body">
        <DishCustomization
          :combo-items="item.comboItems"
          :modifiers="modifiers"
          :selected-modifiers="selectedModifiers"
          :removable-ingredients="removableIngredients"
          :removed-ingredients="[...removedSet]"
          :addons="addons"
          :selected-addon-ids="[...selectedAddonIds]"
          :currency="custCurrency"
          @select-modifier="selectModifier"
          @update:removed-ingredients="removedSet = new Set($event)"
          @update:selected-addon-ids="selectedAddonIds = new Set($event)"
        />
      </div>

      <DishModalFooter v-model="quantity" :total-price="totalPrice" :currency="custCurrency" :mode="mode" @confirm="onConfirm" />
    </div>
  </FsDialog>
</template>

<script setup lang="ts">
import type { DishModifierGroup, OrderItemModifier } from '@fastio/shared'
import type { CartItem } from '~/stores/cart'
import type { ClientAddon } from '~/stores/menu'
import type { ModalItem } from '~/composables/useDishCustomization'
import { FsDrawer, FsDialog, FsHeading, FsText } from '@fastio/public-ui'
import DishCustomization from '~/components/sf/domain/DishCustomization.vue'
import DishNutrition from '~/components/sf/domain/DishNutrition.vue'
import DishModalFooter from '~/components/sf/domain/DishModalFooter.vue'
import { useIsMobile } from '~/composables/useIsMobile'
import { useDishCustomization } from '~/composables/useDishCustomization'

type Props = {
  modelValue: boolean
  item: ModalItem
  modifiers: DishModifierGroup[]
  addons: ClientAddon[]
  currency?: string
  mode?: 'add' | 'edit'
  initialQuantity?: number
  initialRemovedIngredients?: string[]
  initialModifiers?: OrderItemModifier[]
  initialAddonIds?: string[]
}

const props = withDefaults(defineProps<Props>(), { currency: '₽', mode: 'add' })
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'add': [item: CartItem]
  'edit': [item: CartItem]
}>()

const isMobile = useIsMobile()

const {
  quantity,
  removedSet,
  selectedModifiers,
  selectedAddonIds,
  removableIngredients,
  totalPrice,
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

// ─── Shared ──────────────────────────────────────────────────────────────────

// ─── Mobile drawer content ───────────────────────────────────────────────────

.drawer-content-root {
  display: flex;
  flex-direction: column;
}

.drawer-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}

.drawer-desc {
  font-size: 12px;
  line-height: 1.3;
  color: var(--color-text-muted);
}

// ─── Desktop dialog content ─────────────────────────────────────────────────

.dialog-content-root {
  display: flex;
  flex-direction: column;
  max-height: calc(95vh - 48px);
}

.dialog-header {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
  padding-right: 32px; // safe space for close button
}

.dialog-photo {
  width: 120px;
  height: 120px;
  object-fit: cover;
  border-radius: var(--radius-card);
  flex-shrink: 0;
}

.dialog-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.dialog-desc {
  color: var(--color-text-secondary);
}

.dialog-body {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}
</style>
