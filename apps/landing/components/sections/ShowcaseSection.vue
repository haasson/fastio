<template>
  <section id="showcase" class="showcase-root">
    <div class="container">
      <FsHeading as="h2" class="title">Посмотрите, как выглядит ваш сайт</FsHeading>
      <FsText class="subtitle">
        Красивый, быстрый и удобный — на любом устройстве
      </FsText>

      <div class="tabs">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          class="tab"
          :class="{ active: activeTab === tab.id }"
          @click="activeTab = tab.id"
        >
          <component :is="tab.icon" :size="18" />
          {{ tab.label }}
        </button>
      </div>

      <div class="preview">
        <div class="browser-frame">
          <div class="browser-dots">
            <span /><span /><span />
          </div>
          <div class="browser-bar">fastio.app/demo-cafe</div>
        </div>
        <div class="screen" :class="`screen-${activeTab}`">
          <div class="screen-content">
            <div v-if="activeTab === 'menu'" class="mock-menu">
              <div class="mock-header-bar" />
              <div class="mock-categories">
                <span class="mock-cat active">Пицца</span>
                <span class="mock-cat">Бургеры</span>
                <span class="mock-cat">Напитки</span>
              </div>
              <div class="mock-grid">
                <div v-for="i in 4" :key="i" class="mock-card">
                  <div class="mock-img" />
                  <div class="mock-info">
                    <div class="mock-line w60" />
                    <div class="mock-line w40 muted" />
                    <div class="mock-price" />
                  </div>
                </div>
              </div>
            </div>

            <div v-else-if="activeTab === 'cart'" class="mock-cart">
              <div class="mock-header-bar" />
              <div class="mock-cart-items">
                <div v-for="i in 3" :key="i" class="mock-cart-item">
                  <div class="mock-thumb" />
                  <div class="mock-cart-info">
                    <div class="mock-line w60" />
                    <div class="mock-line w30 muted" />
                  </div>
                  <div class="mock-price" />
                </div>
              </div>
              <div class="mock-total">
                <div class="mock-line w40" />
                <div class="mock-price lg" />
              </div>
              <div class="mock-btn" />
            </div>

            <div v-else class="mock-admin">
              <div class="mock-sidebar">
                <div class="mock-line w80" />
                <div class="mock-line w60" />
                <div class="mock-line w70" />
                <div class="mock-line w50" />
              </div>
              <div class="mock-main">
                <div class="mock-stats">
                  <div v-for="i in 3" :key="i" class="mock-stat-card">
                    <div class="mock-line w40 muted" />
                    <div class="mock-line w60 bold" />
                  </div>
                </div>
                <div class="mock-table">
                  <div v-for="i in 4" :key="i" class="mock-row">
                    <div class="mock-line w30" />
                    <div class="mock-line w20" />
                    <div class="mock-badge" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Monitor, ShoppingCart, LayoutDashboard } from 'lucide-vue-next'
import { FsHeading, FsText } from '@fastio/public-ui'

const activeTab = ref('menu')

const tabs = [
  { id: 'menu', label: 'Меню', icon: Monitor },
  { id: 'cart', label: 'Корзина', icon: ShoppingCart },
  { id: 'admin', label: 'Панель управления', icon: LayoutDashboard },
]
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;
.showcase-root {
  padding: var(--section-spacing) 16px;
  background: var(--color-surface);
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  text-align: center;
}

.title {
  font-family: var(--heading-font-family);
  font-size: 28px;
  font-weight: 800;
  margin: 0 0 12px;
}

.subtitle {
  color: var(--color-text-secondary);
  @include text-body-sm;
  margin: 0 0 32px;
}

.tabs {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin: 0 0 32px;
}

.tab {
  @include flex-row(6px);
  padding: 10px 20px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-btn);
  background: transparent;
  color: var(--color-text-secondary);
  @include text-caption;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--border-hover);
    color: var(--color-text);
  }

  &.active {
    background: var(--primary);
    border-color: var(--primary);
    color: var(--on-primary);
  }
}

.preview {
  border-radius: var(--radius-card);
  overflow: hidden;
  box-shadow: var(--shadow-card-md);
  border: 1px solid var(--color-border);
}

