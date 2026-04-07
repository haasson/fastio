<template>
  <section id="hero" class="hero-root">
    <div class="container">
      <span class="label">Сайт для кафе и бизнеса</span>

      <h1 class="title">
        Пока вы без сайта — клиенты <em>уходят</em> туда, где можно заказать онлайн
      </h1>

      <div class="hero-body">
        <div class="hero-text">
          <p class="subtitle">
            Кафе, ресторан, салон — запускаете сайт с онлайн-заказами за&nbsp;1&nbsp;день.
            Без агентств, без 200 000 ₽, без ожидания 3&nbsp;месяца.
          </p>

          <div class="price-hint">
            <span class="price-hint-old">от 200 000 ₽ у агентства</span>
            <span class="price-hint-arrow">→</span>
            <span class="price-hint-new">2 490 ₽/мес в Fastio</span>
          </div>

          <div class="actions">
            <FsButton as="a" href="#contact" variant="primary" size="large">
              Оставить заявку
            </FsButton>
            <FsButton as="a" href="#how-it-works" variant="outline" size="large">
              Как это работает →
            </FsButton>
          </div>

          <p class="trust">
            Подключаем за 1 день через менеджера — быстро и без лишних вопросов
          </p>
        </div>

        <div class="hero-mockup">
          <div class="mockup-wrapper">
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

              <div class="mock-main">
                <div class="mock-header">ПАНЕЛЬ УПРАВЛЕНИЯ</div>
                <div class="mock-stats">
                  <div class="stat-card">
                    <span class="stat-title">Заказы сегодня</span>
                    <span class="stat-value">Новых 12</span>
                  </div>
                  <div class="stat-card">
                    <span class="stat-title">Выручка</span>
                    <span class="stat-value">14 800 ₽</span>
                  </div>
                </div>
                <div class="mock-orders">
                  <div class="mock-order">
                    <span class="order-num">#1047</span>
                    <span class="order-name">Шаурма × 2, Кола</span>
                    <span class="order-badge new">Новый</span>
                  </div>
                  <div class="mock-order">
                    <span class="order-num">#1046</span>
                    <span class="order-name">Бургер, Картофель</span>
                    <span class="order-badge cooking">Готовится</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="floating-card floating-top">
            <span class="floating-title">Заказов за неделю</span>
            <span class="floating-value">+34%</span>
            <span class="floating-sub">к прошлой неделе</span>
          </div>

          <div class="floating-card floating-bottom">
            <span class="floating-title">Новый заказ #1048</span>
            <span class="floating-value accent">2 340 ₽</span>
          </div>
        </div>
        </div>
      </div>
    </div>
  </section>

</template>

<script setup lang="ts">
import { FsButton } from '@fastio/public-ui'
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.hero-root {
  background: var(--ln-black);
  padding: 48px 16px 64px;

  @media (min-width: 480px) {
    padding: 64px 24px 80px;
  }

  @media (min-width: 768px) {
    padding: 80px 32px 100px;
  }

  @media (min-width: 1280px) {
    padding: 100px 32px 120px;
  }
}

.container {
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 40px;
}

.hero-body {
  display: flex;
  flex-direction: column;
  gap: 32px;

  @media (min-width: 768px) {
    gap: 48px;
  }

  @media (min-width: 1100px) {
    flex-direction: row;
    align-items: center;
    gap: 48px;
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
  display: inline-flex;
  align-items: center;
  gap: 8px;
  @include text-xs(600);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ln-accent);
  margin-bottom: 24px;

  &::before {
    content: '';
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--ln-accent);
  }
}

.title {
  margin: 0;
  font-family: var(--heading-font-family);
  font-weight: 800;
  font-size: 28px;
  line-height: 1.15;
  color: var(--ln-white);
  text-align: center;

  em {
    color: var(--ln-accent);
    font-style: normal;
  }

  @media (min-width: 480px) {
    font-size: 36px;
  }

  @media (min-width: 768px) {
    font-size: 44px;
  }

  @media (min-width: 1100px) {
    font-size: 52px;
    text-align: left;
  }

  @media (min-width: 1280px) {
    font-size: 60px;
    line-height: 1.08;
  }
}

.subtitle {
  margin-top: 20px;
  max-width: 540px;
  @include text-body-sm;
  color: rgba(245, 243, 238, 0.65);
  line-height: 1.6;

  @media (min-width: 768px) {
    margin-top: 24px;
    font-size: 18px;
  }
}

.price-hint {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-top: 20px;
  padding: 8px 16px;
  background: rgba(245, 243, 238, 0.05);
  border: 1px solid var(--ln-border);
  border-radius: 40px;
  @include text-caption(500);
}

