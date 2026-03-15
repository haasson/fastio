<template>
  <li class="dish-item-row-root">
    <div class="body">
      <div class="row">
        <div class="title-row">
          <span v-if="categoryName" class="category">{{ categoryName }}</span>
          <span class="name">{{ name }}</span>
        </div>
        <span v-if="price != null" class="row-price">{{ price }} ₽</span>
      </div>
      <div v-if="modifiers?.length" class="row">
        <div class="tags">
          <UiTag
            v-for="mod in modifiers"
            :key="mod.name"
            size="small"
            type="primary"
            empty
            round
          >
            {{ mod.name }}
            <template v-if="mod.priceDelta > 0"> +{{ mod.priceDelta }}₽</template>
          </UiTag>
        </div>
        <span v-if="modifiersDelta > 0" class="row-price delta">+{{ modifiersDelta }} ₽</span>
      </div>
      <div v-if="removedIngredients?.length" class="row">
        <div class="tags">
          <span class="row-label remove">Убрать</span>
          <UiTag
            v-for="ing in removedIngredients"
            :key="ing"
            size="small"
            type="error"
            empty
            round
          >
            <UiIcon name="minusRound" :size="12" class="tag-icon" />{{ ing }}
          </UiTag>
        </div>
      </div>
      <div v-if="addons?.length" class="row">
        <div class="tags">
          <span class="row-label add">Добавить</span>
          <UiTag
            v-for="addon in addons"
            :key="addon.name"
            size="small"
            type="success"
            empty
            round
          >
            {{ addon.name }} +{{ addon.price }}₽
          </UiTag>
        </div>
        <span v-if="addonsTotal > 0" class="row-price delta">+{{ addonsTotal }} ₽</span>
      </div>
    </div>
    <div class="controls">
      <slot />
    </div>
  </li>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { UiTag, UiIcon } from '@fastio/ui'

type ModifierTag = { name: string; priceDelta: number }
type AddonTag = { name: string; price: number }

const props = defineProps<{
  name: string
  categoryName?: string | null
  modifiers?: ModifierTag[]
  removedIngredients?: string[]
  addons?: AddonTag[]
  price?: number
}>()

const modifiersDelta = computed(() => props.modifiers?.reduce((s, m) => s + m.priceDelta, 0) ?? 0)
const addonsTotal = computed(() => props.addons?.reduce((s, a) => s + a.price, 0) ?? 0)
</script>

<style scoped lang="scss">
.dish-item-row-root {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--color-bg-card);

  & + & {
    border-top: 1px solid var(--color-border-light);
  }
}

.body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
}

.category {
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

.name {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-title);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  flex: 1;
}

.tag-icon {
  flex-shrink: 0;
}

.row-label {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;

  &.remove {
    color: var(--color-error);
  }

  &.add {
    color: var(--color-success);
  }
}

.row-price {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary);
  white-space: nowrap;

  &.delta {
    font-weight: 400;
  }
}

.controls {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
</style>
