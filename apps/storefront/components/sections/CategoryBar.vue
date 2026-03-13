<template>
  <nav class="category-bar-root">
    <div class="pills" :class="`pills--${overflow}`">
      <!-- категории будут здесь -->
    </div>
  </nav>
</template>

<script setup lang="ts">
defineProps<{
  overflow: 'scroll' | 'wrap'
}>()
</script>

<style scoped>
.category-bar-root {
  background: var(--color-surface);
  padding: 8px 20px;
}

.pills {
  display: flex;
  gap: 8px;
  max-width: 1100px;
  margin: 0 auto;
}

.pills--scroll {
  overflow-x: auto;
  flex-wrap: nowrap;
  scrollbar-width: none;

  &::-webkit-scrollbar { display: none; }
}

.pills--wrap {
  flex-wrap: wrap;
}
</style>
