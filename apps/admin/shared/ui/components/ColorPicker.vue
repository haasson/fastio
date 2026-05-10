<template>
  <div class="color-picker-root">
    <UiText v-if="label" size="small">{{ label }}</UiText>
    <div class="swatches">
      <button
        v-for="c in presets"
        :key="c"
        type="button"
        class="swatch"
        :class="{
          selected: modelValue === c,
          used: isUsed(c),
        }"
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
import { UiText } from '@fastio/ui'

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

.swatch {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 2.5px solid transparent;
  cursor: pointer;
  padding: 0;
  transition: transform 0.1s, border-color 0.15s, opacity 0.15s;

  &:hover { transform: scale(1.15); }

  &.selected {
    border-color: var(--color-text);
    transform: scale(1.15);
  }

  &.used {
    opacity: 0.35;
  }
}

.custom {
  width: 26px;
  height: 26px;
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
