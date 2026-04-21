<template>
  <section class="compare-root">
    <div class="container">
      <SectionHeader label="Считаем вместе" dark>
        <template #heading>Во сколько на самом деле обходится сайт</template>
        <template #subtitle>Прежде чем звонить в агентство — посчитайте реальную стоимость</template>
      </SectionHeader>

      <div class="cards">
        <!-- Agency -->
        <div class="card card-agency">
          <div class="card-header">
            <span class="card-tag bad">Агентство / фрилансер</span>
            <span class="card-subtitle">Разработка под ключ</span>
          </div>
          <ul class="items">
            <li v-for="item in agencyItems" :key="item.label" class="item">
              <span class="item-label">{{ item.label }}</span>
              <span class="item-value bad">{{ item.value }}</span>
            </li>
          </ul>
          <div class="total total-bad">
            <span class="total-label">Итого за первый год</span>
            <span class="total-value">250 000 — 500 000 ₽</span>
          </div>
          <div class="deadline">
            <Clock :size="14" />
            <span>Срок запуска: 1.5 — 4 месяца</span>
          </div>
        </div>

        <!-- Fastio -->
        <div class="card card-fastio">
          <div class="card-header">
            <span class="card-tag good">Fastio</span>
            <span class="card-subtitle">Готово к работе за&nbsp;1&nbsp;день</span>
          </div>
          <ul class="items">
            <li v-for="item in fastioItems" :key="item.label" class="item">
              <span class="item-label">{{ item.label }}</span>
              <span class="item-value good">{{ item.value }}</span>
            </li>
          </ul>
          <div class="total total-good">
            <span class="total-label">Итого за первый год</span>
            <span class="total-value">29 880 ₽</span>
          </div>
          <div class="deadline">
            <Zap :size="14" />
            <span>Срок запуска: 1 день</span>
          </div>
          <FsButton as="a" href="#contact" variant="primary">
            Подключиться
          </FsButton>
        </div>
      </div>

      <p class="footnote">
        * Цены на разработку — средние по рынку для небольших заведений (кафе, ресторан, салон).
        Реальные цифры могут отличаться.
      </p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { FsButton } from '@fastio/public-ui'
import { Clock, Zap } from 'lucide-vue-next'
import SectionHeader from './SectionHeader.vue'

type CompareItem = {
  label: string
  value: string
}

const agencyItems: CompareItem[] = [
  { label: 'Разработка и вёрстка', value: '80 000 — 200 000 ₽' },
  { label: 'Дизайн', value: '30 000 — 80 000 ₽' },
  { label: 'Хостинг + SSL', value: '2 000 — 5 000 ₽/мес' },
  { label: 'Поддержка и обновления', value: '5 000 — 15 000 ₽/мес' },
  { label: 'Правки после сдачи', value: '5 000 — 20 000 ₽' },
]

const fastioItems: CompareItem[] = [
  { label: 'Подключение', value: 'Бесплатно' },
  { label: 'Тариф Бизнес', value: '2 490 ₽/мес' },
  { label: 'Хостинг + SSL', value: 'Включено' },
  { label: 'Поддержка', value: 'Включено' },
  { label: 'Обновления и новые функции', value: 'Включено' },
]
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.compare-root {
  background: var(--ln-cream);
  padding: var(--section-spacing) 0;
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

.cards {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;

  @media (min-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
    gap: 24px;
  }
}

.card {
  border-radius: 16px;
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  gap: 0;

  @media (min-width: 480px) {
    padding: 28px;
  }

  @media (min-width: 768px) {
    padding: 36px;
  }
}

.card-agency {
  background: #fff;
  border: 1px solid #e2dfd8;
}

.card-fastio {
  background: var(--ln-black);
  border: 1px solid rgba(229, 90, 37, 0.3);
}

.card-header {
  @include flex-col(6px);
  margin-bottom: 24px;
}

.card-tag {
  display: inline-block;
  align-self: flex-start;
  @include text-xs(600);
  padding: 4px 12px;
  border-radius: 20px;

  &.bad {
    background: rgba(239, 68, 68, 0.1);
    color: #dc2626;
  }

  &.good {
    background: rgba(229, 90, 37, 0.15);
    color: var(--ln-accent);
  }
}

.card-subtitle {
  @include text-caption;
  color: #888;

  .card-fastio & {
    color: var(--ln-muted);
  }
}

.items {
  list-style: none;
  padding: 0;
  margin: 0 0 20px;
  @include flex-col(0);
}

.item {
  @include flex-between;
  padding: 12px 0;
  border-bottom: 1px solid #f0ede8;
  gap: 12px;

  .card-fastio & {
    border-bottom-color: var(--ln-border);
  }
}

.item-label {
  @include text-caption;
  color: #4a4744;

  .card-fastio & {
    color: rgba(245, 243, 238, 0.7);
  }
}

.item-value {
  @include text-caption(600);
  white-space: nowrap;

  &.bad {
    color: #dc2626;
  }

  &.good {
    color: var(--ln-accent);
  }

  .card-fastio .item-value.good {
    color: #4ade80;
  }
}

.card-fastio .item-value.good {
  color: #4ade80;
}

.total {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 16px;
  border-radius: 10px;
  margin-bottom: 12px;

  @media (min-width: 480px) {
    @include flex-between;
    gap: 12px;
    padding: 16px;
  }
}

.total-bad {
  background: rgba(239, 68, 68, 0.06);
  border: 1px solid rgba(239, 68, 68, 0.15);
}

.total-good {
  background: rgba(229, 90, 37, 0.1);
  border: 1px solid rgba(229, 90, 37, 0.25);
}

.total-label {
  @include text-caption(500);
  color: #4a4744;

  .card-fastio & {
    color: rgba(245, 243, 238, 0.7);
  }
}

.total-value {
  font-family: var(--heading-font-family);
  font-size: 16px;
  font-weight: 700;

  @media (min-width: 480px) {
    font-size: 18px;
  }

  .total-bad & {
    color: #dc2626;
  }

  .total-good & {
    color: var(--ln-accent);
  }
}

.deadline {
  @include flex-row(6px);
  @include text-xs;
  color: #888;
  margin-bottom: 0;

  .card-fastio & {
    color: var(--ln-muted);
  }
}

.footnote {
  margin-top: 20px;
  @include text-xs;
  color: #aaa;
}
</style>
