<template>
  <div class="fs-alert-root" :class="`type-${type}`">
    <component :is="icon" v-if="icon" :size="14" class="alert-icon" />
    <slot />
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
.fs-alert-root {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  font-size: 13px;
  border-radius: var(--radius-btn);

  &.type-success {
    background: var(--color-success);
    color: #fff;
  }

  &.type-error {
    background: var(--color-error);
    color: #fff;
  }

  &.type-warning {
    background: var(--color-warning);
    color: #fff;
  }

  &.type-info {
    background: var(--primary);
    color: var(--on-primary);
  }

  &.type-muted {
    background: var(--color-surface);
    color: var(--color-text-muted);
  }
}
</style>
