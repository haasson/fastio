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
  gap: 2px;
  padding: 6px 10px;
  border-radius: 8px;
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
    --chip-bg: #52c41a0d;
    --chip-border: #52c41a33;
    --chip-accent: #52c41a;
  }

  &.chip--warning {
    --chip-bg: #faad140d;
    --chip-border: #faad1433;
    --chip-accent: #faad14;
  }

  &.chip--error {
    --chip-bg: #ff4d4f0d;
    --chip-border: #ff4d4f33;
    --chip-accent: #ff4d4f;
  }

  &.chip--info {
    --chip-bg: #1677ff0d;
    --chip-border: #1677ff33;
    --chip-accent: #1677ff;
  }
}

.chip-label {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.3;
  color: var(--color-text);
}

.chip-sub {
  font-size: 11px;
  line-height: 1.2;
  color: var(--color-text-secondary);
}
</style>
