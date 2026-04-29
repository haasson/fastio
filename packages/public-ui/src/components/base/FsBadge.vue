<template>
  <span
    class="badge-root"
    :class="[`badge-${variant}`, `badge-${size}`, { 'badge-dot': dot }]"
  >
    <slot v-if="!dot" />
  </span>
</template>
<script setup lang="ts">
type Props = {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info'
  size?: 'small' | 'medium'
  dot?: boolean
}

withDefaults(defineProps<Props>(), {
  variant: 'default',
  size: 'medium',
  dot: false,
})
</script>
<style scoped lang="scss">
.badge-root {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
  white-space: nowrap;
  line-height: 1;
}

// Sizes
.badge-small {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 999px;
}

.badge-medium {
  font-size: 12px;
  padding: 3px 8px;
  border-radius: 999px;
}

// Dot mode — круглая точка без текста
.badge-dot {
  width: 8px;
  height: 8px;
  padding: 0;
  border-radius: 50%;
}

// Variants
.badge-default {
  background: var(--color-surface);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
}

.badge-primary {
  background: var(--primary-subtle);
  color: var(--primary);
}

.badge-success {
  background: color-mix(in srgb, #10b981 12%, transparent);
  color: #10b981;
}

.badge-warning {
  background: color-mix(in srgb, #f59e0b 12%, transparent);
  color: #f59e0b;
}

.badge-error {
  background: color-mix(in srgb, var(--color-error) 12%, transparent);
  color: var(--color-error);
}

.badge-info {
  background: color-mix(in srgb, #3b82f6 12%, transparent);
  color: #3b82f6;
}
</style>
