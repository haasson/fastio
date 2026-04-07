<template>
  <section id="pricing" class="pricing-root">
    <div class="container">
      <SectionHeader label="Тарифы">
        <template #heading>Вы удивитесь, насколько это дёшево</template>
        <template #subtitle>Тариф окупается с первых же онлайн-заказов. Никаких скрытых платежей.</template>
      </SectionHeader>

      <p class="note-text">
        Fastio создан для общепита и крупных заведений, но мы оставили доступный тариф
        для частных мастеров и небольших сервисов — чтобы классный инструмент
        был у каждого.
      </p>

      <div class="cards">
        <div v-for="plan in plans" :key="plan.name" class="card" :class="{ featured: plan.featured }">
          <div class="card-inner">
            <span v-if="plan.badge" class="badge">{{ plan.badge }}</span>
            <span class="plan-name">{{ plan.name }}</span>
            <p class="plan-desc">{{ plan.desc }}</p>

            <div class="price-wrap">
              <div class="price">
                <span class="amount">{{ plan.price }}</span>
                <span class="period">/ мес</span>
              </div>
              <span class="per-year">{{ plan.perYear }} в год</span>
            </div>

            <ul class="features">
              <li v-for="feature in plan.features" :key="feature" class="feature">
                <Check :size="15" class="check-icon" />
                <span>{{ feature }}</span>
              </li>
            </ul>

            <FsButton as="a" href="#contact" :variant="plan.featured ? 'primary' : 'outline'" class="action">
              Оставить заявку
            </FsButton>
          </div>
          <p v-if="plan.note" class="note">{{ plan.note }}</p>
        </div>
      </div>

      <div class="compare-hint">
        <span>Агентство возьмёт</span>
        <span class="compare-old">150 000 — 300 000 ₽</span>
        <span>за то, что Fastio даёт с первого дня</span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { FsButton } from '@fastio/public-ui'
import { Check } from 'lucide-vue-next'
import SectionHeader from './SectionHeader.vue'

type Plan = {
  name: string
  desc: string
  price: string
  perYear: string
  features: string[]
  note?: string
  featured?: boolean
  badge?: string
}

const plans: Plan[] = [
  {
    name: 'Услуги',
    desc: 'Для мастеров, салонов и сервисов',
    price: '490 ₽',
    perYear: '5 880 ₽',
    features: [
      'Конструктор сайта',
      'Каталог услуг',
      'Приём заявок онлайн',
      'Онлайн-бронирование',
      'Уведомления в Telegram',
      'Поддомен fastio.ru',
    ],
  },
  {
    name: 'Бизнес',
    desc: 'Для кафе, ресторанов и магазинов',
    price: '2 490 ₽',
    perYear: '29 880 ₽',
    badge: 'Популярный',
    featured: true,
    features: [
      'Всё из тарифа Услуги',
      'Корзина и онлайн-заказы',
      'Доставка и самовывоз',
      'Модификаторы и добавки',
      'Промокоды и акции',
      'Комбо-наборы',
      'Экран кухни',
      'Заказ со стола (QR)',
      'Кастомные роли сотрудников',
      'Свой домен + SSL',
    ],
    note: 'Окупается уже с первой недели онлайн-заказов',
  },
]
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;

.pricing-root {
  padding: var(--section-spacing) 0;
  background: var(--ln-black);
  border-top: 1px solid var(--ln-border);

  :deep(.section-header-root) {
    margin-bottom: 16px;
  }
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

.note-text {
  text-align: center;
  @include text-caption;
  color: var(--ln-muted);
  max-width: 520px;
  margin: 0 0 48px;
  line-height: 1.5;
}

.cards {
  display: flex;
  flex-direction: column;
  gap: 20px;
  align-items: center;
  width: 100%;
  max-width: 900px;

  @media (min-width: 768px) {
    flex-direction: row;
    align-items: stretch;
    justify-content: center;
  }
}

.card {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 420px;
  background: var(--ln-surface);
  border: 1px solid var(--ln-border);
  border-radius: 16px;
  overflow: hidden;
  transition: border-color 0.2s;

  &:hover {
    border-color: var(--border-hover);
  }

  @media (min-width: 768px) {
    max-width: none;
    flex: 1;
  }

  &.featured {
    border-color: rgba(229, 90, 37, 0.4);
    background: var(--ln-surface-2);

    &:hover {
      border-color: var(--ln-accent);
    }
  }
}

.card-inner {
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  flex: 1;

  @media (min-width: 480px) {
    padding: 28px 24px;
  }

  @media (min-width: 768px) {
    padding: 32px 28px;
  }
}

.badge {
  align-self: flex-start;
  background: var(--ln-accent);
  color: white;
  @include text-xs(600);
  padding: 4px 12px;
  border-radius: 20px;
  margin: 0 0 16px;
}

.plan-name {
  font-family: var(--heading-font-family);
  font-size: 20px;
  font-weight: 700;
  color: var(--ln-white);
  margin: 0 0 6px;
}

.plan-desc {
  @include text-caption;
  color: var(--ln-muted);
  margin: 0 0 20px;
}

.price-wrap {
  @include flex-col(4px);
  margin-bottom: 24px;
}

.price {
  @include flex-row(6px);
  align-items: baseline;
}

.amount {
  font-size: 32px;
  font-weight: 700;

  @media (min-width: 480px) {
    font-size: 40px;
  }
  font-family: var(--heading-font-family);
  color: var(--ln-white);
  line-height: 1;
}

.period {
  @include text-caption;
  color: var(--ln-muted);
}

.per-year {
  @include text-xs;
  color: var(--ln-muted);
}

.features {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
  margin-bottom: 24px;
}

.feature {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  @include text-caption;
  color: rgba(245, 243, 238, 0.8);
  line-height: 1.4;
}

.check-icon {
  color: var(--ln-accent);
  flex-shrink: 0;
  margin-top: 1px;
}

.action {
  width: 100%;
}

.note {
  padding: 12px 24px 16px;
  @include text-xs;
  color: rgba(229, 90, 37, 0.7);
  text-align: center;
  border-top: 1px solid var(--ln-border);
}

.compare-hint {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 32px;
  @include text-caption;
  color: var(--ln-muted);
}

.compare-old {
  @include text-caption(600);
  color: #f87171;
  text-decoration: line-through;
}
</style>
