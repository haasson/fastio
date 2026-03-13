<template>
  <li class="dish-item-row-root">
    <div class="body">
      <div class="title-row">
        <span v-if="categoryName" class="category">{{ categoryName }}</span>
        <span class="name">{{ name }}</span>
      </div>
      <div v-if="modifiers?.length" class="tags">
        <UiTag
          v-for="mod in modifiers"
          :key="mod.name"
          size="tiny"
          secondary
        >
          {{ mod.name }}
          <template v-if="mod.priceDelta > 0"> +{{ mod.priceDelta }}₽</template>
        </UiTag>
      </div>
      <div v-if="removedIngredients?.length" class="tags">
        <UiTag
          v-for="ing in removedIngredients"
          :key="ing"
          size="tiny"
          type="error"
          secondary
        >
          <UiIcon name="minusRound" :size="11" class="tag-icon" />{{ ing }}
        </UiTag>
      </div>
    </div>
    <div class="controls">
      <slot />
    </div>
  </li>
</template>

<script setup lang="ts">
import { UiTag, UiIcon } from '@fastio/ui'

type ModifierTag = { name: string; priceDelta: number }

defineProps<{
  name: string
  categoryName?: string | null
  modifiers?: ModifierTag[]
  removedIngredients?: string[]
}>()
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

.title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
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
  gap: 4px;
}

.tag-icon {
  margin-right: 3px;
  flex-shrink: 0;
}

.controls {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
</style>
