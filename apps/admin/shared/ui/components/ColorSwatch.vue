<template>
  <div class="color-swatch-root">
    <UiText v-if="label" size="small">{{ label }}</UiText>
    <div class="swatches">
      <UiPickerItem
        v-for="preset in presets"
        :key="preset.value"
        :selected="modelValue === preset.value"
        :class="['swatch', { used: isUsed(preset.value) }]"
        data-testid="swatch"
        @click="$emit('update:modelValue', preset.value)"
      >
        <span
          v-if="preset.bg"
          class="swatch-fill"
          :style="{ background: preset.bg }"
        >
          <span class="swatch-dot" :style="{ background: preset.color }" />
        </span>
        <span
          v-else
          class="swatch-fill"
          :style="{ background: preset.color }"
        />
      </UiPickerItem>

      <UiPickerItem
        v-if="customSwatch"
        :selected="true"
        class="swatch"
        data-testid="custom-swatch"
        :style="{ background: customSwatch }"
      />

      <button
        v-if="allowCustom"
        class="add-btn"
        data-testid="add-btn"
        type="button"
        @click="openPicker"
      >+</button>
      <input
        v-if="allowCustom"
        ref="inputRef"
        type="color"
        class="hidden-input"
        data-testid="color-input"
        @change="onColorPicked"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { UiText, UiPickerItem } from '@fastio/ui'

export type ColorOption = {
  value: string
  color: string
  bg?: string
}

const props = withDefaults(defineProps<{
  modelValue: string
  presets?: ColorOption[]
  label?: string
  usedValues?: string[]
  allowCustom?: boolean
}>(), {
  presets: () => [],
  usedValues: () => [],
  allowCustom: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'add-color': [hex: string]
}>()

const inputRef = ref<HTMLInputElement | null>(null)

const isUsed = (value: string) => props.usedValues.includes(value)

const customSwatch = computed(() => {
  if (!props.modelValue) return null
  if (props.presets.some((p) => p.value === props.modelValue)) return null
  if (/^#[0-9a-fA-F]{3,8}$/.test(props.modelValue)) return props.modelValue

  return null
})

const openPicker = () => inputRef.value?.click()

const onColorPicked = (e: Event) => {
  const hex = (e.target as HTMLInputElement).value

  emit('update:modelValue', hex)
  emit('add-color', hex)
}
</script>

<style scoped lang="scss">
.color-swatch-root {
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
  --picker-selected-border: var(--color-text);

  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;

  &:hover { transform: scale(1.15); }
  &.ui-picker-item--selected { transform: scale(1.15); }
  &.used { opacity: 0.35; }
}

.swatch-fill {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

.swatch-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
}

.add-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px dashed var(--color-border);
  background: none;
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  color: var(--color-text-hint);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.15s, color 0.15s, transform 0.1s;

  &:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
    transform: scale(1.1);
  }
}

.hidden-input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}
</style>
