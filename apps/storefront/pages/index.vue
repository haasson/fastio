<template>
  <div class="page-root" data-theme="dark">

    <!-- Липкий блок: шапка + категории -->
    <div ref="stickyRef" class="sticky-top">
      <header class="header">
        <div class="container header-inner">
          <img v-if="tenant?.theme?.logoUrl" class="logo" :src="tenant.theme.logoUrl" :alt="tenant.name" />
        <span v-else class="logo-fallback">{{ tenant?.name ?? 'Лого' }}</span>
          <div class="venue-info">
          <span class="venue-hours">{{ tenant?.workingHours }}</span>
          <a class="venue-phone" :href="`tel:${tenant?.contacts?.phone}`">{{ tenant?.contacts?.phone }}</a>
        </div>
          <button class="cart-btn" aria-label="Корзина">
          <ShoppingCart :size="22" :stroke-width="1.7" />
        </button>
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
import type { Tenant } from '@fastio/shared'
import { ShoppingCart } from 'lucide-vue-next'
import { useElementSize } from '@vueuse/core'

const { data: tenant } = useNuxtData<Tenant>('tenant')

const stickyRef = useTemplateRef('stickyRef')
const { height: stickyHeight } = useElementSize(stickyRef)
const heroHeight = computed(() => `calc(100vh - ${stickyHeight.value}px)`)
</script>

<style scoped>
.page-root {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--color-bg);
  color: var(--color-text);
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
  background: var(--color-bg);
  padding: 12px 0;
}

.header-inner {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo {
  height: 36px;
  width: auto;
  object-fit: contain;
}

.logo-fallback {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text);
}

.venue-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.cart-btn {
  color: var(--color-text);
  padding: 6px;
  border-radius: 8px;
  transition: opacity 0.15s;

  &:hover {
    opacity: 0.7;
  }
}

.venue-hours {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.venue-phone {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
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
