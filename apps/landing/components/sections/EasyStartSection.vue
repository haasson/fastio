<template>
  <section class="easy-root">
    <div class="container">
      <SectionHeader label="Не страшно">
        <template #heading>Боитесь, что будет сложно?<br><em>Мы ведём за руку до первых продаж</em></template>
        <template #subtitle>
          Большинство наших клиентов никогда не запускали сайт самостоятельно.
          Нам важно, чтобы ваш бизнес был успешен — поэтому мы не бросаем вас на полпути.
        </template>
      </SectionHeader>

      <div class="grid">
        <div v-for="item in items" :key="item.title" class="card" :class="{ featured: item.featured }">
          <div class="icon-wrap">
            <component :is="item.icon" :size="22" />
          </div>
          <div class="card-body">
            <span class="card-title">{{ item.title }}</span>
            <span class="card-desc">{{ item.desc }}</span>
          </div>
        </div>
      </div>

      <div class="cta-row">
        <p class="cta-text">Застряли? Напишите — ответим за несколько минут</p>
        <FsButton as="a" href="#contact" variant="primary">
          Написать в поддержку
        </FsButton>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { FsButton } from '@fastio/public-ui'
import { Lightbulb, MapIcon, Headphones, PlayCircle, Bot, Wand2 } from 'lucide-vue-next'
import SectionHeader from './SectionHeader.vue'
import type { Component } from 'vue'

type Item = {
  icon: Component
  title: string
  desc: string
  featured?: boolean
}

const items: Item[] = [
  {
    icon: Lightbulb,
    title: 'Подсказки на каждом шаге',
    desc: 'В каждом разделе панели есть контекстные подсказки — что это, зачем и как заполнить. Не нужно ничего гуглить.',
  },
  {
    icon: MapIcon,
    title: 'Виртуальный тур для каждого действия',
    desc: 'Не один приветственный тур, а отдельный для каждого флоу: добавить блюдо, настроить доставку, запустить акцию — везде есть пошаговый тур.',
  },
  {
    icon: PlayCircle,
    title: 'Видеоуроки для каждого флоу',
    desc: 'Как добавить меню, настроить доставку, создать акцию — короткое видео прямо рядом с нужным разделом.',
  },
  {
    icon: Headphones,
    title: 'Поддержка прямо в админке',
    desc: 'Чат с поддержкой встроен в панель управления — не нужно никуда переходить. Застряли — написали, ответили.',
  },
  {
    icon: Bot,
    title: 'AI-ассистент в панели управления',
    desc: 'Спросите что угодно — как работает доставка, почему не принимаются заказы, как настроить промокод.',
  },
  {
    icon: Wand2,
    title: 'Ваши идеи → новый функционал за дни',
    desc: 'Написали об идее в поддержку — через пару дней уже пользуетесь. Мы прислушиваемся к каждому клиенту и выпускаем обновления быстро. Без доплат.',
    featured: true,
  },
]
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.easy-root {
  background: var(--ln-black);
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

.grid,
.cta-row {
  width: 100%;
}

.grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;

  @media (min-width: 640px) {
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }

  @media (min-width: 1024px) {
    grid-template-columns: repeat(3, 1fr);
  }
}

.card {
  @include flex-row(12px);
  align-items: flex-start;
  padding: 16px;

  @media (min-width: 480px) {
    gap: 16px;
    padding: 20px;
  }
  background: var(--ln-surface);
  border: 1px solid var(--ln-border);
  border-radius: var(--radius-card);
  transition: border-color 0.2s;

  &:hover {
    border-color: var(--border-hover);
  }

  &.featured {
    border-color: rgba(229, 90, 37, 0.3);
    background: rgba(229, 90, 37, 0.04);

    &:hover {
      border-color: rgba(229, 90, 37, 0.55);
    }
  }

  @media (min-width: 1024px) {
    // AI-ассистент занимает всю ширину последней строки (5-й элемент в сетке 3 колонки)
    &:last-child {
      grid-column: span 1;
    }
  }

  @media (min-width: 640px) {
    flex-direction: column;
    gap: 14px;
  }
}

.icon-wrap {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: rgba(229, 90, 37, 0.1);
  color: var(--ln-accent);

  .featured & {
    background: rgba(229, 90, 37, 0.15);
  }
}

.card-body {
  @include flex-col(6px);
}

.card-title {
  @include text-caption(600);
  color: var(--ln-white);
  line-height: 1.4;
}

.card-desc {
  @include text-caption;
  color: var(--ln-muted);
  line-height: 1.6;
}

.cta-row {
  @include flex-col(16px);
  align-items: flex-start;
  margin-top: 24px;
  padding-top: 24px;

  @media (min-width: 640px) {
    margin-top: 36px;
    padding-top: 32px;
  }
  border-top: 1px solid var(--ln-border);

  @media (min-width: 640px) {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}

.cta-text {
  @include text-body-sm;
  color: var(--color-text-secondary);
  margin: 0;
}


</style>
