<template>
  <section id="pricing" class="pricing-root">
    <div class="container">
      <span class="label">Тарифы</span>
      <h2 class="heading">Простые цены</h2>
      <p class="subtitle">
        Никаких скрытых платежей. Никаких обязательств. Первые 14 дней — бесплатно.
      </p>

      <div class="cards">
        <div v-for="plan in plans" :key="plan.name" class="card" :class="{ dark: plan.dark }">
          <div class="card-inner">
            <span v-if="plan.badge" class="badge">{{ plan.badge }}</span>
            <span class="plan-name">{{ plan.name }}</span>
            <div class="price">
              <span class="amount">{{ plan.price }}</span>
            </div>
            <span class="period">{{ plan.period }}</span>

            <ul class="features">
              <li v-for="feature in plan.features" :key="feature" class="feature">
                <Check :size="16" class="check-icon" />
                <span>{{ feature }}</span>
              </li>
            </ul>

            <button class="action" :class="{ 'action-accent': plan.dark }">
              Начать бесплатно
            </button>
          </div>
          <p v-if="plan.note" class="note">{{ plan.note }}</p>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { Check } from 'lucide-vue-next'

type Plan = {
  name: string
  price: string
  period: string
  features: string[]
  note?: string
  dark?: boolean
  badge?: string
}

const plans: Plan[] = [
  {
    name: 'Услуги',
    price: '490 ₽',
    period: 'в месяц',
    features: [
      'Конструктор сайта',
      'Каталог услуг',
      'Приём заявок',
      'Онлайн-бронирование',
      'Уведомления в Telegram',
      'Поддомен fastio.ru',
    ],
    note: 'Для мастеров, салонов, ремонтных мастерских',
  },
  {
    name: 'Бизнес',
    price: '2 490 ₽',
    period: 'в месяц',
    features: [
      'Всё из тарифа Услуги',
      'Корзина и заказы',
      'Доставка и самовывоз',
      'Модификаторы и добавки',
      'Промокоды и акции',
      'Комбо-наборы',
      'Экран кухни',
      'Заказ со стола (QR)',
      'Кастомные роли',
      'Свой домен + SSL',
    ],
    note: 'Для кафе, ресторанов и магазинов',
    dark: true,
    badge: 'Всё включено',
  },
]
</script>

<style scoped lang="scss">
@use '~/assets/styles/mixins' as *;
.pricing-root {
  padding: var(--section-spacing) 0;
  background: var(--ln-white);
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
  @include text-xs(600);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ln-accent);
  margin: 0 0 16px;

  &::before {
    content: '●';
    margin-right: 8px;
    font-size: 8px;
    vertical-align: middle;
  }
}

.heading {
  font-family: var(--heading-font-family);
  font-weight: 700;
  font-size: 24px;
  text-align: center;
  margin: 0 0 12px;

  @media (min-width: 768px) {
    font-size: 32px;
  }
}

.subtitle {
  text-align: center;
  color: var(--color-text-muted);
  @include text-body-sm;
  margin: 0 0 48px;
  max-width: 500px;
}

.cards {
  display: flex;
  flex-direction: column;
  gap: 20px;
  align-items: center;
  width: 100%;

  @media (min-width: 900px) {
    flex-direction: row;
    align-items: stretch;
    justify-content: center;
  }
}

.card {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 400px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  overflow: hidden;

  @media (min-width: 900px) {
    max-width: none;
    flex: 1;
  }

  &.dark {
    background: var(--ln-black);
    border-color: var(--ln-black);
    color: var(--ln-white);

    .plan-name {
      color: rgba(255, 255, 255, 0.7);
    }

    .amount {
      color: var(--ln-white);
    }

    .period {
      color: rgba(255, 255, 255, 0.5);
    }

    .feature {
      color: rgba(255, 255, 255, 0.85);
    }

    .check-icon {
      color: var(--ln-accent);
    }

    .note {
      color: rgba(255, 255, 255, 0.5);
    }
  }
}

.card-inner {
  padding: 32px 28px;
  display: flex;
  flex-direction: column;
  flex: 1;
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
  @include text-xs(600);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-text-muted);
  margin: 0 0 12px;
}

.price {
  margin: 0 0 4px;
}

.amount {
  font-size: 42px;
  font-weight: 700;
  font-family: var(--heading-font-family);
  color: var(--color-text);
  line-height: 1;
}

.period {
  @include text-caption;
  color: var(--color-text-muted);
  margin: 0 0 28px;
}

.features {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  margin-bottom: 28px;
}

.feature {
  display: flex;
  align-items: center;
  gap: 10px;
  @include text-caption;
  color: var(--color-text);
  line-height: 1.4;
}

.check-icon {
  color: var(--color-success);
  flex-shrink: 0;
}

.action {
  width: 100%;
  height: var(--ctrl-h);
  padding: 0 var(--ctrl-px);
  @include text-body-sm(500);
  font-family: var(--font-family);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-btn);
  background: transparent;
  color: var(--color-text);
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: var(--ln-cream);
  }

  &.action-accent {
    background: var(--ln-accent);
    border-color: var(--ln-accent);
    color: white;

    &:hover {
      background: var(--primary-hover);
    }
  }
}

.note {
  padding: 12px 28px 16px;
  @include text-xs;
  color: var(--color-text-muted);
  text-align: center;
}
</style>
