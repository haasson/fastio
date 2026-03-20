<template>
  <div class="sf-alert" :class="`type-${type}`">
    <component :is="icon" v-if="icon" :size="14" class="alert-icon" />
    <span><slot /></span>
  </div>
</template>

<script setup lang="ts">
import type { Component } from 'vue'

type Props = {
  type?: 'success' | 'error' | 'warning' | 'info' | 'muted'
  icon?: Component
}

withDefaults(defineProps<Props>(), {
  type: 'info',
})
</script>

<style scoped lang="scss">
.sf-alert {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  font-size: 13px;
  border-radius: var(--radius-btn);

  &.type-success {
    background: color-mix(in srgb, var(--color-success) 10%, transparent);
    color: color-mix(in srgb, var(--color-success) 80%, #000);
  }

  &.type-error {
    background: color-mix(in srgb, var(--color-error) 10%, transparent);
    color: color-mix(in srgb, var(--color-error) 80%, #000);
  }

  &.type-warning {
    background: color-mix(in srgb, var(--color-warning) 10%, transparent);
    color: color-mix(in srgb, var(--color-warning) 80%, #000);
  }

  &.type-info {
    background: color-mix(in srgb, var(--primary) 10%, transparent);
    color: var(--primary);
  }

  &.type-muted {
    background: var(--color-surface);
    color: var(--color-text-muted);
  }
}
</style>
