<template>
  <div class="color-picker-root">
    <UiText v-if="label" size="small">{{ label }}</UiText>
    <div class="swatches">
      <button
        v-for="c in presets"
        :key="c"
        class="swatch"
        :class="{ selected: modelValue === c }"
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

withDefaults(defineProps<{
  modelValue: string
  label?: string
  presets?: string[]
}>(), {
  presets: () => ['#FF5500', '#FFA500', '#FFD700', '#00C853', '#2979FF', '#AA00FF', '#E91E63'],
})

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<style scoped lang="scss">
.color-picker-root {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.swatches {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.swatch {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 2.5px solid transparent;
  cursor: pointer;
  padding: 0;
  transition: transform 0.1s, border-color 0.15s;

  &:hover { transform: scale(1.15); }
  &.selected { border-color: var(--color-text); }
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
}
</style>
