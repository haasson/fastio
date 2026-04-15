<template>
  <div
    class="chip-root"
    :class="[`chip--${type}`, { 'chip--selected': selected, 'chip--disabled': disabled }]"
    @click="!disabled && $emit('click', $event)"
  >
    <span class="chip-label"><slot /></span>
    <span v-if="$slots.sub || sub" class="chip-sub">
      <slot name="sub">{{ sub }}</slot>
    </span>
  </div>
</template>

<script setup lang="ts">
type Props = {
  type?: 'default' | 'success' | 'warning' | 'error' | 'info'
  sub?: string
  selected?: boolean
  disabled?: boolean
}

withDefaults(defineProps<Props>(), {
  type: 'default',
})

defineEmits<{
  click: [event: MouseEvent]
}>()
</script>

<style scoped lang="scss">
.chip-root {
  display: inline-flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-8) var(--space-8);
  border-radius: var(--radius-8);
  border: 1.5px solid var(--chip-border);
  background: var(--chip-bg);
  cursor: pointer;
  transition: border-color 0.15s;
  user-select: none;

  &:hover:not(.chip--disabled),
  &.chip--selected {
    border-color: var(--chip-accent);
  }

  &.chip--disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  // Types
  &.chip--default {
    --chip-bg: var(--color-bg-subtle);
    --chip-border: var(--color-border);
    --chip-accent: var(--color-text-secondary);
  }

  &.chip--success {
    --chip-bg: var(--color-success-light);
    --chip-border: color-mix(in srgb, var(--color-success) 20%, transparent);
    --chip-accent: var(--color-success);
  }

  &.chip--warning {
    --chip-bg: var(--color-warning-light);
    --chip-border: color-mix(in srgb, var(--color-warning) 20%, transparent);
    --chip-accent: var(--color-warning);
  }

  &.chip--error {
    --chip-bg: var(--color-error-light);
    --chip-border: color-mix(in srgb, var(--color-error) 20%, transparent);
    --chip-accent: var(--color-error);
  }

  &.chip--info {
    --chip-bg: var(--color-primary-light);
    --chip-border: color-mix(in srgb, var(--color-primary) 20%, transparent);
    --chip-accent: var(--color-primary);
  }
}

.chip-label {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-height-tight);
  color: var(--color-text);
}

.chip-sub {
  font-size: var(--font-size-xs);
  line-height: var(--line-height-tight);
  color: var(--color-text-secondary);
}
</style>
