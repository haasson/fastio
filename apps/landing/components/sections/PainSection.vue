<template>
  <section class="pain-root">
    <div class="container">
      <SectionHeader label="Почему это важно">
        <template #heading>Каждый день без онлайн-заказов — это потерянные деньги</template>
      </SectionHeader>

      <div class="cards">
        <div v-for="item in items" :key="item.title" class="card">
          <div class="icon-wrap" :class="item.color">
            <component :is="item.icon" :size="24" />
          </div>
          <div class="card-body">
            <span class="card-title">{{ item.title }}</span>
            <span class="card-desc">{{ item.desc }}</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { SmartphoneNfc, Clock, BarChart3 } from 'lucide-vue-next'
import SectionHeader from './SectionHeader.vue'
import type { Component } from 'vue'

type PainItem = {
  icon: Component
  color: string
  title: string
  desc: string
}

const items: PainItem[] = [
  {
    icon: SmartphoneNfc,
    color: 'red',
    title: 'Клиент хочет выбрать сам — а не ждать ответа по телефону',
    desc: 'Посмотреть фото блюд, выбрать добавки, узнать цену доставки — и сразу оформить заказ. Без звонков, без ожидания, без «перезвоните через 5 минут». Если у вас этого нет — он закажет там, где есть.',
  },
  {
    icon: Clock,
    color: 'orange',
    title: 'Агентство возьмёт 150&nbsp;000 — и&nbsp;пропадёт на&nbsp;3&nbsp;месяца',
    desc: 'Дизайн, вёрстка, правки, ещё правки... Через полгода получите сайт-визитку без корзины. А деньги уже потрачены.',
  },
  {
    icon: BarChart3,
    color: 'red',
    title: 'Вы не знаете, что происходит с вашим бизнесом прямо сейчас',
    desc: 'Сколько заказов сегодня? Какая загрузка у филиалов? Сколько денег принесли онлайн-заказы? Без системы — это вопросы без ответов. С Fastio вы откроете админку вечером из дома и увидите всё в реальном времени.',
  },
]
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.pain-root {
  background: var(--ln-surface);
  padding: var(--section-spacing) 0;
  border-top: 1px solid var(--ln-border);
  border-bottom: 1px solid var(--ln-border);
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
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
  }
}

.card {
  @include flex-row(12px);
  align-items: flex-start;
  padding: 16px;
  background: var(--ln-black);
  border: 1px solid var(--ln-border);
  border-radius: var(--radius-card);
  transition: border-color 0.2s;

  &:hover {
    border-color: var(--border-hover);
  }

  @media (min-width: 480px) {
    gap: 16px;
    padding: 24px;
  }

  @media (min-width: 768px) {
    flex-direction: column;
    gap: 16px;
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

  &.red {
    background: rgba(239, 68, 68, 0.12);
    color: #f87171;
  }

  &.orange {
    background: rgba(229, 90, 37, 0.12);
    color: var(--ln-accent);
  }
}

.card-body {
  @include flex-col(8px);
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
</style>
