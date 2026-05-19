<template>
  <div class="color-picker-root">
    <UiText v-if="label" size="small">{{ label }}</UiText>
    <div class="swatches">
      <UiPickerItem
        v-for="c in presets"
        :key="c"
        :selected="modelValue === c"
        class="swatch"
        :class="{ used: isUsed(c) }"
        :style="{ background: c }"
        @click="$emit('update:modelValue', c)"
      />
      <input
        type="color"
        class="custom"
        :value="modelValue"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { UiText, UiPickerItem } from '@fastio/ui'

const props = withDefaults(defineProps<{
  modelValue: string
  label?: string
  presets?: string[]
  // Уже занятые цвета (hex). Приглушаются, но остаются кликабельными.
  usedColors?: string[]
}>(), {
  presets: () => ['#FF5500', '#FFA500', '#FFD700', '#00C853', '#2979FF', '#AA00FF', '#E91E63'],
  usedColors: () => [],
})

defineEmits<{
  'update:modelValue': [value: string]
}>()

const isUsed = (hex: string) => props.usedColors.includes(hex)
</script>

<style scoped lang="scss">
.color-picker-root {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.swatches {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  flex-wrap: wrap;
}

// Canonical color swatch size: 32×32 round. Стандартизировано вместе с TagFormModal color-grid.
.swatch {
  // Selected ring специально --color-text (а не primary), чтобы контрастировать с
  // любым swatch-цветом — иначе синий primary swatch при выборе сливается с primary ring.
  --picker-selected-border: var(--color-text);

  width: 32px;
  height: 32px;
  border-radius: 50%;

  &:hover {
    transform: scale(1.15);
  }

  &.ui-picker-item--selected {
    transform: scale(1.15);
  }

  &.used {
    opacity: 0.35;
  }
}

.custom {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1.5px solid var(--color-border);
  cursor: pointer;
  padding: 0;
  overflow: hidden;
  background: none;

  &::-webkit-color-swatch-wrapper { padding: 0; }
  &::-webkit-color-swatch { border-radius: 50%; border: none; }
}
</style>