.price-hint-old {
  color: var(--ln-muted);
  text-decoration: line-through;
}

.price-hint-arrow {
  color: var(--ln-muted);
}

.price-hint-new {
  color: var(--ln-accent);
  font-weight: 600;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 32px;
  width: 100%;

  @media (min-width: 480px) {
    flex-direction: row;
    width: auto;
    gap: 16px;
  }

  @media (min-width: 768px) {
    margin-top: 40px;
  }
}

.trust {
  margin-top: 16px;
  @include text-xs;
  color: var(--ln-muted);
  max-width: 400px;
}

/* Mockup */

.hero-mockup {
  @include flex-fill;
  flex-shrink: 0;
  display: none;

  @media (min-width: 1100px) {
    display: block;
  }
}

.mockup-wrapper {
  position: relative;
  padding: 28px 52px 44px 0;
}

.browser-frame {
  background: var(--ln-surface-2, #1e1b18);
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid var(--ln-border);
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.6);
}

.browser-bar {
  @include flex-row(12px);
  padding: 10px 14px;
  background: #1a1714;
  border-bottom: 1px solid var(--ln-border);
}

.browser-dots {
  @include flex-row(6px);
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.dot-red { background: #ff5f57; }
.dot-yellow { background: #febc2e; }
.dot-green { background: #28c840; }

.browser-address {
  flex: 1;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 6px;
  padding: 4px 12px;
  @include text-micro;
  color: rgba(255, 255, 255, 0.4);
}

.browser-body {
  display: flex;
  min-height: 240px;

  @media (min-width: 1280px) {
    min-height: 280px;
  }
}

.mock-sidebar {
  @include flex-col(4px);
  width: 130px;
  background: #141210;
  padding: 14px 10px;
  flex-shrink: 0;
  border-right: 1px solid var(--ln-border);
}

.sidebar-item {
  @include flex-row(8px);
  padding: 7px 8px;
  border-radius: 8px;
  cursor: default;

  &.active {
    background: rgba(229, 90, 37, 0.15);
  }
}

.sidebar-icon {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.1);
  flex-shrink: 0;

  &.orange {
    background: var(--ln-accent);
  }
}

.sidebar-label {
  @include text-xs;
  color: rgba(255, 255, 255, 0.35);
  white-space: nowrap;

  .active & {
    color: var(--ln-accent);
    font-weight: 600;
  }
}

.mock-main {
  flex: 1;
  background: #0f0e0c;
  padding: 16px 18px;

  @media (min-width: 1280px) {
    padding: 20px 24px;
  }
}

.mock-header {
  @include text-micro(700);
  letter-spacing: 0.08em;
  color: rgba(245, 243, 238, 0.3);
  margin-bottom: 14px;
}

.mock-stats {
  @include flex-row(10px);
  margin-bottom: 16px;

  @media (min-width: 1280px) {
    gap: 14px;
    margin-bottom: 18px;
  }
}

.stat-card {
  @include flex-col(4px);
  @include flex-fill;
  background: var(--ln-surface);
  border: 1px solid var(--ln-border);
  border-radius: 10px;
  padding: 12px 14px;
}

.stat-title {
  @include text-micro;
  color: var(--ln-muted);
}

.stat-value {
  @include text-caption(700);
  color: var(--ln-white);
}

.mock-orders {
  @include flex-col(6px);
}

.mock-order {
  @include flex-row(8px);
  background: var(--ln-surface);
  border: 1px solid var(--ln-border);
  border-radius: 8px;
  padding: 8px 12px;
}

.order-num {
  @include text-micro(600);
  color: var(--ln-muted);
  flex-shrink: 0;
}

.order-name {
  @include text-micro;
  color: rgba(245, 243, 238, 0.7);
  flex: 1;
  @include truncate;
}

.order-badge {
  @include text-micro(600);
  padding: 2px 8px;
  border-radius: 20px;
  flex-shrink: 0;

  &.new {
    background: rgba(229, 90, 37, 0.2);
    color: var(--ln-accent);
  }

  &.cooking {
    background: rgba(201, 151, 58, 0.2);
    color: var(--ln-gold);
  }
}

/* Floating cards */

.floating-card {
  @include flex-col(2px);
  position: absolute;
  background: var(--ln-surface);
  border: 1px solid var(--ln-border);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
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
  color: var(--ln-white);
}

.floating-value {
  font-family: var(--heading-font-family);
  font-size: 20px;
  font-weight: 700;
  color: var(--ln-white);

  &.accent {
    color: var(--ln-accent);
  }
}

.floating-sub {
  @include text-micro;
  color: var(--color-success);
}
</style>
