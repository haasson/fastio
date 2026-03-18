<template>
  <!-- Mobile: bottom drawer -->
  <SfDrawer
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

      <div class="footer">
        <SfStepper v-model="quantity" :min="1" :max="99" />
        <SfButton variant="primary" class="add-btn" @click="onAdd">
          Добавить за {{ totalPrice }} {{ custCurrency }}
        </SfButton>
      </div>
    </div>
  </SfDrawer>

  <!-- Desktop: centered dialog -->
  <SfDialog
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
          <SfHeading as="h3">{{ item.name }}</SfHeading>
          <SfText v-if="item.description" variant="body-sm" color="secondary" class="dialog-desc">
            {{ item.description }}
          </SfText>
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

      <!-- Footer: stepper + add button -->
      <div class="footer">
        <SfStepper v-model="quantity" :min="1" :max="99" />
        <SfButton variant="primary" class="add-btn" @click="onAdd">
          Добавить за {{ totalPrice }} {{ custCurrency }}
        </SfButton>
      </div>
    </div>
  </SfDialog>
</template>

<script setup lang="ts">
import type { DishModifierGroup } from '@fastio/shared'
import type { CartItem } from '~/stores/cart'
import type { ClientAddon } from '~/stores/menu'
import type { ModalItem } from '~/composables/useDishCustomization'
import SfDrawer from '~/components/sf/overlay/SfDrawer.vue'
import SfDialog from '~/components/sf/overlay/SfDialog.vue'
import SfStepper from '~/components/sf/domain/SfStepper.vue'
import SfHeading from '~/components/sf/typography/SfHeading.vue'
import SfText from '~/components/sf/typography/SfText.vue'
import SfButton from '~/components/sf/base/SfButton.vue'
import DishCustomization from '~/components/sf/domain/DishCustomization.vue'
import DishNutrition from '~/components/sf/domain/DishNutrition.vue'
import { useIsMobile } from '~/composables/useIsMobile'
import { useDishCustomization } from '~/composables/useDishCustomization'

type Props = {
  modelValue: boolean
  item: ModalItem
  modifiers: DishModifierGroup[]
  addons: ClientAddon[]
  currency?: string
}

const props = withDefaults(defineProps<Props>(), { currency: '₽' })
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'add': [item: CartItem]
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
})

function onAdd() {
  emit('add', buildCartItem())
  emit('update:modelValue', false)
}
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

// ─── Shared ──────────────────────────────────────────────────────────────────

.footer {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
  flex-shrink: 0;
}

.add-btn {
  flex: 1;
}

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
