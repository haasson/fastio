<template>
  <UiCollapseItem name="tags" title="Теги">
    <div class="tags-section-root">
      <UiPickerItem
        v-for="tag in availableTags"
        :key="tag.id"
        :selected="modelValue.includes(tag.id)"
        class="tag-chip"
        :style="chipStyle(tag)"
        @click="onToggle(tag.id, !modelValue.includes(tag.id))"
      >
        <component :is="getIcon(tag.icon)" :size="14" :stroke-width="2.5" />
        <span>{{ tag.name }}</span>
      </UiPickerItem>
      <UiText v-if="availableTags.length === 0" size="small" style="color: var(--color-text-secondary)">
        Нет доступных тегов. Создайте теги во вкладке «Теги».
      </UiText>
    </div>
  </UiCollapseItem>
</template>

<script setup lang="ts">
import { UiCollapseItem, UiText, UiPickerItem } from '@fastio/ui'
import type { DishTagDefinition } from '@fastio/shared'
import { getTagColorPreset } from '@fastio/shared'
import * as icons from 'lucide-vue-next'

const props = defineProps<{
  modelValue: string[]
  availableTags: DishTagDefinition[]
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>()

const onToggle = (tagId: string, checked: boolean) => emit('update:modelValue', checked
  ? [...props.modelValue, tagId]
  : props.modelValue.filter((t) => t !== tagId),
)

const getIcon = (name: string) => (icons as Record<string, unknown>)[name] ?? icons.Tag

const chipStyle = (tag: DishTagDefinition) => {
  const preset = getTagColorPreset(tag.color)

  if (!preset) return {}

  return {
    '--chip-color': preset.color,
    '--chip-bg': preset.background,
  }
}
</script>

<style scoped lang="scss">
.tags-section-root {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-8);
}

// UiPickerItem уже даёт ring/hover/focus. Здесь — pill shape + tag-color theming.
.tag-chip {
  --picker-hover-border: var(--chip-color, var(--color-text-secondary));
  --picker-selected-border: var(--chip-color);

  gap: var(--space-4);
  padding: var(--space-8) var(--space-12);
  border-radius: var(--radius-full);
  border-color: var(--color-border);
  background: var(--color-fill-quaternary);
  color: var(--color-text-secondary);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-medium);
  user-select: none;

  &.ui-picker-item--selected {
    color: var(--chip-color);
    background: var(--chip-bg);
  }
}
</style>
