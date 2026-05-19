<template>
  <div class="picker-root" :class="{ light }">
    <UiPickerItem
      v-for="pos in 9"
      :key="pos"
      :selected="modelValue === pos"
      :title="`Позиция ${pos}`"
      class="cell"
      @click="emit('update:modelValue', pos)"
    />
  </div>
</template>

<script setup lang="ts">
import { UiPickerItem } from '@fastio/ui'

defineProps<{ modelValue: number; light?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: number] }>()
</script>

<style scoped lang="scss">
.picker-root {
  display: grid;
  grid-template-columns: repeat(3, var(--cell-size, 32px));
  grid-template-rows: repeat(3, var(--cell-size, 32px));
  gap: var(--space-4);
}

// UiPickerItem уже делает selected ring. Здесь — visible default border + фон + (опц.) светлый variant.
.cell {
  border-color: var(--color-border);
  border-radius: var(--radius-4);
  background: var(--color-bg-card);

  &.ui-picker-item--selected {
    background: var(--color-primary);
    opacity: 0.8;
  }
}

// Light variant — для вставки поверх тёмного/градиентного фона.
.light .cell {
  --picker-selected-border: var(--color-white);
  --picker-hover-border: rgba(255, 255, 255, 0.7);

  border-color: rgba(255, 255, 255, 0.4);
  background: rgba(255, 255, 255, 0.15);

  &:hover {
    background: rgba(255, 255, 255, 0.25);
  }

  &.ui-picker-item--selected {
    background: rgba(255, 255, 255, 0.6);
    opacity: 1;
  }
}
</style>