.browser-frame {
  @include flex-row(12px);
  padding: 12px 16px;
  background: var(--ln-cream);
  border-bottom: 1px solid var(--color-border);
}

.browser-dots {
  display: flex;
  gap: 6px;

  span {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--color-border);
  }
}

.browser-bar {
  flex: 1;
  padding: 6px 12px;
  background: var(--color-surface);
  border-radius: 6px;
  @include text-xs;
  color: var(--color-text-muted);
  text-align: left;
}

.screen {
  background: var(--ln-white);
  min-height: 300px;
  padding: 20px;
}

.screen-content {
  max-width: 100%;
}

// Mock elements
.mock-header-bar {
  height: 40px;
  background: var(--ln-cream);
  border-radius: 8px;
  margin: 0 0 16px;
}

.mock-categories {
  display: flex;
  gap: 8px;
  margin: 0 0 16px;
}

.mock-cat {
  padding: 6px 16px;
  border-radius: 20px;
  background: var(--ln-cream);
  @include text-xs;
  color: var(--color-text-muted);

  &.active {
    background: var(--primary);
    color: var(--on-primary);
  }
}

.mock-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.mock-card {
  border-radius: var(--radius-card);
  border: 1px solid var(--color-border);
  overflow: hidden;
}

.mock-img {
  height: 80px;
  background: linear-gradient(135deg, var(--ln-cream), var(--color-border));
}

.mock-info {
  @include flex-col(4px);
  padding: 10px;
}

.mock-line {
  height: 10px;
  background: var(--ln-cream);
  border-radius: 4px;

  &.w30 { width: 30%; }
  &.w40 { width: 40%; }
  &.w50 { width: 50%; }
  &.w60 { width: 60%; }
  &.w70 { width: 70%; }
  &.w80 { width: 80%; }
  &.muted { opacity: 0.5; }
  &.bold { height: 14px; }
}

.mock-price {
  width: 50px;
  height: 12px;
  background: var(--primary-subtle);
  border-radius: 4px;
  margin-top: 4px;

  &.lg {
    width: 70px;
    height: 16px;
  }
}

// Cart mock
.mock-cart-items {
  @include flex-col(12px);
  margin: 0 0 16px;
}

.mock-cart-item {
  @include flex-row(12px);
  padding: 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-btn);
}

.mock-thumb {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  background: linear-gradient(135deg, var(--ln-cream), var(--color-border));
  flex-shrink: 0;
}

.mock-cart-info {
  @include flex-col(4px);
  @include flex-fill;
}

.mock-total {
  @include flex-between;
  padding: 12px 0;
  border-top: 1px solid var(--color-border);
  margin: 0 0 12px;
}

.mock-btn {
  height: 44px;
  background: var(--primary);
  border-radius: var(--radius-btn);
}

// Admin mock
.mock-admin {
  display: flex;
  gap: 16px;
  min-height: 240px;
}

.mock-sidebar {
  @include flex-col(10px);
  width: 140px;
  padding: 12px;
  background: var(--ln-cream);
  border-radius: 8px;
  flex-shrink: 0;
}

.mock-main {
  @include flex-col(16px);
  @include flex-fill;
}

.mock-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.mock-stat-card {
  @include flex-col(6px);
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
}

.mock-table {
  @include flex-col(8px);
}

.mock-row {
  @include flex-row(12px);
  padding: 8px 12px;
  border-bottom: 1px solid var(--color-border);
}

.mock-badge {
  width: 50px;
  height: 20px;
  background: color-mix(in srgb, var(--color-success) 15%, transparent);
  border-radius: 10px;
  margin-left: auto;
}

@media (min-width: 768px) {
  .title {
    font-size: 36px;
  }

  .subtitle {
    @include text-body;
  }

  .mock-grid {
    grid-template-columns: repeat(4, 1fr);
  }

  .mock-img {
    height: 100px;
  }

  .screen {
    min-height: 400px;
    padding: 28px;
  }
}

@media (min-width: 1280px) {
  .title {
    font-size: 40px;
  }
}
</style>
