<template>
  <div class="body-root">
    <!-- Combo composition -->
    <div v-if="comboItems?.length" class="combo-composition">
      <FsText variant="body-sm" class="section-title">Состав</FsText>
      <div class="combo-items">
        <div v-for="(ci, idx) in comboItems" :key="idx" class="combo-item">
          <img v-if="ci.photo" :src="ci.photo" :alt="ci.name" class="combo-item-photo" >
          <div v-else class="combo-item-placeholder">
            <component :is="placeholderIcon" :size="18" />
          </div>
          <span class="combo-item-name">
            {{ ci.name }}<span v-if="ci.modifier" class="combo-item-mod"> · {{ ci.modifier }}</span><span v-if="ci.addons" class="combo-item-mod"> + {{ ci.addons }}</span>
          </span>
        </div>
      </div>
    </div>

    <!-- Customization sections -->
    <DishChips
      v-for="group in modifiers"
      :key="group.groupId"
      :title="group.groupName"
      :items="modifierChips(group)"
      mode="radio"
      :model-value="[selectedModifiers[group.groupId]]"
      :group-name="`mod-${group.groupId}`"
      @update:model-value="emit('selectModifier', group.groupId, $event[0])"
    />

    <DishChips
      v-if="removableIngredients.length"
      title="Можно убрать"
      :items="ingredientChips"
      mode="toggle"
      :model-value="removedIngredients"
      @update:model-value="emit('update:removedIngredients', $event)"
    />

    <DishChips
      v-if="addons.length"
      :title="addonsTitle"
      :items="addonChips"
      mode="checkbox"
      :model-value="selectedAddonIds"
      :disabled-select="!canSelectMoreAddons"
      @update:model-value="emit('update:selectedAddonIds', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { DishModifierGroup, DishIngredient } from '@fastio/shared'
import type { ClientAddon } from '../stores/menu'
import type { ComboItemInfo } from '../composables/useDishCustomization'
import { FsText } from '@fastio/public-ui'
import DishChips from '~/shared/ui/sf/domain/DishChips.vue'
import { useItemPlaceholder } from '~/shared/composables/useItemPlaceholder'

const { placeholderIcon } = useItemPlaceholder()

type Props = {
  comboItems?: ComboItemInfo[]
  modifiers: DishModifierGroup[]
  selectedModifiers: Record<string, string>
  removableIngredients: DishIngredient[]
  removedIngredients: string[]
  addons: ClientAddon[]
  selectedAddonIds: string[]
  canSelectMoreAddons?: boolean
  addonsCountLabel?: string | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  selectModifier: [groupId: string, optionId: string]
  'update:removedIngredients': [ids: string[]]
  'update:selectedAddonIds': [ids: string[]]
}>()

// --- Chip data adapters ---

const ingredientChips = computed(() =>
  props.removableIngredients.map((i) => ({ id: i.name, label: i.name })),
)

function modifierChips(group: DishModifierGroup) {
  return group.options.map((o) => ({
    id: o.optionId,
    label: o.optionName,
    priceDelta: o.priceDelta,
  }))
}

const addonChips = computed(() =>
  props.addons.map((a) => ({ id: a.id, label: a.name, priceDelta: a.price })),
)

const addonsTitle = computed(() =>
  props.addonsCountLabel ? `Можно добавить (${props.addonsCountLabel})` : 'Можно добавить',
)
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.body-root {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 16px;
}

.combo-composition {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-title {
  font-weight: 600;
  color: var(--color-text);
}

.combo-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.combo-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.combo-item-photo {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  object-fit: cover;
  flex-shrink: 0;
}

.combo-item-placeholder {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-border);
  color: var(--color-text-muted);
}

.combo-item-name {
  @include text-caption;
  line-height: 1.3;
  color: var(--color-text);
}

.combo-item-mod {
  color: var(--color-text-secondary);
  @include text-xs;
}
</style>
