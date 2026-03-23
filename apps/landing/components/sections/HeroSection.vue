<template>
  <section id="hero" class="hero-root">
    <div class="container">
      <div class="hero-text">
        <span class="label">Конструктор сайта для бизнеса</span>

        <h1 class="title">Сайт с&nbsp;<em>онлайн&#8209;заказами</em> для&nbsp;любого бизнеса</h1>

        <FsText as="p" variant="body" color="secondary" class="subtitle">
          Кафе, салон красоты, кальянная, частный мастер — настраиваете сайт
          и принимаете заказы сами. Без агентств и программистов.
        </FsText>

        <div class="actions">
          <FsButton size="large" variant="primary" class="btn-primary">Попробовать бесплатно</FsButton>
          <FsButton size="large" variant="outline" class="btn-outline">Смотреть демо →</FsButton>
        </div>
      </div>

      <div class="hero-mockup">
        <div class="mockup-wrapper">
          <!-- Browser chrome -->
          <div class="browser-frame">
            <div class="browser-bar">
              <div class="browser-dots">
                <span class="dot dot-red" />
                <span class="dot dot-yellow" />
                <span class="dot dot-green" />
              </div>
              <div class="browser-address">admin.fastio.ru</div>
            </div>

            <div class="browser-body">
              <!-- Sidebar -->
              <div class="mock-sidebar">
                <div class="sidebar-item active">
                  <span class="sidebar-icon orange" />
                  <span class="sidebar-label">Заказы</span>
                </div>
                <div class="sidebar-item">
                  <span class="sidebar-icon" />
                  <span class="sidebar-label">Меню</span>
                </div>
                <div class="sidebar-item">
                  <span class="sidebar-icon" />
                  <span class="sidebar-label">Сайт</span>
                </div>
                <div class="sidebar-item">
                  <span class="sidebar-icon" />
                  <span class="sidebar-label">Акции</span>
                </div>
              </div>

              <!-- Main content -->
              <div class="mock-main">
                <div class="mock-header">ПАНЕЛЬ УПРАВЛЕНИЯ</div>
                <div class="mock-stats">
                  <div class="stat-card">
                    <span class="stat-title">Заказы сегодня</span>
                    <span class="stat-value">Новых 12</span>
                  </div>
                  <div class="stat-card">
                    <span class="stat-title">Выручка</span>
                    <span class="stat-value">14к</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Floating card: top-right -->
          <div class="floating-card floating-top">
            <span class="floating-title">Заказов за неделю</span>
            <span class="floating-badge green">+34% к прошлой</span>
          </div>

          <!-- Floating card: bottom-right -->
          <div class="floating-card floating-bottom">
            <span class="floating-title">Заказ #1042</span>
            <span class="floating-badge green">Новый</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { FsButton, FsText } from '@fastio/public-ui'
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;
.hero-root {
  background: var(--ln-cream);
  padding: 48px 16px;
  display: flex;

  @media (min-width: 480px) {
    padding: 64px 24px;
  }

  @media (min-width: 768px) {
    padding: 100px 32px;
  }

  @media (min-width: 1280px) {
    padding: 120px 32px;
  }
}

.container {
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 40px;

  @media (min-width: 1100px) {
    flex-direction: row;
    align-items: center;
    gap: 40px;
  }

  @media (min-width: 1280px) {
    gap: 64px;
  }
}

.hero-text {
  @include flex-col;
  @include flex-fill;
  align-items: center;
  text-align: center;

  @media (min-width: 1100px) {
    align-items: flex-start;
    text-align: left;
  }
}

.label {
  @include flex-row(8px);
  @include text-xs(600);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ln-accent);
  margin-bottom: 20px;

  &::before {
    content: '';
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--ln-accent);
  }
}

.title {
  margin: 0;
  font-family: var(--heading-font-family);
  font-weight: 800;
  font-size: 24px;
  line-height: 1.2;
  color: var(--ln-black);
  max-width: 600px;

  em {
    color: var(--ln-accent);
    font-style: normal;
  }

  @media (min-width: 480px) {
    font-size: 32px;
    line-height: 1.15;
  }

  @media (min-width: 1100px) {
    font-size: 40px;
  }

  @media (min-width: 1280px) {
    font-size: 52px;
  }
}

