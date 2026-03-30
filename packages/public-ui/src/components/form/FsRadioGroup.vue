<template>
  <RadioGroupRoot
    class="radio-group-root"
    :class="[`orientation-${orientation}`, `size-${size}`]"
    :model-value="stringValue"
    :disabled="disabled"
    :orientation="orientation"
    @update:model-value="onValueChange"
  >
    <label
      v-for="option in options"
      :key="option.value"
      class="radio-item"
      :class="[`size-${size}`, { 'is-disabled': disabled || option.disabled }]"
    >
      <RadioGroupItem
        class="radio-btn"
        :class="`size-${size}`"
        :value="String(option.value)"
        :disabled="option.disabled"
      >
        <RadioGroupIndicator class="radio-indicator" :class="`size-${size}`" />
      </RadioGroupItem>
      <span class="radio-label">{{ option.label }}</span>
    </label>
  </RadioGroupRoot>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import { RadioGroupRoot, RadioGroupItem, RadioGroupIndicator, type AcceptableValue } from 'reka-ui'

type Option = {
  value: string | number
  label: string
  disabled?: boolean
}

type Props = {
  modelValue?: string | number
  options: Option[]
  disabled?: boolean
  orientation?: 'horizontal' | 'vertical'
  size?: 'sm' | 'md'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  disabled: false,
  orientation: 'vertical',
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
}>()

function onValueChange(value: AcceptableValue) {
  if (typeof value === 'string' || typeof value === 'number') {
    emit('update:modelValue', value)
  }
}

const stringValue = computed(() =>
  props.modelValue !== undefined ? String(props.modelValue) : undefined,
)
</script>
<style scoped lang="scss">
.radio-group-root {
  display: flex;

  &.orientation-vertical {
    flex-direction: column;
    gap: 10px;
  }

  &.orientation-horizontal {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 16px;
  }
}

.radio-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;

  &.is-disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }
}

.radio-btn {
  flex-shrink: 0;
  border-radius: 50%;
  border: 2px solid var(--color-border);
  background: var(--color-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  outline: none;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;

  &.size-sm {
    width: 16px;
    height: 16px;
  }

  &.size-md {
    width: 20px;
    height: 20px;
  }

  &:focus-visible {
    box-shadow: 0 0 0 3px var(--primary-subtle);
  }

  &[data-state='checked'] {
    border-color: var(--primary);
  }
}

.radio-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--primary);
  transition: transform 0.15s;
  transform: scale(0);

  &[data-state='checked'] {
    transform: scale(1);
  }

  &.size-sm {
    width: 6px;
    height: 6px;
  }

  &.size-md {
    width: 8px;
    height: 8px;
  }
}

.radio-label {
  color: var(--color-text);
  line-height: 1.4;

  .size-sm & {
    font-size: 13px;
  }

  .size-md & {
    font-size: 15px;
  }
}
</style>
