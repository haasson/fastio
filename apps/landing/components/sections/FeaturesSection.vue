<template>
  <section id="features" class="features-root">
    <div class="container">
      <SectionHeader label="Возможности">
        <template #heading>Всё что нужно — из коробки</template>
        <template #subtitle>Никаких дополнительных модулей и скрытых доплат за базовые функции.</template>
      </SectionHeader>

      <div class="grid">
        <div v-for="feature in features" :key="feature.title" class="card">
          <div class="icon">
            <component :is="feature.icon" :size="22" />
          </div>
          <span class="title">{{ feature.title }}</span>
          <span class="desc">{{ feature.desc }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import SectionHeader from './SectionHeader.vue'
import {
  UtensilsCrossed,
  ShoppingCart,
  Palette,
  MapPin,
  Smartphone,
  BarChart3,
  QrCode,
  Tag,
} from 'lucide-vue-next'
import type { Component } from 'vue'

type Feature = {
  icon: Component
  title: string
  desc: string
}

const features: Feature[] = [
  {
    icon: UtensilsCrossed,
    title: 'Меню с фото',
    desc: 'Загрузите блюда, добавьте фото, описания и цены. Клиенты увидят красивое меню.',
  },
  {
    icon: ShoppingCart,
    title: 'Корзина и заказы',
    desc: 'Удобная корзина, оформление заказа, выбор доставки или самовывоза.',
  },
  {
    icon: Palette,
    title: 'Свой дизайн',
    desc: 'Настройте цвета, шрифты и стиль под ваш бренд — без дизайнера.',
  },
  {
    icon: MapPin,
    title: 'Зоны доставки',
    desc: 'Настройте зоны, стоимость доставки и минимальный заказ для каждой зоны.',
  },
  {
    icon: QrCode,
    title: 'QR-меню со стола',
    desc: 'Гость сканирует QR-код и заказывает со своего телефона. Без ошибок официанта.',
  },
  {
    icon: Tag,
    title: 'Промокоды и акции',
    desc: 'Создавайте скидки, запускайте акции и управляйте ими из панели управления.',
  },
  {
    icon: Smartphone,
    title: 'Мобильная версия',
    desc: 'Сайт отлично работает на телефоне, планшете и компьютере без каких-либо правок.',
  },
  {
    icon: BarChart3,
    title: 'Аналитика',
    desc: 'Отслеживайте заказы, популярные блюда и выручку в реальном времени.',
  },
]
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.features-root {
  background: var(--ln-black);
  padding: var(--section-spacing) 0;
}

.container {
  @include flex-col;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 16px;

  @media (min-width: 1024px) {
    padding: 0 32px;
  }
}

.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  width: 100%;

  @media (min-width: 480px) {
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }

  @media (min-width: 1024px) {
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
  }
}

.card {
  @include flex-col(10px);
  padding: 20px;
  border-radius: var(--radius-card);
  background: var(--ln-surface);
  border: 1px solid var(--ln-border);
  transition: border-color 0.2s;

  &:hover {
    border-color: var(--border-hover);
  }

  @media (min-width: 1024px) {
    padding: 24px;
  }
}

.icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: rgba(229, 90, 37, 0.12);
  color: var(--ln-accent);
  flex-shrink: 0;
}

.title {
  @include text-caption(600);
  color: var(--ln-white);
}

.desc {
  @include text-caption;
  color: var(--ln-muted);
  line-height: 1.6;
}
</style>
