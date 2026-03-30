<template>
  <component
    :is="as"
    class="icon-btn-root"
    :class="[
      `icon-btn-${variant}`,
      `size-${size}`,
      { 'is-responsive': responsive, 'is-loading': loading, 'is-disabled': disabled || loading },
    ]"
    :type="as === 'button' ? 'button' : undefined"
    :disabled="as === 'button' ? (disabled || loading) : undefined"
    :aria-label="ariaLabel"
    :aria-disabled="as !== 'button' ? (disabled || loading) || undefined : undefined"
  >
    <FsSpinner v-if="loading" size="small" />
    <slot v-else />
  </component>
</template>
<script setup lang="ts">
import FsSpinner from './FsSpinner.vue'

type Props = {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline'
  size?: 'small' | 'medium' | 'large'
  responsive?: boolean
  disabled?: boolean
  loading?: boolean
  as?: string
  ariaLabel?: string
}

withDefaults(defineProps<Props>(), {
  variant: 'ghost',
  size: 'medium',
  responsive: false,
  disabled: false,
  loading: false,
  as: 'button',
})
</script>
<style scoped lang="scss">
@use '../../styles/mixins' as *;
.icon-btn-root {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: none;
  cursor: pointer;
  border-radius: var(--radius-btn);
  transition: background 0.15s, opacity 0.15s;
  padding: 0;
  text-decoration: none;
  outline-offset: 2px;

  &:focus-visible {
    outline: 2px solid var(--primary);
  }

  :deep(svg) {
    flex-shrink: 0;
    pointer-events: none;
  }
}

// Sizes (квадрат)
.size-small {
  width: 32px;
  height: 32px;

  :deep(svg) {
    width: 16px;
    height: 16px;
  }
}

.size-medium {
  width: 40px;
  height: 40px;

  :deep(svg) {
    width: 20px;
    height: 20px;
  }
}

.size-large {
  width: 48px;
  height: 48px;

  :deep(svg) {
    width: 24px;
    height: 24px;
  }
}

// Responsive: lg+ поднимаем на шаг вверх
.size-small.is-responsive {
  @include lg {
    width: 40px;
    height: 40px;

    :deep(svg) {
      width: 20px;
      height: 20px;
    }
  }
}

.size-medium.is-responsive {
  @include lg {
    width: 48px;
    height: 48px;

    :deep(svg) {
      width: 24px;
      height: 24px;
    }
  }
}

// Disabled
.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

// Variants
.icon-btn-primary {
  background: var(--primary);
  color: var(--on-primary);

  &:hover:not(.is-disabled) {
    background: var(--primary-hover);
  }
}

.icon-btn-secondary {
  background: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);

  &:hover:not(.is-disabled) {
    background: var(--surface-hover);
  }
}

.icon-btn-ghost {
  background: transparent;
  color: var(--color-text-secondary);

  &:hover:not(.is-disabled) {
    background: var(--primary-subtle);
    color: var(--primary);
  }
}

.icon-btn-outline {
  background: transparent;
  color: var(--primary);
  border: 1px solid var(--primary);

  &:hover:not(.is-disabled) {
    background: var(--primary-subtle);
  }
}
</style>
