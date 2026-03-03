<template>
  <div class="section-header-root">
    <span class="label">{{ label }}</span>
    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{ label: string }>()
</script>

<style scoped lang="scss">
.section-header-root {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.label {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
</style>
