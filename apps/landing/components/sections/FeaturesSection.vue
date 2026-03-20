<template>
  <section id="features" class="features-root">
    <div class="container">
      <span class="label">Возможности</span>

      <FsHeading as="h2" align="center">
        Всё что нужно — из коробки
      </FsHeading>
      <FsText variant="body" color="secondary" align="center" class="subtitle">
        Не придётся покупать дополнительные модули или доплачивать за базовые функции.
      </FsText>

      <div class="grid">
        <div v-for="feature in features" :key="feature.title" class="card">
          <div class="icon">
            <component :is="feature.icon" :size="22" />
          </div>
          <FsText as="span" variant="label" class="title">{{ feature.title }}</FsText>
          <FsText variant="body-sm" color="muted">{{ feature.desc }}</FsText>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { FsHeading, FsText } from '@fastio/public-ui'
import {
  UtensilsCrossed,
  ShoppingCart,
  Palette,
  MapPin,
  Smartphone,
  BarChart3,
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
    desc: 'Настройте цвета, шрифты и стиль под ваш бренд. Без дизайнера.',
  },
  {
    icon: MapPin,
    title: 'Зоны доставки',
    desc: 'Настройте зоны, стоимость доставки и минимальный заказ для каждой зоны.',
  },
  {
    icon: Smartphone,
    title: 'Мобильная версия',
    desc: 'Сайт отлично работает на любом устройстве — телефоне, планшете, компьютере.',
  },
  {
    icon: BarChart3,
    title: 'Аналитика',
    desc: 'Отслеживайте заказы, популярные блюда и выручку в реальном времени.',
  },
]
</script>

<style scoped lang="scss">
.features-root {
  background: var(--ln-white, #fff);
  padding: var(--section-spacing, 64px) 0;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
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

.subtitle {
  margin-top: 12px;
  margin-bottom: 40px;
  max-width: 560px;
}

.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  width: 100%;

  @media (min-width: 480px) {
    grid-template-columns: repeat(2, 1fr);
    gap: 20px;
  }
}

.card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 20px;
  border-radius: 8px;
  background: var(--ln-cream, #f9f8f6);
  border: 1px solid var(--color-border, #eee);
}

.icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: var(--primary-subtle);
  color: var(--primary);
  flex-shrink: 0;
  opacity: 0.85;
}

.title {
  font-weight: 600;
}

@media (min-width: 1024px) {
  .container {
    padding: 0 24px;
  }

  .grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
  }

  .card {
    padding: 28px;
    gap: 10px;
  }
}
</style>
