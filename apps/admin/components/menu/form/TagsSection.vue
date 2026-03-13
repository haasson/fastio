<template>
  <UiCollapseItem name="tags" title="Теги">
    <div class="tags-section-root">
      <UiCheckbox
        v-for="(label, value) in tagOptions"
        :key="value"
        :model-value="modelValue.includes(String(value) as DishTag)"
        @update:model-value="onToggle(String(value) as DishTag, $event)"
      >
        {{ label }}
      </UiCheckbox>
    </div>
  </UiCollapseItem>
</template>

<script setup lang="ts">
import { UiCollapseItem, UiCheckbox } from '@fastio/ui'
import type { DishTag } from '@fastio/shared'
import { tagOptions } from '~/config/dish-tags'

const props = defineProps<{ modelValue: DishTag[] }>()
const emit = defineEmits<{ 'update:modelValue': [value: DishTag[]] }>()

const onToggle = (tag: DishTag, checked: boolean) => emit('update:modelValue', checked
  ? [...props.modelValue, tag]
  : props.modelValue.filter((t) => t !== tag),
)
</script>

<style scoped lang="scss">
.tags-section-root {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
