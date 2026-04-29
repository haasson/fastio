<template>
  <component
    :is="as"
    class="btn-root"
    :class="[
      `btn-${variant}`,
      `size-${size}`,
      { 'is-responsive': responsive, 'is-loading': loading, 'is-disabled': disabled || loading, 'has-sub': !!$slots.sub },
    ]"
    :type="as === 'button' ? type : undefined"
    :disabled="as === 'button' ? (disabled || loading) : undefined"
    :aria-disabled="as !== 'button' ? (disabled || loading) || undefined : undefined"
  >
    <FsSpinner v-if="loading" class="btn-spinner" size="small" />
    <slot />
    <span v-if="$slots.sub" class="btn-sub"><slot name="sub" /></span>
  </component>
</template>
<script setup lang="ts">
import FsSpinner from './FsSpinner.vue'

type Props = {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'destructive'
  size?: 'small' | 'medium' | 'large'
  responsive?: boolean
  disabled?: boolean
  loading?: boolean
  as?: string
  type?: 'button' | 'submit' | 'reset'
}

withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'medium',
  responsive: false,
  disabled: false,
  loading: false,
  as: 'button',
  type: 'button',
})
</script>
<style scoped lang="scss">
@use '../../styles/mixins' as *;
.btn-root {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  cursor: pointer;
  font-weight: 500;
  border-radius: var(--radius-btn);
  transition: background 0.15s, opacity 0.15s;
  white-space: nowrap;
  text-decoration: none;
  outline-offset: 2px;
  height: var(--ctrl-h);
  padding: 0 var(--ctrl-px);
  font-size: var(--ctrl-fs);
  gap: var(--ctrl-gap);

  &:focus-visible {
    outline: 2px solid var(--primary);
  }

  :deep(svg) {
    width: var(--ctrl-icon);
    height: var(--ctrl-icon);
    flex-shrink: 0;
  }
}

// Disabled & loading
.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

// Variants
.btn-primary {
  background: var(--primary);
  color: var(--on-primary);

  &:hover:not(.is-disabled) {
    background: var(--primary-hover);
  }
}

.btn-secondary {
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);

  &:hover:not(.is-disabled) {
    background: var(--surface-hover);
  }
}

.btn-ghost {
  background: transparent;
  color: var(--primary);

  &:hover:not(.is-disabled) {
    background: var(--primary-subtle);
  }
}

.btn-outline {
  background: transparent;
  color: var(--primary);
  border: 1px solid var(--primary);

  &:hover:not(.is-disabled) {
    background: var(--primary-subtle);
  }
}

.btn-destructive {
  background: var(--color-error);
  color: #fff;

  &:hover:not(.is-disabled) {
    background: color-mix(in srgb, var(--color-error) 82%, #000);
  }
}

.btn-spinner {
  flex-shrink: 0;
}

.has-sub {
  flex-direction: column;
  gap: 2px;
  height: auto;
  padding-block: 8px;
}

.btn-sub {
  font-size: 11px;
  font-weight: 400;
  opacity: 0.75;
  line-height: 1;
}
</style>