.subtitle {
  margin-top: 20px;
  max-width: 560px;

  @media (min-width: 768px) {
    margin-top: 24px;
    font-size: 20px;
  }
}

.actions {
  @include flex-col(12px);
  margin-top: 32px;
  width: 100%;

  @media (min-width: 480px) {
    flex-direction: row;
    width: auto;
  }

  @media (min-width: 768px) {
    margin-top: 40px;
    gap: 16px;
  }
}

.btn-primary {
  --primary: var(--ln-black);
  --on-primary: var(--ln-white);
  --primary-hover: var(--ln-black);

  &:hover {
    opacity: 0.85;
  }
}

.btn-outline {
  color: var(--ln-black);
  border-color: var(--color-border);

  &:hover {
    border-color: var(--ln-black);
  }
}

/* Mockup */

.hero-mockup {
  @include flex-fill;
  display: none;

  @media (min-width: 1100px) {
    display: block;
  }
}

.mockup-wrapper {
  position: relative;
  padding: 24px 48px 40px 0;
}

.browser-frame {
  background: var(--ln-black);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: var(--shadow-card-md);
}

.browser-bar {
  @include flex-row(12px);
  padding: 10px 14px;
  background: var(--ln-black);
}

.browser-dots {
  @include flex-row(6px);
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #555;
}

.dot-red { background: #ff5f57; }
.dot-yellow { background: #febc2e; }
.dot-green { background: #28c840; }

.browser-address {
  flex: 1;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 4px 12px;
  @include text-micro;
  color: rgba(255, 255, 255, 0.6);
}

.browser-body {
  display: flex;
  min-height: 220px;

  @media (min-width: 1280px) {
    min-height: 260px;
  }
}

.mock-sidebar {
  @include flex-col(4px);
  width: 120px;
  background: #1a1a1a;
  padding: 14px 10px;
  flex-shrink: 0;

  @media (min-width: 1280px) {
    width: 140px;
    padding: 16px 12px;
  }
}

.sidebar-item {
  @include flex-row(8px);
  padding: 7px 8px;
  border-radius: 8px;
  cursor: default;

  &.active {
    background: rgba(255, 255, 255, 0.08);
  }
}

.sidebar-icon {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  background: #444;
  flex-shrink: 0;

  &.orange {
    background: var(--ln-accent);
  }
}

.sidebar-label {
  @include text-xs;
  color: rgba(255, 255, 255, 0.5);
  white-space: nowrap;

  .active & {
    color: rgba(255, 255, 255, 0.9);
    font-weight: 600;
  }
}

.mock-main {
  flex: 1;
  background: var(--ln-white);
  padding: 16px 18px;

  @media (min-width: 1280px) {
    padding: 20px 24px;
  }
}

.mock-header {
  @include text-micro(700);
  letter-spacing: 0.06em;
  color: var(--ln-black);
  margin-bottom: 14px;

  @media (min-width: 1280px) {
    @include text-xs(700);
    margin-bottom: 18px;
  }
}

.mock-stats {
  @include flex-row(10px);

  @media (min-width: 1280px) {
    gap: 14px;
  }
}

.stat-card {
  @include flex-col(4px);
  @include flex-fill;
  background: var(--ln-white);
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 12px 14px;

  @media (min-width: 1280px) {
    padding: 14px 16px;
  }
}

.stat-title {
  @include text-micro;
  color: #888;

  @media (min-width: 1280px) {
    @include text-xs;
  }
}

.stat-value {
  @include text-xs(700);
  color: var(--ln-black);
}

/* Floating cards */

.floating-card {
  @include flex-col(4px);
  position: absolute;
  background: var(--ln-white);
  border-radius: 12px;
  box-shadow: var(--shadow-card);
  padding: 12px 16px;
  white-space: nowrap;
}

.floating-top {
  top: 0;
  right: 0;
}

.floating-bottom {
  bottom: 0;
  right: 0;
}

.floating-title {
  @include text-xs(600);
  color: var(--ln-black);
}

.floating-badge {
  @include text-micro(600);

  &.green {
    color: #22c55e;
  }
}
</style>
