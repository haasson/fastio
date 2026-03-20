<template>
  <label
    class="checkbox-root"
    :class="[`size-${size}`, { 'is-disabled': disabled }]"
  >
    <CheckboxRoot
      class="checkbox-box"
      :class="`size-${size}`"
      :checked="modelValue"
      :disabled="disabled"
      @update:checked="onCheckedChange"
    >
      <CheckboxIndicator class="checkbox-indicator">
        <Check class="check-icon" :stroke-width="3" />
      </CheckboxIndicator>
    </CheckboxRoot>
    <span v-if="label" class="checkbox-label">{{ label }}</span>
  </label>
</template>
<script setup lang="ts">
import { CheckboxRoot, CheckboxIndicator } from 'reka-ui'
import { Check } from 'lucide-vue-next'

type Props = {
  modelValue?: boolean | 'indeterminate'
  disabled?: boolean
  size?: 'sm' | 'md'
  label?: string
}

withDefaults(defineProps<Props>(), {
  size: 'md',
  disabled: false,
  modelValue: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean | 'indeterminate']
}>()

function onCheckedChange(value: boolean | 'indeterminate') {
  emit('update:modelValue', value)
}
</script>
<style scoped lang="scss">
.checkbox-root {
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

.checkbox-box {
  flex-shrink: 0;
  border: 2px solid var(--color-border);
  background: var(--color-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
  outline: none;
  cursor: pointer;

  &.size-sm {
    width: 16px;
    height: 16px;
    border-radius: 4px;
  }

  &.size-md {
    width: 20px;
    height: 20px;
    border-radius: 5px;
  }

  &:focus-visible {
    box-shadow: 0 0 0 3px var(--primary-subtle);
  }

  &[data-state='checked'],
  &[data-state='indeterminate'] {
    border-color: var(--primary);
    background: var(--primary);
  }
}

.checkbox-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--on-primary);
}

.check-icon {
  .size-sm & {
    width: 10px;
    height: 10px;
  }

  .size-md & {
    width: 13px;
    height: 13px;
  }
}

.checkbox-label {
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
