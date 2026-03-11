<template>
  <div class="page-root">

    <!-- Липкий блок: шапка + категории -->
    <div ref="stickyRef" class="sticky-top">
      <header class="header">
        <div class="container header-inner">
          <span>Лого</span>
          <span>Инфо о заведении</span>
          <span>Корзина</span>
        </div>
      </header>

      <nav class="category-nav">
        <div class="container">
          Категории меню
        </div>
      </nav>
    </div>

    <!-- Хиро блок — занимает оставшееся место в экране -->
    <div class="hero" :style="{ height: heroHeight }">
      Хиро
    </div>

    <!-- Карточки категорий -->
    <div class="container menu-section">
      <div class="category-grid">
        <div class="category-card">Категория 1</div>
        <div class="category-card">Категория 2</div>
        <div class="category-card">Категория 3</div>
        <div class="category-card">Категория 4</div>
        <div class="category-card">Категория 5</div>
        <div class="category-card">Категория 6</div>
      </div>
    </div>

    <!-- Футер -->
    <footer class="footer">
      <div class="container">
        Футер
      </div>
    </footer>

  </div>
</template>

<script setup lang="ts">
import { useElementSize } from '@vueuse/core'

const stickyRef = useTemplateRef('stickyRef')
const { height: stickyHeight } = useElementSize(stickyRef)
const heroHeight = computed(() => `calc(100vh - ${stickyHeight.value}px)`)
</script>

<style scoped>
.page-root {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.container {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 20px;
  width: 100%;
}

/* Липкий контейнер */
.sticky-top {
  position: sticky;
  top: 0;
  z-index: 100;
}

/* Шапка */
.header {
  background: #eee;
  padding: 12px 0;
}

.header-inner {
  display: flex;
  justify-content: space-between;
}

/* Навигация по категориям */
.category-nav {
  background: #ddd;
  padding: 10px 0;
}

/* Хиро */
.hero {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ccc;
}

/* Категории */
.menu-section {
  padding: 32px 20px;
}

.category-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.category-card {
  background: #e8e8e8;
  padding: 60px 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Футер */
.footer {
  margin-top: auto;
  background: #ddd;
  padding: 24px 0;
}
</style>
