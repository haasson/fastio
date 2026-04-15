<template>
  <div class="section-header-root">
    <div class="left">
      <span class="label">{{ title }}</span>
      <slot name="left" />
    </div>
    <div class="right">
      <slot name="right" />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ title: string }>()
</script>

<style scoped lang="scss">
.section-header-root {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-12);
}
.left, .right {
  display: flex;
  align-items: center;
  gap: var(--space-8);
}
.label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
}
</style>
