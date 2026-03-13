<template>
  <section class="menu-root">
    <div class="container">
      <div class="category-grid">
        <div class="category-card">Категория 1</div>
        <div class="category-card">Категория 2</div>
        <div class="category-card">Категория 3</div>
        <div class="category-card">Категория 4</div>
        <div class="category-card">Категория 5</div>
        <div class="category-card">Категория 6</div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  defaultView: 'categories' | 'dishes'
}>()
</script>

<style scoped>
.menu-root {
  padding: 32px 0;
}

.container {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 20px;
  width: 100%;
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.category-card {
  background: var(--color-surface);
  color: var(--color-text-secondary);
  padding: 60px 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
}
</style>
