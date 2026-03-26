<template>
  <UiCollapseItem name="tags" title="Теги">
    <div class="tags-section-root">
      <button
        v-for="tag in availableTags"
        :key="tag.id"
        type="button"
        class="tag-chip"
        :class="{ active: modelValue.includes(tag.id) }"
        :style="chipStyle(tag)"
        @click="onToggle(tag.id, !modelValue.includes(tag.id))"
      >
        <component :is="getIcon(tag.icon)" :size="14" :stroke-width="2.5" />
        <span>{{ tag.name }}</span>
      </button>
      <UiText v-if="availableTags.length === 0" size="small" style="color: var(--color-text-tertiary)">
        Нет доступных тегов. Создайте теги во вкладке «Теги».
      </UiText>
    </div>
  </UiCollapseItem>
</template>

<script setup lang="ts">
import { UiCollapseItem, UiText } from '@fastio/ui'
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
  gap: 8px;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border-radius: 99px;
  border: 1.5px solid var(--color-border);
  background: var(--color-fill-quaternary);
  color: var(--color-text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  user-select: none;

  &:hover {
    border-color: var(--chip-color, var(--color-text-tertiary));
  }

  &.active {
    color: var(--chip-color);
    background: var(--chip-bg);
    border-color: var(--chip-color);
  }
}
</style>
