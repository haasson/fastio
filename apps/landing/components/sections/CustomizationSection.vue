<template>
  <section class="custom-root">
    <div class="container">
      <SectionHeader label="Кастомизация">
        <template #heading>Конструктор — не значит <em>одинаковый</em></template>
        <template #subtitle>
          Вы думаете, что ваш сайт будет как у соседнего кафе? Нет.
          Мы даём обширные возможности кастомизации — от палитры до шрифтов.
        </template>
      </SectionHeader>

      <div class="showcase">
        <div class="example example-light">
          <div class="example-header">
            <span class="example-tag light">Светлая тема</span>
            <span class="example-name">Детский сад «Солнышко»</span>
          </div>
          <div class="example-body">
            <div class="mock-btn light-btn">Записаться</div>
            <div class="mock-colors">
              <span class="dot" style="background: #f59e0b" />
              <span class="dot" style="background: #34d399" />
              <span class="dot" style="background: #f9fafb" />
            </div>
            <span class="mock-font">Округлый, дружелюбный шрифт</span>
          </div>
        </div>

        <div class="example example-dark">
          <div class="example-header">
            <span class="example-tag dark">Тёмная тема</span>
            <span class="example-name">Bar «Black Smoke»</span>
          </div>
          <div class="example-body">
            <div class="mock-btn dark-btn">Забронировать</div>
            <div class="mock-colors">
              <span class="dot" style="background: #ef4444" />
              <span class="dot" style="background: #1c1917" />
              <span class="dot" style="background: #a8a29e" />
            </div>
            <span class="mock-font">Рубленый, брутальный шрифт</span>
          </div>
        </div>
      </div>

      <div class="features">
        <div v-for="item in items" :key="item.title" class="feature">
          <component :is="item.icon" :size="20" class="feature-icon" />
          <div class="feature-body">
            <span class="feature-title">{{ item.title }}</span>
            <span class="feature-desc">{{ item.desc }}</span>
          </div>
        </div>
      </div>

      <p class="corporate-note">
        <Sparkles :size="16" class="sparkle-icon" />
        Нужна точная палитра под ваш бренд? Мы создадим индивидуальную тему
        с вашими корпоративными цветами — бесплатно.
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { Palette, Type, LayoutGrid, Sparkles } from 'lucide-vue-next'
import SectionHeader from './SectionHeader.vue'
import type { Component } from 'vue'

type FeatureItem = {
  icon: Component
  title: string
  desc: string
}

const items: FeatureItem[] = [
  {
    icon: Palette,
    title: 'Множество тем',
    desc: 'Светлые, тёмные, цветные — выбирайте готовую тему или настраивайте под себя.',
  },
  {
    icon: Type,
    title: 'Шрифты на любой вкус',
    desc: 'От мягких округлых до строгих рубленых. Каждый шрифт меняет характер сайта.',
  },
  {
    icon: LayoutGrid,
    title: 'Гибкая структура страниц',
    desc: 'Включайте и выключайте секции, меняйте порядок блоков, настраивайте контент.',
  },
]
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.custom-root {
  background: var(--ln-surface);
  padding: var(--section-spacing) 0;
  border-top: 1px solid var(--ln-border);
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 16px;
  display: flex;
  flex-direction: column;
  align-items: center;

  @media (min-width: 768px) {
    padding: 0 32px;
  }
}

.showcase {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  width: 100%;
  max-width: 700px;
  margin-bottom: 40px;

  @media (min-width: 640px) {
    grid-template-columns: repeat(2, 1fr);
  }
}

.example {
  border-radius: var(--radius-card);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;

  @media (min-width: 480px) {
    padding: 24px;
    gap: 20px;
  }
}

.example-light {
  background: #fefce8;
  border: 1px solid #fde68a;
}

.example-dark {
  background: #1c1917;
  border: 1px solid #44403c;
}

.example-header {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.example-tag {
  @include text-xs(600);
  text-transform: uppercase;
  letter-spacing: 0.05em;

  &.light {
    color: #92400e;
  }

  &.dark {
    color: #a8a29e;
  }
}

.example-name {
  @include text-caption(600);

  .example-light & {
    color: #1c1917;
  }

  .example-dark & {
    color: #fafaf9;
  }
}

.example-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mock-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 20px;
  @include text-caption(500);
  width: fit-content;

  &.light-btn {
    background: #f59e0b;
    color: white;
    border-radius: 20px;
  }

  &.dark-btn {
    background: #ef4444;
    color: white;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
}

.mock-colors {
  display: flex;
  gap: 8px;
}

.dot {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid rgba(128, 128, 128, 0.2);
}

.mock-font {
  @include text-xs;

  .example-light & {
    color: #78716c;
  }

  .example-dark & {
    color: #78716c;
  }
}

.features {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  width: 100%;
  max-width: 700px;
  margin-bottom: 32px;

  @media (min-width: 640px) {
    grid-template-columns: repeat(3, 1fr);
  }
}

.feature {
  display: flex;
  flex-direction: row;
  gap: 12px;
  align-items: flex-start;

  @media (min-width: 640px) {
    flex-direction: column;
  }
}

.feature-icon {
  color: var(--ln-accent);
  flex-shrink: 0;
  margin-top: 2px;

  @media (min-width: 640px) {
    margin-top: 0;
  }
}

.feature-body {
  @include flex-col(4px);
}

.feature-title {
  @include text-caption(600);
  color: var(--ln-white);
}

.feature-desc {
  @include text-xs;
  color: var(--ln-muted);
  line-height: 1.5;
}

.corporate-note {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 16px;
  border-radius: var(--radius-card);
  border: 1px solid rgba(229, 90, 37, 0.3);
  background: rgba(229, 90, 37, 0.06);
  @include text-caption;
  color: rgba(245, 243, 238, 0.8);
  max-width: 700px;
  line-height: 1.5;
  margin: 0;
}

.sparkle-icon {
  color: var(--ln-accent);
  flex-shrink: 0;
}
</style>
