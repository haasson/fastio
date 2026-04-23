<template>
  <div
    class="progress-root"
    :aria-valuenow="percent"
    aria-valuemin="0"
    aria-valuemax="100"
    role="progressbar"
  >
    <span class="bar" :style="{ width: `${percent}%` }" />
  </div>
</template>

<script setup lang="ts">
defineProps<{ percent: number }>()
</script>

<style scoped lang="scss">
.progress-root {
  width: 100%;
  height: 3px;
  background: var(--color-border);
  border-radius: var(--radius-4);
  overflow: hidden;
}

.bar {
  display: block;
  height: 100%;
  background: var(--color-primary);
  transition: width var(--transition-base);
}
</style>
