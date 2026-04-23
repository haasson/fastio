<template>
  <section id="how-it-works" class="how-root">
    <div class="container">
      <SectionHeader label="Как начать">
        <template #heading>Сайт с онлайн-заказами за&nbsp;5&nbsp;минут</template>
        <template #subtitle>Зарегистрируйтесь, заполните меню — и принимайте заказы. Без менеджеров и ожиданий.</template>
      </SectionHeader>

      <div class="layout">
        <div class="steps">
          <div v-for="(step, i) in steps" :key="step.title" class="step">
            <div class="number">{{ i + 1 }}</div>
            <div class="step-content">
              <span class="step-title">{{ step.title }}</span>
              <span class="step-desc">{{ step.desc }}</span>
            </div>
          </div>

          <FsButton as="a" href="#try" variant="primary">
            Начать бесплатно
          </FsButton>
        </div>

        <!-- Visual -->
        <div class="visual">
          <div class="timeline">
            <div class="tl-item">
              <div class="tl-dot active" />
              <div class="tl-content">
                <span class="tl-time">Сегодня, 10:00</span>
                <div class="tl-bubble">Заполнили форму регистрации</div>
              </div>
            </div>
            <div class="tl-item">
              <div class="tl-dot" />
              <div class="tl-content">
                <span class="tl-time">Сегодня, 10:05</span>
                <div class="tl-bubble">Подтвердили почту, вошли в кабинет</div>
              </div>
            </div>
            <div class="tl-item">
              <div class="tl-dot" />
              <div class="tl-content">
                <span class="tl-time">Сегодня, 12:00</span>
                <div class="tl-bubble">Загрузили меню, настроили сайт</div>
              </div>
            </div>
            <div class="tl-item tl-item-done">
              <div class="tl-dot done" />
              <div class="tl-content">
                <span class="tl-time">Сегодня, 14:00</span>
                <div class="tl-bubble success">
                  <span>Первый онлайн-заказ принят 🎉</span>
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
import { FsButton } from '@fastio/public-ui'
import SectionHeader from './SectionHeader.vue'

type Step = {
  title: string
  desc: string
}

const steps: Step[] = [
  {
    title: 'Регистрируетесь',
    desc: 'Заполняете форму: название, адрес сайта, email. Занимает 2 минуты.',
  },
  {
    title: 'Настраиваете сайт',
    desc: 'Загружаете меню, выбираете тему, настраиваете доставку — всё через простую панель.',
  },
  {
    title: 'Принимаете заказы',
    desc: 'Ваш сайт готов к работе. Уведомления о заказах — сразу в Telegram.',
  },
]
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.how-root {
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

.layout {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 32px;

  @media (min-width: 768px) {
    gap: 48px;
  }

  @media (min-width: 1024px) {
    flex-direction: row;
    align-items: flex-start;
    gap: 64px;
  }
}

.steps {
  @include flex-col(0);

  @media (min-width: 1024px) {
    flex: 1;
  }
}

.step {
  @include flex-row(20px);
  align-items: flex-start;
  padding: 20px 0;
  border-bottom: 1px solid var(--ln-border);

  &:first-child {
    padding-top: 0;
  }
}

.number {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--ln-accent);
  color: #fff;
  @include text-caption(700);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-family: var(--heading-font-family);
}

.step-content {
  @include flex-col(6px);
  padding-top: 2px;
}

.step-title {
  @include text-body-sm(600);
  color: var(--ln-white);
}

.step-desc {
  @include text-caption;
  color: var(--ln-muted);
  line-height: 1.6;
}

/* Timeline */

.visual {
  @media (min-width: 1024px) {
    flex: 1;
    padding-top: 0;
  }
}

.timeline {
  @include flex-col(0);
  position: relative;
  padding-left: 20px;
}

.tl-item {
  @include flex-row(16px);
  align-items: flex-start;
  position: relative;
  padding-bottom: 28px;

  &:last-child {
    padding-bottom: 0;
  }

  &::before {
    content: '';
    position: absolute;
    left: -13px;
    top: 16px;
    bottom: 0;
    width: 1px;
    background: var(--ln-border);
  }

  &:last-child::before {
    display: none;
  }
}

.tl-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--ln-border);
  border: 2px solid var(--ln-surface);
  flex-shrink: 0;
  margin-top: 4px;
  position: relative;
  left: -19px;
  margin-right: -7px;

  &.active {
    background: var(--ln-accent);
    border-color: var(--ln-surface);
    box-shadow: 0 0 0 3px rgba(229, 90, 37, 0.2);
  }

  &.done {
    background: var(--color-success);
    border-color: var(--ln-surface);
  }
}

.tl-content {
  @include flex-col(6px);
  flex: 1;
}

.tl-time {
  @include text-xs;
  color: var(--ln-muted);
}

.tl-bubble {
  display: inline-block;
  padding: 10px 14px;
  background: var(--ln-black);
  border: 1px solid var(--ln-border);
  border-radius: 10px;
  @include text-caption;
  color: var(--ln-white);

  &.success {
    background: rgba(16, 185, 129, 0.08);
    border-color: rgba(16, 185, 129, 0.25);
    color: #4ade80;
    font-weight: 600;
  }
}
</style>
