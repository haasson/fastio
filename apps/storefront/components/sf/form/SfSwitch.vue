<template>
  <label
    class="switch-root"
    :class="[`size-${size}`, { 'is-disabled': disabled }]"
  >
    <SwitchRoot
      class="switch-track"
      :class="`size-${size}`"
      :checked="modelValue"
      :disabled="disabled"
      @update:checked="onCheckedChange"
    >
      <SwitchThumb class="switch-thumb" :class="`size-${size}`" />
    </SwitchRoot>
    <span v-if="label" class="switch-label">{{ label }}</span>
  </label>
</template>
<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from 'reka-ui'

type Props = {
  modelValue?: boolean
  disabled?: boolean
  size?: 'sm' | 'md'
  label?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  disabled: false,
  modelValue: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

function onCheckedChange(value: boolean) {
  emit('update:modelValue', value)
}
</script>
<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;
.switch-root {
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

.switch-track {
  position: relative;
  flex-shrink: 0;
  border-radius: 999px;
  border: none;
  outline: none;
  cursor: pointer;
  transition: background 0.2s, box-shadow 0.2s;
  background: var(--color-surface);
  box-shadow: inset 0 0 0 2px var(--color-border);

  &.size-sm {
    width: 32px;
    height: 18px;
  }

  &.size-md {
    width: 44px;
    height: 24px;
  }

  &[data-state='checked'] {
    background: var(--primary);
    box-shadow: none;
  }

  &:focus-visible {
    box-shadow: inset 0 0 0 2px var(--color-border), 0 0 0 3px var(--primary-subtle);
  }
}

.switch-thumb {
  display: block;
  background: white;
  border-radius: 50%;
  transition: transform 0.2s;
  position: absolute;
  top: 50%;
  transform: translateY(-50%) translateX(2px);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);

  &.size-sm {
    width: 14px;
    height: 14px;

    [data-state='checked'] & {
      transform: translateY(-50%) translateX(16px);
    }
  }

  &.size-md {
    width: 20px;
    height: 20px;

    [data-state='checked'] & {
      transform: translateY(-50%) translateX(22px);
    }
  }
}

.switch-label {
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
