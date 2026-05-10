<template>
  <div
    class="progress-root"
    :aria-valuenow="completed"
    aria-valuemin="0"
    :aria-valuemax="total"
    aria-label="Прогресс онбординга"
    role="progressbar"
  >
    <span
      v-for="i in total"
      :key="i"
      class="pill"
      :class="{ filled: i <= completed }"
    />
  </div>
</template>

<script setup lang="ts">
defineProps<{ total: number; completed: number }>()
</script>

<style scoped lang="scss">
.progress-root {
  display: flex;
  gap: var(--space-4);
  width: 100%;
}

.pill {
  flex: 1;
  height: 8px;
  background: var(--color-border);
  border-radius: var(--radius-full);
  transition: background var(--transition-base);

  &.filled {
    background: var(--color-primary);
  }
}
</style>
