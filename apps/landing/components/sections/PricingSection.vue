<template>
  <section id="pricing" class="pricing-root">
    <div class="container">
      <SectionHeader label="Тарифы">
        <template #heading>Вы удивитесь, насколько это дёшево</template>
        <template #subtitle>Тариф окупается с первых же онлайн-заказов. Никаких скрытых платежей.</template>
      </SectionHeader>

      <div class="switcher">
        <button
          class="switcher-btn"
          :class="{ active: activeType === 'retail' }"
          @click="activeType = 'retail'"
        >
          Магазины и рестораны
        </button>
        <button
          class="switcher-btn"
          :class="{ active: activeType === 'services' }"
          @click="activeType = 'services'"
        >
          Услуги и запись
        </button>
      </div>

      <div class="cards">
        <div
          v-for="plan in activePlans"
          :key="plan.key"
          class="card"
          :class="{ featured: plan.is_featured }"
        >
          <div class="card-inner">
            <div class="plan-header">
              <span class="plan-name">{{ plan.name }}</span>
              <span v-if="plan.badge" class="badge">{{ plan.badge }}</span>
            </div>
            <p class="plan-desc">{{ plan.description }}</p>

            <div class="price-wrap">
              <div class="price">
                <span class="amount">{{ plan.price > 0 ? `${plan.price.toLocaleString('ru')} ₽` : 'Бесплатно' }}</span>
                <span v-if="plan.price > 0" class="period">/ мес</span>
              </div>
            </div>

            <ul class="features">
              <li v-if="prevPlanName(plan)" class="feature feature-inherited">
                <Check :size="15" class="check-icon" />
                <span>Всё из тарифа {{ prevPlanName(plan) }}</span>
              </li>
              <li v-for="label in featureLabels(plan)" :key="label" class="feature">
                <Check :size="15" class="check-icon" />
                <span>{{ label }}</span>
              </li>
            </ul>

            <FsButton as="a" href="#contact" :variant="plan.is_featured ? 'primary' : 'outline'" class="action">
              Оставить заявку
            </FsButton>
          </div>
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
import { ref, computed } from 'vue'
import { FsButton } from '@fastio/public-ui'
import { extractPlanTier, getPlanTierOrder } from '@fastio/shared'
import { Check } from 'lucide-vue-next'
import SectionHeader from './SectionHeader.vue'
import type { LandingPlanRow } from '~/types/plan'

type PlanRow = LandingPlanRow

const BASE_FEATURES: Record<string, string[]> = {
  retail: ['Конструктор сайта', 'Каталог товаров и блюд', 'Кастомный домен', 'Тема и дизайн'],
  services: ['Конструктор сайта', 'Каталог услуг', 'Кастомный домен', 'Тема и дизайн'],
}

const MODULE_LABELS: Record<string, string> = {
  delivery: 'Доставка',
  pickup: 'Самовывоз',
  modifiers: 'Модификаторы блюд',
  addons: 'Добавки к заказу',
  promotions: 'Акции и промокоды',
  combos: 'Комбо-наборы',
  kitchen: 'Экран кухни (KDS)',
  dineIn: 'QR-столы и зал',
  reservations: 'Бронирование столиков',
  services: 'Онлайн-запись',
  branches: 'Несколько филиалов',
  customRoles: 'Кастомные роли',
  customers: 'База клиентов',
  team: 'Управление командой',
}

const props = defineProps<{ plans: PlanRow[] }>()

const activeType = ref<'retail' | 'services'>('retail')

const activePlans = computed(() =>
  props.plans.filter((p) => p.business_type === activeType.value),
)

const prevPlanName = (plan: PlanRow): string | null => {
  const order = getPlanTierOrder(plan.key)
  if (order === 0) return null
  const prev = props.plans
    .filter((p) => p.business_type === plan.business_type && getPlanTierOrder(p.key) === order - 1)
    .at(0)
  return prev?.name ?? null
}

const featureLabels = (plan: PlanRow): string[] => {
  if (extractPlanTier(plan.key) === 'showcase') {
    return BASE_FEATURES[plan.business_type] ?? BASE_FEATURES.retail
  }

  const f = plan.features
  const labels: string[] = []

  if (f.modules) {
    for (const [key, val] of Object.entries(f.modules)) {
      if (val && MODULE_LABELS[key]) labels.push(MODULE_LABELS[key])
    }
  }
  if (f.site?.telegramNotifications) labels.push('Уведомления в Telegram')
  if (f.menu?.virtualCategories) labels.push('Виртуальные категории')
  if (f.menu?.ingredients) labels.push('Состав блюд')
  if (f.resources?.max !== undefined) {
    labels.push(f.resources.max === 0 ? 'Без лимита ресурсов' : `До ${f.resources.max} активных ресурсов`)
  }

  return labels
}
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

.switcher {
  display: flex;
  background: var(--ln-surface);
  border: 1px solid var(--ln-border);
  border-radius: 10px;
  padding: 4px;
  gap: 4px;
  margin-bottom: 40px;
}

.switcher-btn {
  padding: 8px 20px;
  border-radius: 7px;
  border: none;
  background: transparent;
  color: var(--ln-muted);
  @include text-caption(500);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;

  &.active {
    background: var(--ln-surface-2);
    color: var(--ln-white);
  }

  &:hover:not(.active) {
    color: rgba(245, 243, 238, 0.7);
  }
}

.cards {
  display: flex;
  flex-direction: column;
  gap: 20px;
  align-items: center;
  width: 100%;
  max-width: 1000px;

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
  max-width: 380px;
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
    padding: 28px 24px;
  }
}

.plan-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 0 6px;
}

.badge {
  background: var(--ln-accent);
  color: white;
  @include text-xs(600);
  padding: 3px 10px;
  border-radius: 20px;
  white-space: nowrap;
}

.plan-name {
  font-family: var(--heading-font-family);
  font-size: 20px;
  font-weight: 700;
  color: var(--ln-white);
  margin: 0;
}

.plan-desc {
  @include text-caption;
  color: var(--ln-muted);
  margin: 0 0 20px;
}

.price-wrap {
  margin-bottom: 24px;
}

.price {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.amount {
  font-size: 32px;
  font-weight: 700;

  @media (min-width: 480px) {
    font-size: 36px;
  }
  font-family: var(--heading-font-family);
  color: var(--ln-white);
  line-height: 1;
}

.period {
  @include text-caption;
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

  &-inherited {
    color: rgba(245, 243, 238, 0.5);

    .check-icon {
      color: rgba(229, 90, 37, 0.5);
    }
  }
}

.check-icon {
  color: var(--ln-accent);
  flex-shrink: 0;
  margin-top: 1px;
}

.action {
  width: 100%;
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
