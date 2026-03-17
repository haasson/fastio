<template>
  <component
    :is="as"
    class="tag-root"
    :class="[
      `tag-${size}`,
      {
        'is-active': active,
        'is-disabled': disabled,
        'is-responsive': responsive,
      },
    ]"
    :type="as === 'button' ? 'button' : undefined"
    :disabled="as === 'button' ? disabled : undefined"
    :aria-pressed="as === 'button' ? active : undefined"
    :aria-disabled="as !== 'button' ? disabled || undefined : undefined"
  >
    <slot />
  </component>
</template>
<script setup lang="ts">
type Props = {
  active?: boolean
  disabled?: boolean
  size?: 'small' | 'medium'
  responsive?: boolean
  as?: string
}

const props = withDefaults(defineProps<Props>(), {
  active: false,
  disabled: false,
  size: 'medium',
  responsive: false,
  as: 'button',
})
</script>
<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;
.tag-root {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-weight: 400;
  white-space: nowrap;
  text-decoration: none;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-secondary);
  transition: background 0.15s, border-color 0.15s, color 0.15s;
  outline-offset: 2px;

  &:focus-visible {
    outline: 2px solid var(--primary);
  }

  &:hover:not(.is-disabled):not(.is-active) {
    background: var(--surface-hover);
    border-color: var(--border-hover);
  }

  &.is-active {
    background: var(--primary-subtle);
    color: var(--primary);
    border-color: var(--primary);
  }

  &.is-disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
  }
}

// Sizes
.tag-small {
  height: 28px;
  padding: 0 10px;
  font-size: 12px;
  border-radius: 999px;
}

.tag-medium {
  height: 36px;
  padding: 0 16px;
  font-size: 14px;
  border-radius: 999px;
}

// Responsive: lg+ поднимаем на шаг вверх
.tag-small.is-responsive {
  @include lg {
    height: 36px;
    padding: 0 16px;
    font-size: 14px;
  }
}
</style>
