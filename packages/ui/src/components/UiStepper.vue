<template>
  <div class="stepper-root" :class="`size-${size}`">
    <button
      class="stepper-btn"
      type="button"
      :disabled="modelValue <= min"
      @click="$emit('update:modelValue', modelValue - 1)"
    >
      <UiIcon name="minus" :size="size === 'small' ? 12 : 14" />
    </button>
    <span class="stepper-value">{{ modelValue }}</span>
    <button
      class="stepper-btn"
      type="button"
      :disabled="modelValue >= max"
      @click="$emit('update:modelValue', modelValue + 1)"
    >
      <UiIcon name="plus" :size="size === 'small' ? 12 : 14" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { UiIcon } from '@fastio/icons'

type Props = {
  modelValue: number
  min?: number
  max?: number
  size?: 'small' | 'medium'
}

withDefaults(defineProps<Props>(), {
  min: 0,
  max: 999,
  size: 'medium',
})

defineEmits<{
  'update:modelValue': [value: number]
}>()
</script>

<style scoped lang="scss">
.stepper-root {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--color-bg-card);
}

.stepper-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--color-primary);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s;

  &:hover:not(:disabled) {
    background: color-mix(in srgb, var(--color-primary) 8%, transparent);
  }

  &:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
}

.stepper-value {
  text-align: center;
  font-weight: 600;
  color: var(--color-title);
  flex-shrink: 0;
  user-select: none;
}

.size-small {
  .stepper-btn {
    width: 28px;
    height: 28px;
  }

  .stepper-value {
    min-width: 24px;
    font-size: 13px;
  }
}

.size-medium {
  .stepper-btn {
    width: 36px;
    height: 36px;
  }

  .stepper-value {
    min-width: 30px;
    font-size: 14px;
  }
}
</style>
