<template>
  <div class="slider-root">
    <div v-if="label" class="label">{{ label }}</div>
    <n-slider
      :value="modelValue"
      :min="min"
      :max="max"
      :step="step"
      :marks="marks"
      :disabled="disabled"
      :format-tooltip="formatTooltip"
      @update:value="emit('update:modelValue', $event)"
    />
    <div class="hint">{{ formatTooltip(modelValue) }}</div>
  </div>
</template>

<script setup lang="ts">
import { NSlider } from 'naive-ui'

type Props = {
  modelValue: number
  label?: string
  min?: number
  max?: number
  step?: number
  marks?: Record<number, string>
  disabled?: boolean
}

withDefaults(defineProps<Props>(), {
  min: 15,
  max: 180,
  step: 15,
})

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

const formatTooltip = (v: number): string => {
  if (v < 60) return `${v} мин`
  const h = Math.floor(v / 60)
  const m = v % 60

  return m === 0 ? `${h} ч` : `${h} ч ${m} мин`
}
</script>

<style scoped lang="scss">
.slider-root {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.hint {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  text-align: right;
}
</style>
